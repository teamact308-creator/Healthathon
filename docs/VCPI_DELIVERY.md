# WholeCare Verified Care Plan Intake

Implementation record: 3 November 2026, Asia/Kolkata. Synthetic data only. Branch: `codex/vcpi-verified-intake`. This is an operational review workflow; no diagnosis, prescribing, dose recommendation, risk scoring or autonomous activation is introduced.

## Increment 1

`supabase/functions/plan-extract/index.ts` now defines weekly recurrence and explicit Sunday=0…Saturday=6 weekdays through the shared contract in `_shared/vcpi.mjs`. Extraction preserves verbatim instruction wording and per-field evidence: exact quote plus zero-based text span or one-based document page. Dates, times and weekdays may remain unknown. PRN/hold/stop and complex schedules remain exceptions. Source SHA-256 fingerprints and contract version are retained in immutable extraction provenance.

The deterministic validator reports structural failures, invalid dates/order/one-year range, once/weekly inconsistencies, invalid/duplicate times/weekdays, missing fields/evidence, literal text/span mismatches and unsupported wording. Date/weekday/time normalization that cannot be established literally is flagged for clinician review. A document page/quote is model-asserted evidence, never independent proof. Validation does not establish clinical correctness or document completeness. Non-English/complex wording may require manual clarification; regex detection is not a comprehensive language parser.

Unresolved extractions are persisted as proposals, not care-loop tasks. Every imported item must later be accounted for exactly once as an included instruction or an excluded manual-handling item. Original extraction JSON must match server-retained provenance. An exclusion requires a reason. Zero-action VCPI drafts can retain all-excluded dispositions, but cannot activate because the existing engine requires scheduled items. Partially unresolved scheduling proposals remain in extraction history until dates/times are resolved or items excluded; the existing executable-plan draft format still requires complete schedules for included items.

## Increment 2

The clinician editor keeps original text visible, offers an expiring private-document comparison frame/full-size link, displays per-item findings and original extraction/evidence, and collects field checks plus an action-level correction/clarification reason. Editing an action invalidates its checks. Review of the whole source is explicitly required to account for omissions. Unsupported source instructions must be excluded; changing the editable wording does not erase the original exception.

A final plan preview lists dates, times, recurrence, weekdays, timezone and excluded instructions; it updates with form edits. A final dialog shows the synchronized activation payload. Saved snapshots in `care_plans.vcpi_data` and `plan_activity.details` preserve reviewed fields, original proposals, corrections, exclusion reasons and actor/time through existing plan activity. The history UI exposes these snapshots. Existing `confirmed_by`, `confirmed_at`, source path, extraction ID and plan revisions remain authoritative provenance.

Migration `20261103145418_wholecare_vcpi.sql` adds these two JSON columns and an activation trigger covering both confirmation RPCs. It checks field attestations, original-source/completeness attestations, reasons, proposal coverage and source integrity. Existing server-side authorization, transactional confirmation, weekly task generation, supersession, completed history, pending evidence and care-loop engine are retained. No new public RPC, table policy, role grant or messaging behavior is introduced. Legacy manual and old extraction contracts remain compatible; VCPI contract-version-1 extractions require the new gate. Older extracted drafts should be re-extracted before editing in the VCPI screen so provenance indices can be established.

## Deployment state

- The additive migration is applied to **wholecare-diabetes-dev**, project `gylnitduoasmybadblcp`. The local migration version was aligned to the version recorded by the connected migration tool.
- A new JWT-protected **plan-extract-vcpi**, version 1, is deployed from the updated extraction source with its shared dependency. The branch client calls this endpoint and sends explicit synthetic-only acknowledgement. The function also verifies that the selected database patient is synthetic and the caller is its assigned clinician.
- Existing hosted **plan-extract**, version 2, was deliberately preserved. The current hosted app is unaffected by the new endpoint. No frontend main merge or production deployment is claimed by this work.
- The existing source path remains the deployment entrypoint for both names. Deploy the VCPI branch to `plan-extract-vcpi` until frontend rollout is verified; do not silently overwrite the legacy endpoint ahead of its client.

## Observed verification

- Root automated suite: 99 tests pass (existing workflows plus validator, extraction-handler and privacy-prototype cases).
- Extractor tests use mocked Auth, REST, provider and persistence boundaries. They cover clinician/other-role access, synthetic acknowledgement/patient guard, provider/allowance/provenance failure, malformed output, weekly payload and no care-plan/task writes. They are not a measurement of live model extraction accuracy.
- The browser build passes an exact 24-file public allowlist and server-credential reference check. Only the shared validator/schema/contract is bundled; the Edge handler and database files are excluded.
- All migrations replayed on real disposable PostgreSQL 17.11 with pg_cron; capture, operations, bucket-three and VCPI rollback suites pass on both clean and dump/restored databases. Local Auth/Storage are minimal SQL fixtures, not running GoTrue/object services.
- The VCPI rollback suite also passed on the connected dev database after migration. It covers patient denial, drafts producing no tasks, old review-RPC bypass denial, missing contract, tampered original, dropped source item, PRN rejection, weekly generation, retry idempotency and audit snapshots. It rolls back its records and plan supersession.
- Post-migration security advisors show the same pre-existing five INFO entries for deny-by-default RLS tables and the leaked-password-protection warning. No new advisor finding was introduced. [Password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Remaining verification and rollout

The new clinician screen has not completed interactive browser verification. Starting an isolated local fixture server was blocked when automatic approval review could not complete because of a usage-limit error; this was not an unsafe-action determination. The already-open localhost app reached sign-in, but no credentials or care records were changed. Complete browser checks for compare/source-link expiry, field-change invalidation, correction/exclusion save/reopen, all-excluded draft, final preview and confirmation before merging/deploying the frontend.

Live provider extraction on the new schema, upload/PDF page navigation behavior and full signed-in source-to-confirmation UX remain unverified. No clinical validation or completeness guarantee is claimed. Private iframe rendering depends on browser/file headers; full-size expiring source links remain available. Original binary files are retained by existing storage policies; the fingerprint does not itself implement retention, malware scanning or content de-identification. Real patient use remains prohibited.

## Increments 3 and 4

See `integrations/vcpi-prototypes/README.md`. Increment 3 is an isolated explicit-opt-in synthetic text minimization/comparison harness, with decimal-loss and omitted-hold regression cases; actual OCR-versus-vision benchmarking remains pending. Increment 4 is a source-informed CARE MedicationRequest adapter plan, not a live adapter or migration. CARE identity/delegation, actual wire fixtures and version mapping remain prerequisites.

## Rollback

Keep the current hosted frontend and legacy endpoint while reviewing this branch. Disable VCPI client entry/use of the new endpoint to stop new proposals; retain provenance and audit history. Do not delete confirmed plans, history or the additive columns as an ad-hoc rollback. Existing manual/legacy confirmed plans continue through the original engine. Any further schema rollback requires review of already-created VCPI plans and their history.
