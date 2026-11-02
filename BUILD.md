# WholeCare Diabetes - connected demo

Use fictional data only. Live app: https://healthathon.vercel.app/ . Local: `npm start`; build: `npm run build`; local tests: `npm test`.

## Demo walkthrough

1. Sign in as the development Clinician. Open Care plans. Upload a fictional PDF/PNG/JPEG or type consultation instructions. Extract proposals with AI, or enter actions manually.
2. Check source excerpts, instructions, timezone, cadence, dates and times. Missing schedule values are not invented. Save a proposed plan. It creates no tasks.
3. Enter a review note, check the confirmation box and confirm. The reviewed form is saved and activated atomically. A confirmed revision retires outstanding tasks from the prior plan while preserving history and pending evidence review.
4. Sign in as Patient. In Today, record meal details/photo or medication taken/missed/delayed/skipped-by-instruction. Only completion statuses close tasks. Voice-file transcription supports English/Hindi; edit the transcript and select the status before confirming.
5. In Activity & data, import a CSV with `observed_at,value,unit,source_id` (ISO timestamp with timezone, mg/dL), or import the fictional 14-day sample. Inspect the neutral chart. Monitoring availability confirmation requires recent data.
6. Upload a fictional test PDF/image against its task. The backend validates file signature and patient/task binding, hashes content to detect duplicates and moves it to REVIEW_PENDING.
7. Clinician opens the private original, records a review note and closes the task. Patient cannot perform this step. Clinician/coordinator can reschedule outstanding occurrences; clinician can cancel. Reasons are audited.
8. Inspect the activity trail, plan/automation history and in-app reminder outbox. The worker runs every five minutes, extends schedules 14 days ahead, queues one overdue reminder per occurrence outside quiet hours and respects the patient's reminder preference. A reschedule retains the occurrence's original identity so regeneration does not recreate it.

The synthetic demo was exercised through this path. Completed examples remain in history. Clinician can reopen a completed current-plan task with a reason to demonstrate capture again. Old fixture history is retained.

## Boundaries

- Schedules support once/daily, up to four daily times, up to a year, explicit timezone, and a rolling 14-day horizon. Quiet hours default to 20:00-09:00; reminders are queued 30 minutes after due time. The clock is database-controlled.
- Care reminders currently stay in the in-app outbox. WhatsApp incoming verification and one approved outbound template were tested, but the trial package-delivery template is not used as a care reminder. Phone-to-patient conversations, WhatsApp voice/media, appropriate care templates and SMS remain pending.
- Web voice input is uploaded audio, not a microphone recorder or conversational assistant. Transcription can mishear words; confirmation is mandatory. Hindi was selected provisionally and tested.
- No diagnosis, prescribing, dosing recommendation, glucose/lab interpretation or emergency monitoring. AI extracts explicit instructions into proposals only. A targeted unsafe/embedded-instruction extraction test produced no tasks; this is not a comprehensive safety certification.
- The app still selects the first assigned patient. Production onboarding, real patient data, vendor CGM feeds, robust delivery workers, retention/cleanup and full production operations remain out of scope for this release.

## Reproduction

See `database/upgrade-mvp.sql` for the consolidated one-time upgrade from the existing foundation/context schema; it is already applied on development. Deploy the source functions under `supabase/functions/` with their included deno.json. Secrets stay in Supabase, never browser code. See `docs/release-verification.md` for observed checks and limitations.

## Further handoff documentation

Start with [README.md](README.md), then [architecture](docs/ARCHITECTURE.md), [API contracts](docs/API_AND_INTEGRATIONS.md), [operations](docs/SETUP_AND_OPERATIONS.md) and [takeover brief](docs/AGENT_HANDOFF.md). The [database guide](database/README.md) explains schema and reconstruction limits. Requirements status and observed verification remain separate in the linked backlog and release notes.

## Operations increment walkthrough

Sign in as Clinician/Coordinator and open Review summary. Assemble a UTC period, inspect cohort definitions and open a task's original evidence. Open Intake & issues to inspect unassigned sources and processing issues. As Patient, submit a fictional note or report without a task; the team proposes an association with a reason; Patient confirms a file match; the existing verified submission requires clinician review. Acknowledging a note never completes care. See docs/bucket-1-delivery.md for testing, definitions and limits.

## Messaging rehearsal increment — 3 November 2026

Patient Messages now rehearses task-linked replies, explicit confirmation, private report upload and unmatched notes using existing authenticated web APIs. Simulation transcript/permission/receipts are session-only; confirmed care records persist. Provider suspension blocks live testing. Server worker/callback contracts are fixture-tested but not deployed or wired to a durable service repository. Verified live enrollment, channel consent and inbound conversation/media remain pending. See [complete scope and recovery checklist](docs/MESSAGING_REHEARSAL.md).

## Bucket 3 update - 3 November 2026

The agreed product increment adds separately confirmed multi-action suggestions, manual patient history/corrections, weekly schedules, activity correction history and clinician-configured operational windows. See [implementation, contracts, permissions and limits](docs/BUCKET_3_DELIVERY.md). Earlier pending descriptions above are historical where this delivery supersedes them. Live messaging/bucket 2 is on hold; clinical thresholds and broad language/intent extraction remain outside this increment.
