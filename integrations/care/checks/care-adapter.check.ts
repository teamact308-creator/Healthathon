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
  await assert.rejects(adapter.reviewEvidence(body),/connection or report changed/);
  assert.deepEqual(JSON.parse(String(sent?.body)),{eventKey:patient,expectedVersion:'v1',note:'Synthetic review'});
  status=401;await assert.rejects(adapter.getWorkspace(patient),/session expired/);
});
test('WholeCare password is sent directly to Auth; CARE only gets the session grant', async () => {
  const calls: Array<{url:string; init?:RequestInit}> = [];
  const projectUrl = 'https://abcdefghijklmnopqrst.supabase.co';
  const send: typeof fetch = async (url, init) => {
    calls.push({url:String(url),init});
    return new Response(JSON.stringify(calls.length === 1 ? {projectUrl,publishableKey:'sb_publishable_test'} : calls.length === 2 ? {refresh_token:'fresh-grant'} : {connected:true}));
  };
  const adapter = createCareAdapter({base,token:()=> 'staff',fetch:send});
  await adapter.connect!(patient,'demo@example.test','demo-password');
  assert.equal(calls[1].url,projectUrl+'/auth/v1/token?grant_type=password');
  assert.equal(new Headers(calls[1].init?.headers).has('Authorization'),false);
  assert.equal(calls[2].url.startsWith(base),true);
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)),{refreshToken:'fresh-grant'});
  assert.equal(calls[2].init?.redirect,'error');
});
test('missing delegation is distinguishable from CARE authentication and original requests are scoped', async () => {
  const calls: string[] = [];
  const adapter = createCareAdapter({base,token:()=> 'staff',fetch:async (url) => {
    calls.push(String(url));
    return calls.length === 1 ? new Response(null,{status:428}) : new Response('%PDF-demo',{headers:{'Content-Type':'application/pdf','X-WholeCare-Report-Receipt':'12345.'+'a'.repeat(64)}});
  }});
  await assert.rejects(adapter.getWorkspace(patient),/Connect to WholeCare/);
  const source = await adapter.openReport!(patient,patient,patient);
  assert.equal(source.blob.type,'application/pdf');
  assert.equal(calls[1],base+'/api/care_wholecare/v1/patients/'+patient+'/loops/'+patient+'/reports/'+patient);
});
