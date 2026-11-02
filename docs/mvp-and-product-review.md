# WholeCare Diabetes - current MVP and product backlog

Updated 3 November 2026; incorporates the agreed bucket 3 product delivery after reviewing the final Team ACT presentation submitted to the judges (PDF and PPTX). Current implementation status is summarized below and in the linked delivery records. This replaces the earlier fixture-only inventory. Capabilities below distinguish implemented web workflows from transport tests and production readiness. Reuse the existing Supabase identity, tables, RPC workflow, private storage, outbox, GitHub repo and Vercel frontend.

## Independent engineering delivery update

See [bucket 1 delivery and verification](bucket-1-delivery.md) for this increment and its limits. Implemented: source-linked date-bounded clinician/coordinator review summary, descriptive operational measures, human unmatched-intake queue with audited decisions and atomic confirmed evidence association, sanitized processing issue tracking, disabled-channel delivery reservation/callback foundations, task/audit pagination, session and chart fixes, expanded tests and build checks. Bucket 1 acceptance is complete, including migration reconciliation and isolated application-database rebuild/restore. Live channel setup remains pending.

J01 remains blocked at live channel integration despite new delivery foundations. J02's manual web association/exception foundation is implemented; automated messaging interpretation/correction remains pending. J03 has expanded isolated/REST/browser evidence but the cross-channel release gate remains NOT MET. J04's deterministic operational digest is implemented; longitudinal physiology will extend it under J07. J05 has descriptive counts/closure timing and event foundations, while policy-defined on-time/participation metrics and pilot outcomes remain pending. J06 has separately confirmed deterministic text/transcribed-voice suggestions; general LLM interpretation remains later scope. J07 manual structured history and correction provenance are implemented. Historical baseline adoption and isolated application-database rebuild/restore passed. Full Supabase-service disaster recovery remains a pilot requirement.

## Working now

- Hosted app: https://healthathon.vercel.app/ . Team repo: https://github.com/teamact308-creator/Healthathon . Four development roles, patient scoping, caregiver consent, audit history and shared persistence remain in use.
- Private source upload (PDF/PNG/JPEG), typed notes, structured OpenAI proposals, exact-source excerpts and model/source provenance. Manual editing remains available on AI failure.
- Proposed plan save, clinician review note and explicit confirmation. The reviewed form is saved/activated atomically. Plan history distinguishes active, superseded and rejected drafts; AI never activates a plan.
- Timezone-aware once/daily/weekly schedules with up to four times per day. Five-minute cron extends a 14-day horizon, with duplicate protection. Default quiet hours, one overdue in-app reminder per occurrence and patient preference are implemented. Reschedule/cancel actions carry reasons and retain occurrence identity.
- Meal descriptions/photos, medication taken/missed/delayed/skipped-by-instruction and typed activity history. Unconfirmed activity remains distinct from completion.
- English/Hindi uploaded voice-file transcription. User checks/edits words and explicitly selects the activity status before saving. No autonomous clinical or task decisions.
- Synthetic CSV import (timestamp/value/unit/source), duplicate suppression, 14-day sample, neutral chart and recent-data availability gate.
- Real private report upload, signature/type/size checks, duplicate-content hash, explicit patient/task binding, original-file link, review queue and clinician-only closure.
- Twilio credential verification, signature-validated inbound receipt and delivered approved outbound trial template. The package-delivery template was only a transport test.

## Final presentation alignment and release gate

The final submitted deck adds an explicit acceptance lens to the PRD; it does not silently remove stricter PRD requirements. Its five-week illustration is historical planning, not a newly agreed delivery date. Preserve asymmetric MVP depth: a full investigations loop, thin meal/medication capture-confirmation loops, and glucose import/availability continuity. The Care Graph is a shared operational model; a separate graph database is not required.

Slide 7 defines five demonstrations:

1. **One synthetic patient across all four dimensions — implemented in the web demo.** Re-run the unified walkthrough for each release.
2. **Investigation loop through human review — web path implemented, channel-connected path incomplete.** Include due prompt, evidence and review in the final acceptance scenario.
3. **App and WhatsApp update the same execution state — NOT MET.** Transport tests and a delivered trial template do not satisfy this gate.
4. **Ownership moves across patient, caregiver and team — partial.** Consented support routing and clinician review exist; richer reassignment and cross-channel handoff remain.
5. **AI-assisted actions are reviewable/overridable and auditable — implemented for current web paths, incomplete for unbuilt messaging paths.** New intake paths must preserve the same safeguards.

