import test from 'node:test';import assert from 'node:assert/strict';import {bindPlans,clearPlanEditor} from './plan-ui.js';
test('failed private-source operation preserves intentionally disabled controls',async()=>{
 clearPlanEditor();const source={disabled:false,isConnected:true,dataset:{planSource:'fictional/source.pdf'}},activation={disabled:true,isConnected:true};let error='';
 const root={querySelector:()=>null,querySelectorAll:selector=>selector==='button'?[source,activation]:selector==='[data-plan-source]'?[source]:[]};
 bindPlans(root,{}, {refresh:async()=>{},toast:t=>error=t,setBusy:()=>{}});
 await source.onclick();assert.ok(error);assert.equal(source.disabled,false);assert.equal(activation.disabled,true);
});
