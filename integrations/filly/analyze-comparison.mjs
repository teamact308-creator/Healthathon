import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {validExtraction,fixtures} from '../../supabase/functions/_shared/filly-trial.mjs';
export function check(row){
 const fixture=fixtures.find(f=>f.id===row.fixture);
 const expected=fixture?.script_id==='taken-en'?'taken':fixture?.script_id==='negated-hi'?'missed':'unclear';
 const t=(row.transcript||'').toLowerCase().replaceAll('eight','8');
 const concepts={
 'taken-en':/i took my medicine/.test(t)&&/8 o.clock/.test(t),
 'uncertain-en':/i think i took my medicine/.test(t)&&/not sure/.test(t),
 'negated-hi':/मैंने दवा नहीं ली/.test(t),
 'future-en':/i will take my medicine tomorrow/.test(t),
 'fraction-and-hold':/medicine a 0\.5 tablet monday at 8 o.clock/.test(t)&&/hold medicine b until review/.test(t)
 };
 const details=(row.data?.medication_details||[]).join(' ').toLowerCase().replaceAll('eight','8');
 return {fixture:row.fixture,provider:row.provider,hash:fixture?.sha256===row.fixture_hash,
 contract:validExtraction(row.data,row.transcript),outcome:row.data?.reported_status===expected,
 critical_concepts:!!concepts[fixture?.script_id],
 dose_and_hold:fixture?.script_id!=='fraction-and-hold'||(/0\.5 tablet monday at 8 o.clock/.test(details)&&/hold medicine b until review/.test(details))};
}
export function analyze(rows){
 const checks=rows.map(check);const pass=c=>Object.entries(c).filter(([k])=>!['fixture','provider'].includes(k)).every(([,v])=>v===true);
 const median=a=>{a.sort((x,y)=>x-y);return (a[4]+a[5])/2};
 return {date:'2026-11-05',fixtures:10,calls:rows.length,passed:checks.filter(pass).length,checks,
 providers:Object.fromEntries(['sarvam','openai'].map(p=>{const r=rows.filter(x=>x.provider===p);return [p,{calls:r.length,passed:checks.filter(c=>c.provider===p&&pass(c)).length,median_asr_ms:r.length===10?median(r.map(x=>x.asr_ms)):null}]})),
 limitation:'Ten short TTS clips; one run per provider/condition, no human speech or clinical validation. Eight oclock does not establish AM/PM.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=analyze(JSON.parse(fs.readFileSync(new URL('./comparison-results.json',import.meta.url))));
 fs.writeFileSync(new URL('./comparison-summary.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({calls:result.calls,passed:result.passed,providers:result.providers}));
 if(result.calls!==20||result.passed!==20)process.exitCode=1;
}
