import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/vault"

/**
 * POST /api/auth/audit — Server-side audit log entry
 * Captures IP address and user-agent from the request headers
 * (not available in client-side components)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_type, email, metadata, session_id } = body

    // Extract IP and user-agent from request
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // For authenticated events, get user from session
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Use service client for writes (bypasses RLS)
    const adminClient = getServiceClient()

    const now = new Date().toISOString()

    // Build the audit record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const record: Record<string, any> = {
      user_id: user?.id || null,
      email: email || user?.email || null,
      event_type,
      ip_address: ip === "unknown" ? null : ip,
      user_agent: userAgent,
      metadata: {
        ...metadata,
        timestamp: now,
      },
      created_at: now,
    }

    // Session tracking
    if (session_id) {
      record.session_id = session_id
    }

    if (event_type === "login_success" && session_id) {
      record.session_started_at = now
    }

    if (event_type === "logout" && session_id) {
      record.session_ended_at = now

      // Calculate session duration from the login event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: loginEvent } = await (adminClient as any)
        .from("auth_audit_log")
        .select("session_started_at")
        .eq("session_id", session_id)
        .eq("event_type", "login_success")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (loginEvent?.session_started_at) {
        const startTime = new Date(loginEvent.session_started_at).getTime()
        const endTime = new Date(now).getTime()
        record.session_duration_seconds = Math.round(
          (endTime - startTime) / 1000
        )

        // Also update the original login record with session end time + duration
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminClient as any)
          .from("auth_audit_log")
          .update({
            session_ended_at: now,
            session_duration_seconds: record.session_duration_seconds,
          })
          .eq("session_id", session_id)
          .eq("event_type", "login_success")
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient as any)
      .from("auth_audit_log")
      .insert(record)

    if (error) {
      console.error("[audit] Failed to write audit log:", error.message)
      // Don't fail the request — audit is non-critical
      return NextResponse.json({ logged: false, reason: error.message })
    }

    return NextResponse.json({ logged: true, session_id })
  } catch (err) {
    console.error("[audit] Error:", err)
    return NextResponse.json({ logged: false })
  }
}
