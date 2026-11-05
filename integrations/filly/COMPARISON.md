# Controlled synthetic Filly provider trial — 5 November 2026

## Result and decision

The revised extraction contract passed 20/20 checks: ten frozen synthetic audio fixtures through Sarvam and the same ten through OpenAI. Each provider passed 10/10. The checks require the expected outcome, original transcript copied exactly, no advice, verbatim medication details, and preservation of consequential concepts. Hindi negation, uncertainty, future intent, fractional dose 0.5, Monday, clock time and hold-until-review wording survived. Automated checks are deliberately narrow and do not establish general accuracy.

Measured median ASR response time was 224 ms for Sarvam and 899.5 ms for OpenAI. These are single-run observations from this deployment, excluding extraction and upload; they are not a general performance claim.

Keep the existing production provider. This is ten short TTS clips (25.491875 seconds total), five authored scripts each clean and with deterministic white noise at nominal 10 dB SNR. It excludes human accents, code switching, long consultations, realistic background noise and rare medication names. Clock speech says “eight o'clock”; neither output establishes AM/PM, and downstream interpretation must not invent it. Human correction time was not measured.

## Initial failure retained

The first run completed 20 requests but only 16 satisfied the contract: all four taken-dose outputs used “completed” instead of the required “taken”. The validator rejected them. We made literal allowed labels explicit, deployed version 2, and repeated all 20 calls. The revised run passed. Both original and revised outputs are retained; no failing outputs were silently coerced. A fresh independent corpus is needed to estimate performance after this prompt adjustment.

## What actually ran

Official Filly revision `33a76c95325bfe72f4f20dbe53007e7993e36b68` supplied the Python transcription and extraction clients. A local relay checked their request contracts and parsing, while Supabase made real provider calls using backend-only credentials. The Sarvam relay returned the actual transcript; both paths used the same Filly template and extraction parser. The backend performed extraction immediately after ASR, then the local parser verified that returned JSON unchanged. This tests the client/provider contract, not a complete deployed CARE plugin or streaming session.

Sarvam used `saaras:v3`, `mode=transcribe`, explicit en-IN/hi-IN. OpenAI ASR used `gpt-4o-mini-transcribe`, explicit en/hi. Both used `gpt-4.1-mini-2025-04-14`, the same custom Filly extraction template, temperature 0 and JSON-object response format. This is a controlled ASR comparison with common extraction, not a comparison of Filly defaults against WholeCare defaults. Filly defaults can include Groq; Groq was not used here.

The protected `filly-synthetic-trial` route accepts only the ten SHA-256-listed WAV fixtures, an assigned clinician in a synthetic workspace, and a single-use approved transfer request. JWT verification remains on. Source reads use the caller's access. It writes no patient activities or plans. Temporary uploads were removed after each fixture. Public demo labels and synthetic-only trial protection do not authorize real patient data processing.

## Reproduction

Run `node integrations/filly/analyze-comparison.mjs` for offline evaluation of captured outputs. Run `npm test` for contract regressions, including deliberate loss of negation and decimal corruption.

For new audio on macOS, copy scripts.json into a local corpus directory and run `python3 integrations/filly/generate-corpus.py /absolute/local/corpus`. Samantha and Lekha voices and afconvert are required. OS voice versions can change hashes; generated files must match corpus-manifest.json before calling the deployed route. Never replace the allowlist with arbitrary uploads to make a run pass. Review and freeze any replacement corpus separately.

Export the shared template/model/example into that directory's contract.json with Node imports from `supabase/functions/_shared/filly-trial.mjs`. Create an isolated Python 3.12 environment and install the pinned upstream standalone dependencies. Set FILLY_SOURCE_DIR to its checkout, FILLY_CORPUS_DIR to the frozen audio folder, and WHOLECARE_TEST_EMAIL / WHOLECARE_TEST_PASSWORD to an assigned synthetic clinician supplied privately. Run `run-live.py` in that environment. Never commit credentials, generated .local files or provider keys. The runner reads public db-config.js; real provider keys stay in Edge Function secrets. The runner consumes API quota and produces results.json; it is not part of normal app startup.

## Privacy gate

The team workspace is visible, but its documented retention control was unavailable in the observed dashboard; the documented retention URL redirected to Home. No retention change was made or verified. Sarvam's Model API documentation says an owner can select No retention (0 days), applies to future requests only, and warns that retention is indefinite until configured. Do not assume the generic privacy-policy duration proves this account's setting. Provider terms, metadata/log retention, region, prior-content handling and health-data contractual suitability remain owner/vendor checks before real data.

Sources: https://docs.sarvam.ai/api/platform/data-retention and https://www.sarvam.ai/privacy-policy .
