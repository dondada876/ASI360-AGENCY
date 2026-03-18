import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /auth/callback
 * Exchanges a Supabase auth code for a session, then redirects to `next`.
 * Used by the password reset flow: email link → /auth/callback?code=XXX&next=/reset-password
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = searchParams.get("next") ?? "/"

  const supabase = await createClient()

  if (tokenHash && type) {
    // Password reset flow: verify token_hash without exposing Supabase URL
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "recovery",
    })
  } else if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
