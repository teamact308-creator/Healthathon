# Database guide — WholeCare development

Updated 2 November 2026. Existing project: wholecare-diabetes-dev (`gylnitduoasmybadblcp`, Mumbai). This is the connected synthetic demo database, not a fixture-only mock. Read ../docs/SETUP_AND_OPERATIONS.md before running SQL. Foundation and upgrade scripts are already applied here; do not replay them on the current project.

## Schema responsibilities

Public tables (17 at this snapshot):

- `clinics`, `profiles`, `patients`: organizational and synthetic patient identity.
- `care_plans`, `care_plan_items`, `plan_schedules`: instruction versions, reviewed actions and recurrence definitions.
- `plan_extractions`: source provenance, extracted proposal/model and actor; it is not an active plan.
- `care_loops`: dated occurrences and their current workflow state/owner.
- `care_events`: patient/team actions with actual occurrence time and recorded-at detail.
- `evidence`: bound private report metadata and duplicate content identity.
- `glucose_observations`: timestamped synthetic observations and source identity.
- `support_tasks`: bounded caregiver assistance routed under consent.
- `message_outbox`: simulated/pending/sent/failed communication intent/history. Pending is not delivery.
- `audit_events`, `plan_activity`: actor/action and plan/system history.
- `twilio_test_sends`: durable singleton setup-send reservation/status.
- `whatsapp_webhook_receipts`: minimal deduplicated technical incoming receipt records.

Private membership, caregiver consent and request-key records enforce scope and idempotency. Public clients have scoped SELECT access under RLS; actions use checked RPCs. Private helpers must retain controlled search paths and membership checks. Service-only verified report registration must not become callable by browser users.

## Important invariants

Only one confirmed care plan per patient is active. Proposed plans create no occurrences. Superseding a plan retires outstanding DUE/UNCONFIRMED tasks while preserving completed history and pending review. Confirmation history is retained on inactive versions.

Loop states are DUE, UNCONFIRMED, REVIEW_PENDING, CLOSED, CANCELLED. Closed loops have closed_at; closed/cancelled loops have no next owner. Patient report upload does not equal clinician review. Unconfirmed does not establish a missed medication dose.

Occurrence identity remains anchored to scheduled_for after rescheduling. The generator must not recreate the original due occurrence. UUID request/event keys suppress duplicate mutations; observation uniqueness uses patient/source_id/observed_at; report identity uses server-computed SHA-256 bytes per patient.

Patient and glucose rows are constrained to synthetic use. No migration here enables real clinical use. Preserve the distinction between occurred_at and entry time, and between a recorded action and an inferred medical outcome.

## Storage

All four buckets are private:

- `plan-documents`: clinician source PDF/PNG/JPEG, 8 MB.
- `care-evidence`: report PDF/PNG/JPEG; baseline bucket ceiling is 10 MB, current UI/Edge path is 8 MB.
- `meal-photos`: JPEG/PNG, 8 MB.
- `voice-notes`: supported webm/mpeg/wav/mp4 audio, 8 MB.

Paths include the patient scope. Policies limit upload/read by role and assignment. Caregiver consent does not provide broad clinical-file access. Signed links are temporary. Report/source signature checks do not constitute antivirus scanning. Orphan cleanup, retention, deletion/export and lifecycle administration are pending.

## Schedules and worker

Once/daily schedules use explicit timezone, dates and up to four daily times, with bounded duration. The database creates a rolling future horizon through local current date plus 14 days and suppresses duplicates. `wholecare-plan-scheduler` runs every five minutes with pg_cron. It extends occurrences and queues overdue reminder intent, respecting reminder preference and default quiet hours 20:00–09:00; reminder grace is 30 minutes.

These defaults are development behavior. There is no full policy editor or external care-message dispatcher. Inspect cron execution history and outbox state separately from Twilio provider delivery. Do not add a parallel client-side scheduler.

## SQL source and historical application

Foundation files are `schema.sql`, `client-context.sql`, `indexes.sql`, `support-context.sql` and `seed.sql`. Provider setup records use `whatsapp-receipts.sql` and `twilio-test-sends.sql`. `upgrade-mvp.sql` captures the consolidated one-time evolution from that foundation: active-plan lifecycle, schedules, capture/import, verified evidence, private buckets, controls and scheduler.

Initial managed migration names were wholecare_foundation, identity_context, due_guard_and_demo_consent, access_indexes and support_context (1 November 2026). Later evolution was applied through reviewed SQL and captured in the consolidated upgrade; it has not yet been fully reconciled into a clean managed migration chain. A clean restore/rebuild test remains pending. Local intermediate scratch SQL is not the canonical replay sequence.

For a new disposable project: provision identities using supported Auth tools; review foundation dependencies and empty-seed expectations; apply reviewed foundation/seed/upgrade in dependency order; deploy functions and configuration; inspect policies/storage/cron; create and confirm a plan through the application; verify role and persistence behavior. Do not claim this sequence is automated or clean-room tested yet. Never insert real production users into Auth internals based on historical fixture setup.

The seed expects four fictional development identities/profiles and refuses duplicate population. It supplies legacy workflow examples, not proof that the current plan scheduler is functioning. Existing development retains historical and newly generated data; resetting it is not a prerequisite for development.

## API and verification

See ../docs/API_AND_INTEGRATIONS.md for RPC arguments, Edge Function payloads and secret names. See ../docs/release-verification.md for observed results. `verify-capture.sql` uses a rolled-back fixture transaction and needs an administrative context. `verify.py` is a legacy mutating shared-fixture test and is not safe as a routine smoke test of the current prepared demo. Provider diagnostic scripts differ from live sends; inspect their action flags first.

Before changing schema: inspect current live objects, preserve data/history, record a migration, verify unauthorized roles as well as the happy path, and update these docs. Before real data: complete enrollment/privacy policy, operational monitoring, retention, backups/restore and security review. Current source and successful synthetic checks do not establish production readiness.

## Operations schema increment

`operations.sql` and `intake-integrity.sql` are applied and recorded migrations. Four new RLS tables hold intake items/history, sanitized processing events and delivery jobs. Three private transport tables hold disabled channel gates, future enrollment references and receipt deduplication. Browser writes remain checked RPCs. Evidence association is checked atomically against the current reviewed intake match. No caregiver clinical intake access or external sends were enabled.

`supabase/migrations/` now contains the five original recorded migrations, a consolidated connected baseline and the two applied operations migrations. The connected baseline was previously applied outside managed history; adoption confirmation expired and remains pending. Do not push/replay it onto development. Original baseline copies here remain historical references. Clean-room rebuild is not yet verified. See ../docs/bucket-1-delivery.md.
