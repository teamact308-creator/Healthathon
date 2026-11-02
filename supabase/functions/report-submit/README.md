# report-submit

Updated 2 November 2026.

Patient-only verified report intake. Accepts patient_id, loop_id, source_path, label and event_key. Validates assignment, task state, file signature and SHA-256 duplicate identity before service-only registration. Successful submission becomes REVIEW_PENDING; clinician review is still required.

See [API contracts](../../../docs/API_AND_INTEGRATIONS.md) for payloads, authentication and secret names; [operations](../../../docs/SETUP_AND_OPERATIONS.md) for deployment and test effects; and [release verification](../../../docs/release-verification.md) for observed checks and limitations. Source in this directory is authoritative for exact validation. Provider secrets belong in Supabase, never in this file or browser code. Use fictional project data only.
