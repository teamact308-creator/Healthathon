# Connected development database

Project: `wholecare-diabetes-dev` (`gylnitduoasmybadblcp`), team organization, Mumbai (`ap-south-1`). Synthetic data only.

## Try it

Run `npm start`, then open http://localhost:4173/database.html. The original local-only demo remains at `/`.

Four real Supabase Auth development identities exist: `patient@wholecare.test`, `clinician@wholecare.test`, `coordinator@wholecare.test`, `caregiver@wholecare.test`. These reserved-domain identities do not send or receive email. Each has a different randomly generated password. Credentials are in the local, permission-restricted `.local/demo-accounts.json`, excluded from GitHub and the server's explicit route allowlist. No passwords or secret API keys belong in this repository. `db-config.js` contains only the publishable browser key.

Sign in as Patient and grant support consent; Coordinator can simulate a reminder and route a task; Caregiver sees only the assigned task. Patient attaches synthetic evidence; Clinician enters a review note and closes the loop. The database, not the selected screen, controls all permissions. Use separate browser tabs for simultaneous users. Access tokens stay in page memory and are discarded on reload; sign in again after expiration.

## Schema

`clinics`, `profiles`, `patients`, `care_plans`, `care_plan_items`, `care_loops`, `care_events`, `glucose_observations`, `evidence`, `support_tasks`, `message_outbox`, `audit_events`.

Non-exposed `private` schema holds memberships, consent and idempotency reservations. No direct client writes are granted. Checked RPCs atomically mutate state and append audit events. Test reports require explicit clinician review. Occurrences have independent due times; future tasks cannot be completed early. Caregiver consent starts off and revocation immediately removes support visibility. The private evidence bucket accepts no client uploads yet; fixture metadata proves the workflow first.

## Verification

`npm test` runs local prototype workflow tests. `python3 database/verify.py` runs real Auth and REST checks using local test credentials. It exercises all roles, direct-write denial, caregiver isolation, consent grant/revocation, concurrent idempotent reminders, human review, independent future occurrences and audited reopening. It leaves today's fixtures reopened and consent revoked, preserving the test activity history. If interrupted midway, records may remain changed; inspect/reopen them through Clinician view before repeating.

Remote migration history is managed by Supabase. Source SQL is tracked here: `schema.sql`, `client-context.sql`, `indexes.sql`. `seed.sql` refuses to create duplicate patient fixtures. Development Auth identities were provisioned separately against the inspected Auth schema and verified using real password sign-in; production onboarding must use supported Supabase Auth administration APIs rather than SQL fixture provisioning.

## Remaining work

- Integrate the connected flow into the polished Today UI; `/database.html` is a minimal working integration surface.
- Clinician plan editing and confirmation UI; current plan is an explicitly confirmed synthetic fixture.
- Private file upload verification and evidence binding; currently only a synthetic built-in fixture.
- Scheduled recurrence generation, actual meal/medication status entry and CGM import; currently separate seeded occurrences and sample events.
- Actual WhatsApp delivery/inbound webhook and voice/AI pipelines. Outbox entries currently remain `simulated`.
- Deployment, production onboarding and credential lifecycle hardening.

Security advisor: table/RLS findings were resolved. Supabase still reports leaked-password protection disabled; [the feature requires Pro or above](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This development project uses unique random passwords and remains on the requested Free plan. Performance advisor only reports unused indexes in this small fixture dataset; keep the foreign-key/access indexes for the planned workload.
