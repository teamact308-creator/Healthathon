# Multi-patient management — 5 November 2026

## Delivered scope

One existing care team can manage multiple assigned synthetic patients. The clinician and coordinator now enter through **Patients**, with search by name/ID, filters for overdue activities, reports awaiting review and help awaiting response, plus 12-patient pagination. Summary cards count operational work across the assigned caseload. Counts are not clinical risk scores and the list does not send information to an AI provider.

Open a patient to use the existing care-plan, history, activity, messages, intake and review workflows. A persistent banner shows name and patient UUID; **Change patient** returns to the list. The original patient login stays restricted to Anita. Caregivers continue to receive only consent-scoped support tasks; they do not receive this staff caseload.

## Synthetic scenarios

- Anita Sen: existing profile and history preserved.
- Ravi Mehta: English-language synthetic workspace with 30-day history, 60 glucose observations, four activity dimensions and a practical lunch help request.
- Farah Khan: Hindi-language synthetic workspace with a different 30-day history, 60 observations and one report fixture awaiting clinician review.

Ravi and Farah are staff-side synthetic records, with no new patient login accounts and no caregiver assignment or consent copied from Anita. Their history is deliberately authored demo material, not measured clinical outcomes. The help fixture was seeded by the team; the report fixture contains no laboratory findings. No real prescriptions were created. Existing clinician/coordinator login credentials are unchanged; credentials are not recorded here.

## Data and permissions

The existing patient_id foreign keys and server-controlled private.memberships remain the access boundary. No global patient-read policy was added. `public.assigned_caseload()` is an invoker wrapper around a private, fixed-search-path function that explicitly restricts every returned patient to active clinician/coordinator memberships for auth.uid(). Anonymous calls are denied; patients and caregivers receive an empty list. No caller-supplied patient list or editable JWT metadata grants access.

The overview uses SQL aggregates; it does not load every patient's detailed chart into the browser. Due counts include due open occurrences in active confirmed plans. Overdue means more than 30 minutes past the due time, matching task labels. Reports awaiting review include review-pending occurrences from retained plan history. Help awaiting response excludes closed threads and threads whose latest conversational action is a team reply awaiting the patient. Refresh reloads counts; there is no real-time subscription.

## Safe switching

The selected patient and role are stored in this tab's sessionStorage, bound to the signed-in user. A fresh my_context lookup validates the exact assignment before each switch and workspace load. A removed assignment fails closed rather than opening a different patient silently. Sign-out and failed sign-in clear the selection.

Switching performs a complete document reload. Module drafts, result handlers, recordings, forms, private links and AI-transfer review state therefore cannot be reused in the new patient's screen. Switching is blocked while the app is saving or a dialog remains open. Returning from plan/activity/history editors asks before leaving unsaved input. An already-started server request is not rolled back by navigation; it remains scoped to its original patient. Do not claim navigation cancels a committed operation. Future in-place switching must preserve these guarantees with captured context, cancellation and stale-response checks.

## Implementation and reproduction

- caseload-model.mjs: exact assignment selection, search/filter/order and counts.
- caseload-ui.js: escaped, responsive patient cards, summary and pagination.
- connected-store.js: selection lifecycle, assigned overview RPC and switch validation.
- app.js: staff entry point, persistent identity and reload-based switching.
- supabase/migrations/20261105122434_wholecare_multi_patient_caseload.sql: overview and latest-thread index.
- database/demo-multiple-patients.sql: explicit idempotent seed; run only in the named synthetic demo clinic. It derives IDs and assignments rather than hardcoding them and skips existing named fixtures without resetting their work.
- database/verify-multi-patient.sql and scripts/verify-rebuild.py: transaction-scoped fixture, isolation and revocation checks during local database rebuild.

Run `npm test`, `npm run build`, and `node scripts/check-build.mjs`. Run `python3 scripts/verify-rebuild.py` with PostgreSQL 17 and pg_cron installed for migration replay and restore checks. This local platform fixture is not a full Supabase service backup.

## Verification

130 automated tests passed at delivery. Seventeen live checks with the existing synthetic accounts covered staff/patient/caregiver/anonymous overview scope, direct patient-row isolation, patient denial of another history and mutation, restricted raw-audio access and temporary-file cleanup. A rollback-only database test proved that revoking a clinician's Ravi assignment immediately reduces the caseload and hides Ravi's row. Local browser checks verified search, switching from Ravi to Farah, correct identity banner, distinct queues and the report awaiting review. See multi-patient-verification.json for the captured API checks.

Security advisors introduced no new finding. Existing project findings remain: leaked-password protection is disabled, and six intentionally restricted service/internal tables have RLS with no client policies. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection and https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . These are existing platform follow-ups, not evidence that the app is ready for real patient use.

## Remaining broader scope

Self-service patient invitations, additional login provisioning, assignment/reassignment administration, real-patient onboarding, hospital/organisation tenancy, cross-team delegation, high-volume server-side search/pagination, real-time caseload updates and production clinical/privacy validation are outside this increment. Existing provider-retention gates and WhatsApp/SMS status are unchanged. Team-wide access must never replace patient-specific assignments when those features are added.
