import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"
import { gatewayCall } from "@/lib/gateway"
import { notifyAdmins } from "@/lib/notifications"
import { createGitHubIssue, buildIssueBody } from "@/lib/github"

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

    // Get client profile
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
      camera_id,
      location_current,
      location_requested,
      issue_type,
      urgency,
      description,
      attachments,
    } = body as {
      project_id: number
      request_type: string
      camera_id?: string
      location_current?: string
      location_requested?: string
      issue_type?: string
      urgency: string
      description: string
      attachments?: unknown[]
    }

    // Validate required fields
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

    // Verify project access — viewer access is enough for camera requests
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

    // Get project name for VTiger case title
    const { data: project } = await adminClient
      .from("client_projects")
      .select("name")
      .eq("id", project_id)
      .single()

    const projectName: string = project?.name || `Project ${project_id}`

    // Insert camera_requests row
    const { data: cameraRequest, error: insertError } = await adminClient
      .from("camera_requests")
      .insert({
        project_id,
        client_id: profile.id,
        request_type,
        camera_id: camera_id || null,
        location_current: location_current || null,
        location_requested: location_requested || null,
        issue_type: issue_type || null,
        urgency,
        description,
        attachments: attachments || null,
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

    const requestId: string = cameraRequest.id

    // VTiger integration — urgent/high only, write-first, 2 calls max
    let vtigerCaseNo: string | null = null
    const isUrgent = urgency === "urgent" || urgency === "high"

    if (isUrgent) {
      try {
        const caseTitle = `Camera ${request_type.toUpperCase()} Request — ${projectName}`

        const newCase = await gatewayCall<{ case_no?: string; vtiger_id?: string }>({
          method: "POST",
          path: "/api/vtiger/cases",
          body: {
            title: caseTitle,
            category: "camera_request",
            project_id,
            description: `${request_type} camera request (${urgency} urgency). ${description}. Portal request ID: ${requestId}`,
            priority: urgency === "urgent" ? "Urgent" : "High",
          },
        })

        // Log the VTiger call
        await adminClient.from("vtiger_api_log").insert({
          operation: "POST",
          endpoint: "/api/vtiger/cases",
          request_payload: { title: caseTitle, project_id, urgency },
          response_payload: newCase,
          success: true,
          camera_request_id: requestId,
        })

        vtigerCaseNo = newCase.case_no || null

        // Update request with VTiger case reference
        await adminClient
          .from("camera_requests")
          .update({
            vtiger_case_no: vtigerCaseNo,
            request_status: "submitted",
          })
          .eq("id", requestId)
      } catch (vtigerErr) {
        const errMessage =
          vtigerErr instanceof Error ? vtigerErr.message : String(vtigerErr)
        console.warn("[cameras/route] VTiger call failed:", errMessage)

        // Log the failure
        try {
          await adminClient.from("vtiger_api_log").insert({
            operation: "POST",
            endpoint: "/api/vtiger/cases",
            request_payload: { project_id, urgency, request_type },
            response_payload: { error: errMessage },
            success: false,
            camera_request_id: requestId,
          })
        } catch {
          // vtiger_api_log insert failure — don't surface
        }

        // Mark for batch sync
        await adminClient
          .from("camera_requests")
          .update({ request_status: "pending_vtiger_sync" })
          .eq("id", requestId)
      }
    }

    // GitHub issue — for issue-type requests at urgent/high urgency
    if (request_type === "issue" && isUrgent) {
      try {
        const issueTitle = `[Camera Issue] ${projectName} — ${issue_type || "Issue"} (${urgency})`
        const issueBody = buildIssueBody({
          requestId,
          requestType: request_type,
          projectName,
          projectId: project_id,
          description,
          urgency,
          vtigerCaseNo,
          extraFields: {
            "Location": location_current || location_requested || null,
            "Issue Type": issue_type || null,
          },
        })
        const ghIssue = await createGitHubIssue({
          title: issueTitle,
          body: issueBody,
          labels: ["bug", "client-report", "camera"],
        })
        await adminClient
          .from("camera_requests")
          .update({
            github_issue_no: ghIssue.number,
            github_issue_url: ghIssue.html_url,
          })
          .eq("id", requestId)
      } catch (ghErr) {
        // Non-blocking — log but don't fail the request
        console.warn("[cameras/route] GitHub issue creation failed:", ghErr instanceof Error ? ghErr.message : ghErr)
      }
    }

    // Notify admins (non-blocking)
    notifyAdmins({
      project_id,
      type: "case_update",
      title: `Camera ${request_type} request — ${urgency} urgency`,
      message: `${profile.display_name} submitted a ${request_type} camera request for ${projectName}. Urgency: ${urgency}.`,
      action_url: `/admin/cameras`,
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

    // Scope to projects the client has access to
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
      .from("camera_requests")
      .select(
        "id, project_id, request_type, camera_id, location_current, location_requested, issue_type, urgency, description, request_status, vtiger_case_no, github_issue_no, github_issue_url, created_at"
      )
      .in("project_id", accessibleProjectIds)
      .order("created_at", { ascending: false })

    if (projectIdParam) {
      query = query.eq("project_id", parseInt(projectIdParam, 10))
    }

    const { data: cameraRequests, error } = await query

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch camera requests: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(cameraRequests || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
