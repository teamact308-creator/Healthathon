# Patient journey UI — 3 November 2026

## Purpose and delivered behavior

This increment makes the care loop understandable through the patient's next action, the person responsible for the following step, and a traceable occurrence detail. It reuses the existing authenticated care workflow and database. It introduces no provider credentials or database migration.

- Patient primary navigation is Today, Journey, Log and Messages. My care plan, Health history and Care circle/preferences are secondary destinations. Team operational screens are excluded from patient navigation and guarded by the role view map.
- Today separates overdue/current attention, reports waiting for review, activities later today and occurrences closed today. Dates use each instruction's timezone. Scheduled-today and closed-today are deliberately separate counts, not an adherence percentage. Closing an old activity today does not inflate today's scheduled count.
- Each occurrence has a detail dialog showing instructions, schedule, status, next owner, progress, evidence and loaded activity/audit history. Future activities are informational; inactive/cancelled occurrences cannot accept new patient records. An unconfirmed outcome is not labelled successful.
- Investigations explicitly progress through report submission, clinician review and follow-up completion. Upload alone does not close the operational follow-up. A completed review does not assert a normal medical result. Private file preparation retains the existing authenticated access contract and identifies the selected historical file.
- The patient plan shows only the active clinician-confirmed plan, organized into four care dimensions, with schedule, source excerpts and occurrence details. Clinician proposal/authoring remains in the existing team workflow. Instructions with no open generated occurrence do not invent a next occurrence.
- Log begins with eligible activities and reuses existing capture, confirmation, correction and upload forms. Journey filters by care dimension and pages loaded history. Account/preferences reuse consent and in-app reminder controls.
- Clinician and coordinator default to the attention queue. Caregiver sees only the consent-scoped support workspace. Backend authorization remains the authority; hiding navigation is not a permission mechanism.
- Mobile patient navigation keeps all four destinations visible. Dialogs scroll within the viewport; headings receive focus on navigation. Sign-in is enabled only after module handlers are ready.

## Code map

`patient-model.mjs` owns role destinations, timezone day cohorts and occurrence meaning. `patient-ui.js` renders patient presentation and shared detail. `connected-model.mjs` retains plan/item/timezone/source and occurrence identifiers. `app.js` routes actions to existing capture/review contracts. `index.html` and `style.css` provide account navigation and responsive presentation. Browser assets are explicitly included in build/server/checker allowlists.

## Verification actually performed

- Root suite: 100 tests passed, including nine new patient model/render tests covering timezone boundaries, distinct count cohorts, pending review, future/non-active capture restrictions, role destinations, confirmed-only plan and escaping.
- Build passed; static checker verified 24 explicitly allowed files with no server credential references. The build's main list reports 23 plus one explicitly copied shared module.
- Local browser: patient signed in, four primary destinations visible, Today and Journey rendered, preferences showed existing consent/reminder settings. Confirmed plan excluded proposals. An investigation awaiting review showed clinician ownership and no patient review/closure control.
- A clearly labelled synthetic breakfast entry was saved through the new Today capture path. Its persisted detail showed recorded activity and audit history after reload; the closed-today count updated independently of scheduled-today.
- Clinician and coordinator sign-ins reached their existing attention queues with role-appropriate controls. Caregiver sign-in reached Support tasks and exposed no clinical details; no tasks were assigned in the fixture at that check.
- Mobile screenshots at 390px were inspected during iteration. This is not a complete accessibility or browser/device certification.

## Remaining release and product work

The broader UI plan remains the backlog authority: `UI_NEXT_STEPS.md`. Do not mark every release gate complete from this increment. Two full upload-to-clinician-review rehearsals with distinct evidence, the complete keyboard/device matrix, session-expiry/revoked-consent cases and failure-path regression remain to be recorded. The current work verifies activity persistence and pending-review presentation, not a fresh end-to-end investigation upload/review rehearsal.

History is bounded by the existing loaded record contract. Journey is newest scheduled first, so Today remains the entry point for immediate work. Assistance requests require a coordinated backend workflow and are not introduced here. Live WhatsApp/SMS remains unavailable; Messages is explicitly a simulation. No clinical interpretation, full CARE migration, Filly or Medispeak adoption is implied.

Publishing and live-deployment evidence must be checked against the actual commit; a local build alone is not deployment proof.

## Publication evidence

The initial release hit ENOENT because concurrently edited local build files referenced unpublished VCPI modules. The follow-up commit `8504c0a8f5ca8b44b7bdb4a3cba70ff2d742201e` restored the published asset contract plus the two patient modules; Vercel reported success. Hosted patient login, Today and confirmed plan were observed at https://healthathon.vercel.app/. Local combined-workspace tests include concurrent unpublished work; the published patient release uses 22 browser assets, while the current combined local workspace uses 24. Do not overwrite the other chat’s local build additions when continuing VCPI work.
