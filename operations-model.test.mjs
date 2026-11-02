import {test} from 'node:test';import assert from 'node:assert/strict';import {periodSummary,paginate,escapeHTML} from './operations-model.mjs';
const from='2026-11-01T00:00:00Z',to='2026-11-03T00:00:00Z';
test('cohort excludes cancellations, future closure and boundary; unresolved prior plan review stays visible',()=>{
 const d={plans:[{id:'old',active:false}],items:[{id:'i',plan_id:'old',domain:'test',label:'Report'}],loops:[
 {id:'1',item_id:'i',due_at:from,state:'CLOSED',closed_at:'2026-11-02T00:00:00Z'},
 {id:'2',due_at:from,state:'CANCELLED'}, {id:'3',due_at:from,state:'CLOSED',closed_at:to},
 {id:'4',due_at:to,state:'DUE'}, {id:'5',item_id:'i',due_at:'2026-10-01T00:00:00Z',state:'REVIEW_PENDING'},
 {id:'6',item_id:'i',due_at:from,state:'DUE'}]};
 const s=periodSummary(d,from,to);assert.equal(s.cohort,4);assert.equal(s.eligible,3);assert.equal(s.closed,1);assert.equal(s.medianHoursFromDue,24);assert.deepEqual(s.unresolved.map(l=>l.id),['5']);
});
test('empty cohort is unavailable rather than fabricated zero percent',()=>{const s=periodSummary({},from,to);assert.equal(s.closurePercent,null);assert.equal(s.medianHoursFromDue,null);});
test('reopened loop is unresolved and early completion is retained without clamping',()=>{const s=periodSummary({loops:[{id:'a',due_at:'2026-11-02T12:00:00Z',state:'CLOSED',closed_at:'2026-11-02T11:00:00Z'},{id:'b',due_at:from,state:'DUE',closed_at:null}]},from,to);assert.equal(s.medianHoursFromDue,-1);assert.equal(s.unresolved[0].id,'b');});
test('period validation and accessible pagination bounds',()=>{assert.throws(()=>periodSummary({},to,from));assert.throws(()=>periodSummary({},'2025-01-01',to));assert.equal(paginate(Array.from({length:45},(_,i)=>i),9).items.length,5);assert.equal(paginate([]).pages,1);assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');});

test('report ending today excludes occurrences not yet due at generation time',()=>{const s=periodSummary({generated_at:'2026-11-02T10:00:00Z',loops:[{id:'future',due_at:'2026-11-02T20:00:00Z',state:'DUE'},{id:'past',due_at:'2026-11-02T08:00:00Z',state:'DUE'}]},from,to);assert.equal(s.eligible,1);assert.deepEqual(s.unresolved.map(x=>x.id),['past']);});
