# WholeCare Diabetes - current MVP and product backlog

Updated 2 November 2026 after the connected demo increment. This replaces the earlier fixture-only inventory. Capabilities below distinguish implemented web workflows from transport tests and production readiness. Reuse the existing Supabase identity, tables, RPC workflow, private storage, outbox, GitHub repo and Vercel frontend.

## Working now

- Hosted app: https://healthathon.vercel.app/ . Team repo: https://github.com/teamact308-creator/Healthathon . Four development roles, patient scoping, caregiver consent, audit history and shared persistence remain in use.
- Private source upload (PDF/PNG/JPEG), typed notes, structured OpenAI proposals, exact-source excerpts and model/source provenance. Manual editing remains available on AI failure.
- Proposed plan save, clinician review note and explicit confirmation. The reviewed form is saved/activated atomically. Plan history distinguishes active, superseded and rejected drafts; AI never activates a plan.
- Timezone-aware once/daily schedules with up to four times per day. Five-minute cron extends a 14-day horizon, with duplicate protection. Default quiet hours, one overdue in-app reminder per occurrence and patient preference are implemented. Reschedule/cancel actions carry reasons and retain occurrence identity.
- Meal descriptions/photos, medication taken/missed/delayed/skipped-by-instruction and typed activity history. Unconfirmed activity remains distinct from completion.
- English/Hindi uploaded voice-file transcription. User checks/edits words and explicitly selects the activity status before saving. No autonomous clinical or task decisions.
- Synthetic CSV import (timestamp/value/unit/source), duplicate suppression, 14-day sample, neutral chart and recent-data availability gate.
- Real private report upload, signature/type/size checks, duplicate-content hash, explicit patient/task binding, original-file link, review queue and clinician-only closure.
- Twilio credential verification, signature-validated inbound receipt and delivered approved outbound trial template. The package-delivery template was only a transport test.

## The eight requested work areas

1. **Plan creation/confirmation - implemented for the web demo.** Broader malformed-file coverage, richer extraction evaluation, version diffs and concurrent-editor protections remain. Live extraction tested typed text, PNG plus typed instructions, and a PDF-only source.
2. **Scheduling - implemented for once/daily web demo.** Cron execution, generation, reminder enqueue/deduplication and reschedule identity were tested. Weekly/complex recurrence, configurable policy editor, end-date extension UI and DST ambiguity prompts are later work. In-app queued reminders do not send WhatsApp/SMS.
3. **Report uploads - implemented for web demo.** Real image upload, private preview, retry handling, human review and role denial tested. PDF upload/review also passed; broader malformed-file testing, automatic report/task matching with ambiguity correction and WhatsApp attachments remain.
4. **WhatsApp care workflow - partial.** Transport works. Still needs verified phone-to-patient mapping, channel consent/opt-out, appropriate approved care templates/sender, persisted task-linked conversations, reply commands, delivery callbacks and reliable delivery/retry reconciliation. No care task closes on message delivery. SMS needs provider/routing selection and applicable registration; reuse the same outbox.
5. **Meal/medication logging - implemented for web demo.** Description/photo and explicit medication statuses persist with source/time. Voice-confirmed activity retains the recording path. More flexible edits/corrections, structured meal fields and WhatsApp capture remain.
6. **Glucose data - synthetic import/chart implemented.** No real CGM vendor connector or clinical interpretation. More detailed expected monitoring windows, automatic continuity closure/stale-data policies, import-batch records and pagination remain.
7. **Voice/language - partial across the full channel requirement.** English/Hindi uploaded audio tested; confirmation required. No native microphone recorder, WhatsApp media retrieval, normalized intent proposals, spoken responses or fully bilingual application/conversation yet. Hindi is provisional, not a final product-language decision.
8. **Controls/reliability/demo acceptance - improved, not complete.** Audited clinician closure/reopen, consented caregiver routing, rescheduling/cancellation, plan history, operational due-task/outbox counts, deployment and golden-path checks work. Comprehensive failure/recovery and model safety testing, pagination, operational alerting, source corrections and production migration/restore verification remain.

