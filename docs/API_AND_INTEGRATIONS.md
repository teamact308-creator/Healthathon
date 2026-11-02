# API and integration reference

Snapshot: 2 November 2026, implementation baseline `8b18bcbc3bae9f825cfdef24e31bd5e17249d420`. This reference describes the development contract. SQL and function source remain authoritative for exact validation and response fields. All patient data must remain fictional.

## Calling convention

Project API: `https://gylnitduoasmybadblcp.supabase.co`. Browser requests use the public project configuration plus the authenticated user's bearer token. Public configuration is not a substitute for user authentication. Never embed the service-role key or provider keys in browser code, GitHub, Drive, screenshots or logs.

RPCs are invoked through Supabase's `/rest/v1/rpc/<name>` endpoint; use the client wrappers already in `connected-store.js`. Edge Functions use `/functions/v1/<name>`. Return shapes can include updated records or an error; handle errors before assuming that a mutation succeeded. Preserve UUID action keys across retries.

## Database RPC surface

- `my_context()` returns current user identity and memberships. Use it to choose authorized UI context.
- `caregiver_support_context(p_patient)` returns assigned caregiver identities/consent within authorized scope.
- `save_care_plan(p_patient,p_plan,p_data)` saves a proposed plan and returns its identifier. `p_plan` can represent the draft being edited. Data contains source_note, source_path, extraction_id, timezone and items. Each item includes domain, label, cadence, source_excerpt, start_date, end_date and times. Source references may be absent for manual entry.
- `confirm_care_plan(p_patient,p_plan,p_data,p_note)` atomically saves the reviewed form and activates the plan. It can report occurrences_created or already_confirmed. This is the UI confirmation path; do not save asynchronously and activate stale data.
- `review_care_plan(p_plan,p_action,p_note)` supports confirm/reject in the database contract. Preserve explicit clinician review.
- `log_care_activity(p_loop,p_status,p_details,p_event)` validates domain/status and records the patient action. Details may include note, source (web/voice), audio_path, photo_path and activity_at. It returns the affected loop. Supported status choices are constrained in SQL/UI; do not accept arbitrary client-defined completion states.
- `import_synthetic_glucose(p_patient,p_rows)` imports rows and returns inserted/duplicates counts. Rows have observed_at, value, unit and source_id. CSV timestamps require timezone-qualified ISO values; unit is mg/dL. Import is bounded to 2,000 rows. Positive numeric checks are technical validation, not clinical ranges.
- `manage_care_loop(p_loop,p_action,p_due,p_note,p_event)` accepts snooze/reschedule or cancel behavior as implemented by the `snooze`/`cancel` action values. A due time is needed for rescheduling; reasons are required. Assignment and role checks remain server-side.
- `set_reminder_preference(p_patient,p_enabled)` changes the patient's reminder setting.
- `set_caregiver_consent(p_patient,p_caregiver,p_granted,p_event_key)` changes consent with an idempotent event key. `demo_caregiver_consent` is a legacy convenience wrapper.
- `care_action(p_loop,p_action,p_event_key,p_note)` is the legacy action interface for complete/evidence/remind/support/review/reopen. New capture uses specialized endpoints. Do not bypass the verified upload flow by treating the old evidence action as proof of report integrity.
- `register_verified_report(p_actor,p_loop,p_path,p_hash,p_label,p_event)` is **service-role only**. Browser callers must use report-submit. Private generation/scheduler helpers are not authenticated-user endpoints.

Read `database/upgrade-mvp.sql` for current transaction boundaries and `database/schema.sql` for the foundation. Existing development already has these applied; this list is not an instruction to replay SQL.

## Edge Functions

### plan-extract

Authenticated, assigned clinician only. POST JSON: `{ "patient_id": "<uuid>", "source_path": "<private path, optional>", "text": "<typed instructions, optional>" }`.

Accepts a patient-prefixed private plan source or typed instructions (bounded to 20,000 characters). PDF/PNG/JPEG sources are limited to 8 MB and checked by file signature. Current extraction uses `gpt-4.1-mini-2025-04-14` with structured output, store=false, and a successful-extraction daily limit per actor. Response includes extraction id, model and proposal containing source_note, warnings and items. Extraction provenance is stored. Embedded source instructions are untrusted; extracted content must be reviewed. No plan activation, prescribing or missing schedule invention is authorized by this endpoint.

### report-submit

Authenticated assigned patient only. POST JSON: `{ "patient_id":"<uuid>", "loop_id":"<uuid>", "source_path":"<private evidence path>", "label":"<description>", "event_key":"<uuid>" }`.

Validates assignment/task state, reads the scoped file, verifies PDF/PNG/JPEG signature, hashes bytes and invokes service-only registration. Moves the applicable test task to REVIEW_PENDING. Duplicate content or invalid binding/state is rejected; a 409 can represent a binding/state conflict. It does not interpret the report or perform clinician review.

### voice-transcribe

Authenticated assigned patient/clinician only. POST JSON: `{ "patient_id":"<uuid>", "source_path":"<private voice path>", "language":"en" }` (also hi).

