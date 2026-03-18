import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"
import { gatewayCall } from "@/lib/gateway"
import { notifyAdmins } from "@/lib/notifications"
import { createGitHubIssue, buildIssueBody } from "@/lib/github"

export async function POST(request: NextRequest) {
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
    const {
      project_id,
      request_type,
      system_type,
      door_location,
      urgency,
      description,
    } = body as {
      project_id: number
      request_type: string
      system_type?: string
      door_location?: string
      urgency: string
      description: string
    }

    if (!project_id || !request_type || !description) {
      return NextResponse.json(
        { error: "project_id, request_type, and description are required" },
        { status: 400 }
      )
    }

    if (description.length < 10) {
      return NextResponse.json(
        { error: "description must be at least 10 characters" },
        { status: 400 }
      )
    }

    // Verify project access — viewer access is enough to submit intercom requests
    const { data: access } = await supabase
      .from("client_project_access")
      .select("access_level, project_id")
      .eq("project_id", project_id)
      .eq("client_id", profile.id)
      .single()

    if (!access) {
      return NextResponse.json(
        { error: "Access denied — no access to this project" },
        { status: 403 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    const { data: project } = await adminClient
      .from("client_projects")
      .select("name")
      .eq("id", project_id)
      .single()

    const projectName: string = project?.name || `Project ${project_id}`

    // Insert intercom_requests row
    const { data: intercomRequest, error: insertError } = await adminClient
      .from("intercom_requests")
      .insert({
        project_id,
        client_id: profile.id,
        request_type,
        system_type: system_type || null,
        door_location: door_location || null,
        urgency: urgency || "normal",
        description,
        request_status: "submitted",
      })
      .select("id")
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create request: ${insertError.message}` },
        { status: 500 }
      )
    }

    const requestId: string = intercomRequest.id

    // VTiger integration — urgent/high only, write-first, 1 call max
    let vtigerCaseNo: string | null = null
    const isUrgent = urgency === "urgent" || urgency === "high"

    if (isUrgent) {
      try {
        const caseTitle = `Intercom ${request_type.replace(/_/g, " ").toUpperCase()} — ${projectName}`

        const newCase = await gatewayCall<{ case_no?: string; vtiger_id?: string }>({
          method: "POST",
          path: "/api/vtiger/cases",
          body: {
            title: caseTitle,
            category: "intercom_request",
            project_id,
            description: `${request_type} intercom request (${urgency} urgency). ${description}. Portal request ID: ${requestId}`,
            priority: urgency === "urgent" ? "Urgent" : "High",
          },
        })

        await adminClient.from("vtiger_api_log").insert({
          operation: "POST",
          endpoint: "/api/vtiger/cases",
          request_payload: { title: caseTitle, project_id, urgency },
          response_payload: newCase,
          success: true,
          // store reference via admin_notes workaround — no dedicated FK column needed
        })

        vtigerCaseNo = newCase.case_no || null

        await adminClient
          .from("intercom_requests")
          .update({ vtiger_case_no: vtigerCaseNo, request_status: "submitted" })
          .eq("id", requestId)
      } catch (vtigerErr) {
        const errMessage =
          vtigerErr instanceof Error ? vtigerErr.message : String(vtigerErr)
        console.warn("[intercoms/route] VTiger call failed:", errMessage)

        try {
          await adminClient.from("vtiger_api_log").insert({
            operation: "POST",
            endpoint: "/api/vtiger/cases",
            request_payload: { project_id, urgency, request_type },
            response_payload: { error: errMessage },
            success: false,
          })
        } catch {
          // vtiger_api_log insert failure — don't surface
        }

        await adminClient
          .from("intercom_requests")
          .update({ request_status: "pending_vtiger_sync" })
          .eq("id", requestId)
      }
    }

    // GitHub issue — for issue-type requests at urgent/high urgency
    if (request_type === "issue" && isUrgent) {
      try {
        const issueTitle = `[Intercom Issue] ${projectName} — ${door_location || "Door Entry"} (${urgency})`
        const issueBody = buildIssueBody({
          requestId,
          requestType: request_type,
          projectName,
          projectId: project_id,
          description,
          urgency,
          vtigerCaseNo,
          extraFields: {
            "Door / Location": door_location || null,
            "System Type": system_type || null,
          },
        })
        const ghIssue = await createGitHubIssue({
          title: issueTitle,
          body: issueBody,
          labels: ["bug", "client-report", "intercom"],
        })
        await adminClient
          .from("intercom_requests")
          .update({
            github_issue_no: ghIssue.number,
            github_issue_url: ghIssue.html_url,
          })
          .eq("id", requestId)
      } catch (ghErr) {
        // Non-blocking — log but don't fail the request
        console.warn("[intercoms/route] GitHub issue creation failed:", ghErr instanceof Error ? ghErr.message : ghErr)
      }
    }

    notifyAdmins({
      project_id,
      type: "case_update",
      title: `Intercom ${request_type.replace(/_/g, " ")} request — ${urgency} urgency`,
      message: `${profile.display_name} submitted an intercom ${request_type} request for ${projectName}. Urgency: ${urgency}.`,
      action_url: `/admin/intercoms`,
      priority: isUrgent ? "high" : "normal",
    })

    return NextResponse.json(
      {
        success: true,
        request_id: requestId,
        ...(vtigerCaseNo ? { vtiger_case_no: vtigerCaseNo } : {}),
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

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
      .from("intercom_requests")
      .select(
        "id, project_id, request_type, system_type, door_location, urgency, description, request_status, vtiger_case_no, github_issue_no, github_issue_url, created_at"
      )
      .in("project_id", accessibleProjectIds)
      .order("created_at", { ascending: false })

    if (projectIdParam) {
      query = query.eq("project_id", parseInt(projectIdParam, 10))
    }

    const { data: intercomRequests, error } = await query

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch intercom requests: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(intercomRequests || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
