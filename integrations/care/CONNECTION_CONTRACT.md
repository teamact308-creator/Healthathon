# CARE → WholeCare connection contract

Status: 3 November 2026. **Implemented and verified for one local synthetic clinician/patient/facility scope.** This replaces the earlier design-only contract. The fixture preview is retained separately and never substitutes for a failed connected request.

## Trust and identity boundaries

The CARE browser sends its current staff access JWT only to the explicit local CARE backend on port 47416. The connected adapter rereads `care_access_token` for every call, does not consult a patient OTP token, disables redirects and uses no shared Supabase/browser service credential. An unconfigured origin fails before transmission.

The CARE plugin resource routes accept `CustomJWTAuthentication` and an active CARE User with token type `access`. They require CARE's existing patient-view and clinical-data permissions. A matching non-deleted encounter must exist at the server-mapped facility. Browser route IDs never establish authorization or a mapping.

The backend loads a mode-0600, read-only mounted local file with this structure:

```json
{"version":1,"links":[{
  "care_user_id":"CARE staff external UUID",
  "care_patient_id":"CARE patient external UUID",
  "care_facility_id":"CARE facility external UUID",
  "supabase_user_id":"verified WholeCare clinician UUID",
  "supabase_patient_id":"assigned synthetic WholeCare patient UUID",
  "project_url":"https://gylnitduoasmybadblcp.supabase.co",
  "publishable_key":"public project key",
  "access_token":"short-lived normal user access token; never commit",
  "expires_at":0,
  "role":"clinician",
  "synthetic_only":true
}]}
```

This is a descriptive example, not an operational credential file; zero expiry is intentionally invalid. The implementation requires valid UUIDs and rejects unsafe permissions, duplicate/ambiguous scopes, duplicate delegated actors, wrong project/role, non-synthetic scope and expired links. One CARE scope per WholeCare actor is deliberate for this experiment.

Before reads and writes, the delegated `/auth/v1/user` identity and `my_context()` user must match the mapped WholeCare actor; the exact patient must have an active clinician membership and a synthetic=true patient record. All subsequent table reads and `care_action` use that same **normal user bearer**, preserving existing RLS and RPC authorization. No new role, grant, service-role bypass, JWT signing key, schema or privileged impersonation is introduced. The resource server has no account password or refresh token.

The interactive renewal helper obtains an ordinary user session after operator sign-in, validates the above scope and writes its expiring access token. It refuses to retarget an existing mapping. Durable enrollment, delegated rotation and administrative revocation UI remain future work. Removing the link disables the integration; existing credentials/roles remain under their original services.

## API

`GET /api/care_wholecare/v1/patients/{carePatientId}/workspace`

Returns `mode: connected`, the exact CARE patient ID, a synthetic patient display label, actual CARE actor display name, snapshot timestamp, workspace hash version, confirmed-plan source, items and a persisted review trail. Items have the WholeCare loop ID, domain, label, DUE/UNCONFIRMED/REVIEW_PENDING/CLOSED state, next owner, source excerpt/evidence labels, due time and `canReview` flag. No signed private-file URL, access token, password, provider configuration or raw provider error is returned.

The bounded read includes at most 40 recently due non-cancelled loops across confirmed plans, 1,000 plan items/evidence rows, 100 confirmed plans and 20 newest review audit entries. It excludes future tasks. It does not promise a complete clinical or longitudinal record. Reaching the evidence cap makes fixture-only provenance incomplete and disables review. Larger/multi-patient datasets need scoped pagination and explicit completeness semantics before expansion.

`POST /api/care_wholecare/v1/patients/{carePatientId}/loops/{loopId}/review`

Accepts exactly:

```json
{"eventKey":"new UUID for this intent","expectedVersion":"hash from GET","note":"explicit operational review note, 5–1000 characters"}
```

The initial write requires the current workspace hash, a pending report requiring human review and evidence entries that are all synthetic fixture placeholders. The note is trimmed. Original uploaded-file review, other task changes and follow-up notes are unavailable through this bridge. They remain in the existing WholeCare app.

The bridge invokes the existing authorized `care_action(review)` RPC and rereads its persisted audit receipt. It requires the receipt to match actor, loop, action and exact note. The response is canonical current workspace state. A matching replay returns state without another RPC write. Changed-payload receipt reuse yields 409. RPC failures or uncertain outcomes return a safe error and require canonical refresh/same-intent retry, not a claim of success.

The browser preserves the request key and payload after an uncertain submission, locks note editing and offers the same action again or a current-state refresh. It also prevents overlapping submits immediately. The original RPC still owns durable state checks and request deduplication. The workspace hash is a **preflight stale-view check**; the bridge does not introduce an atomic transaction spanning CARE and Supabase, nor an evidence-version lock across concurrent uploads. Broader concurrent document review needs an atomic database contract and separate acceptance tests before production use.

## Denials and errors

Unauthenticated or wrong-token-type requests are denied by CARE (403 in the checked runtime). Unmapped users/patients or failed CARE permission/facility context return 404. Failed delegated membership returns 403. Stale view/changed receipt returns 409. Missing/unsafe/expired links and unconfirmed remote responses return 503. Unexpected exceptions are reduced to a safe message, with only the exception class logged, so development DEBUG tracebacks cannot expose delegated tokens.

CARE patient OTP, patient/caregiver/coordinator writes, real patient records, arbitrary backend origins and cross-patient fallbacks are outside the contract. Hiding React controls alone is never access control.

## Verified acceptance and remaining scope

Actual CARE patient action → federated route → staff authentication/CARE permissions → mapped user delegation → synthetic Supabase task read → explicit fixture review → RPC/audit → CARE reload and hosted WholeCare Activity trail all passed. Anonymous, unmapped staff, wrong patient, stale version, same-key replay and changed-note replay checks passed. A signed `patient_login` token type was separately denied; this was not a full phone/OTP enrollment test.

No production CARE deployment, durable identity federation, real-file workflow, Filly/Medispeak integration, live channel send or full migration is claimed. See VERIFICATION.md for exact evidence and runtime/README.md for restart/renewal instructions.
