# CARE integration verification

> **5 November 2026 update:** Renewable user-scoped account linking and verified original-file review are now implemented locally. See [account/report upgrade](ACCOUNT_AND_REPORTS.md). The dated 3 November record below describes the earlier fixture-only baseline; its absence-of-refresh/original-review statements are superseded by this upgrade. Final live acceptance evidence follows in VERIFICATION.md.

3 November 2026. The connected experiment was exercised on the actual local CARE host, not only a standalone sharing harness. All records used were synthetic. One explicit fixture review was retained in the existing shared development database.

## End-to-end observed result

1. Started an isolated official CARE backend/Celery/PostgreSQL/Redis/MinIO stack and official care_fe, with external plugin registration, dedicated names/volumes and loopback ports. Standard synthetic fixtures loaded once. Created a dedicated clearly labelled synthetic patient, encounter and standard fixture-doctor assignment.
2. Signed into CARE as its existing fixture doctor and opened that patient's actual profile. The WholeCare action was present through PatientHomeActions. Clicking it loaded the federated plugin route inside CARE's shell with shared React and scoped styles.
3. The connected route read 12 recently due/historical confirmed-plan actions from the existing WholeCare database: 9 closed, 1 needing review and 2 unresolved. The actor came from CARE; the server verified the separately mapped WholeCare clinician, membership and synthetic patient.
4. Opened the pending renal-investigation source. It contained three explicitly labelled synthetic report placeholders and no clinical findings. Entered: “CARE integration acceptance: checked synthetic placeholder sources and patient mapping. No laboratory findings or clinical interpretation.” Confirmed once in the actual CARE UI.
5. CARE showed 10/12 closed, zero needing review and the same two unresolved patient actions. Reloading the host retained the closed loop and persisted review trail.
6. Opened the existing hosted WholeCare app as the authorized clinician. Its Activity trail showed the same renal-investigation review, clinician role, REVIEW_PENDING → CLOSED transition, exact note and server timestamp. Direct normal-user REST verification confirmed the persisted loop/note and exactly one matching audit record under the mapped clinician.
7. Replaying that event key returned 200/current state without an extra audit record. Replaying it with a changed note returned 409. No duplicate care action or provider send occurred.

The original app's current-plan view has a different count because this integration also includes confirmed historical-plan actions; this is a bounded follow-up experiment, not a full longitudinal record or a change to the original app's filtering.

## Permission and failure checks

Actual runtime HTTP checks passed:

