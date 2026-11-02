# Bucket 1 delivery — independent engineering increment

**Bucket 1 acceptance: complete. Updated 3 November 2026, Asia/Kolkata.** This increment implements work that did not require new channel approvals or clinical/product policy. It does not complete the full MVP or enable real patient use. The submitted presentation remains an acceptance source; no requirement was waived.

## Delivered

### Source-linked pre-consult review

Assigned clinician/coordinator can choose a UTC due-date period up to 90 days and assemble a database-backed snapshot. It includes the eligible due cohort, current closures, cancelled exclusions, unresolved tasks (including old-plan pending evidence), current next owner, source excerpt, retained evidence/original links, recorded activity/review counts, plan rejections, cancellations/reschedules/reopenings and latest glucose observation time. It queries the chosen period separately from bounded recent activity feeds.

Current-state closure is explicitly labelled: due_at in [start, end), capped at snapshot generation, current cancellations excluded, currently CLOSED with closed_at before cutoff. Reopened work is unresolved. Median duration is closed_at minus due_at and can be negative. Empty cohorts show N/A. This is not an on-time score or historical state reconstruction. Expected completion windows, participation/response-rate denominators, D30 retention and effort saved remain decisions/pilot observations in other buckets.

### Human intake and association

Patient can submit an unassigned private report or note. Team reviews it with a reason, proposes a due active investigation match, dismisses it or acknowledges a note. Patient confirms a proposed file association through the existing verified report endpoint; clinician review is still required. No task changes merely because an intake arrived or a note was acknowledged.

All association decisions have source/history. Evidence registration checks and resolves the associated intake atomically. A stale/concurrently changed match is rejected. Duplicate request keys cannot be reused with altered input. Files are scoped to the assigned patient; caregivers cannot access the clinical intake queue. No automatic multi-action extraction/matching was introduced; that product decision remains in bucket 3.

### Messaging engineering foundation

`messaging-core.mjs` provides provider-neutral dispatch control and fixture adapter tests: durable reservation before provider calls, concurrent claim suppression, explicit accepted vs delivered, duplicate/out-of-order callbacks, bounded safe-failure backoff and no automatic retry of uncertain sends.

Database delivery jobs link to the existing outbox with patient identity constraints. Private service-only preparation/claim/result functions enforce disabled gates, verified consented enrollment, due/open task state and durable reservations. Receipt keys deduplicate callbacks; delivery cannot close a care task. Both channel gates are false; no enrollment or phone destination was added; no dispatch worker is scheduled. The server-only Twilio WhatsApp/SMS transport adapter is implemented and tested with injected fixture HTTP responses. Enabling the worker, approved sender/template enrollment, signed callback HTTP activation and live channel acceptance remain bucket 2. This foundation is tested with fixtures, not proof of live care-message delivery.

### Processing visibility and application resilience

Sanitized processing failures can be recorded without document text, credentials or provider response bodies. Assigned team sees issues and can mark investigation, retaining actor/time. A separate assigned-team backend health RPC reports actual scheduler status/last run, outbox backlog and uncertain delivery reservations. Client failure records remain distinct from backend health; no claim of comprehensive production monitoring is made.

Task lists and audit feed have pagination. Large loop/item/plan/evidence/outbox reads use deterministic server paging rather than silently accepting the first API page. The loader fails explicitly beyond 50,000 records. Activity, audit, plan history, processing issues and observations can load older records in explicit increments, using deterministic timestamp/id cursors. Observations traverse provider row limits instead of silently truncating at the first page. Initial windows remain 200 activities, 100 audit/plan/extraction entries and 2,000 observations; a 50,000-record client safety cap is explicit. Realtime and large-scale pilot load validation remain full-product work.

Keyboard focus and narrow-screen control wrapping were improved. Glucose charts position readings by actual timestamp and label units/time; a single reading remains visible. No clinical threshold or interpretation was added. Sign-in failure clears the prior local identity; concurrent refresh requests share one refresh; logout clears local state despite a network failure. Summary state is cleared on sign-out and stale async results cannot restore the previous identity's report.

### Test/build and migration maintenance

