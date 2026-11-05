import test from 'node:test';import assert from 'node:assert/strict';import {bindPlans,clearPlanEditor} from './plan-ui.js';
test('failed private-source operation preserves intentionally disabled controls',async()=>{
 clearPlanEditor();const source={disabled:false,isConnected:true,dataset:{planSource:'fictional/source.pdf'}},activation={disabled:true,isConnected:true};let error='';
 const root={querySelector:()=>null,querySelectorAll:selector=>selector==='button'?[source,activation]:selector==='[data-plan-source]'?[source]:[]};
 bindPlans(root,{}, {refresh:async()=>{},toast:t=>error=t,setBusy:()=>{}});
 await source.onclick();assert.ok(error);assert.equal(source.disabled,false);assert.equal(activation.disabled,true);
});

test('source evidence and instructions remain escaped in the clinician review layout',async()=>{
 const {renderPlans}=await import('./plan-ui.js');clearPlanEditor();
 const item={domain:'medication',label:'<script>alert(1)</script>',source_excerpt:'<img src=x onerror=alert(1)>',cadence:'daily',weekdays:[],times:['08:00'],start_date:'2026-11-09',end_date:'2026-11-10',evidence:[{field:'label',quote:'<svg onload=alert(1)>',page:1}]};
 const plan={id:'fixture',status:'proposed',source_note:'Fictional source',created_at:'2026-11-05',timezone:'UTC',vcpi_data:{items:[item],vcpi:{version:1,excluded:[]}}};
 const state={plans:[plan],rawItems:[],schedules:[],planActivity:[],historyLimits:{planActivity:100}};
 const edit={dataset:{planEdit:'fixture'}};const root={innerHTML:'',querySelector:()=>null,querySelectorAll:s=>s==='[data-plan-edit]'?[edit]:[]};
 bindPlans(root,state,{refresh:async()=>{},toast:()=>{},setBusy:()=>{}});edit.onclick();
 assert.ok(!root.innerHTML.includes('<script>'));assert.ok(!root.innerHTML.includes('<svg onload'));assert.ok(root.innerHTML.includes('&lt;svg onload'));
 clearPlanEditor();const patientHTML=renderPlans(state,'Patient');assert.ok(!patientHTML.includes('data-plan-review'));assert.ok(!patientHTML.includes('data-verify'));
});
