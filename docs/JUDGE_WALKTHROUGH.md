# WholeCare Diabetes demo walkthrough

Use the hosted app at https://healthathon.vercel.app/ and the four separately shared synthetic test accounts. Use distinct browser profiles for simultaneous sessions. Refresh after another persona saves a change. The workspace is shared, so choose an available due activity before starting the run. Use fictional source files and notes throughout.

1. Clinician opens the confirmed care plan and points out the source instructions. Choose one due investigation and one due activity for the rest of the demo.
2. Patient opens Today, records an activity and verifies the saved receipt and next step. For the investigation, upload a fictional report from its task. The report should appear in Journey → Documents as awaiting review.
3. Clinician opens the care queue, reviews the original report and records the review. Patient opens the bell or Documents to verify the result. A standalone upload for association should never close a care task.
4. Patient asks for help on another due activity. Coordinator opens the Intake queue, picks up the request and replies without resolving it. Patient opens Messages from the bell, sees the assigned owner and sends a follow-up. Coordinator then resolves the conversation. Check that the activity still requires its own record or review.
5. If practical support is needed, the patient grants caregiver access in Account. Coordinator routes support through the task queue. Caregiver sees only the consented task and practical next step. Revoke permission and refresh the caregiver session to check that access disappears.
6. Clinician assembles the pre-consult summary for the due-date range and opens a source record. Patient opens the 30-day trend, selects one day and exports the CSV. Point out that absent readings are gaps and adjacent events show timing.

Negative checks to run in the shared demo with a planned test fixture or in an isolated copy:

- Non-owner team member cannot reply to or resolve a claimed help request. Caregiver cannot open help threads or clinical originals.
- Replaying a help action with its original request key records one event. Reply leaves the request open. Resolving help leaves care-task status unchanged.
- Future tasks reject premature activity capture. Missing or unsupported files leave investigation status intact.
- No browser or app action should produce a live WhatsApp/SMS send in this demo. Use the separate rehearsal for those states.

Record the deployed commit, time, role, expected outcome and observed outcome for each check. Leave credentials and signed file URLs out of evidence.
