import { NextResponse } from 'next/server'

// MODULAR: Agent ID per location. Default: 500GL Lake Merritt agent.
// When TT-992 (multi-location) executes, this comes from locations table.

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://gtfffxwfgcxiiauliynd.supabase.co'
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''

  // Fetch ElevenLabs credentials from Vault
  const vaultRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_secrets`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ secret_names: ['elevenlabs_api_key', 'elevenlabs_agent_id'] }),
  })

  if (!vaultRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
  }

  const secrets = await vaultRes.json()
  const apiKey = secrets.elevenlabs_api_key
  const agentId = secrets.elevenlabs_agent_id

  if (!apiKey || !agentId) {
    return NextResponse.json({ error: 'Missing ElevenLabs credentials' }, { status: 500 })
  }

  // Get signed URL from ElevenLabs for secure client-side conversation
  try {
    const signedUrlRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        headers: { 'xi-api-key': apiKey },
      }
    )

    if (!signedUrlRes.ok) {
      const errText = await signedUrlRes.text()
      console.error('ElevenLabs signed URL error:', errText)
      // Fall back to returning agent ID directly (less secure but works)
      return NextResponse.json({ agentId, mode: 'direct' })
    }

    const { signed_url } = await signedUrlRes.json()
    return NextResponse.json({ signedUrl: signed_url, agentId, mode: 'signed' })
  } catch (err) {
    // Fallback: return agent ID for direct connection
    console.error('ElevenLabs signed URL fetch failed:', err)
    return NextResponse.json({ agentId, mode: 'direct' })
  }
}
