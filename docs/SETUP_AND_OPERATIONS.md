# Setup, operation and recovery runbook

As of 2 November 2026. Read README.md and release-verification.md first. This is a synthetic development demo; production onboarding is not enabled. The existing Supabase project is already provisioned and upgraded.

## Existing environment: normal development

1. Obtain repository access to teamact308-creator/Healthathon and the team project Drive folder. Confirm you are using the team account before writing.
2. Use a current Node installation; Node 25.8.1 was used during verification. The project has no npm dependencies to install.
3. Run `npm start` and open http://localhost:4173/. Browser operations use the configured remote development database; a local page is not an isolated local database.
4. Use assigned fictional role accounts. Passwords live only in protected `.local/demo-accounts.json` in the original workspace, not in the repository or Drive. A fresh clone will not contain them. Arrange an authorized credential reset/provisioning through the project owner rather than guessing a password or disabling Auth.
5. Run `npm test` for six local reference/model checks and `npm run build` for the allowlisted static output. These do not prove that every live RPC and browser flow works.
6. Use BUILD.md for the human walkthrough and release-verification.md for recorded evidence and its limitations.

Do not run seed or upgrade SQL as an application startup step. They are already applied to development. Inspect project identity, schema and existing data before any database mutation.

## New environment: controlled reconstruction

The repository records foundation SQL and a consolidated one-time upgrade, but the later live changes have not yet been reconciled into a complete managed migration history or proved by a clean restore. A fresh build is therefore a pending verification task, not a one-command guarantee.

Provision a separate Supabase project. Create development identities using supported Auth administration tools. Review the foundation/context/index/support SQL dependencies and seed expectations with database/README.md. The seed is for an empty fictional environment with the required four identities/profiles; it refuses duplicates. Apply the consolidated upgrade only after its foundation is present. Capture each step in managed migrations and test in a disposable project before declaring the new environment equivalent.

Deploy all seven Edge Functions with their included deno.json configuration. Configure private buckets/policies through reviewed SQL. Set provider secret names from API_AND_INTEGRATIONS.md; never copy values into source. Update browser public project configuration, allowed function CORS origins and the fixed inbound Twilio webhook URL. Set the actual signed webhook URL in Twilio. Confirm the cron extension/job and its execution history. Use the clinician UI to create and explicitly activate a new plan; legacy seed tasks alone do not prove the scheduling path.

Do not provision production users by directly inserting into Auth internals. Historical fixture setup does not establish a production onboarding method.

## Deployment

The team GitHub repository's main branch is connected to Vercel project healthathon in act-healthathon. Production URL: https://healthathon.vercel.app/. The project uses Other/no framework, build command `npm run build`, output directory `dist`.

Verify the intended source commit and build outcome after publishing. Local files are not automatically on GitHub. This original workspace has been managed with connector commits and may not be a normal Git checkout; inspect before assuming git status or git push describes publication. Browser availability alone does not establish that the newest commit is deployed.

The static output must contain only the explicit browser asset allowlist. `.local`, SQL, credentials, test scripts and source documents must stay out. Documentation edits should not change runtime behavior or require database reapplication.

## Verification by risk

- Local reference tests/build: low risk and repeatable; no remote patient mutations.
- `database/verify-capture.sql`: privileged, isolated transaction with rollback and temporary fixtures. Review before execution; use a database administration context.
- `database/check-openai.py`: role/provider diagnostic; does not run the full extraction workflow.
- `database/check-twilio.py`: role/provider diagnostic without sends.
- `database/check-whatsapp-send.py status`: checks the already reserved setup send; can update the stored technical status. The send action has a real external side effect and is not a routine test.
- `database/verify.py`: legacy live fixture test that changes tasks/consent. It is not an isolated test and may conflict with current active-plan state. Do not run it casually against the demonstration environment.

Earlier full-path REST/PDF/audio experiments used private local scripts and synthetic fixtures. Those are not versioned CI coverage. Preserve the evidence in release-verification.md and reproduce through documented UI flows or build an isolated maintained suite. Do not state that manual/provider checks prove all input, concurrency or failure cases.

## Practical diagnosis

**Cannot sign in:** verify project URL, account assignment and authorized credentials. A public publishable key does not authenticate a user. Inspect user-context/RLS failures rather than granting broad access.

**Source extraction fails:** confirm clinician assignment, allowed file signature/size, private patient-prefixed path, provider secret and quota. Manual entry is the fallback. No extraction result should auto-activate tasks.

**No tasks after saving:** proposed plans intentionally create no occurrences. Review explicit dates/times/timezone, confirmation and active-plan state. Then inspect schedule generation and cron run history.

**Reminder absent:** inspect due state/time, preference, quiet hours, grace period and prior occurrence reminder. Pending outbox means queued internally, not delivered on WhatsApp. Do not create another dispatcher without idempotency.

**Report rejected:** inspect patient/task ownership, allowed task state, file signature/size and duplicate hash. A renamed file with identical bytes is still duplicate content. Clinician review is separately required.

**Voice text is wrong:** edit or abandon it before confirmation. Transcription does not itself change the task. Uploaded audio is the supported path; live microphone and spoken response are pending.

**No WhatsApp reply:** the signed inbound receipt endpoint intentionally returns 204 and does not implement conversation replies. The setup trial template and its reserved send are separate from WholeCare task communication. Check provider delivery status rather than treating queued as delivered.

## Recovery and credential rotation

Rotate exposed provider credentials in their provider console, then update corresponding Supabase secrets. Do not print saved secrets to verify them; diagnose presence and authenticated behavior. Auth token rotation changes signature verification expectations. Avoid logging bearer tokens, file contents, phone values or passwords.

For failed/uncertain messaging, inspect the durable reservation and provider record before retrying. Never remove the singleton reservation to bypass the one-send setup guard. A real message or billing action needs an explicitly intended recipient/action.

For database regressions, preserve history and inspect transaction boundaries before attempting a repair. Never replay the entire baseline or reset demo data merely to clear an error. Automated backup/restore drills, production monitoring, retention and migration reconciliation remain pending. Document the exact repair and verification rather than marking the whole system production-ready.

## Maintaining documentation

Update README status, the backlog and release evidence whenever scope changes. Keep endpoint details in API_AND_INTEGRATIONS.md, data invariants in database/README.md and architecture in ARCHITECTURE.md. Record what was observed separately from what is planned. Republish the Drive handoff derivative after material changes; preserve its file ID rather than uploading dated duplicates. See DRIVE_PUBLISHING.md for locations.

## Operations release additions

Run `node scripts/check-build.mjs` after build. `database/check-operations.py` performs role/read checks by default; `--write-fixture` adds and acknowledges a labelled synthetic note. `database/verify-operations.sql` tests operations/integrity in a rolled-back admin transaction. New operations migrations are applied; do not rerun standalone SQL. The reconstructed connected-baseline migration is already present in live schema but not yet adopted into remote migration history; confirmation expired. An isolated environment is required to prove the complete rebuild/restore chain. Do not blindly run migration push against existing development.
