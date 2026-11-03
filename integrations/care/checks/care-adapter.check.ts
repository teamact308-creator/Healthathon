import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCareAdapter} from '../src/care-adapter';
const patient = '8bb02ec2-6b42-47d9-8ed3-700bf92a1060';
const base = 'http://localhost:47416';
const workspace = {mode:'connected',carePatientId:patient,version:'v1',patient:{displayName:'Synthetic'},items:[],trail:[]};
test('staff token is refreshed per request and only a CARE request is made', async () => {
  let token = 'first'; const calls: Array<{url:string;init?:RequestInit}> = [];
  const send: typeof fetch = async (url,init) => {calls.push({url:String(url),init});return new Response(JSON.stringify(workspace));};
  const adapter = createCareAdapter({base,token:()=>token,fetch:send});
  await adapter.getWorkspace(patient);token='second';await adapter.getWorkspace(patient);
  assert.equal(calls.length,2);assert.equal(new Headers(calls[1].init?.headers).get('Authorization'),'Bearer second');
  assert.equal(calls[0].url,base+'/api/care_wholecare/v1/patients/'+patient+'/workspace');
  assert.equal(calls[0].init?.redirect,'error');assert.equal(calls[0].init?.credentials,'omit');
});
test('unconfigured origin and missing staff session fail before transmission', async () => {
  const send:typeof fetch = async () => {throw new Error('Should not call network');};
  assert.throws(()=>createCareAdapter({base:'https://other.invalid',token:()=>null,fetch:send}),/configured local CARE/);
  await assert.rejects(createCareAdapter({base,token:()=>null,fetch:send}).getWorkspace(patient),/Sign in to CARE/);
});
test('cross-patient response is rejected and unimplemented writes never transmit', async () => {
  let writes=0;const send:typeof fetch=async()=>{writes++;return new Response(JSON.stringify({...workspace,carePatientId:'other'}));};
  const adapter=createCareAdapter({base,token:()=>'staff',fetch:send});
  await assert.rejects(adapter.getWorkspace(patient),/unexpected workspace/);
  await assert.rejects(adapter.recordFollowUp({carePatientId:patient,taskId:patient,eventKey:patient,expectedVersion:'v1',note:'Follow-up'}),/existing WholeCare/);
  assert.equal(writes,1);
});
test('review sends only frozen command fields and maps stale/auth errors',async()=>{
  const body={carePatientId:patient,taskId:patient,eventKey:patient,expectedVersion:'v1',note:'  Synthetic review  '};
  let sent:RequestInit|undefined;let status=409;
  const send:typeof fetch=async(_url,init)=>{sent=init;return new Response('{}',{status});};
  const adapter=createCareAdapter({base,token:()=>'staff',fetch:send});
  await assert.rejects(adapter.reviewEvidence(body),/view or request changed/);
  assert.deepEqual(JSON.parse(String(sent?.body)),{eventKey:patient,expectedVersion:'v1',note:'Synthetic review'});
  status=401;await assert.rejects(adapter.getWorkspace(patient),/session expired/);
});
