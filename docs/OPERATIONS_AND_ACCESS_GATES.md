# Operational and access gates — 6 November 2026

This is a synthetic development service. These procedures do not authorize real patient onboarding, clinical advice, permanent deletion, paid upgrades, new staff access or external care messaging.

## At the start of an engineering session

1. Read README, INDEPENDENT_DELIVERY and mvp-and-product-review. Check the current main commit, deployment status and Supabase migration list before changing anything. The shared workspace may not be a Git checkout; use a clean checkout elsewhere or the documented Git tree publication lease. Never overwrite another contributor's changed files.
2. Keep test passwords, access tokens, service keys, signed file URLs and generated manifests in .local or an approved secret store. No browser client may receive a service key. Use a dedicated isolated scenario for tests; do not reset shared testers' data.
3. Run npm test, npm run build and node scripts/check-build.mjs. For schema changes run scripts/verify-rebuild.py and inspect database advisories. The rebuild uses minimal Auth/Storage contracts and an offline network fixture, not a full Supabase platform restore.
4. Inspect the selected patient's identity before writes. Staff assignment is rechecked by the server. An expired or revoked assignment must fail closed; never substitute another patient to recover an error.

## Incident checks and recovery

- Frontend fails to load: inspect the Vercel build/status and browser errors, confirm every imported module is in the explicit build allowlist. Do not add backend handlers or .local to the static output.
- Sign-in fails: distinguish invalid credentials, expired sessions and service outage. Reauthenticate through normal Auth. Do not reset passwords or widen access to make tests pass.
- Care operation fails: inspect the operation's audit/event and current occurrence state first. Retry only with the same idempotency key. Never show success before the persistence response or create a replacement event to conceal a failure.
- Report upload/review: verify patient path, allowed type/size, source bytes, evidence receipt and REVIEW_PENDING. Review closes only through the clinician action. A rejected upload must not produce completed care state. Short-lived links can expire; prepare a fresh link through current access rather than extending its exposure.
- AI outage or unclear response: retain the reviewed source where authorized, show the error/clarification and offer manual entry. Do not reinterpret a failed provider call as an outcome. Preserve failed evaluation cases and provider/model version.
- Scheduler: inspect operational_health and due occurrences. An operational time-window measure is not clinical risk. DST duplicates/nonexistent clocks now require manual review; do not silently shift a medication schedule.
- Messaging: WhatsApp/SMS remain on hold. Inspect jobs only; do not enable gates, enroll real phones, schedule sending workers or replay uncertain sends. A provider delivery acknowledgement is not patient completion. The staged inbound proposal schema is excluded from normal migrations pending explicit approval.
- Database recovery: use a separately isolated target, replay migrations and verify grants, RLS, triggers, role-denials and fixture counts. The local dump/restore evidence excludes actual Auth sessions, Storage object bytes, Vault encryption, Edge Functions and provider delivery. Do not claim full platform disaster recovery. Preserve production data and obtain explicit authorization before any destructive restore.

## Prepared onboarding contract; implementation decision required

The current system has assigned patient/team memberships and clinician-scoped synthetic provisioning. It does not establish who may administer real staff or invite real patients. Before a real invitation/assignment endpoint is implemented, the owner must select an administrator role and facility boundary, approve identity verification and invitation expiry/revocation, decide reassignment/history policy and audit access. Use server-issued invitations, no client-editable role metadata, one-use expiring acceptance and current membership checks. No public self-selection of clinician/coordinator roles. Do not reuse demo provisioning as real onboarding.

## Retention, export and privacy boundary

Existing voice retention is explicit and scoped to its approved rules. The patient JSON download includes only loaded authorized records and excludes private paths, signed links, credentials and original file bytes. Thirty-day trends have a separate CSV. Neither is a complete legal export. A full export requires server-side pagination, original-file collection, identity verification, expiry and download audit. General record retention, backups, legal holds, deletion/anonymization and downstream provider erasure need owner-approved rules; no arbitrary deletion period is inferred.

## Monitoring boundary

Current facilities include platform logs/advisories, scoped operational health, processing-failure records, revision checks and reproducible fixtures. They are not continuous staffed monitoring or a guaranteed incident response service. Assign a human incident owner and approved notification destination before configuring external alerts. Never send raw notes, documents, tokens or phone numbers in an alert payload. Clinical safety and pilot outcome validation remain human work.
