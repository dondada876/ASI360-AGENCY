import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"

// ── PATCH — update credential entry status or purge PII (admin only) ─────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin profile
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: "No client profile found" },
        { status: 403 }
      )
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin role required" },
        { status: 403 }
      )
    }

    const { id } = await params
    const entryId = id
    const body = await request.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    // Confirm the entry exists before patching
    const { data: existing, error: fetchError } = await adminClient
      .from("credential_entries")
      .select("id, submission_id")
      .eq("id", entryId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Credential entry not found" },
        { status: 404 }
      )
    }

    // PII purge path
    if (body.pii_purge === true) {
      const { error: purgeError } = await adminClient
        .from("credential_entries")
        .update({
          first_name: "[PURGED]",
          last_name: "[PURGED]",
          email: null,
          phone: null,
          role_title: null,
          pii_purged_at: new Date().toISOString(),
        })
        .eq("id", entryId)

      if (purgeError) {
        return NextResponse.json(
          { error: `PII purge failed: ${purgeError.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, pii_purged: true })
    }

    // Status update path
    const { credential_status } = body as { credential_status?: string }

    if (!credential_status) {
      return NextResponse.json(
        { error: "credential_status or pii_purge is required" },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await adminClient
      .from("credential_entries")
      .update({ credential_status })
      .eq("id", entryId)
      .select("id, credential_status")
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: `Update failed: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, entry: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── DELETE — admin only, removes entire submission + entries (cascade) ────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin profile
    const { data: profile } = await supabase
      .from("client_profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: "No client profile found" },
        { status: 403 }
      )
    }

    if (profile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin role required" },
        { status: 403 }
      )
    }

    // The [id] here is the submission_id, not an entry id
    const { id } = await params
    const submissionId = id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminClient = getServiceClient() as any

    // Confirm submission exists
    const { data: existing, error: fetchError } = await adminClient
      .from("credential_submissions")
      .select("id")
      .eq("id", submissionId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Credential submission not found" },
        { status: 404 }
      )
    }

    // Delete entries first (in case DB cascade is not set)
    const { error: entriesDeleteError } = await adminClient
      .from("credential_entries")
      .delete()
      .eq("submission_id", submissionId)

    if (entriesDeleteError) {
      return NextResponse.json(
        { error: `Failed to delete entries: ${entriesDeleteError.message}` },
        { status: 500 }
      )
    }

    // Delete the submission itself
    const { error: submissionDeleteError } = await adminClient
      .from("credential_submissions")
      .delete()
      .eq("id", submissionId)

    if (submissionDeleteError) {
      return NextResponse.json(
        { error: `Failed to delete submission: ${submissionDeleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, deleted_submission_id: submissionId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
