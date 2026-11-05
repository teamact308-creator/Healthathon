# AI privacy controls

Implemented 5 November 2026 for the existing synthetic demo. This is an implementation record, not a certification for clinical use.

## What the user controls

Every transcription, text interpretation, activity-suggestion, prescription-extraction and visit-note selection request opens a review dialog. The user can cancel. Text is editable after conservative identifier removal. Visit-note selection shows the minimized selected notes and lets the patient exclude notes. Prescription extraction defaults to text only, with a separate unchecked option to include the complete original file. A document-only source requires explicit file inclusion. The original file is not automatically cropped or redacted.

Audio transcription sends the original recording to OpenAI. Its preview explains that spoken identifiers remain in the audio. The transcript is minimized before a subsequent translation or interpretation call. Patient/clinician names from the authorized workspace, recognizable email addresses, links, common phone/identifier formats, and explicitly labeled identity fields are removed from text. Other identifying details can remain. Human review is required because automatic removal can miss identifiers or remove a line containing useful context.

These controls are exercised before the provider call. WholeCare may already hold the selected file in private storage at that point. The user can type instead of sending audio. The recording-review panel lists the uploader's files.

## Server boundary

All four deployed AI endpoints, including both prescription versions, require a privacy version and fresh operation approval ID. The RPC checks current identity, role, assigned patient and synthetic-workspace flag, records operation metadata, and provides names for minimization. Raw text, source documents and audio are absent from the approval record. An approval is a user assertion for one attempted operation, not evidence that the provider completed the request or a legal determination of consent.

The receipt stores actor, patient, operation, payload kind, version and timestamp. Browser tokens cannot insert or update receipts directly. Reuse is rejected. An actor lock serializes the daily allowance check across workspaces. Provider calls use reviewed/minimized content, temporary note indexes and generic filenames. Model calls retain store:false where supported. External provider retention, data residency and contract settings require their own verification.

The synthetic flag identifies the workspace. It cannot establish that arbitrary uploaded bytes are fictional. Keep real data out of this deployment.

## Source access

Raw recordings and prescription originals in Storage are readable by the assigned patient and clinician. Coordinator and caregiver access is denied by storage policies. Existing source URLs already issued before a policy change may remain valid until their short expiry. Wider report/intake access and structured care-team records follow their existing separate policies.

## Recording removal

Patient Account and clinician Care plans expose a recording manager. It lists up to the 100 most recent voice files uploaded by that caller. Removal requires a second button action and is limited to unused files. A database reservation checks uploader ownership and existing activity references before permitting Storage deletion. Referencing activity inserts and updates take the same advisory lock and reject reserved files, preventing a deletion/save race.

The reservation is retained if physical deletion fails so removal can be retried safely. The manager permits retry. A successful Storage deletion removes the live stored object. This does not recall data previously sent to an AI provider or delete provider records or backups. Linked audio and confirmed source documents require an agreed clinical record-retention policy. Per-uploader retention preferences now support Off, 1, 7 or 30 days. A preview precedes saving. New uploads are the default scope; including older unused audio requires an explicit selection. The worker retains JWT verification and a private scheduler token. The protected worker is installed and scheduled daily at 07:45 India time. A live worker check returned HTTP 200 with removed=0 and failed=0 while all uploader policies were off. The UI checks readiness and prevents saving an automatic preference while the worker is unavailable. Manual removal remains available.

## Verification

124 automated tests passed, including identifier preservation, absence of text in approval metadata, denial before networking without approval, and synthetic Filly checker regressions. The browser-asset build passed.

Live HTTP checks using the existing synthetic accounts verified approved interpretation, denial without approval, denial of coordinator AI access, own recording listing, coordinator recording denial and owner reservation/retry/removal of a newly uploaded fictional test file. The test file was removed. A browser check with the synthetic patient verified name/email minimization in the preview, agreement required before Continue, and cancellation back to the unchanged note-entry form.

Database checks of patient/clinician/coordinator/caregiver authorization and recording ownership/retry were rolled back. Security advisors returned intentional default-deny private-table notices and an existing warning that leaked-password protection is disabled. Approval records do not contain prompt or audio content.

## Remaining rollout decisions

- Agree clinical record retention, deletion and backup schedules before enabling unattended purges. Browser extensions and managed-device settings also need review because they can access page text independently of the application.
- Verify provider terms, sub-processors, actual retention configuration and deployment/processing regions.
- Validate source cropping or a reviewed local OCR path before making stronger document-minimization claims.
- Expand de-identification evaluation across formats and languages without losing medication names, doses, timing, negation or uncertainty.
- Complete multi-patient, consent withdrawal, cross-tab/session and access-revocation browser checks with a pilot owner.
- Use the pinned candidate and comparison harness in integrations/filly for a controlled synthetic provider trial. No live Filly accuracy result is claimed.

## Additional pending-item work, 5 November 2026

The clinician editor includes optional on-device image cropping before upload. The selected area is re-encoded as PNG, removing source image metadata. Include every medication instruction, dose, timing and hold/stop note in the selection. A PDF remains a complete file upload. The cropped selection is the source supplied to WholeCare; the full original stays on the user device unless independently uploaded. Cropping does not guarantee identifier removal.

The official pinned Filly app passed local mock session, upload-token, chunk-order, result and unauthenticated-read checks with provider network calls blocked. See integrations/filly/mock-verification.json. The owner selected Sarvam for the live trial and is adding its backend secret. See PROVIDER_DATA_HANDLING.md for verified configuration and the remaining vendor/account evidence.

Retention database tests passed for new-upload scoping, uploader ownership, protection of linked audio, disabling a policy and service-only worker claims. All test database writes were rolled back and no existing files were deleted. The worker deployment keeps verify_jwt=true. A rejected verify_jwt=false attempt was not applied. A subsequent live installation check was initially blocked by an approval-service usage limit. After checks recovered, the scheduler was configured with an enabled legacy public JWT held in Vault plus its private worker token. JWT verification remains enabled. Installation and an authenticated zero-work run passed. Every uploader policy remains off until explicitly enabled.

## Sarvam key and synthetic connectivity

The team key is confirmed available server-side. The connection checker accepts only two immutable synthetic WAV hashes and requires an assigned clinician, synthetic workspace and per-request approval. Both English and Hindi requests returned HTTP 200 and nonempty transcripts using saaras:v3 in transcribe mode. Temporary recordings were removed. The provider key is never returned. This verifies connection and original-language output; it does not establish clinical accuracy or automatically replace WholeCare’s current transcription path.


## Synthetic Filly/Sarvam comparison, 5 November 2026

Completed the fixed ten-clip controlled trial through Sarvam and OpenAI with common Filly extraction: revised contract 20/20 checks; initial contract 16/20 (unsupported status labels rejected). Full method, captured outputs, limitations and reproduction are in integrations/filly/COMPARISON.md. Production provider choice is unchanged. No real patient material was used; temporary source uploads were removed.

Actual Sarvam account retention remains unverified: the team dashboard did not expose the documented owner control, and the documented deep link returned Home. No retention setting was changed. Model API documentation permits 0 days for future requests but warns of indefinite retention until configured. Verify this account setting, past content treatment, logs/metadata, region and applicable provider agreement before real patient use. WholeCare source deletion does not prove provider-side deletion.
