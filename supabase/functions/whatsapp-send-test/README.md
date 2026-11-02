# whatsapp-send-test

Updated 2 November 2026.

Clinician-only fixed-recipient/template setup test. POST action=status inspects the existing reservation; action=send can initiate the singleton guarded attempt. The setup send has already been used and was delivered. Do not reset its reservation or blindly retry an uncertain provider result. The trial package-delivery template is a connectivity test, not a WholeCare care reminder. This endpoint accepts no arbitrary destination or message.

See [API contracts](../../../docs/API_AND_INTEGRATIONS.md) for payloads, authentication and secret names; [operations](../../../docs/SETUP_AND_OPERATIONS.md) for deployment and test effects; and [release verification](../../../docs/release-verification.md) for observed checks and limitations. Source in this directory is authoritative for exact validation. Provider secrets belong in Supabase, never in this file or browser code. Use fictional project data only.
