import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAdapter, createFixtureAdapter, DEMO_PATIENT_ID} from '../src/fixture-adapter.ts';
import {summarize} from '../src/model.ts';
const now = () => '2026-11-03T08:00:00Z';
const command = (overrides = {}) => ({carePatientId: DEMO_PATIENT_ID, taskId: 'report-1', eventKey: randomUUID(), expectedVersion: 1, note: 'Reviewed the fictional source for a software demonstration.', ...overrides});

test('only the dedicated fixture patient loads; returned data cannot mutate adapter state', async () => {
  const adapter = createFixtureAdapter(now);
  await assert.rejects(adapter.getWorkspace('another-patient'), /not mapped/);
  await assert.rejects(adapter.reviewEvidence(command({carePatientId: 'another-patient'})), /not mapped/);
  const view = await adapter.getWorkspace(DEMO_PATIENT_ID);
  view.items[0].state = 'CLOSED';
  assert.equal((await adapter.getWorkspace(DEMO_PATIENT_ID)).items[0].state, 'UNCONFIRMED');
  assert.deepEqual(summarize(view.items), {total: 4, closed: 3, review: 1, patient: 0});
});

test('explicit review closes only the pending report and retains source plus actor/time/reason', async () => {
  const adapter = createFixtureAdapter(now);
  const before = await adapter.getWorkspace(DEMO_PATIENT_ID);
  const after = await adapter.reviewEvidence(command());
  assert.deepEqual(summarize(after.items), {total: 4, closed: 3, review: 0, patient: 1});
  assert.equal(after.items[1].source, before.items[1].source);
  assert.equal(after.items[0].state, 'UNCONFIRMED');
  assert.equal(after.items[1].nextOwner, 'None');
  assert.equal(after.trail[0].actor, 'Demo clinician');
  assert.equal(after.trail[0].recordedAt, now());
  assert.match(after.trail[0].note, /fictional source/);
});

test('same request replays without another action; key reuse with changed data is rejected', async () => {
  const adapter = createFixtureAdapter(now), input = command();
  const first = await adapter.reviewEvidence(input);
  assert.deepEqual(await adapter.reviewEvidence(input), first);
  await assert.rejects(adapter.reviewEvidence({...input, note: 'A different review using the same key.'}), /different action/);
  assert.equal((await adapter.getWorkspace(DEMO_PATIENT_ID)).trail.length, 1);
});

test('stale views, invalid tasks, wrong transitions and missing reasons fail without changing state', async () => {
  const adapter = createFixtureAdapter(now);
  for (const input of [command({expectedVersion: 0}), command({taskId: 'missing'}), command({taskId: 'meal-1'}), command({note: ' '}), command({eventKey: 'invalid'})]) {
    await assert.rejects(adapter.reviewEvidence(input));
  }
  assert.equal((await adapter.getWorkspace(DEMO_PATIENT_ID)).version, 1);
  assert.equal((await adapter.getWorkspace(DEMO_PATIENT_ID)).trail.length, 0);
});

test('a follow-up note does not complete the patient task or imply a provider send', async () => {
  const adapter = createFixtureAdapter(now);
  const after = await adapter.recordFollowUp(command({taskId: 'medication-1', note: 'Ask for a patient update at the next care-team check-in.'}));
  assert.equal(after.items[0].state, 'UNCONFIRMED');
  assert.equal(after.items[0].nextOwner, 'Patient');
  assert.equal(after.trail[0].action, 'follow_up_note');
  await assert.rejects(adapter.recordFollowUp(command({expectedVersion: 2})), /not awaiting/);
});

test('separate page instances reset independently; live mode fails closed without network calls', async () => {
  const first = createFixtureAdapter(now);
  await first.reviewEvidence(command());
  assert.equal((await createFixtureAdapter(now).getWorkspace(DEMO_PATIENT_ID)).trail.length, 0);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {throw new Error('Network must not be called');};
  try {assert.throws(() => createAdapter('care'), /not configured/);}
  finally {globalThis.fetch = originalFetch;}
});