The full MVP remains incomplete. A release gate must be evidenced, not inferred from a provider connection or a working screen.

## Prioritized delivery backlog from the judges' deck

Priority here means implementation order: **P0** blocks the promised end-to-end demonstration; **P1** completes explicit product-proof gaps next; **P2** is pilot/expanded scope or needs an owner decision. These labels do not reclassify or waive existing PRD acceptance requirements. Reuse existing services, storage, outbox and checked actions.

### J01 — P0 — Task-linked WhatsApp investigation loop

**Status:** missing above working transport foundations. **Sources:** slides 3, 5, 7. **Maps to:** work areas 3/4/8, M04/M09/M10.

Build verified phone-to-patient enrollment, channel consent/opt-out, an appropriate supported care template/sender, persisted conversation/task association and an outbound dispatcher over the existing outbox. Capture provider delivery callbacks and reconcile failures/uncertain sends without duplicate messages. Delivery alone must never close a care task.

**Done when:** one fictional patient's due investigation receives an authorized prompt; a WhatsApp reply/attachment is bound to the correct patient/occurrence; validated private evidence becomes review pending; an authorized clinician reviews the original and closes it; app and messaging reflect the same persisted state after reload. Duplicate events, wrong-patient attempts, revoked consent and provider failure have verified outcomes. A real phone test requires an explicitly intended enrolled recipient.

**Dependencies:** existing verified evidence workflow; supported care sender/template and recipient enrollment. Business/provider approval is an external dependency, not completed engineering.

### J02 — P0 — Confirmation, ambiguity and unmatched intake

**Status:** manual web intake/association, history and atomic evidence linkage implemented; messaging ambiguity proposals and general automatic matching remain pending. **Sources:** slides 4–6. **Maps to:** work areas 3/7/8, M05/M09/M10/M12.

Keep unmatched documents and ambiguous messages in a private review queue. Show source, possible task associations and a human correction/assignment action. Clarify medication completion: taken can satisfy completion; missed/delayed/skipped are recorded outcomes requiring their configured operational resolution, not successful adherence. Make dependencies and next-owner handoffs explicit for the investigation path; a general dependency editor can follow later.

**Done when:** ambiguous/unmatched input changes no task until resolved; incorrect associations can be corrected with reason/history; duplicate replay produces no extra event/evidence; receipt and clinician review remain distinct; any assigned next owner is authorized. Reuse server-side controls rather than implementing alternate message-only state rules.

### J03 — P0 — Release proof and failure checks

**Status:** current web golden path verified; final cross-channel gate pending. **Sources:** slides 6–7. **Maps to:** work area 8, M12.

**Done when:** a repeatable synthetic walkthrough demonstrates all five slide-7 criteria, including caregiver consent/ownership, explicit AI confirmation, source evidence and audit. Exercise duplicate webhook, expired session, wrong role/patient, failed provider call, invalid file, rejected proposal and missing data. Publish observed evidence and remaining limits. Do not reset the reserved setup sender or shared demo merely to repeat old fixtures.

### J04 — P1 — Pre-consult review summary

**Status:** source-linked date-bounded operational digest implemented in bucket 1; longitudinal context and further clinician usability validation remain. **Sources:** slides 2–3, 5, 8. **Maps to:** work area 8, M11.

**Done when:** a date-bounded patient summary assembles completed/unresolved actions, pending evidence, stale monitoring availability and next owner; each statement links to its underlying source/event and indicates missing data. Clinician can move directly to review/correction. Start with deterministic aggregation; an AI-written summary is not required. No clinical interpretation or unsupported assertion that physician time was saved.

### J05 — P1 — KPI definitions and instrumentation

**Status:** descriptive cohort closure, closure timing and intervention/failure counts implemented; policy-defined KPI calculations and pilot measurements remain pending. **Sources:** slides 7–8. **Maps to:** work area 8, M11/M12.

Define cohort, expected window, numerator/denominator, timezone and cancellation/supersession/reopening treatment for closure rate. Capture median time-to-close, stale loops, evidence completeness, response/participation, AI rejection/override and unresolved processing failures. Define manual touches and review-readiness measures with an explicit event source.

