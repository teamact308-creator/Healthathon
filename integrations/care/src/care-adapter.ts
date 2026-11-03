import type {Command, WholeCareAdapter, Workspace} from './model';
import {validateNote} from './model';

declare global {interface Window {CARE_API_URL?: string}}
const id = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid mapped resource.');
  return encodeURIComponent(value);
};

// Deliberately limited to the isolated local experiment. No patient OTP fallback,
// Supabase token, service credential, or browser-provided identity mapping.
export function createCareAdapter(options?: {base: string; token: () => string | null; fetch: typeof fetch}): WholeCareAdapter {
  const base = options?.base ?? window.CARE_API_URL ?? '';
  if (base !== 'http://localhost:47416' && base !== 'http://127.0.0.1:47416') throw new Error('Open WholeCare from the configured local CARE staff workspace.');
  const readToken = options?.token ?? (() => localStorage.getItem('care_access_token'));
  const send = options?.fetch ?? fetch;
  async function request(patientId: string, suffix = '/workspace', command?: Command): Promise<Workspace> {
    const token = readToken();
    if (!token) throw new Error('Sign in to CARE with the linked clinician account.');
    let response: Response;
    try {
      response = await send(base + '/api/care_wholecare/v1/patients/' + id(patientId) + suffix, {
        method: command ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: {Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
        body: command ? JSON.stringify({eventKey: command.eventKey, expectedVersion: command.expectedVersion, note: command.note.trim()}) : undefined,
      });
    } catch {throw new Error('CARE could not confirm the request. Retry the same review or refresh its current state.');}
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your CARE session expired. Sign in again.');
      if (response.status === 403 || response.status === 404) throw new Error('This account and patient are not linked for this action.');
      if (response.status === 409) throw new Error('This view or request changed. Refresh before editing or confirming again.');
      throw new Error('The WholeCare connection is unavailable or expired. Refresh or relink the development account.');
    }
    const data = await response.json() as Workspace;
    if (data.mode !== 'connected' || data.carePatientId !== patientId || typeof data.version !== 'string' || !Array.isArray(data.items) || !Array.isArray(data.trail) || !data.patient?.displayName) throw new Error('CARE returned an unexpected workspace.');
    return data;
  }
  return {
    getWorkspace: patientId => request(patientId),
    reviewEvidence: command => {validateNote(command.note); id(command.eventKey); return request(command.carePatientId, '/loops/' + id(command.taskId) + '/review', command);},
    async recordFollowUp() {throw new Error('Record follow-up notes in the existing WholeCare app.');},
  };
}
