export type LoopState = 'UNCONFIRMED' | 'REVIEW_PENDING' | 'CLOSED';
export type Owner = 'Patient' | 'Clinician' | 'None';
export interface FollowUp {
  id: string;
  domain: 'Medication' | 'Meals' | 'Monitoring' | 'Investigation';
  label: string;
  state: LoopState;
  nextOwner: Owner;
  summary: string;
  source: string;
  recordedAt: string;
}
export interface TrailEntry {
  id: string; actor: string; action: 'report_reviewed' | 'follow_up_note';
  taskId: string; note: string; recordedAt: string;
}
export interface Workspace {
  carePatientId: string;
  patient: {displayName: string; reference: string; facility: string};
  mode: 'fixture'; version: number; snapshotAt: string;
  planSource: string; items: FollowUp[]; trail: TrailEntry[];
}
export interface Command {
  carePatientId: string; taskId: string; eventKey: string;
  expectedVersion: number; note: string;
}
export interface WholeCareAdapter {
  getWorkspace(carePatientId: string): Promise<Workspace>;
  reviewEvidence(command: Command): Promise<Workspace>;
  recordFollowUp(command: Command): Promise<Workspace>;
}
export const stateLabel: Record<LoopState, string> = {
  UNCONFIRMED: 'Awaiting patient', REVIEW_PENDING: 'Review needed', CLOSED: 'Completed',
};
export function summarize(items: FollowUp[]) {
  return {
    total: items.length,
    closed: items.filter(i => i.state === 'CLOSED').length,
    review: items.filter(i => i.state === 'REVIEW_PENDING').length,
    patient: items.filter(i => i.state === 'UNCONFIRMED').length,
  };
}
export function validateNote(note: string) {
  if (note.trim().length < 5 || note.trim().length > 1000) {
    throw new Error('Enter a review or follow-up note of 5–1,000 characters.');
  }
}
