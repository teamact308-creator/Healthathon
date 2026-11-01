// One-shot approved-template test to a server-configured recipient; no clinical data.
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
    const input = await req.json();
    if (!input || !['send','status'].includes(input.action) || Object.keys(input).some(k => k !== 'action')) return json({error:'Use action send or status only'},400);
    const names = ['TWILIO_ACCOUNT_SID','TWILIO_API_KEY_SID','TWILIO_API_KEY_SECRET','TWILIO_WHATSAPP_FROM','TWILIO_WHATSAPP_TO','TWILIO_WHATSAPP_CONTENT_SID'];
    const values = names.map(n => Deno.env.get(n)?.trim() || '');
    const missing = names.filter((_, i) => !values[i]);
    if (missing.length) return json({configured:false,missing},503);
    const [account,keySid,secret,from,to,contentSid] = values;
    const formats = [/^AC[0-9a-f]{32}$/i,/^SK[0-9a-f]{32}$/i,/^.+$/,/^whatsapp:\+[1-9][0-9]{7,14}$/,/^whatsapp:\+[1-9][0-9]{7,14}$/,/^HX[0-9a-f]{32}$/i];
    const invalid = names.filter((_,i) => !formats[i].test(values[i]));
    if (invalid.length) return json({error:'Invalid configured value format',invalid},422);
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!service) return json({error:'Backend unavailable'},503);
    const dbHeaders = {apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
    const table = `${url}/rest/v1/twilio_test_sends`;
    const testKey = 'whatsapp_trial_v1';
    const read = async () => {
      const r = await fetch(`${table}?test_key=eq.${testKey}&select=state,message_sid,provider_status,error_code`,{headers:dbHeaders,signal:AbortSignal.timeout(5000)});
      if (!r.ok) throw new Error('Storage unavailable');
      return (await r.json())[0];
    };
    const update = async (data: Record<string,unknown>) => {
      const r = await fetch(`${table}?test_key=eq.${testKey}`,{method:'PATCH',headers:dbHeaders,body:JSON.stringify(data),signal:AbortSignal.timeout(5000)});
      if (!r.ok) throw new Error('Storage unavailable');
    };
    const auth = {Authorization:`Basic ${btoa(`${keySid}:${secret}`)}`};
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${account}/Messages`;
    if (input.action === 'status') {
      const record = await read();
      if (!record) return json({state:'not_started'});
      if (record.message_sid && /^(SM|MM)[0-9a-f]{32}$/i.test(record.message_sid)) {
        const r = await fetch(`${endpoint}/${record.message_sid}.json`,{headers:auth,signal:AbortSignal.timeout(15000),redirect:'error'});
        if (!r.ok) return json({error:'Unable to retrieve Twilio status',upstream_status:r.status},502);
        const message = await r.json();
        record.provider_status = message.status;
        record.error_code = message.error_code || null;
        await update({provider_status:record.provider_status,error_code:record.error_code});
      }
      return json(record);
    }
    // One durable reservation for this setup test. Retries never create another message,
    // including after an ambiguous network timeout. This is not a general sending API.
    const claim = await fetch(`${table}?on_conflict=test_key`,{method:'POST',headers:{...dbHeaders,Prefer:'resolution=ignore-duplicates,return=representation'},
      body:JSON.stringify({test_key:testKey,actor_id:(await user.json()).id,state:'reserved'}),signal:AbortSignal.timeout(5000)});
    if (!claim.ok) return json({error:'Unable to reserve test'},503);
    if (!(await claim.json()).length) return json({duplicate_suppressed:true,...await read()});
    let upstream: Response;
    try {
      upstream = await fetch(`${endpoint}.json`,{method:'POST',headers:{...auth,'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({From:from,To:to,ContentSid:contentSid}),signal:AbortSignal.timeout(15000),redirect:'error'});
    } catch {
      await update({state:'unknown'});
      return json({state:'unknown',error:'Delivery request outcome unknown; do not retry with another test key'},504);
    }
    const result = await upstream.json();
    if (!upstream.ok) {
      await update({state:'rejected',error_code:typeof result.code === 'number' ? result.code : null});
      return json({state:'rejected',upstream_status:upstream.status,error_code:typeof result.code === 'number' ? result.code : null},502);
    }
    if (!/^(SM|MM)[0-9a-f]{32}$/i.test(result.sid || '')) {
      await update({state:'unknown'}); return json({state:'unknown'},502);
    }
    await update({state:'submitted',message_sid:result.sid,provider_status:result.status});
    return json({state:'submitted',message_sid:result.sid,provider_status:result.status,template_test_only:true});
  } catch {
    return json({ error: 'Connection check timed out or the provider is unreachable' }, 504);
  }
});
