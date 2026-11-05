# WholeCare Diabetes — Team Act / Healthathon

The patient journey UI now has four primary destinations, a grouped Today screen, a confirmed-only care plan and occurrence details showing who acts next. See [delivery, verification and remaining release gates](docs/PATIENT_UI_DELIVERY.md).

**CARE upgrade — 5 November 2026, merged into main:** The local [CARE clinician integration](integrations/care/README.md) implements renewable encrypted account connections and verified private original-report access using the existing synthetic WholeCare database. Actual sign-in, rotation, restart persistence, file integrity, review/save/reload, shared audit and disconnection passed. The owner manually viewed the fictional PDF; CARE closed its task with the exact operational note and one matching clinician audit entry. Temporary delegation was removed afterward. This upgrade is on `codex/care-account-reports-20261105` in PR #2, merged through PR #2 at 32a47fbbf613c4f54addfa0aa6f9dd7e65f3d0e7. CARE has not been publicly deployed. Read [account/report operation and limits](integrations/care/ACCOUNT_AND_REPORTS.md) and [verification evidence](integrations/care/VERIFICATION.md). The historical snapshot below remains context for the wider application.

**Start here even if you have no prior project context.** WholeCare is an assistive diabetes-care coordination prototype: it turns clinician-confirmed instructions into scheduled patient actions, captures participation and supporting files, coordinates help, and leaves a traceable review/history trail.

**Status: connected, hosted development demo; the full documented MVP and production application are not complete. All patient data is fictional.** A working screen, a provider connection test, an implemented workflow and a production-ready capability are different claims. This documentation distinguishes them.

