// Connection diagnostic only: no patient input, generation, transcription or database writes.
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sign-in required' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  let publicKey = Deno.env.get('SUPABASE_ANON_KEY');
  try { publicKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || publicKey; } catch {}
  if (!url || !publicKey) return json({ error: 'Backend authentication is not configured' }, 503);
  const headers = { apikey: publicKey, Authorization: authorization, 'Content-Type': 'application/json' };
  try {
    // Ask Auth to verify the token; never trust decoded claims supplied by a caller.
    const user = await fetch(`${url}/auth/v1/user`, { headers, signal: AbortSignal.timeout(10000) });
    if (!user.ok) return json({ error: 'Valid sign-in required' }, 401);
    const contextResponse = await fetch(`${url}/rest/v1/rpc/my_context`, {
      method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(10000),
    });
    if (!contextResponse.ok) return json({ error: 'Unable to verify care-team role' }, 403);
    const context = await contextResponse.json();
    if (!context?.memberships?.some((m: { role?: string }) => m.role === 'clinician')) {
      return json({ error: 'Assigned clinician access required' }, 403);
    }
    const key = Deno.env.get('OPENAI_API_KEY')?.trim();
    if (!key) return json({ configured: false, error: 'OPENAI_API_KEY is not configured' }, 503);
    // List models verifies key/network access without a token-generating request.
    const upstream = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) {
      // Deliberately omit upstream bodies: diagnostics must never echo secrets or account data.
      return json({ configured: true, connected: false, upstream_status: upstream.status,
        error: upstream.status === 401 ? 'OpenAI rejected the configured key' : upstream.status === 403 ? 'The key does not have permission for this diagnostic' : 'OpenAI connection check failed' }, 502);
    }
    await upstream.body?.cancel();
    return json({ configured: true, connected: true, check: 'models.list',
      generation_tested: false, transcription_tested: false, patient_data_sent: false });
  } catch {
    return json({ error: 'Connection check timed out or the provider is unreachable' }, 504);
  }
});
