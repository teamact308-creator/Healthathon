# Draft CARE → WholeCare backend contract

Version 0.1, 3 November 2026. **Design contract only. No endpoint described here is deployed.** The running prototype uses the fixture adapter exclusively. Current data types and UI are limited to its synthetic clinician workflow; a connected adapter must undergo a separate implementation/review.

## Proposed request boundary

CARE frontend → CARE backend plugin → authorized WholeCare operations in the existing Supabase project. OpenAI functions remain behind the existing trusted server boundary. The frontend must not receive service keys, provider keys or a shared privileged session. Do not reuse a browser account as a universal clinician service identity.

The draft CARE backend base path is `/api/care_wholecare/v1`. It uses the target CARE version's staff authentication, rather than accepting a client-supplied role or actor. Patient OTP and caregiver sessions are outside this first staff integration and must be denied until separately implemented.

## Required identity and authorization sequence

1. Validate the CARE staff access token with CARE's configured authentication. Verify expiry/revocation according to that deployment. Do not merely decode unsigned JWT claims.
2. Resolve an active server-owned CARE-user → WholeCare-actor mapping and CARE-patient → WholeCare-patient mapping. IDs are foreign identifiers, not proof of access. Map the facility context and ensure it matches the patient's authorized context.
3. Check CARE permissions plus the mapped WholeCare assignment and allowed operation. Coordinator read/follow-up scope must not authorize clinician evidence review. Recheck on every mutation; navigation visibility is not authorization.
4. Choose one explicit Supabase delegation design before implementing:
   - **User-delegated access:** link and verify an actual WholeCare/Supabase user session, keeping tokens server-side with revocation/expiry. Call existing checked RPCs under the assigned user. Do not automatically link by an unverified email string.
   - **Purpose-built service bridge:** add service-only checked functions which accept a trusted, verified actor/mapping and enforce the same assignment, consent, state, idempotency and audit requirements. This requires a reviewed migration and role-denial tests. Existing service-role access bypasses RLS and cannot be treated as equivalent to a user session. Current RPCs rely on `auth.uid()`; passing a random actor argument does not retrofit them safely.
5. Return a purpose-limited workspace. Never return raw tokens, global membership lists, provider responses or unrelated patient rows. A missing/unauthorized mapping must not fall back to another patient.

## Proposed API shape

### GET `/patients/{care_patient_id}/workspace`

Read a mapped patient's follow-ups and permitted source summaries. Response fields mirror `Workspace` in `src/model.ts`: mapped CARE patient ID, minimal patient label/reference/facility, data mode, version, snapshot timestamp, agreed plan source, items and scoped audit trail. Connected mode and concrete cursor/version semantics must be added and tested when the bridge is implemented. The current model explicitly uses `mode: 'fixture'` and cannot silently accept a live response.

Each item includes the real WholeCare occurrence ID, domain, display label, state, next owner, source summary and record timestamp. This prototype intentionally has only one synthetic patient and a bounded list; real pagination is not specified by this stub.

### POST `/patients/{care_patient_id}/loops/{loop_id}/review`

Body: `{ eventKey, expectedVersion, note }`. Caller must be an assigned clinician in both systems. Validate mapped occurrence/patient binding, current review-pending state, an explicit review note and the expected version in one transaction. Preserve the original evidence and source linkage. Do not turn OCR extraction or document availability into a clinical review automatically.

### POST `/patients/{care_patient_id}/loops/{loop_id}/follow-up-notes`

Body: `{ eventKey, expectedVersion, note }`. Persist an authorized operational note with the verified actor and reason. It must not complete the patient's task, send a provider message or change consent. The existing backend does not have this exact route/operation; decide whether to extend an existing audit/intake operation or add a checked function. The fixture's in-memory method is not proof of persistent support.

### Replay, concurrency and errors

Use stable UUID request keys for retries of the same action. Same key + same actor/mapping/body returns the original receipt; same key with changed payload returns conflict. Preserve expected state/version checks and transactional locks. Return server-generated canonical state and timestamps, rather than applying optimistic completion in the UI.

Use 401 for missing/expired authentication, 403 for an authenticated operation denial, 404 for an unavailable mapped resource where existence should not be disclosed, 409 for stale state/key conflict, 422 for invalid input and 503 for an unavailable integration. Return bounded stable error codes/messages without secrets or raw database exceptions. Identity changes or an ambiguous mutation response must not cause a blind retry with a new key.

## Private files

Evidence URLs require a fresh access check and short expiry. They must remain scoped to the patient, report and clinician purpose. Do not proxy global storage credentials, publish permanent object URLs, or place real records into static fixture files. Accessed source and audit provenance must survive the bridge. Current prototype source panels are synthetic text only and do not exercise storage access.

## Acceptance tests before enabling connected mode

- A mapped, assigned CARE clinician reads only the intended synthetic patient's workspace and reviews a pending report; the same persisted result is visible in the existing WholeCare app.
- An unassigned staff user, unrelated facility, coordinator review attempt, patient OTP token, revoked mapping and missing/expired token are denied.
- Swapped patient/loop IDs, another user's request key and stale versions cannot mutate data.
- One repeated confirmation creates one audit/event result; ambiguous transport failures are reconciled safely.
- A follow-up note leaves patient completion unresolved and causes no provider send.
- Review keeps evidence immutable and traceable; private-file access is denied outside the authorized assignment.
- Sign-out/patient changes discard pending proposals and stale responses; a missing mapping never shows fixture or another patient's data.
- No secret enters the browser bundle; rollback removes only the integration and preserves existing care history.

## What this increment actually implements

Only the local adapter interface, its synthetic implementation and the associated frontend interactions/tests. It makes no change to Supabase Auth, RLS, schemas, functions, storage, CARE permissions or current deployed accounts. The authentication bridge is the main remaining implementation boundary.
