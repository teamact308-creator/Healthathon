import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixtures,validExtraction} from '../../supabase/functions/_shared/filly-trial.mjs';
import {analyze,check} from './analyze-comparison.mjs';
const source='I took my medicine.';
const good={source_excerpt:source,reported_status:'taken',needs_clarification:false,recommendations:[],medication_details:[]};
test('reject unsupported status, advice, changed source and invented details',()=>{
 assert.equal(validExtraction(good,source),true);
 for(const patch of [{reported_status:'completed'},{recommendations:['Take another dose']},{source_excerpt:'Changed'},{needs_clarification:true},{medication_details:['0.5 tablet']}])assert.equal(validExtraction({...good,...patch},source),false);
});
test('frozen corpus has unique hashes and matches published manifest',()=>{
 assert.equal(new Set(fixtures.map(f=>f.sha256)).size,10);
 assert.deepEqual(fixtures,JSON.parse(fs.readFileSync(new URL('./corpus-manifest.json',import.meta.url))));
});
test('live results preserve critical meaning; corruption fails evaluation',()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('./comparison-results.json',import.meta.url)));
 assert.equal(analyze(rows).passed,20);
 const row=rows.find(r=>r.script_id==='fraction-and-hold');
 assert.equal(check({...row,transcript:row.transcript.replace('0.5','5')}).critical_concepts,false);
 const hi=rows.find(r=>r.script_id==='negated-hi');
 assert.equal(check({...hi,transcript:hi.transcript.replace('नहीं ','')}).critical_concepts,false);
});
