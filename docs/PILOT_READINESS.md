# Workflow measurement and pilot readiness

## Synthetic baseline

Read-only snapshot taken 5 November 2026 (India time). The cohort covered synthetic workspaces with due dates from 5 October 00:00 UTC through 4 November 00:00 UTC, end exclusive. Of 98 eligible occurrences, 91 were currently closed with closure recorded before the cutoff (92.9%). 89 had an activity event recorded before the cutoff (90.8%). Current cancellations were excluded. These counts can change when the shared demo is reseeded or an occurrence is reopened. The baseline measures fictional workflow behavior only.

## Measurement definitions

- Closure. Eligible non-cancelled occurrences due in the chosen period form the denominator. The numerator is occurrences currently closed with closure recorded before the cutoff. Report reopened occurrences separately as outstanding.
- On-time closure. Use the same eligible cohort restricted to activity types with a configured completion window. Count closure by due time plus that window and before the report cutoff. Report the applicable policy version and the denominator.
- Recorded participation. Count eligible occurrences with at least one activity event recorded before cutoff. A missed or delayed activity still counts as a record.
- Open workload. Count currently open due occurrences beyond the configured age. Report investigation review separately by next owner.
- Monitoring availability. Use the latest observation timestamp before the cutoff and compare it with the configured availability window. Present missing observations and unconfigured policy as separate states.
- Help response. For requests created during the observation window, record time from request creation to first care-team reply, and time to resolution separately. Report median times with counts and show unanswered and unresolved counts, including those still open at cutoff.
- Staff time and sustained use. Collect staff minutes per sampled task in the existing workflow and during pilot using the same task categories. Report invite acceptance and repeat participation against explicitly defined cohorts. The demo has no measured staffing or retention outcome.

## Before enrolling real patients

1. Agree on the pilot site, care-team owner, escalation coverage, and response expectations. Define supported use cases and success thresholds.
2. Build and test invitations, identity verification, role and patient assignment, switching between multiple patients, access revocation and recovery. Test cross-patient isolation for records, storage, exports and notifications.
3. Agree retention and deletion rules, consent and access history, data export, backup restoration, and incident ownership. Decide which data may be sent to each integration. Keep synthetic testing separate.
4. Validate one source at a time for device or lab imports. Verify source identity, timestamps, units, duplicate detection, correction provenance and handling of delayed or missing records.
5. Verify production operations in a staging rehearsal, including monitoring, recovery, failure handling, and all supported roles. Record sign-off before enabling real enrollment or external messaging.

See JUDGE_WALKTHROUGH.md for the synthetic end-to-end checks and MESSAGING_REHEARSAL.md for external delivery gates.
