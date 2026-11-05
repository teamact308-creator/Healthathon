# WholeCare inside CARE

Status: **5 November 2026 — local implementation and synthetic live acceptance complete; merged into main.** [PR #2](https://github.com/teamact308-creator/Healthathon/pull/2) adds renewable user-scoped account linking and verified original-report access. Sign-in, refresh-token rotation, persistence through a backend restart, private-file integrity, review/save/reload and disconnection were exercised against the local CARE host and synthetic WholeCare project. The owner manually viewed the fictional PDF after browser automation blocked its temporary link. CARE then closed the dedicated task, retained the exact note after reload and produced one matching clinician audit entry in the shared database. The temporary connection has been removed. See [the complete upgrade guide](ACCOUNT_AND_REPORTS.md) and [dated verification evidence](VERIFICATION.md).

The separate standalone preview still uses page-local fixtures. Supabase/OpenAI and the public Vercel application remain in use. CARE runs on this development machine; this integration is not a public CARE deployment or full platform migration.

## What works now

An authenticated CARE clinician opens the dedicated synthetic patient's profile and selects **Open WholeCare follow-ups**. The federated plugin displays current due/historical care actions, next owner, source context, completion/review counts and persisted review history from WholeCare. Its server checks both CARE permissions and the linked clinician's normal Supabase identity/RLS scope on every request.

One pending synthetic placeholder investigation was explicitly reviewed through the actual CARE UI. WholeCare's shared loop changed from REVIEW_PENDING to CLOSED. The note, mapped clinician actor and timestamp appeared after CARE reload and in the existing hosted WholeCare Activity trail. Replaying its request key did not create another audit; changing its note was rejected.

The upgrade adds a **Connect to WholeCare** form and an encrypted, normally renewable user session capped at seven days. Passwords go directly to WholeCare Auth and are not saved by CARE. Exact CARE/WholeCare user, patient and facility mappings still apply. Disconnect removes the local delegation and attempts provider-session revocation; an unavailable provider does not restore local access.

Supported original PDF/PNG/JPEG files can be retrieved through a staff-scoped endpoint with private Storage access, size/type/signature checks and SHA-256 verification. A clinician must open every listed original and supply a review note. The server requires short-lived, link-bound retrieval receipts before delegating the existing review action. This records explicit review confirmation, not a clinical interpretation or proof of human reading. The new original-file path passed its live synthetic review/save/reload/shared-audit acceptance on 5 November.

Other care writes, patient/caregiver/coordinator experiences, AI extraction, WhatsApp and SMS continue in their existing implementations or backlog. No messages were sent. No CARE core source, Supabase schema or existing role/password was changed. Two independent baseline repository-check repairs restore a missing shared validator and verify the existing public build with an exact file allowlist; they do not deploy extraction logic or add backend files to the public build.

## Two different execution modes

1. **Standalone fixture preview**, `http://localhost:4183/`: four fictional actions held in page memory. Review/follow-up notes reset on reload. It has no verified actor or backend access. `/federation.html` is a built-remote smoke harness, not the CARE host.
2. **Connected CARE workspace**, `http://localhost:47417/wholecare/patient/8bb02ec2-6b42-47d9-8ed3-700bf92a1060`: actual local CARE staff authentication and backend delegation to the existing synthetic WholeCare project. Confirmed reviews use the shared database. Access requires running local services and a valid mapped account connection. The temporary acceptance-test link is disconnected, so sign-in is expected on return. The interface labels its mode.

These loopback links work on the development machine while its services are running. The CARE environment is not hosted on Vercel or an organizer sandbox. The original public demo remains https://healthathon.vercel.app/.

## Run the standalone preview

Use Node.js 22.12+ and npm:

```sh
cd integrations/care
npm ci --ignore-scripts
npm test
npm run build
npm run preview
```

The preview binds loopback port 4183 strictly. `/?patient=unmapped` must show no patient data. Source-development Vite does not serve the production federation entry; use a build plus preview for the CARE host.

## Source layout

- `src/manifest.tsx`: lazy CARE routes and PatientHomeActions extension, with scoped error boundaries.
- `src/FollowUpPage.tsx`: common clinician interface, explicit write confirmation, frozen retry intent and canonical refresh.
- `src/care-adapter.ts`: fresh CARE staff token per request, fixed local backend origin, direct WholeCare sign-in followed by scoped link establishment, original-file retrieval and review receipts. No Supabase session is stored in browser storage and no OTP fallback exists.
- `src/fixture-adapter.ts`: page-local demonstration and fixture idempotency checks; its old `createAdapter('care')` entry deliberately remains unavailable. Connected routes use `createCareAdapter`, never a fixture fallback.
- `backend/`: independent Django plugin, delegated bridge, encrypted session rotation, original-file receipts, legacy short-lived link helper and regression checks.
- `ACCOUNT_AND_REPORTS.md`: current account/file flow, API, key/session storage, limits and rollout status. This supersedes dated legacy-only claims in the older contract/runtime evidence.
- `runtime/README.md`: exact checked local revisions, isolated runtime paths, ports, renewal and start/stop instructions.
- `CONNECTION_CONTRACT.md`: authorization, write/retry semantics and current limitations.
- `VERIFICATION.md`: evidence and unverified boundaries.

The build exposes only `./manifest` through `dist/assets/remoteEntry.js`. `/wholecare/patient/:patientId` is connected; `/wholecare/fixture/:patientId` is an explicitly separate page-memory preview. PatientHomeActions enables only the dedicated synthetic CARE patient ID. UI visibility is convenience; server authorization is mandatory. Unknown patients never fall back to another patient's data.

React and ReactDOM are shared peers. Styling stays under `.wc-care`; the host font is inherited. No host/core types are imported. Source/code tests and server files are excluded from the browser build. CI runs frontend behavior/type/build checks and pure backend bridge tests, without live credentials or shared-demo mutations.

## What is still pending

Remaining: production CARE hosting/HTTPS and distributed secret storage; account-lifecycle administration; multiple clinicians/patients and facilities; broader task mutations, patient OTP/caregiver/coordinator surfaces; localization; paginated full history; production concurrency/load/browser/security testing. The encrypted session store is for one host/filesystem. The workspace hash is a preflight guard rather than an atomic cross-service transaction. Filly and Medispeak have not been adopted. Supabase/OpenAI still serve the existing app.

The connected view is intentionally bounded to at most 40 recent due actions, 1,000 plan items/evidence entries, 100 confirmed plans and 20 review audit records. It is not a complete longitudinal record. The original app's current-plan view may show a different count because this integration includes confirmed historical-plan actions. The browser displays the bounded scope. See the contract before extending it.
