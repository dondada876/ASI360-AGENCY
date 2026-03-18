import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/vault"
import { createClient } from "@supabase/supabase-js"

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://projects.asi360.co"

/** Anon client — used only for triggering Supabase's built-in email delivery */
function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const adminClient = getServiceClient()

    // Look up client profile — silent 200 if not found (prevent enumeration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (adminClient as any)
      .from("client_profiles")
      .select("id, display_name, user_id, is_active")
      .eq("email", email)
      .single()

    if (!profile || !profile.is_active) {
      // Prevent enumeration — always return success
      return NextResponse.json({ success: true })
    }

    // Trigger Supabase's built-in password reset email (handles delivery internally)
    const anonClient = getAnonClient()
    const { error: resetError } = await anonClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${PORTAL_URL}/auth/callback?next=/reset-password`,
    })

    if (resetError) {
      console.error("[forgot-password] resetPasswordForEmail error:", resetError.message)
      // Still return 200 — don't expose internal errors
      return NextResponse.json({ success: true })
    }

    // Audit log (non-blocking)
    fetch(`${PORTAL_URL}/api/auth/audit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "password_reset_requested",
        email,
        metadata: { user_id: profile.user_id },
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[forgot-password] Error:", err)
    // Always return 200 — don't expose server errors to the client
    return NextResponse.json({ success: true })
  }
}
