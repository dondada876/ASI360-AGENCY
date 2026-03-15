import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
      .select("id, display_name")
      .eq("user_id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: "No client profile found" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { project_id, content, task_id } = body

    if (!project_id || !content) {
      return NextResponse.json(
        { error: "project_id and content are required" },
        { status: 400 }
      )
    }

    // Verify the client has access to this project (RLS will filter)
    const { data: access } = await supabase
      .from("client_project_access")
      .select("id, access_level")
      .eq("project_id", project_id)
      .eq("client_id", profile.id)
      .single()

    if (!access) {
      return NextResponse.json(
        { error: "Project not found or not accessible" },
        { status: 404 }
      )
    }

    // Only commenter and above can post comments
    if (access.access_level === "viewer") {
      return NextResponse.json(
        { error: "Viewer access does not allow comments" },
        { status: 403 }
      )
    }

    // Insert the comment (author_id references auth.users, not client_profiles)
    const { data: comment, error: insertErr } = await supabase
      .from("project_comments")
      .insert({
        project_id,
        task_id: task_id || null,
        author_id: user.id,
        author_name: profile.display_name,
        author_role: "client",
        content,
        visibility: "external",
      })
      .select("id")
      .single()

    if (insertErr) {
      return NextResponse.json(
        { error: `Failed to post comment: ${insertErr.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { id: comment.id, success: true },
      { status: 201 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
