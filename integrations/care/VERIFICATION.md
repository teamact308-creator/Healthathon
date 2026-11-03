# CARE integration verification

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
