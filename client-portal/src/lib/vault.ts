/**
 * Supabase Vault — Runtime secret loader.
 *
 * The ONLY env vars this app needs on disk are:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   (for client-side auth)
 *   SUPABASE_SERVICE_KEY            (for server-side admin)
 *
 * Everything else (gateway keys, Twilio, Stripe, etc.) comes from
 * Supabase Vault via the public.get_secrets() SECURITY DEFINER RPC.
 *
 * NEVER import this in client components — server-side only.
 */

import { createClient } from "@supabase/supabase-js"

// ── Singleton service-role client (no cookies needed) ────────

let _adminClient: ReturnType<typeof createClient> | null = null

function getAdminClient() {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — " +
          "these are the only two bootstrap env vars required."
      )
    }
    _adminClient = createClient(url, key)
  }
  return _adminClient
}

// ── In-memory cache ──────────────────────────────────────────

const secretCache: Record<string, { value: string; expiresAt: number }> = {}
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ── Public API ───────────────────────────────────────────────

/**
 * Fetch one or more secrets from Supabase Vault.
 * Results are cached in memory for 5 minutes.
 *
 * @example
 *   const secrets = await loadSecrets(['gateway_api_key', 'stripe_secret_key'])
 *   const gatewayKey = secrets.gateway_api_key
 */
export async function loadSecrets(
  names: string[]
): Promise<Record<string, string>> {
  const now = Date.now()
  const result: Record<string, string> = {}
  const missing: string[] = []

  // Check cache first
  for (const name of names) {
    const cached = secretCache[name]
    if (cached && cached.expiresAt > now) {
      result[name] = cached.value
    } else {
      missing.push(name)
    }
  }

  // All cached? Return immediately.
  if (missing.length === 0) return result

  // Fetch missing from Vault via SECURITY DEFINER RPC
  const sb = getAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)("get_secrets", {
    secret_names: missing,
  })

  if (error) {
    throw new Error(`Vault RPC failed: ${error.message}`)
  }

  if (data) {
    for (const row of data as { name: string; secret: string }[]) {
      result[row.name] = row.secret
      secretCache[row.name] = {
        value: row.secret,
        expiresAt: now + CACHE_TTL_MS,
      }
    }
  }

  return result
}

/**
 * Fetch a single secret by name. Convenience wrapper.
 *
 * @example
 *   const key = await getSecret('gateway_api_key')
 */
export async function getSecret(name: string): Promise<string | undefined> {
  const secrets = await loadSecrets([name])
  return secrets[name]
}

/**
 * Clear the in-memory cache (useful for testing or forced refresh).
 */
export function clearSecretCache(): void {
  for (const key of Object.keys(secretCache)) {
    delete secretCache[key]
  }
}

/**
 * Get the admin (service-role) Supabase client for server-side
 * operations that need to bypass RLS. No cookies.
 */
export function getServiceClient() {
  return getAdminClient()
}
