# One-shot outgoing WhatsApp template test

POST whatsapp-send-test with authenticated clinician session and JSON {"action":"send"} or {"action":"status"}. Values come only from TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_TO and TWILIO_WHATSAPP_CONTENT_SID. No arbitrary recipient, content or clinical data is accepted. The configured trial template is the package-delivery example, not a care reminder.

A backend-only twilio_test_sends row reserves the singleton whatsapp_trial_v1 test before any sending attempt. Repeated calls suppress another submission, including on ambiguous outcomes. Rejected or unknown attempts need deliberate operator reconciliation; do not delete the reservation blindly. Status reads query Twilio without sending another message. Client roles have no table access. The function verifies Auth and my_context membership before privileged operations.

Current verification: anonymous 401 and patient 403 passed. Configuration checks report invalid TWILIO_WHATSAPP_CONTENT_SID; sending is blocked before reservation and no message has been sent. Run python3 database/check-whatsapp-send.py send only for the authorized single test, then status to inspect delivery. Queued or accepted does not mean delivered.
