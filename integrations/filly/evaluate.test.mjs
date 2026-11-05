import test from 'node:test';
import assert from 'node:assert/strict';
import {corpus,evaluate} from './evaluate.mjs';
const fixtures=()=>corpus.map(f=>({id:f.id,source_excerpt:f.text,reported_status:f.status,needs_clarification:f.clarify,recommendations:[]}));
test('comparison catches lost negation, false certainty, dose corruption and generated advice',()=>{
 const rows=fixtures();
 rows[1].reported_status='taken';
 rows[2].source_excerpt=rows[2].source_excerpt.replace('नहीं','');
 rows[4].source_excerpt=rows[4].source_excerpt.replace('0.5','5');
 rows[0].recommendations=['Change the dose'];
 assert.equal(evaluate(rows).filter(row=>!row.pass).length,4);
 assert.equal(evaluate(fixtures()).every(row=>row.pass),true);
});
test('duplicate fixtures cannot masquerade as a comparison',()=>{
 const rows=fixtures();rows[0].id=rows[1].id;
 assert.throws(()=>evaluate(rows),/duplicate/);
});
