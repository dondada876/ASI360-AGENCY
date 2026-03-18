import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"
import { gatewayCall } from "@/lib/gateway"
import { notifyAdmins } from "@/lib/notifications"

interface CredentialEntry {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  role_title?: string
  entry_method: string
  access_schedule?: string
  access_zones?: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get client profile (RLS-filtered — user can only read own profile)
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("id, display_name, company_name")
      .eq("user_id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: "No client profile found" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { project_id, entries } = body as {
      project_id: number
      entries: CredentialEntry[]
    }

    // Validate required fields
    if (!project_id) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      )
    }

    if (!Array.isArray(entries) || entries.length < 1 || entries.length > 50) {
      return NextResponse.json(
        { error: "entries must be an array of 1–50 items" },
        { status: 400 }
      )
    }

    // Verify project access — commenter or admin required
    const { data: access } = await supabase
      .from("client_project_access")
      .select("access_level")
      .eq("project_id", project_id)
      .eq("client_id", profile.id)
      .in("access_level", ["commenter", "admin"])
      .single()

    if (!access) {
      return NextResponse.json(
        { error: "Access denied — commenter or admin role required" },
        { status: 403 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    // Create credential_submission row (service role, bypasses RLS)
    const { data: submission, error: submissionError } = await adminClient
      .from("credential_submissions")
      .insert({
        project_id,
        client_id: profile.id,
        submitted_by_name: profile.display_name,
        entry_count: entries.length,
        submission_status: "pending",
      })
      .select("id")
      .single()

    if (submissionError) {
      return NextResponse.json(
        { error: `Failed to create submission: ${submissionError.message}` },
        { status: 500 }
      )
    }

    const submissionId: string = submission.id

    // Bulk insert credential_entries linked to this submission
    const entryRows = entries.map((e) => ({
      submission_id: submissionId,
      project_id,
      first_name: e.first_name,
      last_name: e.last_name,
      email: e.email || null,
      phone: e.phone || null,
      role_title: e.role_title || null,
      entry_method: e.entry_method,
      access_schedule: e.access_schedule || null,
      access_zones: e.access_zones || null,
      notes: e.notes || null,
    }))

    const { error: entriesError } = await adminClient
      .from("credential_entries")
      .insert(entryRows)

    if (entriesError) {
      return NextResponse.json(
        { error: `Failed to insert entries: ${entriesError.message}` },
        { status: 500 }
      )
    }

    // VTiger integration — write-first, 2 calls max
    let caseNo: string | null = null
    let submissionStatus = "processing"

    try {
      // Call 1: check for existing open access_control case for this project
      const existingCases = await gatewayCall<{
        records?: Array<{ case_no: string }>
        case_no?: string
      }>({
        method: "GET",
        path: `/api/vtiger/cases?project_id=${project_id}&status=Open&category=access_control`,
      })

      // Log this GET attempt
      await adminClient.from("vtiger_api_log").insert({
        operation: "GET",
        endpoint: `/api/vtiger/cases`,
        request_payload: { project_id, status: "Open", category: "access_control" },
        response_payload: existingCases,
        success: true,
        submission_id: submissionId,
      })

      // Reuse existing case if found
      const existingList = Array.isArray(existingCases?.records)
        ? existingCases.records
        : []
      if (existingList.length > 0) {
        caseNo = existingList[0].case_no
      } else {
        // Call 2: create a new VTiger case
        const newCase = await gatewayCall<{ case_no?: string; vtiger_id?: string }>({
          method: "POST",
          path: "/api/vtiger/cases",
          body: {
            title: `Access Control Credential Intake — ${entries.length} staff`,
            category: "access_control",
            project_id,
            description: `${entries.length} staff credentials submitted via portal. See submission ID: ${submissionId}. No PII in this case.`,
            priority: "Normal",
          },
        })

        // Log the POST
        await adminClient.from("vtiger_api_log").insert({
          operation: "POST",
          endpoint: "/api/vtiger/cases",
          request_payload: {
            title: `Access Control Credential Intake — ${entries.length} staff`,
            category: "access_control",
            project_id,
          },
          response_payload: newCase,
          success: true,
          submission_id: submissionId,
        })

        caseNo = newCase.case_no || null
      }
    } catch (vtigerErr) {
      const errMessage =
        vtigerErr instanceof Error ? vtigerErr.message : String(vtigerErr)
      console.warn("[credentials/route] VTiger call failed:", errMessage)

      // Log the failure
      try {
        await adminClient.from("vtiger_api_log").insert({
          operation: "POST",
          endpoint: "/api/vtiger/cases",
          request_payload: { project_id, entry_count: entries.length },
          response_payload: { error: errMessage },
          success: false,
          submission_id: submissionId,
        })
      } catch {
        // vtiger_api_log insert failed — don't surface this
      }

      submissionStatus = "pending_vtiger_sync"
    }

    // Update submission with vtiger_case_no and final status
    await adminClient
      .from("credential_submissions")
      .update({
        vtiger_case_no: caseNo,
        submission_status: submissionStatus,
      })
      .eq("id", submissionId)

    // Notify admins (non-blocking)
    notifyAdmins({
      project_id,
      type: "case_update",
      title: `Credential intake — ${entries.length} staff`,
      message: `${profile.display_name} submitted ${entries.length} staff credential${entries.length === 1 ? "" : "s"} for project ${project_id}. Submission ID: ${submissionId}`,
      action_url: `/admin/credentials`,
      priority: "normal",
    })

    return NextResponse.json(
      {
        success: true,
        submission_id: submissionId,
        case_no: caseNo,
        entry_count: entries.length,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: "No client profile found" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const projectIdParam = searchParams.get("project_id")

    // Build query — RLS on client_project_access gates visibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    // Only return submissions for projects the client has access to
    const { data: accessible } = await supabase
      .from("client_project_access")
      .select("project_id")
      .eq("client_id", profile.id)

    const accessibleProjectIds = (accessible || []).map(
      (r: { project_id: number }) => r.project_id
    )

    if (accessibleProjectIds.length === 0) {
      return NextResponse.json([])
    }

    let query = adminClient
      .from("credential_submissions")
      .select(
        "id, project_id, submitted_by_name, entry_count, submission_status, vtiger_case_no, created_at"
      )
      .in("project_id", accessibleProjectIds)
      .order("created_at", { ascending: false })

    if (projectIdParam) {
      query = query.eq("project_id", parseInt(projectIdParam, 10))
    }

    const { data: submissions, error } = await query

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch submissions: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(submissions || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
