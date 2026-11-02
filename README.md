# WholeCare Diabetes - Team Act

A connected care-coordination development demo using fictional patient data.

Live app: https://healthathon.vercel.app/

- `npm start`: local preview on http://localhost:4173
- `npm run build`: allowlisted browser assets in dist for Vercel; backend code and credentials are excluded
- `npm test`: local occurrence/workflow regression checks
- Care plans: private document upload, AI proposals, manual editing, clinician confirmation and version history
- Scheduling: timezone-aware once/daily occurrences, background generation, in-app reminders, rescheduling and cancellation
- Capture: meals/photos, medication statuses, English/Hindi voice-file transcription, synthetic glucose CSV/chart and private report upload/review

Supabase enforces roles, patient scoping, caregiver consent and workflow actions. OpenAI credentials are server-side. Twilio transport has passed inbound and outbound tests; care conversations and SMS are not implemented. Real patient records are not enabled.

- [Demo walkthrough](BUILD.md)
- [Current MVP/product backlog](docs/mvp-and-product-review.md)
- [Release verification](docs/release-verification.md)
- [Database foundation](database/README.md)
- [One-time MVP schema upgrade](database/upgrade-mvp.sql)
