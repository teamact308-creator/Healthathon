import type {Command, WholeCareAdapter, Workspace} from './model';
import {validateNote} from './model';

export const DEMO_PATIENT_ID = '8bb02ec2-6b42-47d9-8ed3-700bf92a1060';
export const newFixture = (): Workspace => ({
  carePatientId: DEMO_PATIENT_ID, mode: 'fixture', version: 1,
  patient: {displayName: 'Anita · synthetic patient', reference: 'WC-DEMO-001', facility: 'Team Act · demonstration clinic'},
  snapshotAt: '2026-11-03T07:30:00Z',
  planSource: 'Fictional clinician-agreed routine covering medication participation, meals, monitoring availability and an investigation report. No medication dose, treatment advice or clinical findings are included in this fixture.',
  items: [
    {id: 'medication-1', domain: 'Medication', label: 'Confirm the agreed morning routine', state: 'UNCONFIRMED', nextOwner: 'Patient', summary: 'Completion has not been confirmed. Ask the patient for an update; this does not establish a missed dose.', source: 'Synthetic scheduled task. No patient activity has been entered.', recordedAt: '2026-11-03T03:30:00Z'},
    {id: 'report-1', domain: 'Investigation', label: 'Review the uploaded investigation', state: 'REVIEW_PENDING', nextOwner: 'Clinician', summary: 'A fictional report placeholder is ready for an operational review rehearsal.', source: 'SYNTHETIC REPORT FIXTURE — no laboratory results or clinical findings. The original document is deliberately not connected in this prototype. Completing review tests the software workflow only.', recordedAt: '2026-11-03T04:10:00Z'},
    {id: 'meal-1', domain: 'Meals', label: 'Breakfast check-in', state: 'CLOSED', nextOwner: 'None', summary: 'A fictional patient-entered breakfast note is recorded.', source: 'Synthetic patient activity: Breakfast logged at the agreed check-in.', recordedAt: '2026-11-03T03:50:00Z'},
    {id: 'monitoring-1', domain: 'Monitoring', label: 'Monitoring data availability', state: 'CLOSED', nextOwner: 'None', summary: 'Sample data availability was confirmed. No clinical interpretation is provided.', source: 'Synthetic imported observations. This view does not display, classify or interpret glucose values.', recordedAt: '2026-11-03T04:00:00Z'},
  ], trail: [],
});

// This is a local demonstration boundary, not a replacement for server authorization.
export function createFixtureAdapter(now = () => new Date().toISOString()): WholeCareAdapter {
  let state = newFixture();
  const receipts = new Map<string, {payload: string; result: Workspace}>();
  function scope(id: string) {
    if (id !== DEMO_PATIENT_ID) throw new Error('This patient is not mapped. No WholeCare data has been loaded.');
  }
  function execute(command: Command, action: 'report_reviewed' | 'follow_up_note') {
    scope(command.carePatientId);
    validateNote(command.note);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.eventKey)) throw new Error('A valid request key is required.');
    const payload = JSON.stringify({command, action});
    const receipt = receipts.get(command.eventKey);
    if (receipt) {
      if (receipt.payload !== payload) throw new Error('This request key was already used for a different action.');
      return structuredClone(receipt.result);
    }
    if (command.expectedVersion !== state.version) throw new Error('This view changed. Refresh it before confirming.');
    const item = state.items.find(i => i.id === command.taskId);
    if (!item) throw new Error('Task not found for this patient.');
    if (action === 'report_reviewed' && item.state !== 'REVIEW_PENDING') throw new Error('Only a pending report can be reviewed.');
    if (action === 'follow_up_note' && item.state !== 'UNCONFIRMED') throw new Error('This task is not awaiting a patient update.');
    const recordedAt = now();
    state = {
      ...state, version: state.version + 1,
      items: state.items.map(i => i.id === item.id && action === 'report_reviewed' ? {...i, state: 'CLOSED', nextOwner: 'None', summary: 'The fictional investigation review is recorded. No clinical interpretation was performed.'} : i),
      trail: [{id: command.eventKey, actor: 'Demo clinician', action, taskId: item.id, note: command.note.trim(), recordedAt}, ...state.trail],
    };
    receipts.set(command.eventKey, {payload, result: structuredClone(state)});
    return structuredClone(state);
  }
  return {
    async getWorkspace(id) {scope(id); return structuredClone(state);},
    async reviewEvidence(command) {return execute(command, 'report_reviewed');},
    async recordFollowUp(command) {return execute(command, 'follow_up_note');},
  };
}

export function createAdapter(mode: 'fixture' | 'care' = 'fixture'): WholeCareAdapter {
  if (mode !== 'fixture') throw new Error('Live CARE identity mapping and backend authorization are not configured.');
  return createFixtureAdapter();
}
