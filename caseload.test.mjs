import test from 'node:test';import assert from 'node:assert/strict';
import {selectMembership,filterCaseload,caseloadTotals} from './caseload-model.mjs';
import {caseloadPanel} from './caseload-ui.js';
test('patient selection requires an exact current assignment and role',()=>{
 const context={memberships:[{patient_id:'b',role:'coordinator'},{patient_id:'a',role:'clinician'}]};
 assert.equal(selectMembership(context).patient_id,'a');
 assert.equal(selectMembership(context,{patient_id:'b',role:'coordinator'}).patient_id,'b');
 assert.throws(()=>selectMembership(context,{patient_id:'b',role:'clinician'}),/no longer assigned/);
 assert.throws(()=>selectMembership(context,{patient_id:'other',role:'clinician'}),/no longer assigned/);
 assert.throws(()=>selectMembership({memberships:[]}),/no assigned/);
});
test('caseload filters and totals preserve patient identities and independent counts',()=>{
 const rows=[{patient_id:'a',display_name:'Anita',overdue:0,review_pending:1,help_waiting:0,due:0},{patient_id:'r',display_name:'Ravi',overdue:2,review_pending:0,help_waiting:1,due:2}];
 assert.deepEqual(caseloadTotals(rows),{patients:2,overdue:2,review:1,help:1});
 assert.equal(filterCaseload(rows,{filter:'review'})[0].patient_id,'a');
 assert.equal(filterCaseload(rows,{search:'ravi'})[0].patient_id,'r');
 assert.equal(filterCaseload(rows,{search:'missing'}).length,0);
 assert.equal(filterCaseload(rows,{filter:'help'})[0].patient_id,'r');
 const html=caseloadPanel([{...rows[0],display_name:'<script>bad</script>',role:'clinician'}]);
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
