# Independent delivery ledger — 6 November 2026

This records execution against the user's 25-item autonomous work list. It supplements, rather than replaces, D01–D07 and J01–J07 in mvp-and-product-review.md. A local test, an installed backend change, a hosted acceptance test and production readiness are different claims. All test records are synthetic. The project is still a development demo.

## 1. Four-persona end-to-end journey (D01)

Two fresh isolated live API rehearsals passed 39 checks each: Auth, confirmed plan, activity retry, real private PDF upload and submission retry, clinician review, practical help claim/reply/follow-up/resolution, wrong-role rejection, caregiver consent and revocation. Evidence: docs/evidence/journey-*.json. Rollback SQL rehearsals passed live and in rebuilt/restored PostgreSQL. Hosted patient upload → clinician review → patient Review complete + notification also passed; see hosted-report-review.json. A complete hosted recording/transcription/extraction/failure journey is still a release gate, not proved by the API checks.

## 2. Shared status, owner and action (D02)

Patient cards/details/documents and staff cards share loopMeaning state/next-owner language. REVIEW_PENDING explicitly identifies clinician review; CLOSED has no further action. Staff task detail has a direct review action. Hosted report completion was verified. No automatic clinical assessment is implied.

## 3. Staff worklists (D03)

Help awaiting a team response is oldest first, with elapsed waiting time and current claimant. Replied/closed threads are separate from actionable requests; a patient follow-up returns it to the response queue. Task-linked original/review navigation remains available. Waiting time is operational, not a clinical severity ranking. Hosted claim/reply verification is recorded separately as completed.

## 4. Multilingual AI interpretation (D04)

Frozen synthetic corpora and all initial failures are retained in integrations/ai-evaluation. The original v1 result was 15/16; pre-guard v2 was 6/8; first v3 holdout was 5/6. Safeguards now require an explicit self-report, certainty, completed outcome, single occurrence and exact source evidence. Clinician-instructed skipping requires supporting instruction wording. Multi-dose and future-intent guards refuse to populate a single occurrence. Current deployed interpretation is evidence-v3 (voice-transcribe version 22). Latest v1 replay is 15/16: a self-decided skip safely requested clarification but used unclear_taken rather than the expected unclear_skip. Latest v2 is 8/8. The earlier evidence-v2 v3 replay was 6/6; that is not a fresh holdout for evidence-v3. Do not claim perfect or clinically validated accuracy. Broader independent recordings, noisy audio and human correction-time testing remain.

## 5. Freshness and draft safety (D05)

Scoped revision RPCs and serialized 30-second polling are installed. Hidden/busy/dialog/dirty-entry views are not replaced; updates are surfaced for explicit refresh. Caseload has its own revision. Revoked assignment clears the selected workspace rather than substituting another patient. Own-save refresh resets the revision to avoid false new-update alerts. Unit/role tests pass. On hosted commit 82ac32a, a separate backend change raised the new-updates notice while the unsaved help dialog and its exact draft stayed intact; explicit refresh then loaded the update. Clean-view automatic refresh and hidden-tab behavior still need broader acceptance.

## 6. Document continuity and file safety (D06)

Scoped paths, type/size/structure checks and conservative active-content rejection protect browser upload and backend source/report boundaries. Traversal, wrong-patient paths and disguised files have tests. Hosted private original bytes matched the prepared PDF; an expired signed link was denied. Hosted review closed the correct occurrence and produced a patient notification. Static screening is not malware scanning, complete PDF sanitization or proof that a human read every page. A managed scanner and infected-file quarantine remain external-service work.

## 7. Repeatable isolated demo (D07)

A clinician-scoped synthetic-only factory provisions generated .test identities with bounded requests and idempotency. Scripts create a new scenario rather than resetting ongoing testers. Two complete API runs passed. A separate retained hosted scenario supports browser checks. Partial failed first attempts remain provenance, not passing evidence. Provisioning never sends invitations or phone messages.

## 8. Keyboard, touch and mobile

Added skip-to-content, explicit focus indicators, minimum narrow-screen touch sizing, wrapping and bounded dialogs. Existing native dialog semantics and field labels are retained. The current browser viewport override returned 1280px after a requested 390px override; therefore narrow-screen acceptance is not claimed. Real mobile/assistive-technology review remains open.

## 9. Separate Ravi and Farah logins

Provisioned generated identities without changing patient histories or shared demo passwords. Both logins see only their own patient, load 120 history rows and cannot use staff caseload RPCs. Evidence: additional-patient-logins.json. Generated credentials live only in private local manifests. The four user-supplied original demo credentials were saved locally and all four sign-ins verified; passwords were not reset or published.

## 10. Server caseload search and paging

Installed assigned-only bounded search/filter/paging with max page 50. Totals remain assignment scoped. Summary aggregation still evaluates assigned patients; this is not a high-volume load certification.

## 11. Safe automatic refresh

Implemented with item 5, including dirty state, serialized requests, hidden-tab pause and session/assignment failure handling. No background overwrite of patient entries is intended. Hosted unsaved-dialog acceptance passed; the remaining browser scope is listed above.

## 12. Reviewed multi-action capture

Existing LLM action proposals retain exact excerpts and require reviewed task selection; future intent and ambiguity remain non-completion. The new single-medication evidence safeguards improve the common form. No general free-text parser is clinically certified; independent ambiguous matching/multi-action evaluations remain necessary. AI output never directly changes a care task.

## 13. Scheduling

