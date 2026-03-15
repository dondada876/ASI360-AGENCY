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
    const { case_no, content } = body

    if (!case_no || !content) {
      return NextResponse.json(
        { error: "case_no and content are required" },
        { status: 400 }
      )
    }

    // Verify the client owns this case (RLS will filter, but be explicit)
    const { data: caseData } = await supabase
      .from("vtiger_cases_cache")
      .select("id, case_no, status")
      .eq("case_no", case_no)
      .single()

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    // Don't allow replies on closed cases
    if (caseData.status === "Closed") {
      return NextResponse.json(
        { error: "Cannot reply to a closed case" },
        { status: 400 }
      )
    }

    // Insert activity log entry
    const { error: insertErr } = await supabase
      .from("case_activity_log")
      .insert({
        case_no,
        author_name: profile.display_name,
        author_role: "client",
        action: "comment",
        content,
        is_internal: false,
      })

    if (insertErr) {
      return NextResponse.json(
        { error: `Failed to post reply: ${insertErr.message}` },
        { status: 500 }
      )
    }

    // Update the case modified_at timestamp
    await supabase
      .from("vtiger_cases_cache")
      .update({ modified_at: new Date().toISOString() })
      .eq("case_no", case_no)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
