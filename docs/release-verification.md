# WholeCare MVP increment - verification, 2 November 2026

## Verified live against development

- Clinician-only plan creation. Patient create attempt denied. Proposed plans create no tasks. Confirmation generates independent occurrences. Revision preserves completed history and pending review, retiring outstanding prior tasks.
- Source image upload plus structured AI extraction of four fictional instructions. A separate source-note test left unspecified dates blank. Original source note/file and model proposals are retained. PDF path is implemented against the documented file-input API; the live extraction file fixture was PNG.
- Once/daily recurrence with multiple daily times. Duplicate generation/confirmation produces no extra occurrences. The cron job is active every five minutes; latest actual job runs succeeded.
- Isolated rollback tests forced overdue reminders, verified one enqueue per occurrence, verified that a reschedule does not recreate the old occurrence, and verified cancellation. Normal quiet hours and patient preference are enforced by the worker query.
- Medication delayed then taken transitions; delayed remains UNCONFIRMED. Repeated request key produced no duplicate event. Meal note with photo and confirmed voice source saved.
- English and Hindi transcription succeeded using locally generated fictional recordings. One English recording misheard a word, demonstrating why transcript editing/confirmation is required. Transcription never writes a task automatically.
- Imported 56 synthetic readings spanning 14 days. Re-importing the same payload inserted zero duplicates. Availability confirmation required recent data. The browser rendered 59 readings including three prior fixtures.
- Real private image report upload passed content signature and binding checks, then REVIEW_PENDING. Repeated request returned the same receipt. Clinician signed preview succeeded. Patient review denied. Clinician review/closure succeeded. SHA-256 duplicate-content constraint and source-path uniqueness are enforced; PDF branch is implemented, with live report fixture PNG.
- Earlier Twilio setup verified both credential types, signed inbound HELLO receipts after token rotation, and one approved package-delivery template reported delivered. No further phone messages were sent during this increment.
- Local browser: clinician sign-in, updated screens, AI proposal editing and populated activity/chart were inspected. Six local regression tests and the build pass. Additional backend rollback and authenticated REST checks cover the new lifecycle.

## Remaining verification and operational limits

This is a development demo, not a completed production or full MVP acceptance certification. PDF extraction/report fixtures, cross-browser recording-file coverage, wider multilingual accuracy, ambiguous/wrong-document matching, sustained worker recovery, timezone DST edge cases, concurrent plan editors and a comprehensive model safety suite need broader coverage. Scheduling uses Postgres timezone conversion; ambiguous/nonexistent local DST times use Postgres' deterministic mapping and are not separately surfaced in the editor.

AI failures preserve manual entry; no proposal activates automatically. The current web frontend refreshes on action/focus or manually, not by realtime subscriptions. Data queries have explicit limits (2,000 observations, 200 activity events, 100 audit/plan events), not complete pagination. Imported numbers are displayed without interpretation.

Unattached files from abandoned/failed uploads currently remain private; retention/orphan cleanup is pending. Storage uses type/size allowlists; source and report endpoints additionally inspect file signatures. Meal images and uploaded audio depend on storage type allowlists and provider decoding. The app is still single selected patient with development accounts and synthetic-only patient data.

The new schema was applied with inspected SQL and is consolidated in database/upgrade-mvp.sql. Reconcile managed migration history and test a clean rebuild/restore before a real pilot. Backend receipt/test tables intentionally have no client policies. The security advisor otherwise retained the existing Free-plan leaked-password-protection warning: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
