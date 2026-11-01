# WholeCare Diabetes — first demo

Source: team Drive PRD v1.1, MVP Development Plan v1.0, Data Model v1.0. Deadline: ASAP; one human builder with Codex.

## Run

Requires Node.js. No packages, API keys, or external services are required.

`npm start` → http://localhost:4173

`npm test` verifies state transitions, human review, idempotency, and consent routing.

## Golden demo (about two minutes)

1. Patient: confirm the prescribed routine, record the sample breakfast activity, and confirm the seeded monitoring-data activity. This does not import new glucose data.
2. Coordinator: open Attention queue, simulate a reminder for the renal-function investigation, then request caregiver help.
3. Caregiver: see only the assigned support task.
4. Patient: attach the built-in synthetic report. The loop becomes REVIEW_PENDING, assigned to Clinician.
5. Clinician: review the sample evidence, enter an operational review note, and close the loop.
6. Activity trail: inspect the state changes and actors. Reload to demonstrate the restored session and shared records. A clinician can reopen completed loops with a reason; there is no database reset button.

## Implemented boundaries

The main `/` app now uses real Supabase sign-in, durable shared records, server-enforced roles and audited transitions. The separate `/database.html` page remains a minimal verification workspace. All records and evidence are synthetic. Neither surface has real file uploads, live WhatsApp, voice transcription, or AI extraction. Do not load real patient information. The external font is optional; system fonts remain usable offline. See `database/README.md` for credentials, workflow details and current limits.

No diagnosis, prescribing, glucose interpretation, or test-result interpretation is implemented. Missing medication confirmation remains UNCONFIRMED rather than being inferred as missed. Test evidence always requires explicit human review before closure.

## Current build backlog

Use [MVP and full application inventory](docs/mvp-and-product-review.md) as the current scope baseline. Authentication, the initial schema, server role policies and connected web screens already exist and must not be reopened as new setup work. The inventory separates partial features from missing integrations and later product scope.

The PRD's full MVP requires real WhatsApp and voice. This first prototype does not satisfy that gate yet. The earlier Lovable/Make plan is a reference architecture; direct implementation here accelerates the immediate demo without requiring those accounts first.
