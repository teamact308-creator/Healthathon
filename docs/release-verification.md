# WholeCare MVP increment - verification, 2 November 2026

**6 November reconciliation:** read [INDEPENDENT_DELIVERY.md](INDEPENDENT_DELIVERY.md) for the current 25-item execution record and [OPERATIONS_AND_ACCESS_GATES.md](OPERATIONS_AND_ACCESS_GATES.md) for access, export, messaging hold and recovery boundaries. Older dated implementation notes below are historical and do not override this evidence. D01–D07 remain release gates where hosted acceptance is incomplete.

## Verified live against development

- Clinician-only plan creation. Patient create attempt denied. Proposed plans create no tasks. Confirmation generates independent occurrences. Revision preserves completed history and pending review, retiring outstanding prior tasks.
- Source image upload plus structured AI extraction of four fictional instructions. A separate source-note test left unspecified dates blank. Original source note/file and model proposals are retained. PDF-only extraction also passed: one explicit task/time was retained and unspecified dates remained blank.
- Once/daily recurrence with multiple daily times. Duplicate generation/confirmation produces no extra occurrences. The cron job is active every five minutes; latest actual job runs succeeded.
- Isolated rollback tests forced overdue reminders, verified one enqueue per occurrence, verified that a reschedule does not recreate the old occurrence, and verified cancellation. Normal quiet hours and patient preference are enforced by the worker query.
- Medication delayed then taken transitions; delayed remains UNCONFIRMED. Repeated request key produced no duplicate event. Meal note with photo and confirmed voice source saved.
- English and Hindi transcription succeeded using locally generated fictional recordings. One English recording misheard a word, demonstrating why transcript editing/confirmation is required. Transcription never writes a task automatically.
- Imported 56 synthetic readings spanning 14 days. Re-importing the same payload inserted zero duplicates. Availability confirmation required recent data. The browser rendered 59 readings including three prior fixtures.
- Real private image report upload passed content signature and binding checks, then REVIEW_PENDING. Repeated request returned the same receipt. Clinician signed preview succeeded. Patient review denied. Clinician review/closure succeeded. SHA-256 duplicate-content constraint and source-path uniqueness are enforced; A separate private PDF upload, preview and clinician review/closure test also passed. The duplicate-content constraint was exercised in a rollback test.
- Earlier Twilio setup verified both credential types, signed inbound HELLO receipts after token rotation, and one approved package-delivery template reported delivered. No further phone messages were sent during this increment.
- Local browser: clinician sign-in, updated screens, AI proposal editing and populated activity/chart were inspected. Six local regression tests and the build pass. Additional backend rollback and authenticated REST checks cover the new lifecycle.

## Remaining verification and operational limits

This is a development demo, not a completed production or full MVP acceptance certification. More malformed/encrypted/large PDF coverage, cross-browser recording-file coverage, wider multilingual accuracy, ambiguous/wrong-document matching, sustained worker recovery, timezone DST edge cases, concurrent plan editors and a comprehensive model safety suite need broader coverage. Scheduling uses Postgres timezone conversion; ambiguous/nonexistent local DST times use Postgres' deterministic mapping and are not separately surfaced in the editor.

AI failures preserve manual entry; no proposal activates automatically. The current web frontend refreshes on action/focus or manually, not by realtime subscriptions. Data queries have explicit limits (2,000 observations, 200 activity events, 100 audit/plan events), not complete pagination. Imported numbers are displayed without interpretation.

Unattached files from abandoned/failed uploads currently remain private; retention/orphan cleanup is pending. Storage uses type/size allowlists; source and report endpoints additionally inspect file signatures. Meal images and uploaded audio depend on storage type allowlists and provider decoding. The app is still single selected patient with development accounts and synthetic-only patient data.

The new schema was applied with inspected SQL and is consolidated in database/upgrade-mvp.sql. Reconcile managed migration history and test a clean rebuild/restore before a real pilot. Backend receipt/test tables intentionally have no client policies. The security advisor otherwise retained the existing Free-plan leaked-password-protection warning: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Independent engineering increment — 2 November 2026

See [bucket 1 delivery](bucket-1-delivery.md). 27 local tests and 13-asset build/output verification passed. Operations SQL assertions passed with rollback, including stale match rejection and no care closure on delivery. Authenticated REST checks passed for scoped summary, denied roles/anonymous/wrong patient, invalid session/period and intake persistence. Browser showed summary and linked original-record details, plus patient note/team acknowledgment. No external messages or AI calls were made for this increment. New synthetic note fixtures are labelled and retained. Historical migration adoption and clean restore remain pending; the full cross-channel acceptance gate is not complete.

Follow-up: hosted check found and corrected a schedule sort key (`item_id`, not `id`); workspace-loading regression added. Full private PDF intake/association/submission/review integration passed with replay protection and atomic intake resolution. The fictional test occurrence was returned to CLOSED and labelled history retained.

## Bucket 1 completion verification — 3 November 2026

All nine migrations replayed on an empty application database with real PostgreSQL 17.11/pg_cron; capture/operations/role tests passed. Expanded schema metadata matched live, including grants, indexes and triggers. pg_dump restored to a second clean cluster; schema, data counts and workflow/permission tests matched. Historical baseline adoption succeeded without replaying DDL/data on the hosted project. Read the delivery record for the Auth/Storage contract-fixture limitation and full-platform recovery exclusions. Twenty-seven local tests passed, including keyset observation paging and server transport fixtures. Backend health and role-denial checks passed.

## Messaging rehearsal — 3 November 2026

