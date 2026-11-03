import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';
import {extractionSchema,extractionContract,validateProposal} from './supabase/functions/_shared/vcpi.mjs';
const source=stripTypeScriptTypes((await readFile(new URL('./supabase/functions/plan-extract/index.ts',import.meta.url),'utf8')).replace(/^import .*\n/,''));
const patient='11111111-1111-4111-8111-111111111111';
async function run({body={patient_id:patient,synthetic_only:true,text:'Fictional weekly Monday check'},role='clinician',synthetic=true,upstream=200,rate=200,authorization='Bearer synthetic',proposal={source_note:'Fictional',warnings:[],items:[{domain:'medication',label:'Fictional weekly Monday check',source_excerpt:'Fictional weekly Monday check',cadence:'weekly',weekdays:[1],start_date:null,end_date:null,times:[],evidence:[],exceptions:[]}]},save=201}={}){
 let handler;const calls=[];
 const fetch=async(url,options={})=>{calls.push({url,options});let status=200,data;
 if(url.endsWith('/auth/v1/user'))data={id:'22222222-2222-4222-8222-222222222222'};
 else if(url.endsWith('/rpc/my_context'))data={memberships:[{patient_id:patient,role}]};
 else if(url.includes('/patients?'))data=[{synthetic}];
 else if(url.includes('plan_extractions?')){status=rate;data=[];}
 else if(url==='https://api.openai.com/v1/responses'){status=upstream;data={status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(proposal)}]}]};}
 else if(url.endsWith('/plan_extractions')){status=save;data={};}
 else throw Error('Unexpected request');
 return new Response(JSON.stringify(data),{status});};
 vm.runInNewContext(source,{Deno:{env:{get:n=>({SUPABASE_URL:'https://synthetic.test',SUPABASE_ANON_KEY:'fixture-public',SUPABASE_SERVICE_ROLE_KEY:'fixture-server',OPENAI_API_KEY:'fixture-provider'}[n])},serve:h=>handler=h},fetch,extractionSchema,extractionContract,validateProposal,Request,Response,AbortSignal,crypto,TextEncoder,TextDecoder,Uint8Array,btoa,Date,Set});
 const headers={'content-type':'application/json'};if(authorization)headers.authorization=authorization;
 const response=await handler(new Request('https://synthetic.test/plan-extract-vcpi',{method:'POST',headers,body:JSON.stringify(body)}));return {status:response.status,data:await response.json(),calls};
}
test('weekly extraction preserves unresolved proposal, validates and stores only provenance',async()=>{const r=await run();assert.equal(r.status,200);assert.deepEqual(r.data.proposal.items[0].weekdays,[1]);assert.equal(r.data.proposal.validation.items[0].status,'needs_clarification');assert.equal(r.data.proposal.source_fingerprint.length,64);assert.equal(r.calls.filter(c=>c.options.method==='POST'&&c.url.includes('plan_extractions')).length,1);assert.ok(!r.calls.some(c=>/care_plan|care_loop/.test(c.url)));const provider=JSON.parse(r.calls.find(c=>c.url.includes('openai')).options.body);assert.equal(provider.store,false);assert.ok(provider.text.format.schema.properties.items.items.properties.cadence.enum.includes('weekly'));});
for(const role of ['patient','caregiver','coordinator'])test(role+' cannot extract',async()=>{const r=await run({role});assert.equal(r.status,403);assert.ok(!r.calls.some(c=>c.url.includes('openai')));});
test('synthetic acknowledgement required before provider call',async()=>assert.equal((await run({body:{patient_id:patient,text:'Fictional'}})).status,400));
test('real patient flag denied before provider call',async()=>{const r=await run({synthetic:false});assert.equal(r.status,403);assert.ok(!r.calls.some(c=>c.url.includes('openai')));});
test('no auth denied',async()=>assert.equal((await run({authorization:null})).status,401));
test('provider failure creates no provenance or plan',async()=>{const r=await run({upstream:500});assert.equal(r.status,502);assert.ok(!r.calls.some(c=>c.url.endsWith('/plan_extractions')));});
test('allowance fails closed',async()=>{const r=await run({rate:500});assert.equal(r.status,503);assert.ok(!r.calls.some(c=>c.url.includes('openai')));});
test('invalid model structure fails closed',async()=>{const r=await run({proposal:{items:null}});assert.equal(r.status,503);assert.ok(!r.calls.some(c=>c.url.endsWith('/plan_extractions')));});
test('provenance failure never returns actionable success',async()=>assert.equal((await run({save:500})).status,503));
