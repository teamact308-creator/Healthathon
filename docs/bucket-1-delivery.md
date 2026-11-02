# Bucket 1 delivery — independent engineering increment

Updated 2 November 2026, Asia/Kolkata. This increment implements work that did not require new channel approvals or clinical/product policy. It does not complete the full MVP or enable real patient use. The submitted presentation remains an acceptance source; no requirement was waived.

## Delivered

### Source-linked pre-consult review

Assigned clinician/coordinator can choose a UTC due-date period up to 90 days and assemble a database-backed snapshot. It includes the eligible due cohort, current closures, cancelled exclusions, unresolved tasks (including old-plan pending evidence), current next owner, source excerpt, retained evidence/original links, recorded activity/review counts, plan rejections, cancellations/reschedules/reopenings and latest glucose observation time. It queries the chosen period separately from bounded recent activity feeds.

Current-state closure is explicitly labelled: due_at in [start, end), capped at snapshot generation, current cancellations excluded, currently CLOSED with closed_at before cutoff. Reopened work is unresolved. Median duration is closed_at minus due_at and can be negative. Empty cohorts show N/A. This is not an on-time score or historical state reconstruction. Expected completion windows, participation/response-rate denominators, D30 retention and effort saved remain decisions/pilot observations in other buckets.

### Human intake and association

Patient can submit an unassigned private report or note. Team reviews it with a reason, proposes a due active investigation match, dismisses it or acknowledges a note. Patient confirms a proposed file association through the existing verified report endpoint; clinician review is still required. No task changes merely because an intake arrived or a note was acknowledged.

All association decisions have source/history. Evidence registration checks and resolves the associated intake atomically. A stale/concurrently changed match is rejected. Duplicate request keys cannot be reused with altered input. Files are scoped to the assigned patient; caregivers cannot access the clinical intake queue. No automatic multi-action extraction/matching was introduced; that product decision remains in bucket 3.

### Messaging engineering foundation

`messaging-core.mjs` provides provider-neutral dispatch control and fixture adapter tests: durable reservation before provider calls, concurrent claim suppression, explicit accepted vs delivered, duplicate/out-of-order callbacks, bounded safe-failure backoff and no automatic retry of uncertain sends.

Database delivery jobs link to the existing outbox with patient identity constraints. Private service-only preparation/claim/result functions enforce disabled gates, verified consented enrollment, due/open task state and durable reservations. Receipt keys deduplicate callbacks; delivery cannot close a care task. Both channel gates are false; no enrollment or phone destination was added; no dispatch worker is scheduled. Real provider adapters, signed callback HTTP integration and live channel acceptance remain bucket 2. This foundation is tested with fixtures, not proof of live care-message delivery.

### Processing visibility and application resilience

Sanitized processing failures can be recorded without document text, credentials or provider response bodies. Assigned team sees issues and can mark investigation, retaining actor/time. This is client-observed telemetry, not comprehensive infrastructure monitoring.

Task lists and audit feed have pagination. Large loop/item/plan/evidence/outbox reads use deterministic server paging rather than silently accepting the first API page. The loader fails explicitly beyond 50,000 records. Existing recent activity (200), audit/plan/extraction (100) and observation (requested 2,000; provider row limits may reduce it) feeds remain bounded. Full historical paging/realtime and load testing remain unfinished.

Keyboard focus and narrow-screen control wrapping were improved. Glucose charts position readings by actual timestamp and label units/time; a single reading remains visible. No clinical threshold or interpretation was added. Sign-in failure clears the prior local identity; concurrent refresh requests share one refresh; logout clears local state despite a network failure. Summary state is cleared on sign-out and stale async results cannot restore the previous identity's report.

### Test/build and migration maintenance

- 22 local tests passed, covering workflow, reporting, chart geometry, session handling and messaging control.
- `database/verify-operations.sql` passed as an administrative rolled-back transaction. Includes RLS/role denial, intake idempotency, stale association rejection, atomic evidence linkage, disabled/unverified dispatch, duplicate claims and callback ordering. No provider calls.
- `database/check-operations.py` passed authenticated REST checks: clinician/coordinator summary, patient/caregiver/anonymous/wrong-patient denial, invalid period/session, caregiver intake RLS and persisted synthetic note history. `--write-fixture` deliberately retains a labelled note; default mode is non-mutating beyond sign-in/session creation.
- Browser verified clinician summary, source-record dialog, patient note intake and team acknowledgment/reload persistence. Synthetic test notes remain clearly labelled in history.
- Static build passes with 13 allowlisted browser assets. A build-output check rejects backend/private artifacts. CI definition runs tests/build/output checks on pushes and pull requests; hosted execution status must be checked after publication.

Five original migration files were recovered verbatim from recorded database history. A consolidated connected-baseline migration captures previously applied SQL without seed/Auth data. New operations and integrity migrations are recorded on the remote project and mirrored locally. Historical connected-baseline adoption is still pending: its metadata update required a connector confirmation that expired; it was not retried by resetting or replaying schema. There is no isolated Docker/Postgres/Supabase rebuild environment available here, so a clean restore was not claimed. Do not blindly push the migration chain onto the current project.

## Remaining outside this increment

Live WhatsApp/SMS setup, real provider adapters/callback activation and phone testing; policy definitions and broader multi-action conversation UX; structured longitudinal physiology; production enrollment, governance, vendor integrations and staffed response commitments. These remain in buckets 2–4. Backend observability beyond recorded client failures, large-scale performance, full accessibility audit and comprehensive failure/safety coverage also remain ongoing hardening work.

## Reproduce and inspect

Run `npm test`, `npm run build`, `node scripts/check-build.mjs`. Read operations/API/database documentation before live scripts. The operations SQL test needs administrative access and rolls back. `python3 database/check-operations.py` needs locally authorized demo credentials; append `--write-fixture` only when deliberately retaining a synthetic note. Do not run the legacy mutating verifier or reset the consumed Twilio setup-send reservation.

## Release verification follow-up

The hosted verification caught a schedule paging query using `id` instead of the table's `item_id` primary key. Corrected the query and added a workspace-loading contract regression test, bringing the local suite to 22 passing tests. A real private PDF completed unmatched intake → team association → patient verified submission → atomic intake resolution → clinician review → CLOSED; replay returned the same result. This deliberately reopened and re-closed a fictional current investigation and retained labelled source/evidence history. No AI or messaging provider was called.
