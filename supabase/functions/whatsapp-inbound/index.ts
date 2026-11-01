import twilio from 'npm:twilio@5.10.4';

// Exact external URL configured in Twilio; do not trust proxy/Host headers for signatures.
const WEBHOOK_URL = 'https://gylnitduoasmybadblcp.supabase.co/functions/v1/whatsapp-inbound';
const xml = (message = '') => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${message}</Message>` : ''}</Response>`,
  { headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' } },
);
const fail = (status: number) => new Response('Request rejected', {status});

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405);
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) return fail(415);
  const signature = req.headers.get('x-twilio-signature');
  if (!signature) return fail(403);
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim();
  const account = Deno.env.get('TWILIO_ACCOUNT_SID')?.trim();
  const backend = Deno.env.get('SUPABASE_URL');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !account || !backend || !service) return fail(503);
  try {
    // Limit untrusted input before parsing. All incoming fields participate in validation.
    const reader = req.body?.getReader();
    if (!reader) return fail(400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 65536) { await reader.cancel(); return fail(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const form = new URLSearchParams(new TextDecoder().decode(bytes));
    const params: Record<string, string> = Object.create(null);
    for (const [key, value] of form) {
      if (Object.hasOwn(params, key)) return fail(400);
      params[key] = value;
    }
    if (!twilio.validateRequest(token, signature, WEBHOOK_URL, params)) return fail(403);
    if (new URL(req.url).search || params.AccountSid !== account) return fail(403);
    if (!/^SM[0-9a-f]{32}$/i.test(params.MessageSid || '') ||
        !/^whatsapp:\+[1-9][0-9]{7,14}$/.test(params.From || '') ||
        !/^whatsapp:\+[1-9][0-9]{7,14}$/.test(params.To || '')) return fail(400);
    const hello = (params.Body || '').trim().toUpperCase() === 'HELLO WHOLECARE';
    // Store receipt metadata only. No phone numbers, body, media, or clinical records.
    const saved = await fetch(`${backend}/rest/v1/whatsapp_webhook_receipts?on_conflict=message_sid`, {
      method: 'POST',
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({message_sid: params.MessageSid, kind: hello ? 'hello' : 'other'}),
      signal: AbortSignal.timeout(5000),
    });
    if (!saved.ok) return fail(503);
    const inserted = await saved.json();
    if (!Array.isArray(inserted) || inserted.length === 0) return xml();
    return xml(hello
      ? 'WholeCare demo connected. Your WhatsApp message reached our backend. No care tasks were changed. Please use fictional demo information only.'
      : 'WholeCare connection test only. Send HELLO WHOLECARE to test the connection. Care updates and clinical advice are not enabled.');
  } catch {
    // Never log request bodies, phone numbers, provider responses or credentials.
    return fail(503);
  }
});
