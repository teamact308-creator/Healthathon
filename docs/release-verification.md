# WholeCare MVP increment - verification, 2 November 2026

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
