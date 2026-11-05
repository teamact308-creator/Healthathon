import type {Command, WholeCareAdapter, Workspace} from './model';
import {validateNote} from './model';

declare global {interface Window {CARE_API_URL?: string}}
const id = (value: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid mapped resource.');
  return encodeURIComponent(value);
};
export class LinkRequiredError extends Error {}

export function createCareAdapter(options?: {base: string; token: () => string | null; fetch: typeof fetch}): WholeCareAdapter {
  const base = options?.base ?? window.CARE_API_URL ?? '';
  if (base !== 'http://localhost:47416' && base !== 'http://127.0.0.1:47416') throw new Error('Open WholeCare from the configured local CARE staff workspace.');
  const readToken = options?.token ?? (() => localStorage.getItem('care_access_token'));
  const send = options?.fetch ?? fetch;
  async function request(patientId: string, suffix: string, method = 'GET', body?: object, staff = readToken()): Promise<Response> {
    if (!staff) throw new Error('Sign in to CARE with the linked clinician account.');
    const url = base + '/api/care_wholecare/v1/patients/' + id(patientId) + suffix;
    let response: Response;
    try {
      response = await send(url, {
        method, cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(75000),
        headers: {Authorization: 'Bearer ' + staff, ...(body ? {'Content-Type': 'application/json'} : {})},
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {throw new Error('CARE could not confirm the request. Retry the same review or refresh its current state.');}
    if (!response.ok) {
      if (response.status === 428) throw new LinkRequiredError('Connect to WholeCare to continue.');
      if (response.status === 401) throw new Error('Your CARE session expired. Sign in again.');
      if (response.status === 403 || response.status === 404) throw new Error('This account, patient or report is not available for this action.');
      if (response.status === 409) throw new Error('The connection or report changed. Refresh its current state before retrying.');
      throw new Error('The WholeCare connection could not complete this request.');
    }
    return response;
  }
  async function workspace(patientId: string, response: Response): Promise<Workspace> {
    const data = await response.json() as Workspace;
    if (data.mode !== 'connected' || data.carePatientId !== patientId || typeof data.version !== 'string' || !Array.isArray(data.items) || !Array.isArray(data.trail) || !data.patient?.displayName) throw new Error('CARE returned an unexpected workspace.');
    return data;
  }
  return {
    getWorkspace: async patientId => workspace(patientId, await request(patientId, '/workspace')),
    async reviewEvidence(command: Command) {
      validateNote(command.note); id(command.eventKey);
      return workspace(command.carePatientId, await request(command.carePatientId, '/loops/' + id(command.taskId) + '/review', 'POST',
        {eventKey: command.eventKey, expectedVersion: command.expectedVersion, note: command.note.trim(), ...(command.reportReceipts ? {reportReceipts: command.reportReceipts} : {})}));
    },
    async recordFollowUp() {throw new Error('Record follow-up notes in the existing WholeCare app.');},
    async connect(patientId, email, password) {
      const staff = readToken();
      const config = await (await request(patientId, '/connection', 'GET', undefined, staff)).json();
      if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.projectUrl) || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(config.publishableKey)) {
        throw new Error('WholeCare sign-in is not configured safely.');
      }
      // The password goes directly to WholeCare Auth. CARE receives only the fresh
      // refresh token over its authenticated local connection; no browser storage.
      const auth = await send(config.projectUrl + '/auth/v1/token?grant_type=password', {
        method: 'POST', cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: {apikey: config.publishableKey, 'Content-Type': 'application/json'}, body: JSON.stringify({email, password}),
      }).catch(() => {throw new Error('WholeCare sign-in is unavailable. Try again.');});
      if (!auth.ok) throw new Error('Could not sign in to WholeCare. Check your account and try again.');
      const {refresh_token} = await auth.json();
      if (typeof refresh_token !== 'string' || !refresh_token || !staff || staff !== readToken()) throw new Error('Sign in to CARE again before connecting.');
      await request(patientId, '/connection', 'POST', {refreshToken: refresh_token}, staff);
    },
    async disconnect(patientId) {
      const response = await (await request(patientId, '/connection', 'DELETE')).json();
      if (response.disconnected !== true) throw new Error('Could not confirm disconnection.');
      return response.sessionRevoked === true;
    },
    async openReport(patientId, taskId, evidenceId) {
      const response = await request(patientId, '/loops/' + id(taskId) + '/reports/' + id(evidenceId));
      const mime = response.headers.get('Content-Type')?.split(';')[0];
      const receipt = response.headers.get('X-WholeCare-Report-Receipt');
      if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mime ?? '') || !receipt || !/^\d{1,12}\.[a-f0-9]{64}$/.test(receipt)) throw new Error('CARE returned an unexpected report.');
      const blob = await response.blob();
      if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error('CARE returned an unexpected report.');
      return {blob, receipt};
    },
  };
}
