// Credential diagnostic only: no messages sent, no patient input or database writes.
const cors = {
  'Access-Control-Allow-Origin': 'https://healthathon.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
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
    const names = ['TWILIO_PERSONAL_ACCOUNT_SID', 'TWILIO_PERSONAL_API_KEY_SID', 'TWILIO_PERSONAL_API_KEY_SECRET', 'TWILIO_PERSONAL_AUTH_TOKEN', 'TWILIO_PERSONAL_WHATSAPP_FROM', 'TWILIO_PERSONAL_WHATSAPP_TO'];
    const values = names.map(name => Deno.env.get(name)?.trim() || '');
    const missing = names.filter((_, i) => !values[i]);
    if (missing.length) return json({ configured: false, missing }, 503);
    const [account, keySid, secret, authToken, from, to] = values;
    if (!/^AC[0-9a-f]{32}$/i.test(account) || !/^SK[0-9a-f]{32}$/i.test(keySid) || from !== 'whatsapp:+14155238886' || !/^whatsapp:\+[1-9][0-9]{7,14}$/.test(to)) {
      return json({ configured: true, connected: false, error: 'Invalid Account SID, API key SID or Sandbox sender/recipient format' }, 422);
    }
    // Fixed read-only request. Discard all message records without returning or logging them.
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages.json?PageSize=1`;
    const checks: Record<string, boolean> = {};
    for (const [label, username, password] of [['api_key', keySid, secret], ['auth_token', account, authToken]]) {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` },
        signal: AbortSignal.timeout(15000), redirect: 'error',
      });
      await response.body?.cancel();
      checks[label] = response.ok;
      if (!response.ok) return json({ configured: true, connected: false, checks,
        failed_check: label, upstream_status: response.status,
        error: 'Twilio rejected the credential or its access to messaging' }, 502);
    }
    return json({ configured: true, connected: true, checks, messages_sent: 0,
      whatsapp_sender_tested: false, sms_sender_tested: false });
  } catch {
    return json({ error: 'Connection check timed out or the provider is unreachable' }, 504);
  }
});
