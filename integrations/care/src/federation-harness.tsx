import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {createRoot} from 'react-dom/client';
import {DEMO_PATIENT_ID} from './fixture-adapter';
import type manifestShape from './manifest';

// Build-output smoke harness only. It tests the real remote entry with a shared React
// provider, not CARE authentication, routing, permissions or its host implementation.
type Manifest = typeof manifestShape;
type Provider = {get: () => Promise<() => unknown>; loaded: boolean};
type Remote = {init: (scope: Record<string, Record<string, Provider>>) => void; get: (name: string) => Promise<() => Manifest | {default: Manifest}>};
const status = document.getElementById('federation-status')!;
try {
  const remoteURL = new URL('/assets/remoteEntry.js', location.origin).href;
  const remote: Remote = await import(/* @vite-ignore */ remoteURL);
  const provide = (value: unknown) => ({[React.version]: {get: async () => () => value, loaded: true}});
  remote.init({react: provide(React), 'react-dom': provide(ReactDOM)});
  const exported = (await remote.get('./manifest'))();
  const manifest = 'default' in exported ? exported.default : exported;
  if (manifest.plugin !== 'care_wholecare_fe' || !manifest.components.PatientHomeActions) throw new Error('Unexpected plugin manifest');
  const patientId = new URLSearchParams(location.search).get('patient') ?? DEMO_PATIENT_ID;
  const route = manifest.routes['/wholecare/fixture/:patientId'];
  createRoot(document.getElementById('root')!).render(route({patientId}));
  status.textContent = 'Federated manifest loaded with a shared React provider. This is a smoke harness, not the CARE host.';
} catch {
  status.textContent = 'Federation smoke test failed. Check the built remote assets and browser console. No live backend was contacted.';
}
