# Care-plan review UI improvements

5 November 2026. Local implementation in `plan-ui.js`, scoped styles in `style.css`, and escaping/role regression coverage in `plan-ui.test.mjs`. Release prepared against main a7a0395; deployment status is tracked in the release pull request.

The screen now separates original instructions from proposed actions, with a sticky source panel on wide screens and a stacked layout on narrow screens. An attached document collapses replacement controls; image originals use an image element and PDFs retain their embedded viewer and private full-size link. Upload, camera and dictation remain available.

Action cards lead with the instruction and schedule. Human-readable field labels replace internal names. Repeated findings are grouped in expandable notices, and source evidence is presented as quotes with field/page references rather than raw JSON. Each of the eight verification checks remains explicit; a live counter reflects progress. Editing clears checks, and switching away from weekly recurrence clears and hides weekday selections. The final preview names weekdays and separates manual-handling items from scheduled actions. Version/history panels are collapsed until requested.

Existing authorization, database confirmation, unresolved-item handling, source paths, exclusion reasons and clinical scope are unchanged. No database records or provider settings were changed for this UI task.

## Checks

- Desktop synthetic browser fixture at 1280px: side-by-side source and action layout, no horizontal overflow; source opened beside editable instructions.
- Mobile fixture at 390px: stacked layout, no horizontal overflow, all seven weekday controls fit in one row.
- Verified checkbox progress updates; editing resets checks; weekday controls follow recurrence; exclusion reasons persist after draft save; confirmation refuses unchecked fields.
- Both UI unit tests pass, including source/evidence escaping and absence of clinician controls for the Patient role.
- Final integration: all 124 tests pass and the 27-file public build allowlist passes its server-credential check.
- PostgreSQL 17 clean migration rebuild, all four synthetic SQL suites, and dump/restore verification pass. Vault and pg_net use explicit offline contracts: no encryption, object bytes, hosted authentication, or HTTP delivery is tested.
- The current privacy approval flow is preserved. Note-only extraction retains the original private document for clinician review separately from the source actually shared with AI. Camera, crop, dictation and current messaging exports remain available.

Local screenshot evidence: `.local/vcpi-ui-before.png`, `.local/vcpi-ui-desktop.png`, `.local/vcpi-ui-mobile.png`. Browser fixtures use in-memory synthetic records, not live clinical validation. The local connected app required sign-in after the preview server restarted; no password was read or changed.
