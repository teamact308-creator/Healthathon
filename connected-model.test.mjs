import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWorkspace} from './connected-model.mjs';
test('keeps overdue occurrences visible and future occurrences separate',()=>{
 const data={items:[{id:'item',domain:'medication',label:'Morning routine'}],loops:[
 {id:'yesterday',item_id:'item',due_at:'2026-11-01T08:00:00Z',state:'UNCONFIRMED',next_owner:'patient'},
 {id:'today',item_id:'item',due_at:'2026-11-02T08:00:00Z',state:'CLOSED',next_owner:'none'},
 {id:'tomorrow',item_id:'item',due_at:'2026-11-03T08:00:00Z',state:'DUE',next_owner:'patient'}]};
 const result=normalizeWorkspace(data,Date.parse('2026-11-02T12:00:00Z'));
 assert.deepEqual(result.items.map(i=>i.loopId),['yesterday','today']);assert.equal(result.upcoming[0].loopId,'tomorrow');
});
test('does not show historical report evidence as a new submission after reopening',()=>{
 const data={items:[{id:'i',domain:'test',label:'Investigation'}],loops:[{id:'l',item_id:'i',due_at:'2026-11-01T08:00:00Z',state:'DUE',next_owner:'patient'}],evidence:[{loop_id:'l',label:'Old report'}],audit:[{loop_id:'l',action:'reopen',actor_role:'clinician',previous_state:'CLOSED',next_state:'DUE'}]};
 const result=normalizeWorkspace(data,Date.parse('2026-11-02T12:00:00Z'));assert.equal(result.items[0].evidence,null);assert.equal(result.audit[0].label,'Investigation');assert.equal(result.consent,false);
});
