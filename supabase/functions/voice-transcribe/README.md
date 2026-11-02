# voice-transcribe

Updated 2 November 2026.

Assigned patient/clinician audio transcription. Accepts patient_id, source_path and language en/hi. Supported private audio is limited to 8 MB. Returns editable text with requires_confirmation=true. The user chooses task/status and confirms separately; transcription alone never changes the task.

See [API contracts](../../../docs/API_AND_INTEGRATIONS.md) for payloads, authentication and secret names; [operations](../../../docs/SETUP_AND_OPERATIONS.md) for deployment and test effects; and [release verification](../../../docs/release-verification.md) for observed checks and limitations. Source in this directory is authoritative for exact validation. Provider secrets belong in Supabase, never in this file or browser code. Use fictional project data only.
