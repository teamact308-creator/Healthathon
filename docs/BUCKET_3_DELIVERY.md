# Bucket 3 - agreed product increment

Updated 3 November 2026, Asia/Kolkata. The owner approved: individually confirmed multi-action intake, manual longitudinal context, configurable operational windows, weekly routines and audited activity corrections. Live messaging/bucket 2 is on hold. No clinical thresholds are configured by this release.

## 1. Multi-action intake

Patient Activity & data has a typed-source / uploaded English-Hindi recording entry point. Existing private voice upload and OpenAI transcription are reused. The user reviews/edits the transcript before creating suggestions. The local splitter uses bounded deterministic text rules, not a newly deployed LLM intent-extraction service. It handles the medicine / breakfast / future-test example, retains each exact source clause, and offers manual add/edit/discard for missed or ambiguous actions. It is not a general language-understanding claim or a fully bilingual interface.

Each proposal is separately reviewed. An activity requires an explicitly chosen open due occurrence, matching structured status, actual activity time, description and confirmation. Backend checks remain authoritative. Future or unclear actions save as intake notes for team clarification; they do not complete a task or create a schedule. Reports still use the existing private upload/review path. Suggestion state is session-memory only and clears on reload/sign-out; confirmed events/intake are persisted. The same per-proposal request key is used for a retry. Voice provenance is retained through the private audio path and voice-confirmed activity source. A pending transcription is discarded if identity/source changes.

## 2. Manual longitudinal context

Patient history supports HbA1c (% or mmol/mol), weight (kg or lb), paired blood pressure (mmHg) and prior-investigation reference text. Every row has observed timestamp, unit, structured value, source/provenance, actor, reason and recorded timestamp. Entries are fictional; numeric validation is structural and is not a clinical reference range. Values are not normalized across units or interpreted clinically.

Assigned patient/clinician can append an entry or correct the current version. Corrections create a replacement linked to the original; history remains readable. Simultaneous stale corrections are rejected. Assigned coordinator can read; caregivers/unassigned/anonymous users cannot read these tables or write through the checked functions. Direct authenticated writes are revoked. The pre-consult report shows current versions observed before its cutoff, with source text and a link to full history; corrected originals do not resurface merely because a correction changed the observation date. Glucose history remains the existing imported series.

## 3. Configurable operational measures

Assigned clinician saves append-only policy versions with a required reason and optimistic previous-version check. No default on-time, stale-data or overdue-age window is invented. Each domain can have a nullable completion window in integer minutes; outstanding-task age and monitoring availability have nullable integer-hour windows. The report labels the current policy date/reason (its ID remains in the source snapshot) and applies it to the current due cohort for comparison. It is not a historical reconstruction of the policy that applied at the time.

Cohort: due_at in the UTC selected period before generation time, cancelled rows excluded. Superseded outstanding work is normally cancelled during plan activation; retained review-pending work remains visible. Current eventual closure is separate from on-time closure. On-time means currently CLOSED, closed_at before report cutoff and at or before due_at plus its configured window; early closure qualifies. Reopened work is unresolved. Missing configured denominator yields N/A. Participation means a due-cohort occurrence has a recorded activity before cutoff, including missed/delayed outcomes; it does not imply adherence. Outstanding age is measured strictly beyond the configured age. Monitoring availability compares the latest received observation before cutoff to the configured age; absence stays explicit. Corrections in the period are counted from correction records. No clinical risk, monitoring alert, retention or physician-effort claim is generated.

## 4. Weekly schedules and corrections

Clinician plan editor supports once/daily/weekly. Weekly uses explicit selected local weekdays (Sunday 0 through Saturday 6), timezone, bounded start/end and up to four distinct times. Existing clinician source review/confirmation and 14-day scheduler horizon remain in use. Generation deduplicates by original occurrence identity, so a reschedule cannot regenerate the old slot. Future bookings in intake do not silently become weekly instructions. DST conversion follows PostgreSQL timezone behavior; an ambiguity-selection UI and more complex recurrence remain later scope.

Activity & data exposes correction of status, description and actual activity time, requiring a reason. The server locks the loop/event, verifies assigned author or clinician, checks expected previous values and retains before/after snapshots with actor/time. Original event creation/provenance and original audit events remain. The current event projection changes; correction history holds original values. Only the latest recorded activity can revise loop state; earlier event corrections remain historical. Taken/meal-logged/data-availability can close their thin loops; missed/delayed/skipped remain UNCONFIRMED. Review-pending/cancelled work and subsequent team review/reopen/reschedule/cancel require team resolution rather than being overridden by a patient correction. Correcting a description/time does not backdate the operational closure timestamp. Existing support tasks are not automatically recreated when a correction reopens thin-loop work.

## Data/API/code map

- Tables: patient_context_entries, workflow_policy_versions, activity_corrections; all scoped RLS, SELECT-only for authenticated clients.
- RPCs: record_patient_context, save_workflow_policy, correct_care_activity; invoker public wrappers, checked private definer implementations, fixed empty search_path, anon execution revoked.
- Updated save_plan / generate_plan add weekly weekdays; operational_snapshot adds context/policy/correction source records and safe report cutoffs.
- bucket-ui.js: intake/history/policy/correction UI. intake-model.mjs: deterministic suggestions, current context projection and workflow calculations.
- connected-store/model extend the existing scoped workspace; app/plan/operations UI reuses existing navigation and authenticated writes.
- Migration history: wholecare_bucket_three and wholecare_summary_cutoffs. Rebuild runner includes verify-bucket-three.sql alongside existing capture/operations checks. Restore remains application SQL/synthetic fixtures, not complete GoTrue/object/Edge disaster recovery.

## Verification and remaining scope

Automated checks cover mixed/future/negated intake, correction chains, metric boundaries/missing policy, weekly generation/deduplication, correction replay/stale editor, all four context types and role restrictions. Local and hosted evidence is recorded in release-verification.md. Confirmed synthetic examples remain in the demo with explicit source/reasons; no real patient data or provider destinations are introduced.

Remaining beyond these four agreed deliverables: general LLM intent extraction/evaluation, durable cross-channel conversation proposals, live phone enrollment/media/dispatch (bucket 2 on hold), clinical threshold agreement, broad language UX, complex recurrence/DST prompts, pilot usability/outcome validation, full service recovery and governance. These are not claimed complete by the new screens.
