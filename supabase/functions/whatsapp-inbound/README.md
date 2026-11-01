# WhatsApp trial receiving handshake

Deployed URL: https://gylnitduoasmybadblcp.supabase.co/functions/v1/whatsapp-inbound

In Twilio Try out WhatsApp, choose Receive a message, Custom auto-reply, paste this exact URL and save. Use POST if asked. Send HELLO WHOLECARE from the joined phone. Incoming messages are acknowledged HTTP 204; no automatic outgoing reply is attempted. The newer trial does not support direct TwiML XML responses. Sending requires a separate REST Messages API request with a Twilio-provided approved ContentSid from the trial UI. See https://www.twilio.com/docs/usage/trials/try-out-whatsapp .

Gateway JWT verification is off because Twilio uses X-Twilio-Signature. The pinned official Twilio SDK checks all form parameters against the fixed external URL. Requests must match TWILIO_ACCOUNT_SID and WhatsApp address syntax, with no query parameters. TWILIO_AUTH_TOKEN and Supabase service credentials stay server-side.

Technical receipts are stored in public.whatsapp_webhook_receipts, denied to anon/authenticated. Only message SID, receipt time, and hello/other classification are stored; no phone numbers, raw bodies, media or patient linkage. The unique MessageSid suppresses duplicate receipts. No care task changes, clinical interpretation, or conversation workflow is implemented. Receipt tracking is not proof of outbound delivery.

Verified: GET 405; missing signature 403; invalid signature 403. The real HELLO WHOLECARE message on 2026-11-01 at 23:03 UTC passed signature verification, was stored and received HTTP 200 from v1. Its TwiML reply was unsupported by the new trial, so v2 now acknowledges HTTP 204 only. No outbound REST message has been sent by WholeCare. Security advisor's no-policy INFO is intentional for this backend-only table; leaked-password-protection WARN predates this change.