Once/daily/weekly policies remain within approved scope. Installed database checks reject ambiguous or nonexistent local DST clocks for manual review instead of silently selecting a dose time. New York transition and normal India/timezone tests pass. PRN, taper, alternate-day and clinical escalation policy are not invented.

## 14. Minimum necessary AI data

Improved identity-field minimization so a semicolon does not remove following clinical context. Source text/evidence and consent-boundary tests are retained. Documents/audio still require explicit transfer review; structural screening does not remove identifiers from original audio or image pixels. Provider contracts, residency and retention need owner verification before real data.

## 15. Isolation, sessions, consent, revocation

Rebuilt/restored and live scoped tests cover patient isolation, wrong roles, help owner conflicts, caregiver clinical denial and consent/assignment revocation. Refresh fails closed when the selected patient disappears. Coverage is not an external penetration test.

## 16. Upload safeguards

Implemented under item 6, deployed in report-submit and prescription variants; voice storage paths are scoped too. PDF/PNG/JPEG validation is structural and conservative. No antivirus certification or remote malware scanning subscription is claimed. plan-extract-legacy was deployed as an authenticated compatibility endpoint during this pass; it uses the same transfer and file guards, but is not the primary browser route.

## 17. Leaked-password protection

Could not verify enabled. Supabase's UI says Pro is required and its security advisory still reports protection disabled. No plan purchase/upgrade was made. This remains an account/plan gate for the owner; do not represent the attempted Save as success.

## 18. Repository and team Drive handoff

README, this ledger, release evidence and operations/access gates are reconciled for this increment. Historical sections retain dates and provenance. The existing team Drive master is the intended publication target; do not create duplicate handoffs or use personal Drive. The existing team master was updated in place and metadata readback confirmed its unchanged file ID and requirements folder. Historical CARE acceptance was preserved; the current section supersedes the historical pg_net failure for this tested release.

## 19. Delivery worker preparation — on hold

Service-only delivery repository RPC is installed with no channel activation capability. Worker/retry/status callback adapters and disabled-network fixture tests are prepared locally. No sending worker or callback was activated or scheduled. Live WhatsApp/SMS remains on hold. Provider credentials/account recovery, exact webhook setup and enrollment require separate approval.

## 20. Incoming-message proposals — disabled infrastructure approved

After the initial automatic approval rejection, the user explicitly approved disabled infrastructure only. The versioned message_proposals schema is now installed; both channel gates were verified false and no webhook/worker was registered or activated. Caregiver reads and confirmation are denied. Service staging deduplicates, requires an unambiguous verified sender and current gate/consent, honors STOP, and never changes a care task. Patient confirmation uses the checked activity RPC. Proposal changes participate in scoped revision checks. Pending review UI and notifications are included. Hosted internal-fixture confirmation passed: no preselected task, explicit patient selection/acknowledgement, one persisted care event and a confirmed proposal. This did not test real provider ingestion. Local clean/restore tests passed, including caregiver raw-text denial and idempotent confirmation. The initial staged copy is historical only; the canonical version is the migration. A disabled, fixture-tested media retrieval adapter is prepared with strict provider URL construction, redirect refusal and byte/type screening; it is not wired to a live endpoint or private upload. Full media processing and live channel acceptance remain pending.

## 21. Onboarding and assignment administration

Prepared the concrete access/acceptance contract in OPERATIONS_AND_ACCESS_GATES.md. Current synthetic provisioning is not real onboarding. A real administrator/facility authority, verification, invitation expiry/revocation and reassignment policy must be selected with the owner before granting real access. No new general staff administrator was silently created.

## 22. Summaries and operational measures

Existing reproducible due-cohort, eventual closure, configured-window closure, participation, corrections and elapsed closure measures remain operational and source traceable. Empty/unconfigured values stay N/A, not zero; participation includes missed activity and does not imply adherence. Visit summaries retain selected patient notes and descriptive records, no diagnosis, causation or dosing advice. Pilot benefit, correction effort and clinical validation still require observed human data.

## 23. Retention, deletion and export

Added a patient JSON download of explicitly selected loaded authorized records, excluding credentials, signed URLs and private paths. The UI declares its partial coverage. Trends CSV remains available. Existing approved voice retention controls remain. Complete legal export, general clinical-record deletion, backup retention and provider erasure require approved rules; no arbitrary period or permanent purge was executed.

## 24. Monitoring and recovery

Operational health, processing events, platform advisories, migration replay and isolated dump/restore checks are available. Added incident triage, retry, access and recovery procedures. Latest rebuild/restore passed with the explicitly approved disabled proposal infrastructure included. Full Auth/Storage/Vault/Edge recovery and staffed external alerts need platform/owner setup. Do not confuse local application database recovery with full disaster recovery.

## 25. CARE and Filly

Existing thin CARE review integration and controlled synthetic Filly/Sarvam comparison remain isolated with their own reproduction and limitation records. They are not a full migration or a privacy guarantee. Provider account/terms, clinical acceptance, hosting, real recordings and production adoption remain owner decisions. Current patient capture uses the existing guarded server provider route.

## Reproduce and preserve evidence

Run npm test, npm run build, node scripts/check-build.mjs and python3 scripts/verify-rebuild.py. Create a fresh synthetic scenario with scripts/provision-synthetic-demo.py --synthetic-only, then scripts/rehearse-demo.py --synthetic-only --manifest <private manifest>. Never reset completed scenarios. AI evaluation scripts make provider requests but no care writes; keep baseline failures and versioned results. No tokens, passwords, signed links, personal audio or real patient data belong in evidence, source control or Drive.