- Local browser patient session: simulated permission, task selection, reminder and unknown receipt; late accepted receipt retained unknown. STOP withdrew permission and disabled reminder. No provider request occurred.
- Confirmed NOTE wrote one unmatched intake record (`b46aa6ec-a96e-4952-94ac-bf1944b4761f`) through existing patient RPC, without task closure.
- Added one dedicated fictional test occurrence (`c3de727b-919b-4b58-9be4-124c37b7299e`) under the existing active fictional investigation item; did not reset existing care occurrences or the consumed setup-send reservation. This is retained synthetic test data, not a production care schedule change.
- REPORT preview opened the existing private upload form. Previously submitted fixture content was rejected; distinct existing fictional-source.png was accepted, producing REVIEW_PENDING with clinician ownership. This fixture contains software-only instructions, no lab findings; it verifies file transport/review mechanics, not clinical report interpretation.
- Assigned clinician session prepared the private original link, then recorded an explicit software review. SQL readback confirmed CLOSED, next owner none, exactly one verified evidence and one review for the dedicated occurrence. Simulated delivery alone never closed the task.
- 37 automated tests passed, including worker/callback boundary fixtures and deterministic reply safeguards. Static build contains 16 reviewed browser assets; server transport/orchestration and test/credential files remain excluded.
- No schema migration or live WhatsApp/SMS enrollment/gate changes. Simulation permission/transcript is memory-only; real care records are database-backed. Server worker and status-handler contracts are not deployed or wired to a durable repository. Live provider acceptance remains blocked by suspension and the activation work in MESSAGING_REHEARSAL.md.

## Bucket 3 acceptance - 3 November 2026

- Patient browser: typed medicine/breakfast/future-test source produced three separate proposals. One selected meal occurrence was confirmed with a supplied activity time; a future test was separately confirmed as an unmatched planned-action note. The medication proposal was not auto-saved. Reload retained shared care records and cleared draft proposals.
- Existing fictional WAV uploaded through the new intake UI and transcribed by the existing server function. Transcript appeared in the editable source field, with no care change until confirmation. The transcription contained an imperfect word; manual review/edit remains required.
- Patient browser saved fictional HbA1c 7.2%, corrected to 7.1%, and retained both records/source/reason. All four context kinds and invalid-unit/role rejection are exercised in rollback SQL.
- Patient browser corrected the new meal description with a reason; the original remained in before/after history. SQL checks also exercised taken-to-missed reopening, idempotent replay and stale-editor rejection.
- Assigned clinician browser saved labelled synthetic operational windows (glucose completion intentionally blank). Review summary returned separate eventual and on-time measures, participation, outstanding age, monitoring availability, correction count and source-linked current HbA1c. These fictional values prove calculation paths, not clinical outcomes.
- Clinician browser saved an inactive weekly Monday/Wednesday/Friday draft; existing active plan retained. Disposable/rolled-back SQL confirmed weekly activation/generation, expected weekdays, replay deduplication and no regeneration of rescheduled original slots. Final editor presents weekday names as checkboxes.
- 42 Node tests passed; build/static allowlist contains 18 public browser assets. Eleven migrations replayed successfully, matched live application metadata, then passed dump/restore and all three SQL workflow/role suites. See bucket-3-verification.json for migration hashes and scope.
- Hosted schema migration/rollback-role tests passed. Security advisors report the pre-existing five intentional deny-all tables and existing leaked-password-protection setting; no new bucket 3 warning. No live provider send, phone enrollment, channel gate or clinical threshold changed.
- Scope details and later work: BUCKET_3_DELIVERY.md. This accepts the four agreed bounded web capabilities, not full MVP/production readiness, general semantic LLM interpretation, historical policy reconstruction or full Supabase service recovery.


## Password recovery increment — 3 November 2026

- Added Forgot password email recovery and signed-in Change password with same-account current-password verification. Persona IDs and care memberships are retained.
- Supabase Site URL is https://healthathon.vercel.app/. Owner approved both exact reset redirects; dashboard visibly lists https://healthathon.vercel.app/?reset=1 and http://localhost:4173/?reset=1 (Total URLs: 2).
- 48 automated tests pass, including mocked recovery/update/logout, account mismatch rejection and password validation. Production build and static asset checks pass with 20 public assets.
- Local browser opened recovery, rejected undeliverable .test email with guidance, returned to sign-in, and opened signed-in Change password. No persona password was changed and no real recovery email was sent. Real-inbox delivery and user-completed password submission remain unverified. See PASSWORD_RECOVERY.md.


## Connected local CARE integration — 3 November 2026

Actual CARE patient action, federated mounting, staff authentication/CARE permissions, normal-user Supabase delegation and one explicit fixture report review passed. The loop and exact audit persisted after CARE reload and in hosted WholeCare. Anonymous/wrong staff/wrong patient/patient-token-type/stale-view requests were denied; replay did not duplicate the audit and changed-note reuse returned 409. Ten frontend and ten backend bridge tests plus strict TypeScript/federation build passed locally. No tracked CARE core changes, schema/grant/password changes or provider send occurred. This is local-only and depends on an expiring account link; the standalone preview remains page-local. See [complete evidence and limitations](../integrations/care/VERIFICATION.md) and [restart/renewal](../integrations/care/runtime/README.md).


## Patient UI implementation — 3 November 2026

Patient navigation, Today cohorts, confirmed-plan presentation, occurrence detail and direct capture are implemented. See [delivered scope, code map, actual verification and remaining release gates](PATIENT_UI_DELIVERY.md). Earlier planning-only language is historical for those portions. Do not infer that all P0 investigation rehearsals or the full accessibility/failure matrix have passed. Existing CARE integration and backend authorization are retained.
