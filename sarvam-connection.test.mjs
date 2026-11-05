import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes((await readFile(new URL('./supabase/functions/sarvam-connection-check/index.ts',import.meta.url),'utf8')).replace(/^import .*\n/gm,''));
const patient='11111111-1111-4111-8111-111111111111';
async function run({role='clinician',body={operation:'status',patient_id:patient},authorization='Bearer fixture'}={}){
 let handler;const calls=[];
 const fetch=async(url)=>{
  calls.push(url);
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'fixture'});
  if(url.endsWith('/rpc/my_context'))return Response.json({memberships:[{patient_id:patient,role}]});
  if(url.includes('/patients?'))return Response.json([{id:patient}]);
  if(url.includes('/storage/'))return new Response(new Uint8Array([1,2,3]));
  throw Error('Unexpected external request');
 };
 vm.runInNewContext(source,{Deno:{env:{get:name=>({SUPABASE_URL:'https://fixture.test',SUPABASE_ANON_KEY:'public-fixture',SARVAM_API_KEY:'private-fixture-key'}[name])},serve:value=>handler=value},authorizeTransfer:()=>{throw Error('Should not approve invalid fixture');},fetch,Request,Response,AbortSignal,crypto,Uint8Array,Map,Set,FormData,Blob,Date});
 const headers={'Content-Type':'application/json'};
 if(authorization)headers.Authorization=authorization;
 const response=await handler(new Request('https://fixture.test',{method:'POST',headers,body:JSON.stringify(body)}));
 return {status:response.status,result:await response.json(),calls};
}
test('Sarvam readiness returns availability without key material or provider calls',async()=>{
 const result=await run();
 assert.equal(result.status,200);
 assert.equal(result.result.configured,true);
 assert.equal(JSON.stringify(result.result).includes('private-fixture-key'),false);
 assert.equal(result.calls.some(url=>url.includes('sarvam.ai')),false);
});
for(const role of ['patient','coordinator','caregiver'])test(role+' cannot run clinician Sarvam trial',async()=>{
 const result=await run({role});
 assert.equal(result.status,403);
 assert.equal(result.calls.some(url=>url.includes('sarvam.ai')),false);
});
test('unapproved trials and arbitrary audio cannot reach Sarvam',async()=>{
 const base={operation:'transcribe',patient_id:patient,source_path:patient+'/fixture.wav'};
 assert.equal((await run({body:base})).status,400);
 const result=await run({body:{...base,synthetic_only:true,approved:true}});
 assert.equal(result.status,400);
 assert.equal(result.calls.some(url=>url.includes('sarvam.ai')),false);
});
test('unauthenticated requests are rejected before any network use',async()=>{
 const result=await run({authorization:null});
 assert.equal(result.status,401);
 assert.equal(result.calls.length,0);
});