## Original work-package / acceptance mapping

- M01 / AC-07: plan authoring and confirmed extraction flow implemented, with remaining evaluation noted above.
- M02 / AC-04/08: real bounded scheduling implemented.
- M03 / AC-08: automatic in-app reminder enqueue implemented; escalation cadence, stale-data policies and delivery workers pending.
- M04 / AC-02: transport proven; real task-linked WhatsApp care workflow pending.
- M05 / AC-11: web-file English/Hindi transcription works; WhatsApp voice and complete multilingual interaction pending.
- M06 / AC-03: web meal description/photo capture works.
- M07 / AC-04: explicit medication statuses and multiple daily occurrences work; WhatsApp integration pending.
- M08 / AC-05: synthetic import, time series and recent-data gate work; broader continuity automation pending.
- M09 / AC-06: web file/evidence/human-review loop works; matching and WhatsApp files pending.
- M10 / AC-09: review/reopen, consented routing, snooze/cancel work; richer reassignment/overrides pending.
- M11 / AC-01/10: shared four-domain views, event history, source/model provenance and operational counts improved. Multi-patient panel and richer clinician digest pending.
- M12 / AC-12: hosted demo, regression tests and targeted unsafe extraction test verified. Full acceptance/safety gate remains incomplete.

## Full application beyond this MVP

- Real patient/staff onboarding, invitations/recovery/deactivation, clinic administration, multiple assignments/patient selection and configurable templates/policies.
- Pilot consent scopes, access lifecycle, retention/deletion/export, orphan-file cleanup, incident response, security review, backup/restore and reconciled migration history. Current schema deliberately remains synthetic-only.
- Reliable outbound workers, retries/dead letters, delivery callbacks, opt-out checks at send time, provider/model incident visibility, deployment gates and monitoring.
- Validated pilot analytics for closure/time-to-close, participation, monitoring coverage and coordinator effort. Current demo counts are not evidence of clinical outcomes or time saved.
- Realtime updates, pagination, accessibility/mobile coverage and performance validation.
- Selected real CGM, laboratory and HIS/EHR interfaces only when vendor/clinic requirements and access are known. FHIR/ABDM can be scoped then.
- More flexible routines, caregiver participation, richer capture and multi-condition orchestration over the same model.
- Billing/native apps/broad integration marketplaces remain undecided optional scope. Autonomous diagnosis, prescribing, clinical interpretation and emergency monitoring remain outside this assistive product's scope.

## Next steps without duplicated work

1. Finish task-linked WhatsApp messaging when appropriate templates/sender access are available; keep the existing outbox and RPCs.
2. Add WhatsApp attachment/voice intake on the private upload/transcription/evidence foundations now built.
3. Complete broader failure, privacy, multilingual and model evaluations; expand malformed-file coverage and exercise DST cases explicitly.
4. Reconcile migration history and verify clean rebuild/restore before a real pilot; add operational delivery monitoring.
5. Decide the real clinic workflow and SMS route when the team is available. No new authentication system, graph database or parallel frontend is needed.

## Requirements sources

PRD v1.1: https://drive.google.com/file/d/1IAarl0c8wygoUbIIPyw6vAPcZ0656AxS/view

Development plan: https://drive.google.com/file/d/1yFlXoXDYmKAMpdLjB7r6Za-caJFF7AOA/view

Data model: https://drive.google.com/file/d/1Ua2gjfPzzS8GrXJTa7VjNOt-qUN11y0N/view

The stricter PRD remains the scope baseline where the older build plan deferred photos/extraction/multilingual work. See BUILD.md and docs/release-verification.md for the current walkthrough and observed evidence. This is not a clinical-safety or production-readiness certification.
