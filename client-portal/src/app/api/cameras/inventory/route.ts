import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"

// ── POST: Admin-only — add a camera to inventory ──────────────────────────

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

    // Verify admin role
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "No client profile found" }, { status: 403 })
    }

    if (!["admin", "owner"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Forbidden — admin role required" },
        { status: 403 }
      )
    }

    // Parse body — support both JSON and form submissions
    let body: Record<string, unknown>
    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      body = await request.json()
    } else {
      // Native HTML form POST (application/x-www-form-urlencoded)
      const formData = await request.formData()
      body = Object.fromEntries(formData.entries())
    }

    const {
      project_id,
      camera_label,
      camera_model,
      location,
      nvr_channel,
      install_date,
      status,
      notes,
    } = body as {
      project_id: number | string
      camera_label: string
      camera_model?: string
      location?: string
      nvr_channel?: number | string
      install_date?: string
      status?: string
      notes?: string
    }

    // Validate required fields
    if (!project_id || !camera_label) {
      return NextResponse.json(
        { error: "project_id and camera_label are required" },
        { status: 400 }
      )
    }

    const projectIdNum =
      typeof project_id === "string" ? parseInt(project_id, 10) : project_id
    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "project_id must be a valid integer" },
        { status: 400 }
      )
    }

    if (typeof camera_label !== "string" || camera_label.trim().length === 0) {
      return NextResponse.json(
        { error: "camera_label must be a non-empty string" },
        { status: 400 }
      )
    }

    // Parse nvr_channel safely
    let nvrChannelNum: number | null = null
    if (nvr_channel !== undefined && nvr_channel !== "") {
      nvrChannelNum =
        typeof nvr_channel === "string" ? parseInt(nvr_channel, 10) : nvr_channel
      if (isNaN(nvrChannelNum)) nvrChannelNum = null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    const { data: camera, error: insertError } = await adminClient
      .from("camera_inventory")
      .insert({
        project_id: projectIdNum,
        camera_label: camera_label.trim(),
        camera_model: camera_model?.trim() || null,
        location: location?.trim() || null,
        nvr_channel: nvrChannelNum,
        install_date: install_date || null,
        status: status || "pending_install",
        notes: notes?.trim() || null,
      })
      .select(
        "id, project_id, camera_label, camera_model, location, nvr_channel, status, install_date, notes, created_at"
      )
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to add camera: ${insertError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, camera }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── GET: Fetch camera inventory for a project (client-facing) ─────────────

export async function GET(request: NextRequest) {
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

    if (!projectIdParam) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 }
      )
    }

    const projectId = parseInt(projectIdParam, 10)

    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: "project_id must be a valid integer" },
        { status: 400 }
      )
    }

    // Verify project access (any level — RLS also enforces this on the camera_inventory table)
    const { data: access } = await supabase
      .from("client_project_access")
      .select("access_level")
      .eq("project_id", projectId)
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

    // Fetch camera inventory — RLS on camera_inventory handles client visibility
    const { data: inventory, error } = await adminClient
      .from("camera_inventory")
      .select(
        "id, camera_label, camera_model, location, status, nvr_channel, install_date, project_id"
      )
      .eq("project_id", projectId)
      .order("camera_label", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch camera inventory: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(inventory || [])
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