- Anonymous request denied: 403 (CARE's checked authenticator uses this status).
- Valid but unmapped CARE staff member denied: 404.
- Linked clinician with another/unmapped patient ID denied: 404.
- Stale workspace version denied before review: 409.
- Correctly signed token carrying `patient_login` rather than `access` denied: 403. This checks token-class isolation; a full phone/OTP enrollment flow was not performed.
- Same committed request replay: 200 with one matching audit; changed-note reuse: 409.

Ten pure backend bridge tests passed: exact mapping, expiry, duplicate mapping, unsafe file permissions/wrong project, missing clinician assignment, incomplete evidence cap, real-file review disabled, stale view, persisted receipt replay/changed payload, and delegated-only transport with redirects disabled. These use fake data/transports and make no network/database changes.

Ten frontend behavior tests passed: four connected-adapter tests for fresh staff tokens and CARE-only requests, invalid origin/missing staff denial, cross-patient response rejection/unsupported writes and command/error handling; plus six retained fixture-adapter tests for isolation, explicit review, replay, stale input/state, non-completing follow-up and independent page-local state.

Strict TypeScript/no-unused checks and the production federation build passed. The build verifier checks the standalone page and remote entry and excludes source tests/maps, existing Supabase project configuration and server/provider secret markers from browser assets. The final build contains 19 assets. Dependency versions remain pinned by the existing lockfile. Backend helper scripts compile and their argument interface loads without credentials. The interactive renewal helper's full operator-input flow is not a separately automated live test.

The current local main-app workspace regression suite passed 99 tests and a 23-asset build. That workspace includes other development increments, so this number is not a claim that this CARE commit publishes those unrelated changes. This increment does not change the main app runtime files. GitHub CI separately validates the selected published source.

## Preserved boundaries

Both read-only official CARE core checkouts stayed at the recorded revisions with **zero tracked file changes** after acceptance. Plugin code lives in independent local plugin repositories and is handed off in integrations/care. No CARE/Supabase core schema migration, role grant, password change or service-role key was used. Normal Supabase RLS and existing checked RPCs remain authoritative. No OpenAI request, Twilio/WhatsApp/SMS care send, real medical record or clinical interpretation was made for this increment.

The local backend link contains a short-lived normal clinician access token in an ignored mode-0600 mounted file. It stores no password or refresh token. The frontend receives only a CARE staff JWT; link expiry requires the documented operator renewal. The original hosted app is still Supabase/OpenAI; CARE is local and not deployed to Vercel.

## Remaining verification and implementation limits

Production CARE hosting/HTTPS, durable account-link lifecycle and administrative UI, multiple users/patients/facilities, private-file review inside CARE, non-review task mutations, patient OTP/caregiver/coordinator workflows, localization, full paginated history and complete browser/load/concurrency/security certification remain pending. The stale-view hash is a preflight check, not atomic cross-service/evidence concurrency control. Filly/Medispeak remain unintegrated. Existing messaging/provider work is outside this increment.

Local screenshots record the mounted connected CARE page and matching hosted WholeCare audit. They remain ignored artifacts on the development machine; no authenticated screenshots or credential files were automatically added to GitHub/Drive. Runtime and renewal instructions are in runtime/README.md; protocol constraints are in CONNECTION_CONTRACT.md.

## 5 November 2026 — renewable link and original reports

The upgrade in ACCOUNT_AND_REPORTS.md is implemented locally. Seventeen backend tests, twelve frontend tests, strict TypeScript/build checks (20 browser assets) and all 107 current main-app regression tests passed. These replace the earlier increment's test counts for this working snapshot; unrelated main-app source is not part of this upgrade.

Actual local CARE HTTP checks passed: anonymous connection-config requests denied; mapped fixture doctor can retrieve public sign-in configuration; a disconnected workspace returns 428; another patient mapping returns 404. Both official core checkouts remain unchanged.

The owner explicitly approved a temporary demo-clinician account link for acceptance testing, with disconnection afterward. The actual browser sign-in succeeded. CARE displayed 40 bounded recent synthetic actions from the shared development database. After forcing only the encrypted session's expiry metadata, a CARE refresh exchanged the provider refresh token, persisted the rotated session and returned current data without another password prompt. No token values were printed.

A previously uploaded fictional PDF was fetched through the staff-scoped original endpoint, passed MIME/signature/SHA-256 verification and became available as a temporary local blob link. A separate synthetic test occurrence was then added under the existing active investigation item without resetting existing demo occurrences: 8cb2d3fa-486a-46dc-9a20-282b76281fa4. The existing synthetic patient's normal private-upload/report-submit path uploaded and verified a new fictional PDF; evidence 02d0fd66-4972-424e-b570-fd7c0b1b8f1c became REVIEW_PENDING. The temporary patient sign-in was signed out and no token/password was saved.

CARE showed the new pending task and kept Confirm review and close disabled before the original was prepared/opened. The new original also passed authenticated retrieval and hash verification. Browser automation's security policy rejected navigation to its blob link. The owner was asked to open the fictional PDF manually; no alternate browser or indirect navigation was used to bypass that rejection.

**Live acceptance pending:** manual confirmation that the original was viewed, then final CARE review/save/reload/shared-audit verification. Unit tests cover those review receipt/replay conditions with synthetic transports, but do not substitute for this final live action. No review was submitted after the blocked navigation. A direct shared-database read confirmed the dedicated occurrence remains REVIEW_PENDING with one evidence record, no review note, no closure timestamp and zero review audit events.

**Temporary-link cleanup completed:** Disconnect WholeCare returned the CARE page to its empty connection form without a provider-revocation warning. The encrypted session directory contains zero session files. Actual HTTP checks again confirmed a disconnected mapped workspace returns 428, anonymous access is denied and another patient is denied. The key and empty session directory remain available for a future explicitly authorized connection. No temporary patient or clinician delegation was left active by this test.

No public CARE deployment, WhatsApp/SMS send, clinical interpretation, schema change, password reset or role grant was performed.

The account connection also survived a restart of only this isolated CARE backend; the encrypted grant stayed on its mounted host directory. The draft branch is codex/care-account-reports-20261105, [PR #2](https://github.com/teamact308-creator/Healthathon/pull/2). A clean-checkout main-app test exposed an existing omitted supabase/functions/_shared/vcpi.mjs dependency; that already-tested validator was restored in a separate commit on the draft branch. No changes to the extraction endpoint or clinical behavior were added for that repair.

The baseline public-build checker also assumed 22 top-level files, while its committed build produces 23 top-level files plus one nested public privacy module. A separate repair now recursively verifies an exact 24-file public allowlist, rejects unexpected artifacts and retains server-secret marker checks. The validator restored for backend imports is not added to public output. GitHub's CARE integration checks and Verify browser build both passed at d6a1fc59c886671d57c9db47df944abae7b10ccc (runs 41997024444 and 41997024526). The main check includes the database rebuild job. Later documentation-only commits must be assessed using their own checks before merge.

The final frontend source was copied to the independent local plugin and rebuilt successfully after removing the temporary link. Both official CARE core repositories still have zero tracked changes. The branch remains a draft; this upgrade has not been merged or publicly deployed. Do not treat the earlier placeholder-only live acceptance as proof that the new original-file review write has completed.
