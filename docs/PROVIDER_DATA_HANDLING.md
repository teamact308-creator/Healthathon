# Provider data handling evidence

Reviewed 5 November 2026. This records observed configuration and remaining account-level evidence. Provider documentation describes available controls; it does not prove that a specific team account has enabled them.

## WholeCare database and application

Supabase project wholecare-diabetes-dev (gylnitduoasmybadblcp) reports region ap-south-1. Private recordings and plan documents use authorized Storage access. This project-region observation does not establish the processing region for a model request.

Vercel serves the static browser app from an explicit browser-asset allowlist. Provider credentials belong in Supabase Edge Function secrets. They are absent from the public browser bundle. Screenshots, test accounts, audio fixtures and local evaluation environments under .local are excluded from publication.

## OpenAI

The current text/image endpoints call https://api.openai.com/v1/responses. Transcription calls /v1/audio/transcriptions. Responses requests use store:false. The app previews the operation and minimizes recognizable text identifiers, but original audio and explicitly included images/PDFs are processed externally.

OpenAI's data-control documentation distinguishes application state, abuse-monitoring retention, endpoint support, and regional processing. Account eligibility, actual retention controls and provider agreements must be confirmed for the team project. No zero-retention or India-only processing claim is established by WholeCare's code.

Reference https://developers.openai.com/api/docs/guides/your-data

## Sarvam and the Filly candidate

The owner selected the team Sarvam account for the synthetic speech trial. SARVAM_API_KEY is to be entered directly into Supabase Edge Function secrets, outside chat and source control. The key has not yet been confirmed saved.

Pin the trial to saaras:v3 to match the reviewed Filly revision. For original-language evaluation, explicitly use transcribe mode and compare it with the translated-output workflow separately. Record provider mode and model on every result. The current Sarvam documentation also lists newer models; that alone is not a reason to change the frozen comparison.

Sarvam's public policy describes processing API content and outputs. Verify the actual workspace's data-retention setting, subprocessors, deletion handling, support/log access, and processing region with the account owner before real data. A public privacy policy does not establish the team's contractual configuration.

References
https://docs.sarvam.ai/api-reference/speech-to-text/transcribe
https://www.sarvam.ai/privacy-policy

The official Filly mock workflow has passed local protocol checks. A live trial still needs a confirmed saved key and approved provider configuration. Keep source audio synthetic, independently transcribed, and free of identifiers. No medical accuracy or compliance certification is claimed.

## Remaining evidence to obtain

Record the actual provider organization/project, policy date, selected retention setting, processing/storage region commitments, subprocessors, and agreement owner. For a clinical pilot, obtain the site's approved recording notice, patient permission process, retention/deletion schedule including backups, and incident contacts. These organization-level decisions cannot be completed by changing an application prompt.
