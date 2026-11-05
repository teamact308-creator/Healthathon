# Follow-up delivery — 6 November 2026

This closes the independent engineering work from the six-item follow-up. It does not claim complete production readiness, clinical accuracy, real-phone acceptance or full browser-only coverage. The only channel hold is on live WhatsApp/SMS. In-app help, replies, documents, notifications, recording and review continue normally.

## 1. Source-to-care journey

A new isolated synthetic scenario exercised a generated instruction PDF in private storage → structural preparation → real AI extraction → retained proposal → no care tasks before review → draft → missing-source-review denial → explicit field/source/completeness confirmation → four scheduled dimensions. The source is explicitly a workflow fixture, not a real prescription or treatment plan. Review in this test compares known generated instructions, not clinical judgment.

The same scenario exercised real frozen synthetic WAV transcription, original and English text, required confirmation, no activity written by transcription, and explicit missing-recording failure/manual fallback. Fourteen source/voice checks pass in source-to-plan-and-voice.json. Its first audio attempt failed; it was not counted as successful. The WAV container had been submitted as recording.webm, producing provider HTTP 400. The multipart filename/MIME now follows the actual supported container, with truncated/unrecognized input rejected. The actual WAV route then passed. audio-format.test.mjs protects this boundary. OpenAI's accepted transcription formats are documented at https://developers.openai.com/api/docs/guides/speech-to-text .

The retained scenario continued through 35 four-persona API checks: medication event and retry, malformed report rejection, real report upload, duplicate submission, wrong-role review denial, clinician closure, practical help claim/reply/follow-up/resolution, underlying task staying open after help, consent-scoped caregiver support, immediate consent revocation and own-patient isolation. See journey-b13bc10f-a295-4092-9c6d-9a3ab1ca2fff.json. No shared tester data was reset and no external care messages were sent.

These are hosted API boundary tests. Earlier hosted UI evidence covers patient upload/review receipt/notification, coordinator help handoff and patient confirmation. A fully human-operated microphone/camera/device walkthrough is still recommended; do not relabel API execution as that walkthrough.

## 2. Interpretation and multi-action capture

The AI now distinguishes reported physical action from clinician instruction. Explicit skipping without an instruction asks the appropriate follow-up; uncertainty, other people, pending doses and multiple occurrences do not populate a completed outcome. Exact source evidence is required. Refusal guards for explicit pending language protect English, Hindi and Hinglish without replacing AI interpretation with a command parser.

Multi-action output includes actor, action certainty, phase and medication evidence. The server checks these before returning actionable suggestions. Investigations remain report workflows. Related pending/intended clauses are grouped into one proposal; explicit task selection and final human confirmation remain required.

Preserved results:

- action-evidence-v4-regression-v1: 15/16; the explicit not-yet/instruction case failed. v4 fresh holdout: 11/12; Hinglish pending input got an unsuitable clarification.
- action-evidence-v5-regression-v1: 16/16 and v5-regression-v4: 12/12 after pending refusal guards.
- Initial log-actions-v1-results: 4/6. A self-decided skip and duplicate pending/future proposals failed strict acceptance.
- log-actions-v1-v6-regression: 6/6 after applying the shared medication contract and grouping related clauses.
- Final untouched eight-case single-medication holdout: 8/8, action-evidence-v6-fresh-holdout.json.

Corpora, hashes, per-case expectations, model version and first failures remain in integrations/ai-evaluation. Passing these small synthetic sets is not a claim of broad clinical or language accuracy. No AI evaluation saved a care activity. The Responses structured-output contract follows https://developers.openai.com/api/docs/guides/structured-outputs .

## 3. Refresh and session recovery

Added visibility-return and online reconciliation through the existing serialized, draft-preserving poller. Hidden checks do not consume the last revision; reconnect reconciles once. Stopping a pending check cannot refresh another account. Invalid refresh grants become explicit authentication denial and clear stale local credentials; transient provider failures preserve the retryable session. No network failure is mislabelled as assignment revocation.

Tests cover hidden/offline/return, stopped in-flight requests, invalid credentials versus transient service outage, shared refresh, wrong patient and revoked assignment. Previous hosted evidence covers unsaved-dialog preservation and idle automatic refresh. Native background timing varies by browser/device and is not certified by unit tests.

## 4. Keyboard and responsive acceptance

Hosted keyboard checks passed: skip link moves focus to the main heading; Enter opens the named task dialog; Escape closes it and restores focus to the opener. Existing focus styles, labels, minimum touch sizing and bounded dialogs remain.

The browser's mobile viewport control again returned innerWidth/scrollWidth 1280 after a 390-pixel request, including a fresh tab. The override was reset. This is a concrete tool limitation, not evidence of mobile correctness. Real mobile and screen-reader acceptance remain unverified. No cropped desktop screenshot is presented as mobile proof.

## 5. Provider-independent document preparation

An authenticated attachment-prepare Edge Function now checks permitted buckets, same-patient document paths, current assigned role and existing private Storage read policies. Reads are bounded to 8 MB, structure/active content is checked and a SHA-256/type/size receipt is returned. No source content goes to AI or a messaging provider, no signed URL is returned by this endpoint, and preparation never changes a care task. Existing Storage access remains the authority.

A proposed privileged read of unassociated files was rejected by automatic approval review. It was removed; no such fallback was deployed. The adopted flow is association first: a report enters the existing private intake queue, then server preparation runs. An unassociated report remains unreadable under existing policies. If preparation fails after intake persists, the UI explicitly says the source is in the queue, could not be prepared, and no care task changed. Retry reuses the intake key. Original-file link preparation also runs the check. Plan documents and meal photos use their current authorized object access.

Twelve live synthetic checks pass in attachment-preparation.json: valid private upload, unassociated read denial, intake association without care completion, patient/clinician/coordinator reads, caregiver and anonymous denial, cross-patient denial, disguised-file rejection, missing source and unchanged care events. This is structural screening, not malware clearance or full PDF sanitization. Raw direct Storage access remains governed by RLS; the app's screening does not replace an approved malware-scanning service.

## 6. Reconciled status and boundaries

Current implementation and evidence are linked from INDEPENDENT_DELIVERY, release-verification, README and the existing team Drive master. Completed engineering, scoped verification, human/device acceptance and provider/policy dependencies are distinct. No unfinished in-app work is described as subject to the WhatsApp/SMS hold.

External dependencies remain: real mobile/assistive-technology acceptance, broad human language/clinical validation, an approved malware-scanning service, Supabase leaked-password protection/account eligibility, real-user onboarding authority, general retention/deletion policy and full-platform recovery. They are not additional user-imposed holds.

## Reproduction

Run npm test; npm run build; node scripts/check-build.mjs. No schema changed in this follow-up. For synthetic live checks use scripts/verify-attachments.py, scripts/verify-source-journey.py and scripts/evaluate-log-actions.py with a private rehearsal manifest and --synthetic-only. Source journey refuses to reset a plan; --resume is explicit and retains the prior scenario. Provider calls consume quota and are not part of normal CI. Private manifests, recordings, credentials and signed links must not be published.
