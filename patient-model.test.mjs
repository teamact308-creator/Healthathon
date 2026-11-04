import {test} from 'node:test';
import assert from 'node:assert/strict';
import {todayGroups,dayKey,loopMeaning,safeView,allowedViews} from './patient-model.mjs';
const now=Date.parse('2026-11-03T01:00:00Z');
const loop=(loopId,overrides={})=>({loopId,id:'med',state:'DUE',planActive:true,timezone:'Asia/Kolkata',dueAt:'2026-11-03T00:00:00Z',...overrides});
test('today uses the instruction timezone at a local midnight boundary',()=>{
 const input=[loop('india',{dueAt:'2026-11-02T23:30:00Z'}),loop('new-york',{timezone:'America/New_York',dueAt:'2026-11-03T02:00:00Z'})];
 assert.equal(dayKey(input[0].dueAt,'Asia/Kolkata'),'2026-11-03');assert.equal(todayGroups(input,now).scheduled,2);assert.equal(todayGroups(input,now).upcoming[0].loopId,'new-york');
});
test('day groups keep closed-today distinct from scheduled-today and waiting review',()=>{
 const g=todayGroups([loop('old-closed',{state:'CLOSED',dueAt:'2026-11-01T00:00:00Z',closedAt:'2026-11-03T00:10:00Z'}),loop('old-done',{state:'CLOSED',closedAt:'2026-11-01T00:00:00Z'}),loop('review',{state:'REVIEW_PENDING'}),loop('tomorrow',{dueAt:'2026-11-04T00:00:00Z'}),loop('cancelled',{state:'CANCELLED'})],now);
 assert.deepEqual(g.completed.map(l=>l.loopId),['old-closed']);assert.equal(g.waiting.length,1);assert.equal(g.scheduled,2);assert.equal(g.future,1);assert.equal(g.attention.length,0);
});
test('superseded unresolved work is excluded but preserved pending review remains visible',()=>{
 const g=todayGroups([loop('old',{planActive:false}),loop('pending',{planActive:false,state:'REVIEW_PENDING'})],now);assert.equal(g.attention.length,0);assert.equal(g.waiting.length,1);
});
test('future, cancelled, superseded and review-pending tasks never offer patient completion',()=>{
 for(const l of [loop('future',{dueAt:'2026-11-04T00:00:00Z'}),loop('cancelled',{state:'CANCELLED'}),loop('old',{planActive:false}),loop('report',{id:'test',state:'REVIEW_PENDING'})])assert.equal(loopMeaning(l,now).recordable,false);
 const review=loopMeaning(loop('report',{id:'test',state:'REVIEW_PENDING'}),now);assert.equal(review.steps[2].state,'current');assert.equal(review.steps[3].state,'pending');
});
test('unconfirmed outcome does not become a successful activity or missed-dose inference',()=>{
 const m=loopMeaning(loop('unconfirmed',{state:'UNCONFIRMED'}),now);assert.equal(m.label,'Follow-up needed');assert.equal(m.steps.at(-1).state,'pending');assert.ok(!m.next.toLowerCase().includes('missed'));
});
test('role routing cannot retain a hidden team view after persona change',()=>{
 assert.equal(safeView('Patient','operations'),'today');assert.equal(safeView('Caregiver','plans'),'today');assert.equal(safeView('Clinician','account'),'queue');assert.ok(!allowedViews('Patient').includes('inbox'));
});

test('trend days keep local midnight, missing readings and reported medication outcomes distinct',async()=>{
 const {trendDays}=await import('./patient-model.mjs');
 const days=trendDays([
  {observed_at:'2026-11-03T18:29:00Z',value:104,unit:'mg/dL'},
  {observed_at:'2026-11-03T18:31:00Z',value:122,unit:'mg/dL'},
  {observed_at:'2026-11-03T18:32:00Z',value:0,unit:'other'}
 ],[{domain:'medication',status:'missed',occurred_at:'2026-11-03T18:31:00Z'}],'Asia/Kolkata',Date.parse('2026-11-04T06:00:00Z'));
 assert.equal(days.length,30);
 assert.equal(days.at(-3).readings.length,0);
 assert.equal(days.at(-2).readings[0].value,104);
 assert.deepEqual(days.at(-1).readings.map(r=>r.value),[122]);
 assert.equal(days.at(-1).events[0].status,'missed');
});

test('voice outcome suggestions accept explicit reports and abstain on ambiguous language',async()=>{
 const {medicationOutcomeFromTranscript:outcome}=await import('./patient-model.mjs');
 assert.equal(outcome('I took my medication.'),'taken');
 assert.equal(outcome('I took it late.'),'delayed');
 assert.equal(outcome("I've taken my medication on time."),'taken');
 assert.equal(outcome('I’ve taken my medicine late.'),'delayed');
 assert.equal(outcome("I haven't taken my medication on time yet."),null);
 assert.equal(outcome('मैंने दवा नहीं ली।'),'missed');
 assert.equal(outcome('I skipped my dose as my doctor instructed.'),'skipped_by_instruction');
 for(const phrase of ['I will take my medication','I might have missed my dose','I took it but missed yesterday','I skipped my dose','I did not take it yet'])assert.equal(outcome(phrase),null);
});
