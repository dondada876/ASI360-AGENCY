/**
 * Gateway API client — Server-side only.
 * All VTiger and notification calls go through the Gateway at 104.248.69.86:8443.
 * NEVER import this in client components.
 */

const GATEWAY_URL = process.env.GATEWAY_URL || "http://104.248.69.86:8443"
const GATEWAY_KEY = process.env.GATEWAY_API_KEY || ""

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
    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(GATEWAY_KEY ? { "X-Api-Key": GATEWAY_KEY } : {}),
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
