# WhatsApp connection handshake

Deployed development URL: https://gylnitduoasmybadblcp.supabase.co/functions/v1/whatsapp-inbound

In Twilio Try out WhatsApp, choose Receive a message, Custom auto-reply, paste this exact URL and save. Use POST if a method is requested. Send HELLO WHOLECARE from the joined phone. A valid first receipt returns a fixed TwiML connection acknowledgement. No care tasks change; no phone numbers, raw bodies or media are stored. This is a connectivity handshake, not the reminder/conversation workflow.

Gateway JWT checking is off because Twilio uses X-Twilio-Signature instead. The official pinned Twilio SDK validates the signature against the fixed external URL and all submitted parameters. Requests must match TWILIO_ACCOUNT_SID and WhatsApp address syntax. No query parameters are accepted. The handler reads TWILIO_AUTH_TOKEN and the Supabase service key only within the backend. Do not paste any credentials in Twilio's webhook URL.

Technical receipts are in public.whatsapp_webhook_receipts, denied to anon/authenticated and writable only with service_role. MessageSid is the unique retry key; repeated delivery returns empty TwiML. Receipt insertion and the TwiML response are not an exactly-once delivery guarantee: if the first response is lost, a retry is acknowledged without repeating the reply. Operational message delivery reconciliation is still pending. No patient linkage, clinical interpretation or care-loop updates are implemented here.

Live negative checks passed: GET 405; missing signature 403; invalid signature 403. A real signed incoming message is required to complete the positive test. Security advisor's no-policy INFO is intentional for this backend-only receipt table. Leaked-password-protection WARN predates this change.
