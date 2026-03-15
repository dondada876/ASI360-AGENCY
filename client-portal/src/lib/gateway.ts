/**
 * Gateway API client — Server-side only.
 * All VTiger and notification calls go through the Gateway at 104.248.69.86:8443.
 *
 * The Gateway API key is fetched from Supabase Vault at runtime — never from .env.
 * NEVER import this in client components.
 */

import { getSecret } from "@/lib/vault"

const GATEWAY_URL = process.env.GATEWAY_URL || "http://104.248.69.86:8443"

// Cache the key for the process lifetime (vault.ts also caches for 5 min)
let _gatewayKey: string | null = null

async function getGatewayKey(): Promise<string> {
  if (!_gatewayKey) {
    _gatewayKey = (await getSecret("gateway_api_key")) || ""
  }
  return _gatewayKey
}

interface GatewayOptions {
  method?: string
  path: string
  body?: Record<string, unknown>
  timeout?: number
}

export async function gatewayCall<T = unknown>({
  method = "GET",
  path,
  body,
  timeout = 12000,
}: GatewayOptions): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const gatewayKey = await getGatewayKey()

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(gatewayKey ? { "X-Api-Key": gatewayKey } : {}),
      },
      signal: controller.signal,
    }
    if (body) options.body = JSON.stringify(body)

    const resp = await fetch(`${GATEWAY_URL}${path}`, options)
    const data = await resp.json()

    if (!resp.ok) {
      throw new Error(
        `Gateway ${resp.status}: ${data?.detail || data?.error || JSON.stringify(data)}`
      )
    }

    return data as T
  } finally {
    clearTimeout(timer)
  }
}

// ── Case Operations ──────────────────────────────────────────

export async function createCase(params: {
  title: string
  description: string
  priority?: string
  category?: string
  contact_id?: string
  contact_name?: string
  organization?: string
}): Promise<{ case_no?: string; vtiger_id?: string; [key: string]: unknown }> {
  return gatewayCall({
    method: "POST",
    path: "/api/vtiger/cases",
    body: params,
  })
}

export async function listCases(filters?: {
  status?: string
  priority?: string
  company?: string
}) {
  const params = new URLSearchParams()
  if (filters?.status) params.set("status", filters.status)
  if (filters?.priority) params.set("priority", filters.priority)
  if (filters?.company) params.set("company", filters.company)

  const qs = params.toString() ? `?${params.toString()}` : ""
  return gatewayCall({ path: `/api/vtiger/cases${qs}` })
}

export async function updateCase(recordId: string, updates: Record<string, unknown>) {
  return gatewayCall({
    method: "PATCH",
    path: `/api/vtiger/records/${recordId}`,
    body: updates,
  })
}

export async function getCaseDetail(recordId: string) {
  return gatewayCall({
    path: `/api/vtiger/records/HelpDesk/${recordId}`,
  })
}

// ── Notification Operations ──────────────────────────────────

export async function sendNotification(params: {
  channel: string
  recipient: string
  subject: string
  message: string
}) {
  return gatewayCall({
    method: "POST",
    path: "/comm/notify",
    body: params,
  })
}

// ── Health Check ─────────────────────────────────────────────

export async function checkGatewayHealth() {
  return gatewayCall({ path: "/health", timeout: 5000 })
}