- 27 local tests passed, covering workflow, reporting, chart geometry, session handling and messaging control.
- `database/verify-operations.sql` passed as an administrative rolled-back transaction. Includes RLS/role denial, intake idempotency, stale association rejection, atomic evidence linkage, disabled/unverified dispatch, duplicate claims and callback ordering. No provider calls.
- `database/check-operations.py` passed authenticated REST checks: clinician/coordinator summary, patient/caregiver/anonymous/wrong-patient denial, invalid period/session, caregiver intake RLS and persisted synthetic note history. `--write-fixture` deliberately retains a labelled note; default mode is non-mutating beyond sign-in/session creation.
- Browser verified clinician summary, source-record dialog, patient note intake and team acknowledgment/reload persistence. Synthetic test notes remain clearly labelled in history.
- Static build passes with 13 allowlisted browser assets. A build-output check rejects backend/private artifacts. CI definition runs tests/build/output checks on pushes and pull requests; hosted execution status must be checked after publication.

Five original migration files were recovered verbatim from recorded history. The consolidated connected baseline was adopted into remote migration history after proving live/replayed application schema equality; no live schema or patient data was replayed. All nine local and remote migration versions now match.

A PostgreSQL 17.11 installation and real pg_cron extension were used in two disposable Unix-socket-only clusters. All nine migrations applied from empty application schemas, synthetic fixture workflow/role tests passed, a custom-format pg_dump restored into the second fresh cluster, and the same tests passed after restore. Schema comparison covered columns/defaults, constraints, function source/security/grants, RLS policies/flags, indexes, triggers, table/schema grants and bucket configuration. Synthetic data counts matched after restore. Both temporary clusters were stopped and removed.

**Scope of restore proof:** application SQL and synthetic records on real PostgreSQL/pg_cron, with minimal Auth/Storage SQL contracts. It does not restore or validate GoTrue identities/sessions, object-file bytes, Edge Function deployments, provider secrets or external channel services. Those service-level pilot recovery requirements remain in the full-build backlog, not an outstanding bucket 1 database drill.

Reproducible runner: `python3 scripts/verify-rebuild.py --pg-bin <PostgreSQL-17-bin>`. Add `--live-snapshot <file>` to compare against an authorized metadata-only export using scripts/schema-snapshot.sql. See database-rebuild-evidence.json for hashes and observed checks. CI now includes the isolated rebuild/restore job as well as local tests/build.

## Remaining outside this increment

Live WhatsApp/SMS setup, live provider/callback activation and phone testing; policy definitions and broader multi-action conversation UX; structured longitudinal physiology; production enrollment, governance, vendor integrations and staffed response commitments. These remain in buckets 2–4. Backend observability beyond recorded client failures, large-scale performance, full accessibility audit and comprehensive failure/safety coverage also remain ongoing hardening work.

## Reproduce and inspect

Run `npm test`, `npm run build`, `node scripts/check-build.mjs`. Read operations/API/database documentation before live scripts. The operations SQL test needs administrative access and rolls back. `python3 database/check-operations.py` needs locally authorized demo credentials; append `--write-fixture` only when deliberately retaining a synthetic note. Do not run the legacy mutating verifier or reset the consumed Twilio setup-send reservation.

## Release verification follow-up

The hosted verification caught a schedule paging query using `id` instead of the table's `item_id` primary key. Corrected the query and added a workspace-loading contract regression test, bringing the local suite to 27 passing tests. A real private PDF completed unmatched intake → team association → patient verified submission → atomic intake resolution → clinician review → CLOSED; replay returned the same result. This deliberately reopened and re-closed a fictional current investigation and retained labelled source/evidence history. No AI or messaging provider was called.

## Final completion checklist

- Pre-consult summary and evidence/source drill-down: implemented and verified.
- Descriptive operational measures and event foundations: implemented; policy-defined metrics remain bucket 3.
- Messaging infrastructure and server transport adapter: implemented, disabled, fixture-tested; live activation remains bucket 2.
- Unmatched intake, confirmation/rejection/correction safeguards and investigation handoffs: implemented and verified.
- Failure handling, client diagnostics and actual backend health: implemented and verified.
- Expanded regression/role/integration tests, historical pagination, mobile/focus/session/chart fixes: implemented and verified.
- Migration history reconciliation, clean application-schema replay and synthetic dump/restore: passed.
- Documentation and GitHub/Drive handoff: refreshed for this completed bucket.

No bucket 1 acceptance item remains blocked. Full application readiness, broader clinical/product decisions and real-channel testing remain in buckets 2–4.
