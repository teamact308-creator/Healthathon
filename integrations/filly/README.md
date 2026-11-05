# Filly evaluation candidate

Reviewed upstream revision 33a76c95325bfe72f4f20dbe53007e7993e36b68.
Source https://github.com/ohcnetwork/care_filly/tree/33a76c95325bfe72f4f20dbe53007e7993e36b68

Filly is a candidate for clinician documentation. WholeCare continues to use its existing provider integration. This directory supplies an offline synthetic comparison harness. A live Filly accuracy result requires captured provider outputs.

## Reproduce the harness

Run node integrations/filly/evaluate.mjs --self-test. This exercises the checker with reference outputs and makes no provider calls.

The frozen corpus is exported from evaluate.mjs. Record these same fictional scripts and independently transcribe them for a provider comparison. Cover English, Hindi negation, uncertainty, future intent, a fractional dose and a hold instruction. Add noisy and mixed-language recordings before judging quality.

Normalize each captured result to an object containing id, source_excerpt, reported_status, needs_clarification and recommendations. Use one result per corpus fixture. Preserve the complete source. The outcome field accepts the expected taken/missed/unclear values. Keep recommendations empty. This is an evaluation template for documentation.

Run node integrations/filly/evaluate.mjs --synthetic-only --results=/absolute/path/to/results.json.
The report prints fixture IDs and checks. A corrupted decimal, lost negation, false certainty, changed source or generated recommendation fails the case. Measure latency and correction time separately for both providers. The harness writes no care records.

## Local mock setup

Use the pinned revision above and follow its README. The standalone server needs Python 3.10+ and its standalone dependencies. Set FILLY_MOCK=1, a throwaway FILLY_AUTH_TOKEN, and PUBLIC_BASE_URL=http://127.0.0.1:8090. Bind uvicorn to 127.0.0.1 and leave provider credentials absent.

The standalone service defaults to optional authentication and wildcard CORS. Production integration should use the CARE Django plugin with user/facility checks, approved origins, quotas and reviewed terms. Clinician opt-in and patient recording permission need separate verification.

The protocol has create session, audio upload, end session and poll endpoints. It returns a transcript and template data. Supply only the current form schema. Omit patient_details and encounter identifiers when unnecessary. Map accepted output into WholeCare's reviewed draft after explicit patient/facility identity mapping. Require clinician confirmation before activation.

## Privacy findings

- Default transcription uses Sarvam, and extraction uses Groq. OpenAI is optional. Hosting the backend leaves external processing of model inputs to review.
- History includes transcripts, structured content and optional audio. Soft deletion retains row and audio. Agree and implement a purge schedule and backup handling before real data.
- Standalone bearer-token access can return complete sessions. Use per-user delegation and session ownership checks.
- Pin dependencies and disable content-bearing logs. Review failure handling, source references, short-lived tokens, recording permission, deletion and revocation in the target CARE deployment.
- Approved provider credentials, terms, retention and region remain prerequisites for live comparison.

## Adoption decision

Proceed to a synthetic provider trial after credential and provider choices. Require preservation of consequential source details, denial of unrelated patient/facility access, clinician review, verified retention behavior and a record of provider/version/fixture used. Adopt only if results improve on the current WholeCare workflow.
