import test from 'node:test';
import assert from 'node:assert/strict';
import {minimizeText} from './supabase/functions/_shared/ai-privacy.mjs';
import {authorizeTransfer} from './supabase/functions/_shared/ai-transfer.mjs';

test('identifier minimization preserves uncertainty, negation, dose, timing and Hindi',()=>{
 const text='Patient name: Anita Sen\nI am not sure. I did not take 0.5 mg at 08:00 on Monday.\nमैंने दवा नहीं ली। Contact anita@example.test or +919876543210';
 const result=minimizeText(text,['Anita Sen']);
 assert.doesNotMatch(result.text,/Anita Sen|anita@example.test|9876543210/);
 assert.match(result.text,/I am not sure\. I did not take 0\.5 mg at 08:00 on Monday\./);
 assert.match(result.text,/मैंने दवा नहीं ली।/);
 assert.equal(minimizeText(result.text,['Anita Sen']).text,result.text);
});
test('a bare dose or date is not treated as an identifier',()=>{
 const text='Take 500 mg on 2026-11-05 at 08:00. BP 120/80. Glucose 110 mg/dL.';
 assert.equal(minimizeText(text).text,text);
});
test('privacy authorization fails before networking if approval is absent',async()=>{
 let called=false;
 await assert.rejects(()=>authorizeTransfer({input:{},url:'https://fixture.test',headers:{},operation:'transcription',kind:'audio'},async()=>{called=true;}),/Review/);
 assert.equal(called,false);
});
test('privacy authorization sends metadata only and fails closed on denial',async()=>{
 const input={patient_id:'fixture',privacy_version:1,privacy_request_id:'request',text:'private text'};
 let sent;
 await assert.rejects(()=>authorizeTransfer({url:'https://fixture.test',headers:{Authorization:'Bearer fixture'},input,operation:'interpretation',kind:'text'},async(url,options)=>{
  sent=JSON.parse(options.body);
  return new Response('{}',{status:403});
 }),/not accepted/);
 assert.deepEqual(Object.keys(sent).sort(),['p_kind','p_operation','p_patient','p_request','p_version']);
 assert.equal(JSON.stringify(sent).includes('private text'),false);
});

test('Hindi identity labels and digits are removed while clinical wording stays intact',()=>{
 const source='रोगी का नाम: अनिता सेन\nपता: परीक्षण पता\nमैंने ०.५ मिलीग्राम दवा नहीं ली। फोन ९८७६५४३२१०';
 const result=minimizeText(source,['अनिता सेन']);
 assert.doesNotMatch(result.text,/अनिता सेन|परीक्षण पता|९८७६५४३२१०/);
 assert.match(result.text,/मैंने ०.५ मिलीग्राम दवा नहीं ली।/);
});
test('known names with regular-expression characters are matched literally',()=>{
 const source='A. Test said no dose was taken. A Test is an unrelated string.';
 const result=minimizeText(source,['A. Test']);
 assert.match(result.text,/\[name removed\] said no dose was taken/);
 assert.match(result.text,/A Test is an unrelated string/);
});