**Done when:** a selected synthetic period produces reproducible values traceable to events, handles empty cohorts explicitly and distinguishes on-time closure from eventual closure. Label synthetic demonstration metrics. D30 retention, actual preparation/evidence-retrieval time and effort reduction require observed pilot data/baselines; do not fabricate outcome claims.

### J06 — P1 — Multiple action proposals from one message/voice note

**Status:** individually reviewed deterministic text/transcribed-voice action suggestions, manual task selection, edit/discard/confirm and future/clarification notes implemented in bucket 3. Broad LLM matching/evaluation and live WhatsApp intake remain pending. **Sources:** slides 4–5. **Maps to:** work areas 4/5/7, M05/M06/M07.

**Done when:** a synthetic message covering medication, breakfast and a future test yields separate source-linked proposals; user can edit/reject each, choose the correct occurrence and confirm before persistence. A planned future test does not become completed. Ambiguous times/statuses go to clarification/review. WhatsApp media retrieval reuses private upload/transcription foundations. Support the selected demo languages without implying fully bilingual UX is complete.

### J07 — P1 — Longitudinal patient context

**Status:** manual structured HbA1c/weight/BP/prior-investigation context, source/units/date/correction history and pre-consult inclusion implemented in bucket 3. Real vendor ingestion and clinician usability validation remain pending. **Sources:** slides 1–2. **Maps to:** work area 6 plus patient record/context extension under M11.

**Done when:** dated fictional values for HbA1c, weight, BP and historical glucose plus prior investigation references appear in a longitudinal view and pre-consult summary, with units, source/provenance and correction history. Preserve structured values separately from uploaded originals. Show absence explicitly. No automatic diagnosis, risk scoring, lab interpretation or medication recommendation. Reuse the patient/event/evidence model; confirm a schema design before adding parallel stores.

### J08 — P2 — Pilot governance, interoperability and scope decisions

**Status:** partially planned; not validated readiness. **Sources:** slides 5–6, 8.

- Privacy/retention, minimum-necessary provider payloads, consent lifecycle, deletion/export, security review, monitoring and restore/migration verification remain pilot prerequisites. Treat DPDP alignment and ABDM readiness as unverified intentions, not certifications or deployed capabilities.
- Keep document/CSV ingestion first. Real CGM/lab/EHR adapters and FHIR/ABDM interfaces require selected use cases, access and validation; they are not prerequisites to demonstrating the synthetic import path.
- SMS still needs routing/registration/consent decisions and explicit channel capabilities. The deck's BP/symptom/ECG/nurse-callback example is expanded scope: do not promise a staffed callback or clinical triage without an agreed workflow, staffing and review policy.
- Existing frontend/Supabase/Twilio implementation differs from the illustrative Lovable/Make/WhatsApp Cloud stack. Document that substitution; do not rebuild functioning components just to match tool names.
- Preserve submitted deck originals. Before reusing the presentation, remove drafting remnants from the PPTX and distinguish implemented features, demo simulations and roadmap claims.

## The eight requested work areas

1. **Plan creation/confirmation - implemented for the web demo.** Broader malformed-file coverage, richer extraction evaluation, version diffs and concurrent-editor protections remain. Live extraction tested typed text, PNG plus typed instructions, and a PDF-only source.
2. **Scheduling - implemented for once/daily web demo.** Cron execution, generation, reminder enqueue/deduplication and reschedule identity were tested. Weekly recurrence and configurable operational measurement windows are implemented; complex recurrence, end-date extension UI and DST ambiguity prompts remain later work. In-app queued reminders do not send WhatsApp/SMS.
3. **Report uploads - implemented for web demo.** Real image upload, private preview, retry handling, human review and role denial tested. PDF upload/review also passed; broader malformed-file testing, automatic report/task matching with ambiguity correction and WhatsApp attachments remain.
4. **WhatsApp care workflow - partial.** Transport works. Still needs verified phone-to-patient mapping, channel consent/opt-out, appropriate approved care templates/sender, persisted task-linked conversations, reply commands, delivery callbacks and reliable delivery/retry reconciliation. No care task closes on message delivery. SMS needs provider/routing selection and applicable registration; reuse the same outbox.
5. **Meal/medication logging - implemented for web demo.** Description/photo and explicit medication statuses persist with source/time. Voice-confirmed activity retains the recording path. Audited status/description/time corrections are implemented; richer structured meal fields and WhatsApp capture remain.
6. **Glucose data - synthetic import/chart implemented.** No real CGM vendor connector or clinical interpretation. More detailed expected monitoring windows, automatic continuity closure/stale-data policies, import-batch records and pagination remain.
7. **Voice/language - partial across the full channel requirement.** English/Hindi uploaded audio tested; confirmation required. No native microphone recorder, WhatsApp media retrieval, broad semantic intent extraction, spoken responses or fully bilingual application/conversation yet. Separately confirmed rule-based multi-action suggestions now reuse uploaded transcription. Hindi is provisional, not a final product-language decision.
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
- M11 / AC-01/10: shared four-domain views, event history, source/model provenance and operational counts improved. Multi-patient panel and longitudinal enrichment of the implemented operational digest remain pending.
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

