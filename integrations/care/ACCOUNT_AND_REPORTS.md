# Renewable account connection and original-report review

Updated 5 November 2026. This is the local CARE upgrade following the 3 November fixture-only integration. It keeps the existing WholeCare database, identities, private Storage, report-submit function and authorized review RPC. No CARE core file, Supabase schema, role grant, provider setting or public deployment is changed by this upgrade.

## Account experience

Sign into the local CARE staff workspace and open the dedicated synthetic patient. An unlinked workspace shows **Connect to WholeCare**. Enter the existing assigned WholeCare clinician email/password. The browser sends the password directly to the configured WholeCare Auth endpoint; CARE receives the fresh refresh token through its staff-authenticated connection endpoint. Neither the password nor Supabase session is placed in browser storage by this plugin.

The server exchanges that fresh token, checks the resulting /user identity, my_context clinician assignment and synthetic patient, then saves an encrypted session bound to the exact existing CARE user/patient/facility and WholeCare actor/patient allowlist. Sign-in does not create memberships, accept arbitrary patients or retarget the mapping.

Access tokens renew when within 60 seconds of expiry. Scope-specific file locks serialize rotation across processes on this single host, and encrypted replacements are flushed and atomically saved. The same lock covers delegated operations and disconnection. A link lasts at most seven days from connection; activity does not extend that limit. Invalid provider refresh or link expiry requires a new sign-in. Temporary network failures retain the encrypted link and display a retryable error instead of silently replacing identity.

**Disconnect WholeCare** removes local delegation and tries to revoke only that provider session (scope=local). Other WholeCare sign-ins are not intentionally signed out. If provider revocation cannot be confirmed, the UI says so; local access remains removed. Already downloaded files cannot be recalled. Provider-wide sign-out/revocation is not claimed to invalidate an existing access JWT immediately: short token expiry, provider /user checks and current RLS/membership checks still apply. The plugin's explicit local disconnect prevents subsequent operations through that link.

The server does not fall back to an expired/legacy access token after disconnect when renewable linking is configured. A reconnect gets a new link identity, invalidating earlier report receipts. The encrypted grant is an ordinary user session; no service-role key, password or provider secret is introduced.

## Original-report experience

The normal patient upload path remains WholeCare's existing private upload and report-submit workflow. This upgrade does not add patient uploads inside the CARE clinician screen.

Open a report task in CARE and choose **Prepare original report**. The backend rechecks CARE scope and current WholeCare identity/membership, looks up the exact evidence ID under the mapped patient and loop, and retrieves the original using that normal user bearer. The client cannot select a bucket, URL, storage path or patient identity.

Only previously validated, non-placeholder evidence with a stored SHA-256 and an allowed patient-owned PDF/PNG/JPEG path can open. The backend disallows redirects, limits the body to 10 MiB, checks response MIME and file signature, and compares downloaded bytes to the registered hash. It sends private/no-store bytes plus a 20-minute authenticated receipt bound to the current link, loop, evidence ID and hash. No Storage credential or signed public-download URL is exposed.

The UI creates a temporary blob link, and **Open original report** opens it in a separate tab. It requires opening every listed original before enabling **Confirm review and close**. Notes remain mandatory. The server independently requires a valid receipt for every current original; missing, forged, expired or another-link receipts cannot authorize a new review. This is a record of verified file retrieval plus explicit user confirmation, not proof that a human read or clinically assessed the document. No AI interpretation or clinical findings are generated.

The initial write still requires a current workspace hash and a pending reviewable task. The existing care_action RPC owns clinician authorization, closure, next owner, durable deduplication and audit. An identical committed request can replay without another write; changed loop/action/note reuse is rejected. Refreshing the page clears unsaved notes, blob links and report-opening receipts but retains persisted reviews.

All originals on the loop must have supported verified metadata, with at most eight originals per review. A capped evidence read disables new review. Unsupported or incomplete originals remain for resolution in the existing application. Closed report tasks can still expose authorized original files without reopening their care loop.

## API and runtime

Staff-only routes below share the existing CARE patient/facility permission checks:

- GET v1/patients/{carePatientId}/connection returns public sign-in configuration.
- POST the same route accepts exactly refreshToken and creates the checked encrypted link.
- DELETE removes that mapped owner's local link, even if their clinical access has since been withdrawn. It still requires their valid CARE staff authentication and exact allowlist ownership.
- GET v1/patients/{carePatientId}/loops/{loopId}/reports/{evidenceId} returns verified original bytes and X-WholeCare-Report-Receipt.
- POST the existing review route additionally accepts reportReceipts, an evidence-ID-to-receipt map. The response remains canonical connected workspace state.

All paths are under /api/care_wholecare/. Missing/expired delegation returns 428; anonymous or wrong-token-class access is denied; wrong patient/unmapped staff is denied. Error payloads and logs omit credentials and raw provider bodies. The browser rereads its CARE access token on every call; no patient OTP fallback exists.

Required runtime settings:

- WHOLECARE_LINKS_FILE: existing operator-maintained mode-0600 scope/public configuration file. Its old access-token fields are not used while renewable linking is enabled.
- WHOLECARE_SESSION_DIR: mode-0700 writable directory; contains encrypted sessions and scope locks.
- WHOLECARE_SESSION_KEY_FILE: separate mode-0600, read-only mounted Fernet key file. Generate once with Python's base64.urlsafe_b64encode(os.urandom(32)); do not print or replace it during routine restarts.
- Expose X-WholeCare-Report-Receipt through CORS only for the explicit local CARE/plugin origins. The plugin-owned dev settings and runtime Compose template include this.
- Install cryptography==48.0.0 alongside the existing CARE dependencies. The CI bridge job installs the same pin.

The new runtime Compose template takes WHOLECARE_SESSIONS_HOST_DIR and WHOLECARE_SESSION_KEY_HOST_FILE in addition to the existing plugin/link paths. Keep the directory and key across restarts. Never commit, upload, serve or paste instantiated link files, keys or sessions. Losing the key requires reconnecting the affected users; it does not justify silently weakening encryption.

The legacy interactive link_account.py helper supplies a short-lived legacy link only. It does not initialize this new renewable store; use the CARE connection screen when renewable linking is enabled.

## Verification and release limits

Automated checks cover encrypted persistence, concurrent refresh, wrong identity rejection, disconnection, invalid versus temporarily failed refresh, scoped original retrieval, checksum failure, expired/cross-link/cross-version receipts, mandatory original receipts, replay, stale views and frontend credential routing. Runtime/browser evidence is recorded in VERIFICATION.md.

This remains a local synthetic demonstration, not a public CARE deployment or production identity service. The grant store supports one host/filesystem; multiple replicas require a transactional shared secret store and suitable key management. Current file locking is not a distributed lock. Original-file checks are not antivirus or a full PDF parser. The workspace hash is a preflight guard, not an atomic cross-service evidence-version transaction. Production rollout, broader personas/patients, lifecycle administration, localization and full clinical/security validation remain separate work.
