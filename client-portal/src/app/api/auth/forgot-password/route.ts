import { NextRequest, NextResponse } from "next/server"
import { getServiceClient, getSecret } from "@/lib/vault"

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://projects.asi360.co"

async function sendResetEmail(params: {
  to: string
  displayName: string
  actionLink: string
}) {
  const resendKey = await getSecret("resend_api_key_asi360")
  if (!resendKey) throw new Error("resend_api_key_asi360 not in vault")

  const text = [
    `Hi ${params.displayName},`,
    "",
    "We received a request to reset your ASI 360 Client Portal password.",
    "",
    "Click the link below to set a new password:",
    params.actionLink,
    "",
    "This link expires in 1 hour.",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "— ASI 360 Team",
  ].join("\n")

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ASI 360 Portal <noreply@asi360.co>",
      to: [params.to],
      subject: "Reset your ASI 360 Portal password",
      text,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend ${res.status}: ${err}`)
  }
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

    // Generate a password recovery link via admin API
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${PORTAL_URL}/auth/callback?next=/reset-password`,
        },
      })

    if (linkError) {
      console.error("[forgot-password] generateLink error:", linkError.message)
      // Still return 200 to client — don't expose internal errors
      return NextResponse.json({ success: true })
    }

    const actionLink = (linkData as { properties?: { action_link?: string } } | null)?.properties?.action_link

    const displayName = profile.display_name || "there"

    // Send email via Resend directly (non-blocking)
    sendResetEmail({
      to: email,
      displayName,
      actionLink: actionLink || `${PORTAL_URL}/forgot-password`,
    }).catch((err: unknown) => {
      console.error("[forgot-password] sendResetEmail error:", err)
    })

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
