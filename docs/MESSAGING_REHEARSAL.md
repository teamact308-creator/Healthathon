# Messaging rehearsal and provider recovery

Updated 3 November 2026. Twilio account suspension was reported by the owner; a support ticket is open. No live provider calls were made for this increment. Both database channel gates remain disabled. Do not create replacement accounts to bypass that review.

## What ships now

The Messages screen includes a patient-only WhatsApp/SMS conversation simulator. It uses the assigned authenticated patient workspace, never a typed phone number or patient identifier. It reuses the existing private upload, activity and intake APIs. Confirmed records persist in the shared database and are visible to authorized team accounts after refresh. SQL authorization, active-plan/due-occurrence validation and request-key deduplication remain authoritative.

Simulation permission, selected task, transcript and delivery receipts exist only in memory (last 40 entries). They clear on reload/sign-out. They are not a durable conversation record, proof of delivery, live enrollment or channel consent. No phone is requested, no sender is enabled, no provider account is contacted and no automated SMS fallback is configured. Care records remain after the simulation clears. Simulator-created activity is a web-origin action; it does not masquerade as a received WhatsApp event.

## Rehearsal

1. Sign in as the fictional patient and open Messages.
2. Enable simulation permission and select an open due occurrence. Simulate reminder, then delivered/failed/uncertain receipts. No receipt changes the care task.
3. Use REPORT for a test, TAKEN/MISSED/DELAYED for medication, MEAL for a meal, or DATA for monitoring availability. Preview binds the selected occurrence. Mismatched task, unsupported/multi-action text, future, completed or review-pending work requires clarification. This is deterministic command handling, not conversational AI extraction.
4. Review the proposed action. Discard it, or open the existing activity/report form, check status/time/description or file, and explicitly confirm. Uploads are limited to supported private files. Monitoring confirmation still requires actual recent fictional observations.
5. A report becomes REVIEW_PENDING; sign in as the assigned clinician, open the original, and explicitly review/close in Attention queue. The patient sees the persisted state after refresh/reload. A reminder, receipt or upload cannot bypass clinical review.
6. NOTE: followed by text previews an unmatched note; confirmation writes to Intake & issues without closing care work. Retry uses the same request key until the proposal is discarded. Use only fictional text/files.
7. STOP withdraws session simulation permission and discards the proposal. START prompts explicit permission; it cannot enroll a real channel. HELP explains commands. SMS is text-only rehearsal; REPORT opens the secure web upload rather than pretending SMS supports attachments.

## Delivery preparation

`messaging-service.mjs` is a server-only, dependency-injected worker/callback contract. It is not deployed, scheduled, wired to the database or included in the public static build. A durable repository implementation must wrap the existing private database helpers; browser code cannot call those helpers. The repository must check current verified enrollment, patient consent, enabled channel, active confirmed plan, task state and due time atomically. The private claim helper checks the gate, enrollment, open state, active confirmed plan and due time. The future enrollment and revocation endpoints need to use the same patient lock before activation. Constructing the worker defaults to disabled. The worker never calls the adapter without a durable reservation and treats ambiguous provider failures as unknown. An accepted result is not a delivery receipt. If provider acceptance cannot be saved, retain the reservation for reconciliation; do not blindly retry.

The status-handler factory defaults to disabled. Before deployment, inject the official pinned Twilio SDK request validator, exact external HTTPS URL, account/token and a server-only repository that resolves provider IDs to existing jobs. It validates the full received form, rejects duplicate form keys, limits bodies to 64 KB, checks account/URL/signature/status, and deduplicates status receipts through the durable repository. No phone, message body or credentials are logged. Unknown provider IDs return a retryable conflict and need reconciliation if acceptance was lost. Never trust a caller-supplied patient/job ID. Existing `whatsapp-inbound` remains receipt-only; it does not process care commands or attachments.

Local automated tests cover disabled dispatch, losing concurrent claims, uncertain send, result-write loss, exact URL/account/signature rejection, unknown identities/statuses, oversized/duplicate callback fields and reply safeguards. Callback validation uses fixtures; this is not proof of a deployed HTTP webhook or a live signed Twilio callback.

## Draft content for owner/provider review — not approved templates

WhatsApp utility-template proposal: “WholeCare: you have a pending care action. Open your secure care workspace to review the details: {{1}}. Reply STOP to stop reminders.” Use a fixed approved workspace URL/button where supported. Avoid medication names, diagnoses or laboratory findings in provider payloads. Template category, variables and final approval must be checked in the restored provider account.

SMS draft: “WholeCare: a care action is waiting in your secure workspace. Open [approved link]. Reply STOP to stop reminders.” Sender registration, destination routing, opt-out mechanism, actual link and applicable provider requirements remain unconfigured. These drafts do not promise clinical response times or emergency monitoring.

## Remaining before live activation

- Owner resolves suspension with Twilio and confirms account/sender capabilities. Check current provider rules and billing before enabling anything.
- Register an appropriate WhatsApp sender/template and SMS sender/routing separately. The old package-delivery trial template is only a connectivity artifact.
- Implement durable phone-verification/enrollment and patient channel-consent/revocation endpoints/UI with audited ownership; the simulator checkbox is not a substitute. Existing private enrollment table is a foundation, not a completed enrollment flow.
- Implement the durable service repository/worker deployment and bind signed callback HTTP route; configure exact URL/secret, verify against live provider events and monitor reservations. Deploy with gates false first.
- Bind verified inbound sender to an enrolled patient and persisted conversation/task, handle STOP before other commands and enforce current consent. Persist pending proposals and request identities; safely retrieve supported provider media into existing private upload pipeline. The web simulator supplies neither live inbound identity verification nor durable conversation history.
- Test the explicitly authorized phone recipient and fictional care loop, including opted-out/revoked/wrong-patient/duplicate/expired-session/media/failure cases. Only then enable the intended channel. Automatic fallback needs a separate agreed rule.

This increment advances J01/J03 without marking their live-channel acceptance complete. It needs no new schema migration and changes no existing channel gates/enrollments.

## November 5 verification

Both live channel gates were checked in the shared database and are disabled. The reservation helper remains service-only. The update adds a due-time and active confirmed-plan check before reserving any external delivery. The live provider review, verified enrollment, durable transport wiring and signed live test remain pending.
