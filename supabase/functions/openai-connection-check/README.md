# OpenAI connection diagnostic

Deployed to the WholeCare development project as `openai-connection-check` with gateway JWT verification enabled. The handler additionally verifies the caller with Supabase Auth and requires a server-assigned clinician membership.

`OPENAI_API_KEY` is read only inside the deployed function from Supabase secrets. It is never returned, logged or placed in browser configuration. The diagnostic makes a fixed `GET https://api.openai.com/v1/models` request; it accepts no patient input and performs no generation, transcription or database writes. Upstream response bodies are not relayed.

Run `python3 database/check-openai.py` with the local development credentials available. It verifies anonymous denial, patient denial and clinician success. The live check succeeded after the key was saved. This confirms key authentication and models-list permission only, not generation/transcription permissions, available billing quota, model selection or end-to-end AI functionality.

The application's document extraction, voice and multilingual workflows remain pending. Reuse the same server-side secret for those bounded integrations; do not expose it to the frontend.
