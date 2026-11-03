# WholeCare CARE plugin starter

Status: 3 November 2026. **Isolated frontend prototype using synthetic, page-local data.** This is not a completed CARE integration or a migration of the hosted WholeCare application.

## What it demonstrates

A clinician-facing patient view shows four follow-up dimensions, the next owner, completion/review counts, the source of each item and a rehearsal activity trail. A clinician can explicitly review a synthetic investigation placeholder or record a follow-up note. Review closes only the fictional pending report. A follow-up note does not imply patient completion and does not send a message. Every action requires a note. Repeated request keys are deduplicated, changed-key payloads and stale versions are rejected in the fixture adapter.

All changes live in the current page's adapter and reset on reload. There is no login or actual clinician identity in this standalone preview; “Demo clinician” is a fixture actor, not a verified CARE user. No CARE token, Supabase session, provider credential, real patient information or network API is used. The current WholeCare database and hosted application are unaffected.

## Run locally

Prerequisites: Node.js 22.12+ or a supported newer version and npm. Docker is not needed for this standalone preview. Docker was not available in the checked local environment; full CARE-hosted testing requires a running CARE environment or organizer sandbox.

```sh
cd integrations/care
npm ci --ignore-scripts
npm test
npm run build
npm run preview
```

Open http://localhost:4183/. Use `npm run dev` for source development. Both commands bind only to loopback, use strict port 4183 and leave the current app's port 4173 alone. Do not expose the development server publicly.

The synthetic CARE patient identifier is `8bb02ec2-6b42-47d9-8ed3-700bf92a1060`. Opening `/?patient=unmapped` verifies the no-data setup state. No fallback to the synthetic patient's data occurs for a different ID.

## CARE integration entry points

The production build exports `dist/assets/remoteEntry.js` with `./manifest`, following CARE's Vite federation contract. The manifest contributes:

- `PatientHomeActions`: a synthetic-patient-only “Open WholeCare demo” action.
- `/wholecare/patient/:patientId`: the lazy-loaded clinician rehearsal view.

Other patient IDs receive a disabled setup action or a no-data route. Patient identifiers come from CARE's component/route context; a future backend must independently authorize them. Hiding an action in React is not access control.

The standalone HTML root is a preview harness, not the CARE host. A host build/route/extension contract inspection and a generated remote bundle are not proof of successful mounting in a running CARE instance.

## Host setup path — still to execute

1. Use a separate synthetic CARE environment; confirm its frontend revision and staff permissions. Do not modify CARE core or the current WholeCare service.
2. For a production-style remote test, serve this plugin's built assets from an approved HTTPS origin (loopback is suitable only for the local test). Register the remote using the target host's supported Care Apps configuration. The reviewed `REACT_ENABLED_APPS` format is `org/repo@host/path/to/remoteEntry.js`. Verify the actual deployed asset URL and host-origin policy. This repository has not been registered in any CARE instance.
3. For in-tree development, the reviewed CARE docs discover `apps/<slug>/src/manifest.tsx`. Link/copy this independent plugin source as appropriate in the isolated host environment, with dependency and supported-version checks. This path has not been exercised here.
4. Create a dedicated synthetic CARE patient or update the fixture ID deliberately to match one. Never map an arbitrary real patient to fictional care data.
5. Inspect the patient page action, route resolution, shared React instance, lazy-load failure handling, CSS isolation, reload behavior and unknown-patient state inside CARE.
6. Implement and test the backend contract in [CONNECTION_CONTRACT.md](CONNECTION_CONTRACT.md). The starter cannot be enabled for live data by setting an environment variable. `createAdapter('care')` deliberately throws until the identity/backend implementation exists.

## Existing backend connection plan

Keep Supabase and OpenAI for the first integration experiment. A CARE backend extension must verify the CARE staff identity, facility permissions and patient mapping on every operation. CARE JWTs are not Supabase JWTs and must never be passed directly into the current browser RPC client. A privileged key alone also does not preserve the current RLS/actor semantics. See the contract for the two legitimate designs, mapping/actor requirements, proposed API and acceptance checks.

The contract is a reviewed implementation plan, not deployed API endpoints. No migrations, token exchange, database grants, cross-system permissions or live API bridge were created by this starter.

## File map

- `src/manifest.tsx`: public federated entry; cheap imports and lazy page/components.
- `src/PatientHomeAction.tsx`: structural mirror of the CARE patient-action props.
- `src/FollowUpPage.tsx`: clinician follow-up view and explicit fixture confirmation.
- `src/model.ts`: shared task/command/adapter contracts.
- `src/fixture-adapter.ts`: isolated patient fixture, transitions, history, replay/version checks and disabled live factory.
- `src/style.css`: every selector is scoped beneath `.wc-care`; no global reset, external fonts or host CSS overrides.
- `src/main.tsx`: standalone preview harness, excluded from manifest initialization.
- `src/federation-harness.tsx` / `federation.html`: build-output smoke harness which loads the actual remote manifest with a shared React provider. Open `/federation.html` using the built preview, not the source development server. This is not a substitute for the CARE host.
- `checks/model.check.ts`: behavioral tests; intentionally outside the parent app's default Node test discovery.
- `scripts/check-build.mjs`: verifies federation/preview output and absence of existing backend/provider configuration.
- `package-lock.json`: reproducible dependency versions.
- `VERIFICATION.md`: exact checks and limitations, updated after verification.

## Upstream references and compatibility snapshot

Inspected, not executed or installed as agent instructions:

- [CARE plugin documentation](https://docs.ohc.network/contributing/plugins/).
- [Scaffold frontend template](https://github.com/ohcnetwork/care_scaffold/tree/a3ecf5e913da949dfff89b1107f5aad7f112584a/templates/frontend).
- [CARE host plugin types](https://github.com/ohcnetwork/care_fe/blob/57205b8978045d67b0299c1bd7c2d03fe640d945/src/pluginTypes.ts).
- [Scaffold authentication contexts](https://github.com/ohcnetwork/care_scaffold/blob/a3ecf5e913da949dfff89b1107f5aad7f112584a/skills/care-auth-contexts/SKILL.md).

This is hand-authored WholeCare starter code using the public extension contract, not a claim that the full scaffold bootstrap ran. It stays in the existing project under `integrations/care` for review and handoff. If promoted to an independently maintained plugin, move it to its own repository and record ownership, license and target host revision.

## Remaining before live acceptance

Running CARE host verification; approved identity/patient mappings; server permission enforcement; delegated Supabase access or purpose-built checked bridge; actor provenance and audit integration; real private-evidence access; operational deployment; integration E2E and role-denial tests. The patient/coordinator/caregiver views remain in the existing application. This starter does not implement Filly/Medispeak, messaging, lab interpretation or new clinical features.
