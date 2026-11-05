# Independent delivery ledger — 6 November 2026

This is execution evidence for the user's authorised sequential work list, not a replacement backlog. D01–D07 remain the source IDs in mvp-and-product-review.md. Completion requires the listed scope and proof; provider, clinical and business decisions are not inferred.

## Current increment

- D01: two isolated four-persona live API journeys passed, including real Auth, private report bytes, retries, clinician review, help ownership and caregiver revocation. PostgreSQL rollback tests also passed on live and rebuilt/restored local databases. Hosted UI acceptance is still being checked.
- D02: shared report status/owner language and direct clinician detail review action implemented; hosted acceptance pending.
- D03: oldest-first actionable help queue, waiting time, owner, separate replied/closed history implemented; hosted acceptance pending.
- D04: frozen v1 cases found 1 failure of 16. A second pre-guard baseline found 2 failures of 8. Multi-dose and explicit non-ingestion guards were added; the eight regression cases now pass. Baselines are retained. Further untouched holdout and hosted clarification checks remain.
- D05: patient-scoped revision polling and safe 30-second refresh implemented, with dirty-form protection and revoked-access handling; hosted two-session check pending.
- D06: document structure/active-content checks, scoped object paths and direct original/review navigation implemented; fresh hosted verification pending. Static screening is not antivirus certification.
- D07: synthetic-only isolated identity provisioning and reusable rehearsal script are implemented. Two fresh API rehearsals passed without resetting shared history. The first interrupted setup remains as provenance, not a passing rehearsal.
- Separate synthetic patient logins for Ravi and Farah are provisioned. Generated credentials are only under .local/rehearsals, excluded from publication. Login/isolation verification is next.
- Caseload search, filters and pagination now execute on the server with a bounded page response. Summary aggregation still evaluates assigned patients and is not a high-volume performance certification.

## Evidence and reproduction

Run npm test, npm run build, node scripts/check-build.mjs and python3 scripts/verify-rebuild.py. The SQL rehearsal runs twice and rolls back. To create a fresh live synthetic scenario, run scripts/provision-synthetic-demo.py --synthetic-only, then scripts/rehearse-demo.py --synthetic-only --manifest <private manifest>. No emails or phone messages are sent. Do not re-run completed scenarios as a reset; generate a new isolated run or inspect its retained history.

AI corpora and result files are in integrations/ai-evaluation. Preserve first-run failures; never overwrite them with tuned results. Provider safety, agreement and retention gates remain separate from synthetic accuracy tests.

Original passwords were not reset. The supplied current credentials were saved only in the mode-0600 local account file. No credentials, tokens or signed document URLs belong in evidence or source control.
