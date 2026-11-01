# WholeCare Diabetes — first demo

Source: team Drive PRD v1.1, MVP Development Plan v1.0, Data Model v1.0. Deadline: ASAP; one human builder with Codex.

## Run

Requires Node.js. No packages, API keys, or external services are required.

`npm start` → http://localhost:4173

`npm test` verifies state transitions, human review, idempotency, and consent routing.

## Golden demo (about two minutes)

1. Patient: confirm the prescribed routine, log sample breakfast, sync sample glucose readings.
2. Coordinator: open Attention queue, simulate a reminder for the renal-function investigation, then request caregiver help.
3. Caregiver: see only the assigned support task.
4. Patient: attach the built-in synthetic report. The loop becomes REVIEW_PENDING, assigned to Clinician.
5. Clinician: review the sample evidence, enter an operational review note, and close the loop.
6. Activity trail: inspect the state and ownership changes. Reload to demonstrate local persistence; reset for another run.

## Implemented boundaries

The main `/` app now uses real Supabase sign-in, durable shared records, server-enforced roles and audited transitions. The separate `/database.html` page remains a minimal verification workspace. All records and evidence are synthetic. Neither surface has real file uploads, live WhatsApp, voice transcription, or AI extraction. Do not load real patient information. The external font is optional; system fonts remain usable offline. See `database/README.md` for credentials, workflow details and current limits.

No diagnosis, prescribing, glucose interpretation, or test-result interpretation is implemented. Missing medication confirmation remains UNCONFIRMED rather than being inferred as missed. Test evidence always requires explicit human review before closure.

## Next implementation steps

1. Supabase schema, authentication, role policies, durable events and evidence storage.
2. WhatsApp Business sender onboarding and webhook verification; idempotent inbound/outbound integration.
3. Real voice transcription and structured extraction with human confirmation.
4. Synthetic CGM CSV import, failure recovery, and end-to-end integration tests.

The PRD's full MVP requires real WhatsApp and voice. This first prototype does not satisfy that gate yet. The earlier Lovable/Make plan is a reference architecture; direct implementation here accelerates the immediate demo without requiring those accounts first.
