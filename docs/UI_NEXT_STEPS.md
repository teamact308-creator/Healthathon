# WholeCare UI discussion reconciliation and next steps

Reviewed 3 November 2026, Asia/Kolkata. This is an implementation recommendation and a limited patient UI check, not a completed UI release. No application code, database records, permissions, provider gates or deployment were changed by this review.

## Source and baseline

- Chat: [List Application Screens](chatgpt-conversation://6ae91376-0950-83ec-8d46-c1364a97f3c4), including the screen inventory, gap assessment and requested implementation plan.
- [Team Drive UX implementation plan](https://drive.google.com/file/d/1VJu_nV3y2sm-pbNWGmqWYBRpmJt2wW9G/view), version 1.0, prepared 3 November for the internal Friday 6 November walkthrough. Its baseline was b75230f. Its acceptance gates and cut lines remain useful; the dates are the existing plan, not a new delivery guarantee.
- GitHub main observed during this review: `2ea71fb755c41c6a12eaddfb39d929903803da6f`, the password-recovery increment after that plan. Login, email recovery UI and signed-in password change should not be recreated as missing UI work. Actual recovery delivery remains separately unverified for a real inbox.
- Local implementation: index.html, app.js, style.css, plan-ui.js and the documented capture, reporting, consent and messaging contracts.
- Current hosted patient screen captures: desktop Today, 390 x 844 Today, 390 x 844 Care Plans. Existing demo credentials were used only to sign in; no password was changed. The review session was signed out and the temporary viewport restored.

## What the discussions already establish

The requested plan is an improvement to the existing application. Preserve the selected cream/green visual direction, one shared care model and the current backend. Patient and caregiver experiences are mobile-first; clinician and coordinator experiences are task-oriented desktop workspaces with different priorities. Four personas do not require four separate applications.

The 95 screen/state concepts are an inventory, not 95 independent pages. The six immediate UI packages are UX-01 through UX-06. Most improve or extract existing workflows. The fuller caregiver check-in/assisted-upload product, real channel enrollment, multi-patient administration and advanced clinical capabilities are outside the immediate UI release.

The accepted plan puts UI function, server authorization, persistence and regression verification ahead of decoration. Keep AI suggestions reviewable and editable, and preserve clinician authority over evidence review. Live WhatsApp/SMS remains a separate blocked workstream. CARE starter/integration work should not become a prerequisite for these improvements or a second implementation of the same follow-up behavior.

## Current limited screen check

### Step 1 — Patient Today at desktop width: usable foundation, unclear daily cohort

The existing screen has a consistent green/neutral style, an identifiable signed-in role, task status and next owner. It still exposes nine patient navigation destinations, including Attention queue and Intake & issues. The hero displays 5/7 loops closed across loaded current items, rather than an explicitly dated daily measure. Source inspection confirms total and closed counts use state.items directly; the screen does not establish today's denominator.

Evidence: ../.local/ui-review-2026-11-03/01-patient-today-desktop.png. Task labels, records and counts are synthetic and change over time.

![Step 1: current patient Today desktop](../.local/ui-review-2026-11-03/01-patient-today-desktop.png)

### Step 2 — Patient Today at 390 x 844: renders, but actions are hard to reach

Navigation becomes a horizontally scrolling strip with destinations off-screen. In the captured viewport, account controls, introductory copy, the technical demo notice and progress hero precede the first task; its primary action is not initially visible. The layout does not itself demonstrate task prioritization or a compact mobile daily companion.

Keep an honest demo/simulation indicator, but move technical infrastructure explanations into secondary information. Give the first actionable care item higher priority. Use the agreed four destinations: Today, Journey, Log, Messages. Put password, preferences, care-circle/consent and profile access under an account control.

Evidence: ../.local/ui-review-2026-11-03/02-patient-today-mobile.png.

![Step 2: current patient Today at mobile width](../.local/ui-review-2026-11-03/02-patient-today-mobile.png)

### Step 3 — Patient Care Plans at 390 x 844: content is available, audience is wrong

The patient sees the heading 'CLINICIAN REVIEW' and instructions to review the source, confirm the plan and schedule next steps. A proposed inactive draft appears before the confirmed active plan. Source inspection confirms the common plan-version presentation is reused. This is a clarity problem; the inspection did not establish an authorization bypass.

Patient instructions should show the active clinician-confirmed plan first, with readable domain/schedule information and links to actual occurrences. Keep proposed-plan authoring and confirmation controls in the clinician experience. Historical versions can remain secondary, clearly distinguished from current instructions.

Evidence: ../.local/ui-review-2026-11-03/03-patient-care-plan-mobile.png.

![Step 3: patient Care Plans showing clinician-facing copy](../.local/ui-review-2026-11-03/03-patient-care-plan-mobile.png)

### Accessibility and evidence limits

Small secondary text and the long horizontal menu present readability/discoverability risks in the mobile screenshots. Focus order, keyboard modal behavior, screen-reader output, contrast ratios, zoom, other widths and all four roles require targeted checks before release. This review does not claim WCAG compliance, a full four-persona browser audit, or end-to-end upload/review verification. Existing source and prior acceptance evidence do not replace those tests after a UI change.

## Recommended implementation order

### First milestone — W00 + UX-01 + UX-03

1. Record the current source/deployment baseline and passing checks. Reuse existing fictional records without resetting the shared demo. Capture 360/390/768/1280 reference states as each surface is changed.
2. Add a centralized role-to-navigation/default-landing map. Patient gets Today/Journey/Log/Messages; caregiver gets a minimal consent-scoped support surface; clinician defaults to work needing clinician review; coordinator defaults to operational follow-up. These team landing refinements are recommendations extending the plan's role-aware navigation, not newly verified implementations.
3. Prevent a stale/hidden view from carrying across sign-out, role change or session restoration. Client routing is usability, not authorization: server permissions remain unchanged.
4. Build one reusable Care Loop detail panel. Start with an accessible dialog/panel rather than new nested routing or a graphical graph. Show instruction and source excerpt, domain, schedule/timezone, exact occurrence, current state, next owner/action, evidence and review, and activity/provenance history.
5. Reuse existing capture, file, review, reschedule and correction actions. No duplicate mutation APIs, frontend scheduler or parallel state store. Only role-authorized actions appear; backend denials remain authoritative.

Exit: a patient can sign in, identify appropriate navigation, open a particular loop and see the next action/owner. Other roles retain the correct access. Sign-out/session restoration and forbidden-role actions remain correct. Patient mobile navigation is usable; relevant tests and public asset checks pass.

### Second milestone — UX-02 + UX-04

- Today: Needs attention, Coming up, Completed today, Waiting on others. Use the relevant plan timezone and explicit date/counter definitions. 'Scheduled today' and 'closed today' are different cohorts and must not be mixed silently. Preserve cancellation, rescheduling, historical completion and pending-review distinctions. Refresh from persisted results; failed writes never become visual completion.
- My Care Plan: a read-only patient view of the active confirmed plan grouped across medication, meals, monitoring and investigations. Link each instruction to its occurrences and the shared detail panel. Surface it from Today/Journey rather than adding another permanent mobile tab.
- Keep Record activity reachable from Today, loop detail and Log, with the same underlying capture flow.

Exit: Today → confirmed instruction → specific occurrence → existing capture → persisted updated status works without a patient encountering clinician proposal-management language.

### Third milestone — UX-05 + UX-06 + W07

- Investigation: make instructions, evidence submission, review-pending receipt and clinician-reviewed closure a coherent journey in the common detail panel. The upload receipt should say who acts next for this submission, without implying every other patient task is finished. Receipt never equals review or clinical interpretation.
- Messaging: keep a persistent 'Simulation — no phone message sent' label, make eligible task association and confirmation clear, and link to the same care records. Preserve the distinction between session-only conversation/receipts and saved activities. Provider gates stay disabled.
- Demonstrate existing support routing with explicit consent and restricted caregiver visibility. Do not invent caregiver check-in completion or clinical file access. Clinician reviews; coordinator coordinates. Use genuine sign-in identities rather than a role switcher.

Exit: a synthetic investigation is identifiable by the patient, evidence becomes review pending, the clinician reviews the private original, and the patient sees the same closed operational state after reload. Confirm existing consent/support visibility and the simulator's boundaries.

### Release gate — W08 + W09

Run relevant role/data regression checks, build/static allowlist checks and a mobile/desktop keyboard smoke matrix. Check duplicate submission, invalid/failed upload, session expiry, revoked consent and invalid-role behavior where relevant to the changed UI. Rehearse twice with safe distinct fictional evidence and no database resets. Verify the served release and document remaining gaps; existing Vercel access limitations in the earlier plan should be rechecked, not assumed current.

## Work to defer

After the six P0 UI packages: Journey/history filters, simplified Log, clearer glucose/history presentation, patient reminders/documents/preferences. New assistance requests must be designed together with coordinator/caregiver resolution and require backend work; they are not a cosmetic button. Keep new enrollment, full caregiver check-ins/uploads, appointment scheduling, multi-patient administration and a broad CARE migration outside the immediate UI improvement.

## Files and reuse boundaries for implementation

- New UI-only modules may hold role navigation, patient presentation and shared loop detail. Add any browser module to build.mjs and the local server allowlist; update the asset checker.
- app.js should coordinate views and selected occurrences rather than accumulate another full independent workflow.
- plan-ui.js remains clinician authoring/review; patient presentation reads the existing confirmed plan.
- capture-ui.js, messaging-ui.js and operations-ui.js retain their checked action contracts.
- The initial navigation/detail/Today/plan work should not require new provider keys or a database migration. Additional clinical/file metadata should be added only if an actual data gap is found, with the appropriate scoped read contract.

Recommendation: execute the existing first milestone next. A new screen inventory, palette exploration or major framework rewrite would repeat planning without addressing the observed patient experience.


## Patient UI implementation — 3 November 2026

Patient navigation, Today cohorts, confirmed-plan presentation, occurrence detail and direct capture are implemented. See [delivered scope, code map, actual verification and remaining release gates](PATIENT_UI_DELIVERY.md). Earlier planning-only language is historical for those portions. Do not infer that all P0 investigation rehearsals or the full accessibility/failure matrix have passed. Existing CARE integration and backend authorization are retained.
