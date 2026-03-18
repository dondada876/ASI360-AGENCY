import { NextRequest, NextResponse } from "next/server"
import { getServiceClient, getSecret } from "@/lib/vault"

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL || "https://projects.asi360.co"

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
      return NextResponse.json({ success: true })
    }

    // Generate a signed recovery link
    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${PORTAL_URL}/auth/callback?next=/reset-password`,
        },
      })

    if (linkError || !linkData) {
      console.error("[forgot-password] generateLink error:", linkError?.message)
      return NextResponse.json({ success: true })
    }

    const actionLink =
      (linkData as { properties?: { action_link?: string } }).properties
        ?.action_link

    if (!actionLink) {
      console.error("[forgot-password] no action_link in generateLink response")
      return NextResponse.json({ success: true })
    }

    const displayName = profile.display_name || "there"

    // Send via Resend — contact.asi360.co is the verified sending domain
    const resendKey = await getSecret("resend_api_key_asi360")
    if (!resendKey) {
      console.error("[forgot-password] resend_api_key_asi360 not in vault")
      return NextResponse.json({ success: true })
    }

    const emailText = [
      `Hi ${displayName},`,
      "",
      "We received a request to reset your ASI 360 Client Portal password.",
      "",
      "Click the link below to set a new password:",
      actionLink,
      "",
      "This link expires in 1 hour.",
      "If you didn't request this, you can safely ignore this email.",
      "",
      "— ASI 360 Team",
    ].join("\n")

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ASI 360 Portal <alerts@contact.asi360.co>",
        to: [email],
        subject: "Reset your ASI 360 Portal password",
        text: emailText,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error(`[forgot-password] Resend ${resendRes.status}: ${errBody}`)
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
    return NextResponse.json({ success: true })
  }
}
