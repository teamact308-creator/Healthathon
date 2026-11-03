# WholeCare delegated CARE backend plugin

Status: 3 November 2026. Tested in an isolated CARE instance. This package is plugin-owned code derived from the official care_scaffold backend template. It adds no CARE model, migration, role, or core change.

The staff-only routes are mounted by CARE at `/api/care_wholecare/`:

- `GET v1/patients/{carePatientId}/workspace`
- `POST v1/patients/{carePatientId}/loops/{loopId}/review` with exactly `eventKey`, `expectedVersion`, and `note`.

Every resource request checks an active CARE staff JWT, the server-maintained clinician/patient/facility link, CARE patient and clinical-data permissions, and an encounter at the mapped facility. The server then verifies the delegated Supabase user, active clinician membership and synthetic patient. Reads and the existing `care_action` RPC use that normal user's token, preserving RLS and actor audit attribution. No service-role key is used. Patient OTP tokens and unmapped staff are unsupported and denied.

Set `WHOLECARE_LINKS_FILE` to a read-only mounted JSON file, mode 0600. Its version-1 `links` array contains the exact mapping fields documented in ../CONNECTION_CONTRACT.md. Never commit an instantiated file. Missing, expired, ambiguous or unsafe links fail closed. This experiment permits one CARE scope per WholeCare actor. The local runtime additionally uses `care_wholecare.dev_settings` to restrict browser origins to its two explicit loopback addresses; that module imports CARE's development settings and is not a production settings module.

The bridge can close only an explicitly confirmed pending report whose visible evidence entries are all synthetic fixture placeholders. Real uploaded-file review and other writes stay in the current WholeCare application. A capped evidence read disables review. This is an operational software acceptance action, not clinical review or interpretation of laboratory results.

The receipt is the existing Supabase audit record. Identical event-key retries return canonical state; changing the loop/action/note on an existing receipt yields 409. A workspace hash rejects a stale initial view. The original RPC enforces role, task state and durable deduplication. The hash is a preflight check, not an atomic cross-service transaction or a new database concurrency guarantee. No remote provider body or credential is returned in an error.

## Renew the local development link

From this repository, run `python3 integrations/care/backend/scripts/link_account.py --help`. Supply the exact CARE user/patient/facility IDs, existing WholeCare patient ID and the protected links-file path. The helper prompts for the existing clinician login, verifies the account and assignment, and writes only the expiring access token plus mapping/public configuration. It does not save a password or refresh token, grant permissions, or retarget an existing link. A standard session expiry requires another explicit renewal. A host refresh alone cannot renew the backend's WholeCare link.

## Regression checks

The bridge tests have no live credentials or database writes. With this package on Python's import path and `requests` installed:

```sh
PYTHONPATH=integrations/care/backend python3 -m unittest discover -s integrations/care/backend/care_wholecare/tests -p 'test_*.py' -v
```

Within the CARE runtime, use the isolated workspace's `.agent/compose.sh exec -T backend python -m unittest discover -s /plugins/care_wholecare/care_wholecare/tests -p 'test_*.py' -v`. See ../VERIFICATION.md for the separate actual HTTP/browser/shared-database evidence.
