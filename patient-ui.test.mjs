import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patientPlan,loopDetail,patientTask} from './patient-ui.js';
test('patient plan only presents the active confirmed plan with escaped source',()=>{
 const state={plans:[{id:'draft',status:'proposed',active:false,source_note:'UNAPPROVED'},{id:'active',status:'confirmed',active:true,timezone:'Asia/Kolkata',created_at:'2026-11-03T00:00:00Z',source_note:'<script>source</script>'}],rawItems:[{id:'item',plan_id:'active',domain:'meals',label:'Breakfast',cadence:'daily'}],schedules:[],occurrences:[]};
 const html=patientPlan(state);assert.ok(html.includes('Breakfast'));assert.ok(!html.includes('UNAPPROVED'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('data-plan-edit'));assert.ok(!html.includes('Confirm and activate'));
});
test('review pending detail explains the handoff without patient upload or closure controls',()=>{
 const l={loopId:'l',id:'test',domain:'Tests',state:'REVIEW_PENDING',label:'Investigation',dueAt:'2026-11-01T00:00:00Z',owner:'Clinician',timezone:'UTC'};
 const html=loopDetail({events:[],audit:[],rawEvidence:[]},l,'Patient');assert.ok(html.includes('Who acts next: Clinician'));assert.ok(html.includes('aria-current="step"'));assert.ok(!html.includes('data-action="capture"'));assert.ok(!html.includes('data-action="review"'));
});
test('future task card offers details without an actionable completion path',()=>{
 const html=patientTask({loopId:'future',id:'med',domain:'Medication',state:'DUE',label:'Future',dueAt:'2099-01-01T00:00:00Z',timezone:'UTC',owner:'Patient'});assert.ok(html.includes('data-open-loop'));assert.ok(!html.includes('data-action="capture"'));
});
