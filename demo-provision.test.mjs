import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(readFileSync('supabase/functions/demo-provision/index.ts','utf8'));
async function run({auth=true,reserve=true,replay=false,input={}}={}){
 let handler;const created=[];
 const fetch=async(url,options)=>{
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'operator'},{status:auth?200:401});
  if(url.includes('reserve_demo_provision'))return Response.json({reserved:!replay},{status:reserve?200:403});
  if(url.endsWith('/auth/v1/admin/users')){created.push(JSON.parse(options.body));return Response.json({id:'synthetic'});}
  if(url.includes('complete_demo_provision'))return Response.json({synthetic:true,patient_id:'new'});
  throw Error('Unexpected request');
 };
 vm.runInNewContext(source,{Deno:{serve:h=>handler=h,env:{get:k=>({SUPABASE_URL:'https://fixture.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'}[k])}},fetch,Response,AbortSignal,Set,JSON});
 const response=await handler(new Request('https://fixture.test',{method:'POST',headers:{authorization:'Bearer user'},body:JSON.stringify({request_id:'11111111-1111-4111-8111-111111111111',kind:'rehearsal',parent_id:'parent',synthetic_only:true,password:'generated-test-password-12345',...input})}));
 return {status:response.status,body:await response.json(),created};
}
test('synthetic provisioning denies invalid session, role, replay and short password before creating identities',async()=>{
 for(const options of [{auth:false},{reserve:false},{replay:true},{input:{password:'short'}}]){const result=await run(options);assert.ok(result.status>=400);assert.equal(result.created.length,0);}
});
test('only generated .test identities are provisioned without invitation emails or disclosed passwords',async()=>{
 const result=await run({input:{email:'external@example.com'}});assert.equal(result.status,200);assert.equal(result.created.length,4);
 assert.ok(result.created.every(a=>a.email.endsWith('@wholecare.test')&&a.email_confirm===true));
 assert.ok(!JSON.stringify(result.body).includes('password'));assert.ok(!JSON.stringify(result.body).includes('private'));
});
