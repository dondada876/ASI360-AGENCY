import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"
import { createCase } from "@/lib/gateway"
import { notifyAdmins } from "@/lib/notifications"

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
      .select("id, display_name, company_name, vtiger_contact_id")
      .eq("user_id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: "No client profile found" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { title, description, category, priority, project_id } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      )
    }

    // Try to create case via Gateway → VTiger
    let caseNo: string
    let vtigerId: string | null = null
    let syncStatus: "synced" | "pending_sync" = "synced"

    try {
      const gatewayResult = await createCase({
        title,
        description,
        category: category || "general",
        priority: priority || "Normal",
        contact_id: profile.vtiger_contact_id || undefined,
        contact_name: profile.display_name,
        organization: profile.company_name || undefined,
      })

      caseNo = gatewayResult.case_no || `CC-${Date.now()}`
      vtigerId = gatewayResult.vtiger_id || null
    } catch {
      // Gateway/VTiger is down — fallback to pending sync
      caseNo = `PENDING-${Date.now()}`
      syncStatus = "pending_sync"
      console.warn("[cases/route] Gateway unavailable — using fallback pending_sync")
    }

    // Use service client for writes (bypasses RLS — API route validates permissions above)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    // Write to Supabase cache
    const { data: newCase, error: insertError } = await adminClient
      .from("vtiger_cases_cache")
      .insert({
        case_no: caseNo,
        vtiger_id: vtigerId,
        project_id: project_id || null,
        client_id: profile.id,
        contact_name: profile.display_name,
        organization_name: profile.company_name,
        title,
        description,
        category: category || "general",
        priority: priority || "Normal",
        status: "Open",
        sync_status: syncStatus,
      })
      .select("id, case_no")
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save case: ${insertError.message}` },
        { status: 500 }
      )
    }

    // Log the creation activity
    await adminClient.from("case_activity_log").insert({
      case_no: newCase.case_no,
      author_name: profile.display_name,
      author_role: "client",
      action: "comment",
      content: "Case created",
      is_internal: false,
    })

    // Notify admins of new case (non-blocking)
    notifyAdmins({
      case_no: newCase.case_no,
      project_id: project_id || null,
      type: "case_update",
      title: `New case: ${title}`,
      message: `${profile.display_name} created case ${newCase.case_no} — ${priority || "Normal"} priority`,
      action_url: `/admin/cases`,
      priority: priority === "Urgent" || priority === "High" ? "high" : "normal",
    })

    return NextResponse.json(
      {
        id: newCase.id,
        case_no: newCase.case_no,
        sync_status: syncStatus,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