Accepts supported audio up to 8 MB. Uses `gpt-4o-mini-transcribe`. Response includes text, language, source_path and requires_confirmation=true. Transcription is an intermediate draft, not evidence that a medication was taken. No task changes occur here.

### openai-connection-check

Clinician only, POST `{}`. Performs a provider connectivity diagnostic. This check is separate from actual extraction/transcription success and does not itself run a generation workflow.

### twilio-connection-check

Clinician only, POST `{}`. Checks required configuration and authenticated provider access without sending a message. A successful response proves credential access, not care-message delivery or recipient enrollment.

### whatsapp-inbound

Public transport endpoint with JWT verification disabled intentionally; authenticates using Twilio's request signature, pinned SDK validation, fixed external webhook URL, expected account and WhatsApp address checks. Receives form data with `X-Twilio-Signature`, not the normal browser JSON contract. Current accepted requests record minimal technical receipts by message SID and kind; raw phone/body is not persisted as a conversation. Duplicate receipts are suppressed. Returns 204; it does not automatically reply. Do not replace signature validation with an anonymous writable endpoint.

### whatsapp-send-test

Clinician only. POST `{ "action":"status" }` reads the reserved setup test status; `{ "action":"send" }` requests the fixed server-configured recipient/template. No arbitrary destination, text or template is accepted. A durable singleton reservation is made before the provider call. The setup attempt has already been used and was delivered. Do not delete/reset it to force another send or automatically retry an uncertain result. The approved trial package-delivery template is a connectivity artifact, not a WholeCare care reminder. A queued response alone is not delivery confirmation.

## Secret names and ownership

Set provider secrets only in Supabase Edge Function secrets:

- OPENAI_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_API_KEY_SID
- TWILIO_API_KEY_SECRET
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_FROM
- TWILIO_WHATSAPP_TO
- TWILIO_WHATSAPP_CONTENT_SID

Account SID identifies an account; API-key SID identifies a key; the matching secret authenticates API-key requests. Auth token is a different credential used for webhook signature validation and relevant diagnostics. Do not interchange these values. A token shared in chat was rotated earlier; never recover it from historical conversation or copy it into examples.

Supabase supplies runtime project variables such as SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Service credentials belong only in trusted server contexts. The browser publishable key is intentionally public and still depends on RLS and user authorization.

## Outstanding integration work

WhatsApp needs approved care templates, supported sender setup, consent and patient/task mapping, delivery callbacks, retries and operational error handling. Incoming messages/media must be connected to explicit confirmed workflow actions. SMS still needs provider/routing/registration decisions. No SMS fallback currently runs. Vendor CGM and clinical systems are not connected; CSV/sample observations are the current data path.

A clone must update CORS origins and the inbound function's fixed external webhook URL as well as project configuration. Test a newly deployed endpoint with its real public URL before accepting signature checks. Do not loosen authorization to accommodate a different preview domain.

## Operations increment RPCs

- `operational_snapshot(p_patient,p_from,p_to)` — assigned clinician/coordinator only; period at most 91 elapsed days (UI offers 90 dates), JSON arrays/source records for deterministic reporting. No browser write and no clinical inference.
- `submit_intake(p_patient,p_label,p_text,p_path,p_event)` — assigned patient; note and/or patient-scoped care-evidence path; stable event key; returns intake id.
- `resolve_intake(p_intake,p_action,p_loop,p_reason)` — team match/dismiss/acknowledge; patient finish acknowledgment after verified evidence. Reason required. Matching does not change care state. Evidence trigger validates current association and resolves intake atomically.
- `record_processing_failure(p_patient,p_operation,p_code,p_event)` — scoped user, bounded allowlisted operation/code and daily volume; no raw body/exception data.
- `resolve_processing_failure(p_id)` — assigned team investigation marker, with actor/time.

Private service-only `prepare_delivery`, `claim_delivery` and `delivery_result` implement outbox-linked durable reservations and receipt handling. They are internal database functions, not public browser endpoints. Both channel gates remain disabled; no live provider worker or enrollment is provisioned. See the bucket 1 delivery record before interpreting these foundations as a connected messaging workflow.

## Completed bucket 1 additions

`operational_health(p_patient)` is assigned-clinician/coordinator only, returning sanitized scheduler execution status, channel gates, outbox/failure counts and uncertain reservations. It exposes no message content, destinations or raw SQL/provider errors. `twilio-adapter.mjs` is server-only, uses fixed Twilio endpoints, approved configured content and an injected verified-recipient resolver; it is not part of the browser build and has no scheduled sender. History reads now use stable time/id cursor paging.

## Messaging rehearsal increment — 3 November 2026

Patient Messages now rehearses task-linked replies, explicit confirmation, private report upload and unmatched notes using existing authenticated web APIs. Simulation transcript/permission/receipts are session-only; confirmed care records persist. Provider suspension blocks live testing. Server worker/callback contracts are fixture-tested but not deployed or wired to a durable service repository. Verified live enrollment, channel consent and inbound conversation/media remain pending. See [complete scope and recovery checklist](MESSAGING_REHEARSAL.md).
