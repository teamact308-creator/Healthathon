# Architecture and data lifecycle

Status: 2 November 2026. Implementation baseline: `8b18bcbc3bae9f825cfdef24e31bd5e17249d420`. Read README.md for project ownership, deployed URLs and scope; the backlog and release verification distinguish implemented behavior from unfinished product requirements. This is a synthetic development system.

## Runtime and source map

The application uses vanilla browser HTML, CSS and ES modules. There is no React framework or application server in the frontend deployment. `server.mjs` serves the local preview on loopback port 4173. `build.mjs` copies an explicit allowlist of browser assets into `dist`; Vercel serves that directory. Source files, database scripts and local credentials must never become public deployment assets.

`app.js` coordinates navigation and role views. `connected-store.js` owns connected authentication/data operations and session refresh. `database-client.js` and `db-config.js` supply the browser connection. `plan-ui.js` handles the clinician plan workflow; `capture-ui.js` handles patient capture, evidence, voice and glucose import. `workflow.mjs` and `connected-model.mjs` support reference/demo behavior and local tests. Inspect the actual import graph before changing shared state: the reference model is not proof of live SQL behavior.

Supabase supplies Auth, Postgres, private Storage, Edge Functions and the scheduled database job. OpenAI receives explicitly submitted source documents/text or audio through authenticated Edge Functions. Twilio integration currently provides credential diagnostics, signed incoming technical receipts and a single reserved setup send. External care-message dispatch is not implemented.

## Identity and authorization

Users authenticate through Supabase Auth. Browser sessions are held per tab in sessionStorage, with expiry refresh. Database membership, not a role selector in the browser, authorizes patient, clinician, coordinator or caregiver actions. The UI currently chooses the first assigned patient; multi-patient navigation is pending.

Public tables have row-level security. Normal browser writes go through checked RPCs rather than direct table updates. Public SECURITY INVOKER wrappers delegate to private SECURITY DEFINER helpers with controlled search paths and actor/membership checks. Never grant broad private-schema access to authenticated users to fix an authorization error. Service-only report registration accepts a verified actor after the Edge Function authenticates and scopes the request; it must stay unavailable to browser roles.

Caregiver access is deliberately narrower than clinical team access. Consent grants support participation; it does not expose all clinical files. The project is constrained to fictional patients and synthetic glucose observations. Removing those checks is a product/security decision, not an onboarding fix.

## Clinician instruction to patient task

1. Clinician submits typed instructions or uploads a private PDF/PNG/JPEG.
2. `plan-extract` authenticates the clinician and patient assignment, validates a submitted source and asks OpenAI for structured proposals. It stores extraction provenance and warnings. It does not activate tasks.
3. Clinician checks excerpts, action labels, domain, timezone, cadence, dates and times. Missing instructions require human completion. A proposed plan can be saved without generating occurrences.
4. Explicit confirmation saves the reviewed form and activates it atomically. Only one confirmed plan per patient is active.
5. The database creates occurrences and periodically extends the future horizon. A new confirmed revision retires prior outstanding DUE/UNCONFIRMED occurrences; completed history and pending evidence review remain available.

A superseded plan remains historically confirmed with active=false. Rejection marks a plan cancelled. Do not equate confirmation history with current activation. Do not create a second scheduling engine in the frontend or Edge Functions.

## Occurrences and state transitions

A care loop represents a scheduled occurrence, not the reusable care-plan item. States are DUE, UNCONFIRMED, REVIEW_PENDING, CLOSED and CANCELLED. CLOSED requires a closure timestamp. Closed/cancelled loops have no next owner. UNCONFIRMED records unresolved completion; it is not a medical inference that a dose was missed.

Patient medication statuses include taken, missed, delayed and skipped_by_instruction. Meal capture and monitoring availability have their own allowed statuses. Completion statuses close applicable loops; other medication reports preserve unresolved follow-up. Monitoring availability confirmation requires a recent stored observation. Patient evidence submission creates REVIEW_PENDING; clinician review closes it. The patient cannot replace that review step.

Capture records actual activity time separately from entry time. The UI defaults to now and requires a timestamp; the backend allows a bounded recent past and rejects sufficiently future values. UUID event keys suppress duplicate submissions. Do not generate a new event key for each retry of the same action.

Rescheduling is available for outstanding occurrences to assigned clinician/coordinator; cancellation is clinician-only. Both require reasons. Original `scheduled_for` identity is preserved when due time changes, so generation does not recreate the original occurrence. Prior pending reminders/support tasks are retired by control actions. Legacy reopen exists for demonstrations; it is not a generic production workflow for every retired plan.

## Scheduling and reminders

Schedules support once or daily recurrence, one to four explicit daily times, explicit timezone and a bounded period up to a year. A once schedule has one time and matching start/end dates. The rolling horizon reaches local current date plus 14 days. Generation is bounded and protected against duplicate occurrences.

`wholecare-plan-scheduler` runs every five minutes in Postgres. Current defaults queue a reminder 30 minutes after due time, outside 20:00–09:00 quiet hours, and respect patient reminder preference. One automated reminder is queued per occurrence. These are development defaults, not a completed configurable clinical escalation policy.

The outbox is an intent/history record. `pending` does not mean delivered. Legacy reminders may be `simulated`. No care-message dispatcher, delivery callbacks, retry/dead-letter worker or automatic SMS fallback exists. An available Twilio account does not make the care workflow connected.

## File and observation lifecycle

Four private buckets hold plan documents, report evidence, meal photos and voice notes. Access is based on patient assignment and purpose. Report submission validates file signature, patient/task binding and SHA-256 content identity server-side before registering evidence. This prevents a duplicate report from being treated as a new independent submission. Signed original-file links are temporary access tools, not public permanent URLs.

Glucose import accepts timestamped synthetic mg/dL observations with source identity. Duplicate identity is patient + source_id + observed_at. Charts are neutral displays, without target bands, dose advice or diagnostic interpretation. Current reads are bounded (up to 2,000 observations, 200 care events and bounded audit/plan histories); pagination and continuous streaming are pending.

Voice transcription returns editable text. The user chooses the task/status and confirms. There is no automatic intent-to-medication mutation, microphone recorder, spoken response or WhatsApp media pipeline.

Storage MIME checks are not antivirus scanning. Abandoned uploads can remain private; automated cleanup, retention, deletion/export and full malware handling are unfinished.

## Failure boundaries and growth path

Manual care-plan entry remains useful if extraction fails. A voice failure must leave the task unchanged. Failed report validation must not close a task. An uncertain provider send must not be blindly retried: the setup sender reserves its one permitted attempt before contacting Twilio. Database transactions and idempotency are the primary protection against double actions; browser disabling alone is insufficient.

Before real use, finish enrollment and multi-patient controls, agreed recurrence/escalation policies, reliable task-linked delivery, privacy/retention operations, monitoring and restore drills. Reconcile migration history and prove a clean environment rebuild. See SETUP_AND_OPERATIONS.md before running database scripts.

## Operations increment

`operations-model.mjs` calculates transparent current-state measures; `operations-ui.js` renders source-linked review and human intake. `operational_snapshot` scopes full-period data to the assigned care team rather than deriving metrics from recent feed limits. Intake registration is separate from care state, and an evidence trigger prevents stale association from binding to the wrong task. `messaging-core.mjs` and private transport tables/functions are disabled delivery foundations, not a running channel worker. See bucket-1-delivery.md for exact limitations.