Documentation snapshot: **3 November 2026, Asia/Kolkata**. Latest increment: [messaging rehearsal and provider recovery](docs/MESSAGING_REHEARSAL.md). Historical implementation baseline: [`8b18bcb`](https://github.com/teamact308-creator/Healthathon/commit/8b18bcbc3bae9f825cfdef24e31bd5e17249d420). Inspect the current branch and deployment before assuming the running service still matches this snapshot. Current main includes subsequent implementation increments; the historical SHA is not the current release.

## 1. Essential links and ownership

- Live development demo: **https://healthathon.vercel.app/**
- Private source repository: **https://github.com/teamact308-creator/Healthathon**, default branch `main`.
- GitHub project owner: `teamact308-creator` (Healthathon team account). Do not confuse this with the separately connected personal/primary GitHub account.
- Vercel workspace/project: **ACT_Healthathon / healthathon** — https://vercel.com/act-healthathon/healthathon
- Supabase project: **wholecare-diabetes-dev**, ref `gylnitduoasmybadblcp`, region `ap-south-1` (Mumbai), in the team account's organization. Dashboard: https://supabase.com/dashboard/project/gylnitduoasmybadblcp
- Supabase API base: `https://gylnitduoasmybadblcp.supabase.co`.
- Team Drive project workspace: https://drive.google.com/drive/folders/1yS9eW_ENqtVN4bylblFvQEbyI2uPLZoo
- Team Drive Healthathon source-documents folder: https://drive.google.com/drive/folders/1WnW1SqNzwZ8P2vC_0l02Zl2dYwi7Va_e
- Team services use the Healthathon account associated with `teamact308@gmail.com`. A Drive invitation does not automatically grant GitHub, Vercel or Supabase access; each service has its own permissions.

There is no requirement to connect an additional graph database, another authentication system, Lovable, Make or a second frontend to continue this implementation. Older plans mentioning other tools describe earlier implementation suggestions.

## 2. Read the right document for your job

1. **Everyone:** this README, then [current scope and pending work](docs/mvp-and-product-review.md).
2. **Reviewer or presenter:** [demo walkthrough](BUILD.md) and [observed verification evidence](docs/release-verification.md).
3. **Engineer:** [architecture and code map](docs/ARCHITECTURE.md), [database/schema/permissions guide](database/README.md), and [API and integration reference](docs/API_AND_INTEGRATIONS.md).
4. **Operator or new environment owner:** [setup and operations runbook](docs/SETUP_AND_OPERATIONS.md).
5. **AI agent or developer taking over:** [handoff and decision record](docs/AGENT_HANDOFF.md). It explains where context lives, what is safe to reuse, what tests mutate data, and what not to claim is already complete.

The repository contains the executable implementation. The Drive contains requirements, pitch material and a published handoff snapshot. Update the repository documentation when behavior changes, then refresh the Drive handoff. Do not independently maintain incompatible versions of the backlog.

## 3. Product purpose and actors

The central demonstration is a closed operational care loop: clinician confirms a plan → system creates dated occurrences → patient records an activity or uploads evidence → clinician reviews where required → the loop closes with an explicit actor and reason. If an activity remains outstanding, it can receive an in-app reminder or consented caregiver assistance.

Four dimensions share this one workflow: **medication routines, meals, monitoring-data availability and investigations/reports**. The system does not provide diagnosis, prescribing, dose adjustment, clinical interpretation of glucose/laboratory findings or emergency monitoring.

- **Patient:** sees the assigned fictional journey; logs activity; uploads reports/photos/voice files; controls caregiver support consent and automated in-app reminder preference.
- **Clinician:** creates/edits/rejects/confirms plans, checks original sources and evidence, performs human review/closure, reopens tasks with a reason, reschedules and cancels permitted occurrences.
- **Coordinator:** sees assigned care work, can simulate outreach, route consented caregiver support and reschedule outstanding occurrences. Cannot confirm a plan or perform clinician-only review/cancellation.
- **Caregiver:** sees assigned, consent-scoped support tasks. Does not receive the patient's full clinical workspace through this role.

The signed-in identity and server-managed patient memberships determine authority. Navigation buttons never grant a role. The current UI uses the **first assigned patient**; a working multi-patient selector/admin product has not been built.

## 4. What actually works today

### Care-plan source and human confirmation

A clinician can upload a private fictional PDF/PNG/JPEG or enter source text, request structured AI extraction, edit instructions and exact source excerpts, explicitly choose dates/times/cadence/timezone, and save a proposed plan. Source files, source text and AI proposals/model identity are retained where applicable. Missing schedule values are not intentionally invented by the extraction prompt. AI output is always a proposal that can be wrong.

A proposed plan creates no patient tasks. Confirmation requires a human review note and an explicit check in the UI; the reviewed form is saved and activated atomically in the database. Revision creates a new plan rather than editing a confirmed plan in place. Prior outstanding tasks are retired, completed history remains and evidence awaiting human review is preserved. Rejected proposals are recorded with cancelled status and a rejection activity.

### Scheduling and reminders

Schedules support **once or daily**, up to **four local times per item per day**, a date range up to **one year**, and an explicit timezone. The worker runs every **five minutes**, generating through a rolling **14-day horizon** within the schedule's end date. Occurrences have independent identities and duplicate generation is suppressed.

The worker can enqueue one overdue in-app reminder per eligible occurrence, defaulting to **30 minutes after due time**, outside **20:00–09:00** quiet hours in the plan timezone, respecting the patient's reminder preference. These are database outbox entries, **not delivered WhatsApp/SMS messages**. Rescheduling preserves the original scheduled occurrence identity so the generator does not recreate the old task. Clinician cancellation and permitted care-team rescheduling require reasons.

### Patient capture and review

- Meal descriptions and optional private meal photos.
- Medication statuses: taken, missed, delayed and skipped-by-clinician-instruction. A missing report of activity is not automatically inferred to be a missed dose. Delayed/missed/skipped entries do not close the loop as completed.
- Explicit activity time separate from entry/recording time; uploaded voice transcript can be edited before confirmation.
- English/Hindi **audio-file upload and transcription**, not a microphone recorder or conversational voice agent. The user selects the task/status and confirms the transcript.
- Synthetic glucose CSV import with timestamp/unit/source identity, duplicate suppression, a 14-day sample and neutral time-series chart. Availability confirmation requires recent observations. No live CGM feed or glucose interpretation.
- Private report PDF/image upload, signature/type/size checks, SHA-256 duplicate-content detection, explicit patient/task association, original-file links, review pending state and clinician-only closure.
- Shared activity/audit history, plan/automation history, caregiver consent, due-task/outbox counts and reload persistence.

### Connected providers versus completed workflows

OpenAI extraction and English/Hindi transcription have passed real fictional-data tests. Twilio credentials and signed inbound WhatsApp transport passed; one approved outbound **package-delivery trial template** was delivered. That message was a connectivity test, not a WholeCare reminder or an actual package notification.

WhatsApp currently records minimal technical inbound receipts. It does **not** provide a task-linked care conversation, map a phone automatically to a patient, update a task from a WhatsApp reply, retrieve WhatsApp voice/media, or send appropriate care reminders. The newer Twilio trial does not support the direct TwiML reply method; its approved-template restrictions matter. See the integration reference before changing it. SMS is not connected.

## 5. What remains pending

The main gaps to the full MVP are task-linked WhatsApp care messaging and appropriate approved templates, channel consent/opt-out and verified patient mapping, WhatsApp file/voice intake, fuller multilingual interaction, richer monitoring-continuity automation, and broader end-to-end failure/safety coverage.

The full application additionally needs real onboarding and staff/clinic administration, patient selection, configurable workflows and policies, reliable delivery workers/retries/dead letters, provider callbacks, operational monitoring, large-scale data access/realtime behavior, retention/deletion/export, orphan-file cleanup, full platform backup/recovery verification, selected real device/lab/EHR integrations and a reviewed real-patient governance model. The database deliberately enforces synthetic patient/observation data; this is not ready to accept real patient records.

The detailed work packages and acceptance mapping are in [the canonical backlog](docs/mvp-and-product-review.md). Do not equate “web feature implemented” with “all channels implemented” or “production ready.” No readiness percentage is asserted.

## 6. Run the existing demo

Use a compatible modern Node.js installation; Node **25.8.1** was used during verification. This repo has no npm dependencies or framework build chain to install.

```bash
npm start
# Open http://localhost:4173/

npm test
npm run build
```

`npm start` is a loopback-only static preview on port 4173. The existing backend is remote Supabase; running locally is **not an offline mode** and is **not a local database clone**. Changes made after sign-in affect the shared development database.

`npm run build` copies an explicit browser-file allowlist into `dist/`. Vercel serves only that directory. Backend functions, SQL, documentation, credentials and `.local` files are excluded from published browser assets. `vercel.json` selects the Other/static configuration, `npm run build` and `dist`.

Four development logins exist: `patient@wholecare.test`, `clinician@wholecare.test`, `coordinator@wholecare.test`, `caregiver@wholecare.test`. They use unique random passwords supplied by the authorized project owner. On the original development machine, the protected `.local/demo-accounts.json` holds them. It is not in GitHub/Drive and is not served by the preview. New collaborators must obtain approved access; no password is contained in this handoff.

The app stores the current session in tab-scoped session storage and refreshes expiring tokens. Use separate tabs for roles. `/database.html` is an older, minimal verification screen, not the main application or a replacement admin console.

## 7. Implementation map

- `index.html`, `style.css`, `app.js`: application shell, role-aware screens, navigation, task actions and dialogs.
- `plan-ui.js`: clinician source/extraction/draft/review/version workflow.
- `capture-ui.js`: meal/medication/report capture, voice-file transcription review, CSV/chart and occurrence management UI.
- `connected-store.js`: Supabase Auth/session handling, REST/RPC access, private upload and Edge Function calls. Uses only publishable browser configuration.
- `connected-model.mjs`: transforms shared records into current/upcoming tasks and history. Superseded/cancelled work is separated from the current journey.
- `workflow.mjs`: reference workflow engine used in local regression tests; it is not the authoritative production database mutation layer.
- `database/`: foundation SQL, one-time MVP upgrade, fixture and verification sources. Read its README before executing any SQL.
- `supabase/functions/`: authenticated AI/report/diagnostic handlers and the signature-authenticated Twilio webhook.
- `server.mjs`, `build.mjs`, `vercel.json`: local allowlist and deployed static build boundary.
- `docs/`: architecture, operations, integration contracts, backlog, decisions and verification evidence.

## 8. Verification and change discipline

Observed checks include live PDF-only and image/text extraction, English/Hindi transcription, clinician-only activation, independent recurring tasks, automatic job runs, reminder/occurrence retry protection, medication states, synthetic data import/deduplication, real private PDF/image review and role denial. Build and local regression tests passed (21 after the independent engineering increment). See [the verification record](docs/release-verification.md) for what was and was not tested.

`database/verify.py` is a **mutating legacy integration test**, not a harmless health check. `database/verify-capture.sql` creates isolated rollback fixtures and still needs a privileged test connection. `database/check-whatsapp-send.py send` can cause a real external message; it is not a routine regression command. The singleton setup send has already been consumed. Read the operations runbook before running any of these.

Before changing the schema, inspect the live schema and migration history. `database/upgrade-mvp.sql` is an already-applied, one-time upgrade, not an idempotent startup command. All nine application migrations are reconciled and clean replay/synthetic dump-restore testing passed. Full platform-service recovery remains a pilot requirement. Never re-run it blindly on development.

When changing behavior, update this README's summary, the relevant reference/runbook, the backlog and verification evidence in the same change. Refresh the Drive handoff after the GitHub change is verified. Document unknowns rather than filling them with assumptions.

## Shared Drive handoff

A [self-contained handoff bundle](https://drive.google.com/file/d/1J12cyyTjLL2C7TawyuHRTAA2pLqDWUz0/view?usp=drivesdk) is available in the team Drive for readers starting outside GitHub. See [publication details](docs/DRIVE_PUBLISHING.md) for how to update it without creating duplicates.

## Final judges’ presentation alignment

The [prioritized backlog](docs/mvp-and-product-review.md) now maps the submitted Team ACT deck to explicit J01–J08 work items and the five slide-7 release gates. The main unmet gate is app/WhatsApp shared execution state. Next priorities include exception intake, pre-consult summaries, KPI instrumentation, multi-action confirmation and longitudinal context. These are pending work, not newly implemented features.

## Independent engineering increment

The [bucket 1 delivery record](docs/bucket-1-delivery.md) describes the new care-team Review summary and Intake & issues screens, operational measures, atomic human evidence association, client processing diagnostics, disabled-channel delivery foundations, pagination/session/chart fixes and verification. There are now 27 local tests and 13 static browser assets. External care dispatch remains disabled. Historical migration adoption and the isolated application-database rebuild/restore drill are now complete; see the delivery record for platform scope.

## Messaging while Twilio access is suspended

Messages now offers an explicitly simulated patient conversation with confirmation before real demo activity, private report upload or unmatched-note persistence. Session-only STOP/permission and delivery receipts do not enable live messaging. Server worker/callback contracts are fixture-tested and remain undeployed. See [rehearsal, draft templates and remaining activation work](docs/MESSAGING_REHEARSAL.md).

## Bucket 3 product increment

[Agreed four-item delivery and scope](docs/BUCKET_3_DELIVERY.md): individually confirmed text/transcribed-voice suggestions, manual dated patient context with retained corrections, weekly schedules/audited activity correction, and configurable operational reporting windows. General LLM intent extraction and clinical interpretation are not enabled. Bucket 2 live messaging is on hold.

## Password recovery - 3 November 2026

Forgot password and authenticated Change password screens are implemented. The four .test persona addresses cannot receive recovery mail; use signed-in Change password to choose a memorable passphrase. New credentials must not enter repo/Drive; local provisioning credentials become stale after changes. See [recovery setup and limitations](docs/PASSWORD_RECOVERY.md).
