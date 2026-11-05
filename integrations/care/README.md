# WholeCare inside CARE

> **5 November 2026 update:** Renewable user-scoped account linking and verified original-file review are now implemented locally. See [account/report upgrade](ACCOUNT_AND_REPORTS.md). The dated 3 November record below describes the earlier fixture-only baseline; its absence-of-refresh/original-review statements are superseded by this upgrade. Final live acceptance evidence follows in VERIFICATION.md.

Status: 3 November 2026. **A thin, actual local CARE integration is verified with the existing synthetic WholeCare database.** The separate standalone preview still uses page-local fixtures. This increment keeps Supabase/OpenAI and the current Vercel app; it is not a full platform migration.

## What works now

An authenticated CARE clinician opens the dedicated synthetic patient's profile and selects **Open WholeCare follow-ups**. The federated plugin displays current due/historical care actions, next owner, source context, completion/review counts and persisted review history from WholeCare. Its server checks both CARE permissions and the linked clinician's normal Supabase identity/RLS scope on every request.

One pending synthetic placeholder investigation was explicitly reviewed through the actual CARE UI. WholeCare's shared loop changed from REVIEW_PENDING to CLOSED. The note, mapped clinician actor and timestamp appeared after CARE reload and in the existing hosted WholeCare Activity trail. Replaying its request key did not create another audit; changing its note was rejected.

The experiment deliberately permits this fixture-review write only. Uploaded original documents, other care writes, patient/caregiver experiences, AI extraction, WhatsApp and SMS continue in their existing implementations or backlog. No messages were sent. No CARE core source, Supabase schema, existing role/password or current app runtime asset was changed by this increment.

## Two different execution modes

1. **Standalone fixture preview**, `http://localhost:4183/`: four fictional actions held in page memory. Review/follow-up notes reset on reload. It has no verified actor or backend access. `/federation.html` is a built-remote smoke harness, not the CARE host.
2. **Connected CARE workspace**, `http://localhost:47417/wholecare/patient/8bb02ec2-6b42-47d9-8ed3-700bf92a1060`: actual local CARE staff authentication and backend delegation to the existing synthetic WholeCare project. Confirmed fixture reviews persist. Access depends on running local services and a valid short-lived account link. The interface labels its mode.

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
- `src/care-adapter.ts`: current CARE staff token per request, fixed local backend origin, no OTP fallback or Supabase credential.
- `src/fixture-adapter.ts`: page-local demonstration and fixture idempotency checks; its old `createAdapter('care')` entry deliberately remains unavailable. Connected routes use `createCareAdapter`, never a fixture fallback.
- `backend/`: independent Django plugin, user-delegated bridge, short-lived link helper and regression checks.
- `runtime/README.md`: exact checked local revisions, isolated runtime paths, ports, renewal and start/stop instructions.
- `CONNECTION_CONTRACT.md`: authorization, write/retry semantics and current limitations.
- `VERIFICATION.md`: evidence and unverified boundaries.

The build exposes only `./manifest` through `dist/assets/remoteEntry.js`. `/wholecare/patient/:patientId` is connected; `/wholecare/fixture/:patientId` is an explicitly separate page-memory preview. PatientHomeActions enables only the dedicated synthetic CARE patient ID. UI visibility is convenience; server authorization is mandatory. Unknown patients never fall back to another patient's data.

React and ReactDOM are shared peers. Styling stays under `.wc-care`; the host font is inherited. No host/core types are imported. Source/code tests and server files are excluded from the browser build. CI runs frontend behavior/type/build checks and pure backend bridge tests, without live credentials or shared-demo mutations.

## What is still pending

Production CARE hosting/HTTPS and secret management; durable account-link enrollment/rotation/revocation and administrative UI; multiple clinicians/patients and facilities; original-file preview/review inside CARE; broader task mutations, patient OTP/caregiver/coordinator surfaces; localization; paginated full history; production concurrency/load/browser/security testing. Filly and Medispeak have not been adopted. Supabase/OpenAI still serve the existing app.

The connected view is intentionally bounded to at most 40 recent due actions, 1,000 plan items/evidence entries, 100 confirmed plans and 20 review audit records. It is not a complete longitudinal record. The original app's current-plan view may show a different count because this integration includes confirmed historical-plan actions. The browser displays the bounded scope. See the contract before extending it.