1. J01–J03: finish and prove the task-linked WhatsApp investigation loop, confirmation/exception handling and shared state. Start unblocked engineering while sender/template/business dependencies are resolved.
2. J04–J05: assemble the pre-consult summary and instrument defined workflow KPIs.
3. J06–J07: add confirmed multi-action intake and longitudinal context, retaining the four-domain MVP depth above.
4. Complete outstanding PRD language, capture, reliability and acceptance requirements; reconcile migrations and verify restore before a real pilot.
5. Resolve J08 owner/provider/governance decisions before expanding real channels/data or promising clinical follow-up. No new authentication system, graph database or parallel frontend is needed.

## Requirements sources

PRD v1.1: https://drive.google.com/file/d/1IAarl0c8wygoUbIIPyw6vAPcZ0656AxS/view

Development plan: https://drive.google.com/file/d/1yFlXoXDYmKAMpdLjB7r6Za-caJFF7AOA/view

Data model: https://drive.google.com/file/d/1Ua2gjfPzzS8GrXJTa7VjNOt-qUN11y0N/view

The stricter PRD remains the scope baseline where the older build plan deferred photos/extraction/multilingual work. See BUILD.md and docs/release-verification.md for the current walkthrough and observed evidence. This is not a clinical-safety or production-readiness certification.

## Final submitted presentation sources

- [Team ACT final PDF — personal Drive source](https://drive.google.com/file/d/1Sc5pcCmJ78sIuZH3qGyeWp5-_Jnx6Qo0/view).
- [Team ACT final PPTX — personal Drive source](https://docs.google.com/presentation/d/1FKf4MIRrBrcx-tpLtIZYlkjsYnm2ID-d/edit).
- [Team copy: final PDF](https://drive.google.com/file/d/1kllp77NW8W1qnyUsXywAS4zSCvJCWP2v/view).
- [Team copy: final PPTX](https://docs.google.com/presentation/d/1284lVJpcM60tKgHHjgRt_RBgfRh1VKkn/edit).

The reviewed presentation's numbered sections 1–8 establish the references above. This update records gaps and proposed delivery order, not new implementation or a waiver of the PRD.

## Bucket 1 closure — 3 November 2026

Independent engineering acceptance is complete; see [delivery evidence](bucket-1-delivery.md). Nine migrations are reconciled and replay/restore tested. Twenty-seven local tests, scoped REST checks and browser verification cover this increment. History paging and server-only Twilio transport are implemented; both external-care channel gates remain disabled. Backend health shows scheduler/outbox/uncertain delivery status. Policy-dependent metrics, approved messaging activation, longitudinal context and real-user/pilot acceptance remain in buckets 2–4. This closure does not assert full MVP or production readiness.

## Messaging rehearsal increment — 3 November 2026

Patient Messages now rehearses task-linked replies, explicit confirmation, private report upload and unmatched notes using existing authenticated web APIs. Simulation transcript/permission/receipts are session-only; confirmed care records persist. Provider suspension blocks live testing. Server worker/callback contracts are fixture-tested but not deployed or wired to a durable service repository. Verified live enrollment, channel consent and inbound conversation/media remain pending. See [complete scope and recovery checklist](MESSAGING_REHEARSAL.md).

## Bucket 3 update - 3 November 2026

The agreed product increment adds separately confirmed multi-action suggestions, manual patient history/corrections, weekly schedules, activity correction history and clinician-configured operational windows. See [implementation, contracts, permissions and limits](BUCKET_3_DELIVERY.md). Earlier pending descriptions above are historical where this delivery supersedes them. Live messaging/bucket 2 is on hold; clinical thresholds and broad language/intent extraction remain outside this increment.
