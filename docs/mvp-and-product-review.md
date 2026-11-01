# WholeCare Diabetes — MVP and full application inventory

Reviewed 2 November 2026 (Asia/Kolkata). Implementation baseline: GitHub commit `4d19ee078b4dde174883fd1ae4411ec0212a24c5`, current workspace source, and the live `wholecare-diabetes-dev` Supabase project.

## Assessment

We have a connected development foundation, not the completed hackathon MVP. The web demo proves shared state, role checks and a simplified care loop. The agreed MVP additionally needs real WhatsApp, voice/multilingual input, document ingestion, actual evidence uploads, domain-specific logging and scheduling. The full application adds clinic operations, real onboarding, reliability, data governance and selected integrations.

Do not estimate readiness from screen count or the number of database tables. A visible control, a seeded record and an automated end-to-end capability are different levels of implementation. No completion percentage is assigned in this review.

## Sources and precedence

- [PRD v1.1](https://drive.google.com/file/d/1IAarl0c8wygoUbIIPyw6vAPcZ0656AxS/view): functional requirements and AC-01 through AC-12.
- [MVP Development Plan v1.0](https://drive.google.com/file/d/1yFlXoXDYmKAMpdLjB7r6Za-caJFF7AOA/view): build sequence and readiness gate.
- [Data Model v1.0](https://drive.google.com/file/d/1Ua2gjfPzzS8GrXJTa7VjNOt-qUN11y0N/view): logical entities and relationships.
- [Reviewed repository](https://github.com/teamact308-creator/Healthathon/tree/4d19ee078b4dde174883fd1ae4411ec0212a24c5).

The PRD marks meal photos, multilingual support and extraction flows as P0, while the development plan puts some of these in P1. Until we explicitly change the scope, use the stricter PRD acceptance criteria. A rushed web-only demo should be labelled a reduced demo, not treated as satisfying the documented MVP. The PRD's later roadmap is broad; production capabilities below are recommended planning requirements, not a newly approved exhaustive full-product specification.

## Working foundations — reuse rather than rebuild

1. **Accounts and access:** four real development Auth identities, membership-derived roles, authenticated database reads and role-checked actions. Caregiver consent grant/revocation works. Extend this for onboarding and additional scopes; do not create another identity system.
2. **Relational care model:** clinic → patient → care plan → plan item → individual occurrence. Extend the existing tables and foreign keys; do not build another Care Graph database or a parallel platform per domain.
3. **Workflow transaction:** completion, synthetic evidence receipt, clinician review/closure, reminder creation, caregiver routing and reopening are checked on the server. Reuse the RPC transaction boundary and idempotency mechanism.
4. **Persistent activity history:** actor, role, time, state change and reason are stored; app users cannot directly edit audit records. Extend the record with source, evidence, owner and AI provenance as needed.
5. **Connected web surfaces:** Today, care journey, attention queue, simulated outbox and activity trail use Supabase. Extend these screens and shared data access rather than making a second app. The app currently selects the first assigned patient.
6. **Development infrastructure:** private team GitHub repository, Free Supabase project, private evidence bucket, five applied migrations and test fixtures exist. Six local tests pass. Earlier live Auth/REST tests exercised access restrictions, consent, concurrent retries, review and occurrence separation. This is not a production certification.

## MVP work packages and acceptance gates

### M01 — Care-plan ingestion, authoring and confirmation — partial

Present: care plan/item tables, proposed/confirmed plan status, a confirmed synthetic source note, and a guard against acting on an unconfirmed plan.

Pending: upload/input consultation note or prescription; retain source file/excerpt; extract or manually author structured actions and timings; show a review workspace to confirm/edit/reject proposals; activate only after authorized confirmation; retain versions and handle superseded plans. There is no plan creation/confirmation UI or mutation endpoint yet. Reuse `care_plans` and `care_plan_items`; add source-document and extraction-run records. References: FR-001–003, FR-MD01, FR-T01, AC-07.

### M02 — Scheduling and recurrence — partial

Present: independently keyed loop occurrences, due timestamps, once/daily cadence labels, due guards and a UI separation between current/overdue and future occurrences.

Pending: structured schedule rules (including morning/evening routines), timezone-aware occurrence generation, background jobs, scheduling changes, next-follow-up timing and recurrence cancellation. Seven seeded occurrences are not a scheduling engine. Reuse `care_loops` and its uniqueness constraint. References: FR-005, FR-MD02, AC-04/08.

### M03 — Open-loop detection and outreach — partial

Present: open-state filters, next-owner labels, a manual coordinator reminder and consented support routing.

Pending: deterministic expected-versus-observed windows; automatic due/unconfirmed/overdue evaluation; CGM stale-data detection; configured reminder cadence, quiet hours, suppression, outreach opt-out and operational escalation/retry rules. No deployed Edge Functions or project cron schema were found. Reuse existing loop state, outbox and action rules. References: FR-M05, FR-G03/05, FR-T02, AC-08.

### M04 — Real WhatsApp — missing

Pending: select/configure WhatsApp Business sender/provider, callback endpoint, webhook verification/signatures, sender-to-patient mapping, channel consent, inbound text/media persistence, outbound delivery, provider message IDs, status callbacks and retry handling. Existing outbox rows are both `simulated`; there is no inbound conversation model or deployed webhook. External account onboarding has not been audited and may already exist outside this app. Reuse the outbox and workflow RPCs; add channel/conversation records and transport adapters. References: FR-007, FR-C01/04/06, AC-02.

### M05 — Voice and language — missing

Pending: retrieve voice media, transcribe, normalize English plus one agreed Indian language, map an utterance to permitted operational events, ask for clarification when ambiguous, and reply in the configured language. A `language` column does not implement multilingual behavior. Add AI-run provenance and failure/review states. References: FR-008/009, FR-C02/03, AC-11.

### M06 — Meal capture — partial

Present: sample breakfast completion creates a generic `care_events` record.

Pending: actual free-text description, meal timestamp, message/voice source, linked meal photo, structured confirmation and event history. The button does not capture what was eaten. Extend typed event payloads or domain child records over `care_events`; do not create a second logging pipeline. References: FR-M01–03/05, AC-03. Photo priority conflicts with the older development plan.

### M07 — Medication routine — partial

Present: sample routine confirmation; `UNCONFIRMED` remains distinct from an inferred missed dose.

Pending: clinician-confirmed routine fields, multiple scheduled occurrences, taken/missed/delayed/skipped-by-instruction/not-yet-reported input, source/timestamp and message/voice integration. Current events use generic `self_reported_complete`; missing and delayed statuses cannot yet be entered. No treatment recommendation capability is planned. Reuse plan items, occurrences and events. References: FR-MD01–04/06, AC-04.

### M08 — Glucose/CGM continuity — partial

Present: observations table and three seeded neutral numeric readings shown in the journey. The completion button confirms a sample activity; it does not import a device feed or prove an expected monitoring window is current.

Pending: synthetic CSV/API import, batch identity/deduplication, normalized timestamps/units/source metadata, 7–14 days of sample data, neutral time-series chart, last-received status, availability-window closure and missing/stale-data task. Reuse `glucose_observations`; add import-batch linkage and ingestion. A real vendor connector is post-MVP. References: FR-G01–06, AC-05.

### M09 — Real test-report evidence and review — partial

Present: evidence table, private bucket, fixture → REVIEW_PENDING → clinician close, and mandatory review note. Closing/reopening is role checked.

Pending: real web and WhatsApp PDF/image upload, content/type validation, storage binding, original-file preview/download, correct-patient/item matching with human correction, duplicate-file handling and source provenance. All three evidence records are fixtures; the bucket contains zero files. A private bucket alone is not a complete upload feature. Reuse the storage bucket, evidence relationship and review transition. References: FR-T03–07, FR-CL03, AC-06.

### M10 — Human operational controls — partial

Present: clinician closure/reopening and coordinator support routing, plus patient consent controls.

Pending: confirm/edit/reject proposals, general reassignment, snooze/reschedule, cancellation/not-applicable resolution and permitted coordinator overrides. Only DUE, UNCONFIRMED, REVIEW_PENDING and CLOSED are loop states today. Reopening is an audited action that restores a due state; it is not a distinct stored state. Extend the same action engine rather than bypassing it with direct table writes. References: FR-010, FR-CL04, AC-09.

### M11 — Care-team experience and provenance — partial

Present: single-patient connected views and server-written activity history.

Pending: practical clinician/coordinator layouts, source-linked evidence review, longitudinal domain events rather than only current cards, proposed-item queue, operational reasons for attention, ownership/evidence/source changes in audit, and a concise patient digest. Current audit UI is limited to the latest 100 events, observations to 50. A multi-patient panel is a pilot/product requirement unless expanded into the agreed MVP. References: FR-CL01–06, AC-01/10.

### M12 — Demo release, reliability and acceptance — partial

Present: local preview, repository, six local tests, and live access/workflow checks.

Pending: shareable hosted deployment, environment configuration, reproducible migration/provisioning process, test-only demo accounts, full golden-path automation through actual integrations, duplicate/wrong-patient/ambiguous-input/media-failure tests, AI safety tests, recovery from provider or model failure, operational event/KPI capture and demo script. No public deployment URL is present in the reviewed implementation; the current preview is local. External hosting accounts/deployments were not independently audited. References: NFR-004/005/007–010, AC-02–12.

## Acceptance summary

- AC-01, four dimensions visible: demonstrated for one synthetic patient.
- AC-02, real WhatsApp: not implemented.
- AC-03, meal log: partial; sample completion only.
- AC-04, medication routine: partial; no real schedule/reminder/status input.
- AC-05, CGM input/view: partial; no import or time-series chart.
- AC-06, report loop: partial; fixture review works, real upload does not.
- AC-07, extraction confirmation: not implemented; a preconfirmed seed is not an extraction review flow.
- AC-08, operational detection: partial; due guard/open list exist, automated evaluation does not.
- AC-09, override controls: partial; most controls still absent.
- AC-10, audit completeness: partial; source and broader provenance remain.
- AC-11, multilingual voice: not implemented.
- AC-12, prohibited-output testing: not met as an acceptance gate; the current code does not provide clinical interpretation, but there is no AI/integration safety suite.

## Full application beyond the MVP

These are staged product requirements, not reasons to delay the one-patient MVP.

### Pilot operation

- Actual patient/staff onboarding, invitations, recovery, deactivation and membership management; current accounts are manually provisioned test fixtures.
- Staff patient panel/search/selection, multiple assignments, clinic administration and configurable care templates. Schema support for multiple patients is not a working multi-patient product.
- Configurable language, reminder timing, consent scopes, follow-up routines and clinic workflow policies.
- Operational metrics: loop closure rate/time, meal/medication participation, monitoring-data coverage, coordinator effort and failed outreach. Current screen counts are not validated pilot analytics.
- Notifications/realtime updates, pagination, accessibility/mobile usability and performance evidence. Refresh-on-focus is not a realtime subscription.
- Reliable worker queues, dead-letter/retry handling, delivery receipts, incident visibility, deployment checks, backups/restore verification and support tooling.
- Data governance for a real pilot: approved onboarding/consent model, retention/deletion/export/access lifecycle, operational security review and documented incident response. The current schema deliberately enforces synthetic patient/observation data; it is not ready for real patient records.

### Later integrations and expansion

- Selected live CGM vendor, lab and HIS/EHR connectors, chosen against demonstrated clinic needs. FHIR/ABDM or other interoperability should be scoped when justified, not added for the hackathon by default.
- Richer meal/photo/voice capture, more flexible routines and caregiver participation within the agreed plan.
- Multi-condition orchestration by extending the operational domain model.
- Commercial billing, native mobile apps, advanced image analytics and broad integration marketplaces are undecided optional scope, not requirements established by these documents.
- Autonomous diagnosis, prescribing, clinical CGM/test interpretation and emergency monitoring remain outside this product's defined assistive scope. They are not a future backlog item by default.

## Sequence that avoids duplicated work

1. **Freeze this inventory as the baseline.** Tag upcoming changes to M01–M12 or a pilot item. Replace outdated local setup tasks rather than opening duplicates.
2. **Resolve source-priority conflicts and start channel onboarding now.** Select the Indian language and WhatsApp sender/provider. No paid integration is implied without a separate choice.
3. **Finish plan authoring/confirmation and scheduling.** These produce the real plan items and occurrences consumed by every channel.
4. **Complete the test evidence loop.** Real upload, source-linked review and human closure provide the strongest proof while channel approvals proceed.
5. **Connect real WhatsApp text to the same server workflow.** Then add voice/language and domain-specific meal/medication input.
6. **Add CGM import and data-window rules.** Reuse the observations and occurrence model.
7. **Complete controls, provenance, metrics, hosting and acceptance tests.** Make UI improvements against actual capabilities rather than maintaining parallel simulations.

Work can overlap where independent; the single builder should still implement bounded changes. No new graph database, authentication system, per-domain app or separate frontend framework is required just to finish the MVP. Lovable and Make were implementation suggestions in the older plan, not additional products we must now duplicate; an integration worker can be chosen once for the same shared backend.

## Decisions still open

- Which Indian language accompanies English?
- Which WhatsApp Business account/sender/provider is ready, and what access exists?
- Are we retaining the strict PRD MVP or explicitly reducing the meal-photo/extraction/multilingual scope?
- What exact full-product/pilot workflow should the upcoming requested changes establish?

This review made no changes to application behavior or patient records. The database checks were read-only; local tests did not mutate the shared database. Capability labels reflect the inspected implementation and are not compliance, clinical-safety or production-readiness certification.
