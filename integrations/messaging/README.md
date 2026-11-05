# Disabled messaging infrastructure — 6 November 2026

The user explicitly approved proposal storage and patient confirmation while keeping both external channels disabled. The schema in supabase/migrations/20261105210450_wholecare_inbound_proposals.sql is installed. Both private.channel_gates rows were verified false. No new webhook, worker schedule, real phone enrollment or sending route was activated.

The service-only repository adapter wraps the existing atomic claim/result/provider functions. Prepared Edge handlers require separate environment gates in addition to current database gates. The status and incoming handlers use pinned Twilio signature verification, exact configured URLs and account checks. Incoming bodies are bounded and duplicate form keys rejected. Server stage permission is not public patient permission. Do not deploy or register these handlers as a way around the hold; provider-facing authentication/gateway configuration needs separate review.

Incoming proposals are raw untrusted self-reports, not completed care. The server stages only a verified unambiguous enrollment with current consent/gate; STOP revokes consent even when sending is disabled. Provider IDs deduplicate. The patient's portal requires explicit activity, outcome, note and checkbox confirmation. The checked care RPC enforces patient/task/domain/state. Caregivers cannot read raw proposals or confirm. Reports retain the separate evidence/upload/review path.

The inbound-media adapter is fixture-tested preparation only and is not called by a live endpoint. It constructs one allowed Twilio media URL from validated identifiers, refuses redirects, limits bytes/time/type and performs structural screening. Its return still requires private patient-scoped storage and report association/review; no care event is written. This is not antivirus. Actual provider media download and private upload integration remains untested.

Tests: delivery-repository.test.mjs, inbound-media.test.mjs and database/verify-inbound-proposals.sql. The SQL fixture temporarily enables a disposable enrollment inside a rolled-back isolated database transaction; normal deployment never enables a gate. No external provider requests occur in these fixtures. The current repository source is preparation, not proof of registered or accepted live webhooks.

Twilio reply-context contract: https://www.twilio.com/docs/messaging/guides/webhook-request . An absent or unresolvable OriginalRepliedMessageSid leaves task selection to explicit patient review. Never infer the most recent open task.
