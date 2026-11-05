import test from 'node:test';import assert from 'node:assert/strict';import {createDeliveryRepository} from './delivery-repository.mjs';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
test('durable repository uses only the service RPC and never exposes provider credentials in errors',async()=>{
 const calls=[];const repository=createDeliveryRepository({url:'https://fixture.test',serviceKey:'server-fixture',request:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return Response.json(null);}});
 await repository.claim('job',1);await repository.result('job','key','unknown',null);assert.deepEqual(calls.map(c=>c.body.p_action),['claim','result']);
 const failed=createDeliveryRepository({url:'https://fixture.test',serviceKey:'secret-fixture',request:async()=>new Response('sensitive upstream',{status:500})});await assert.rejects(()=>failed.candidates(),e=>e.message==='Delivery repository unavailable');
});
test('disabled messaging deployment makes zero provider or database requests',async()=>{
 let handler,calls=0;const source=stripTypeScriptTypes(readFileSync('supabase/functions/care-messaging-worker/index.ts','utf8').replace(/^import .*\n/gm,''));
 vm.runInNewContext(source,{Deno:{serve:h=>handler=h,env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'server-fixture':undefined}},Response,createDeliveryRepository:()=>{calls++;throw Error('Should remain disconnected');}});
 assert.equal((await handler(new Request('https://fixture.test',{method:'POST',headers:{authorization:'Bearer ordinary-user'}}))).status,403);
 const response=await handler(new Request('https://fixture.test',{method:'POST',headers:{authorization:'Bearer server-fixture'}}));assert.equal((await response.json()).state,'disabled');assert.equal(calls,0);
});
