// Credential diagnostic only: no messages sent, no patient input or database writes.
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
    const names = ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY_SID', 'TWILIO_API_KEY_SECRET', 'TWILIO_AUTH_TOKEN'];
    const values = names.map(name => Deno.env.get(name)?.trim() || '');
    const missing = names.filter((_, i) => !values[i]);
    if (missing.length) return json({ configured: false, missing }, 503);
    const [account, keySid, secret, authToken] = values;
    if (!/^AC[0-9a-f]{32}$/i.test(account) || !/^SK[0-9a-f]{32}$/i.test(keySid)) {
      return json({ configured: true, connected: false, error: 'Account SID must start AC and API Key SID must start SK, each with 32 hexadecimal characters' }, 422);
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
