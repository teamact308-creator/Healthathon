# CARE starter verification

3 November 2026. Standalone browser and build-output federation checks completed locally.

Scope: standalone synthetic UI → page-local adapter → canonical fixture response → updated UI. No live CARE or Supabase bridge is present. Host contract inspection and federation build do not establish runtime compatibility.

## Observed results

- Six behavioral tests passed: dedicated-patient isolation and defensive copies; explicit pending-report review; idempotent replay and changed-payload rejection; stale version/invalid input/state rejection; follow-up note preserving unresolved completion; independent page state and fail-closed live factory.
- TypeScript strict/no-unused checks passed. Vite production build passed. Build verifier found the standalone page and `assets/remoteEntry.js`, with no source tests, source maps, existing Supabase URL, server credential names or provider configuration in the public assets. Final build contains 18 assets, including the federation smoke harness.
- npm installation audit reported zero vulnerabilities. Dependencies are exact-pinned with a committed lockfile. The test runner uses Node's tsx import hook rather than the CLI's unnecessary local IPC listener.
- Browser loaded the built standalone page on localhost port 4183. Initial summary: 4 actions, 2 closed, 1 needing review, 1 awaiting the patient.
- Explicit synthetic review changed counts to 3 closed and 0 needing review, preserved the patient task as unresolved, and recorded the actor, note and time in the page-local trail. Source remains the synthetic placeholder; no real document was reviewed.
- Saving a fictional follow-up note left the task awaiting the patient and explicitly reported that no message was sent.
- Reload reset all page-local actions. `/?patient=unmapped` displayed the connection-required state with no patient fixture or task data.
- `/federation.html` loaded the actual production remote entry and manifest, supplied React/ReactDOM through its sharing registry, and rendered the lazy patient route. This checks the bundling boundary but not CARE host discovery, routing, authentication or permissions.
- The original application still passed all 48 existing tests and its 20-asset build/allowlist checks. No current app runtime asset was changed by this increment.

## Review decisions

Component hooks have stable dependencies, pending workspace requests are discarded on scope changes, route instances are keyed by patient, notes render as React text, submit handling has an immediate duplicate-click lock, and every CSS selector is scoped beneath the plugin root. Forms use explicit labels, native required/minimum-length checks, focus on the opened source heading and polite status feedback. The manifest lazy-loads its view and extension component. The standalone root is separate from the federated entry.

## Unverified and deliberately absent

No Docker/full CARE environment was available. The actual CARE host was not started, modified or tested. No backend/plugin registration, verified user mapping, credential exchange, schema migration, production deployment of this prototype, remote patient data access, private-file integration, provider send or real clinician authentication occurred. Mobile layout has responsive rules but no device/browser matrix was exercised. The code is a fixture-backed starter and connection contract, not a live integration.

Required next acceptance evidence is in CONNECTION_CONTRACT.md and README.md. Root CI remains responsible for the existing application; a separate CARE prototype workflow installs the nested package and runs its tests/build without adding React dependencies to the main app.
