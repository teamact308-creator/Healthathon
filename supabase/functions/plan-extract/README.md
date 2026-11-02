# plan-extract

Updated 2 November 2026.

Clinician-only source extraction. Accepts patient_id with typed text and/or a private source_path. PDF/PNG/JPEG up to 8 MB. Returns a stored proposal with provenance and warnings. Explicit clinician review and confirmation are required before task generation; this function never activates a plan.

See [API contracts](../../../docs/API_AND_INTEGRATIONS.md) for payloads, authentication and secret names; [operations](../../../docs/SETUP_AND_OPERATIONS.md) for deployment and test effects; and [release verification](../../../docs/release-verification.md) for observed checks and limitations. Source in this directory is authoritative for exact validation. Provider secrets belong in Supabase, never in this file or browser code. Use fictional project data only.
