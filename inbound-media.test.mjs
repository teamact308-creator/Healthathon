import {test} from 'node:test';import assert from 'node:assert/strict';import {retrieveReportMedia} from './integrations/messaging/inbound-media.mjs';
const refs={enabled:true,accountSid:'AC'+'1'.repeat(32),messageSid:'SM'+'2'.repeat(32),mediaSid:'ME'+'3'.repeat(32),authorization:'Basic server-fixture'};
test('held media adapter makes no request and rejects arbitrary URL references',async()=>{let calls=0;assert.deepEqual(await retrieveReportMedia({request:()=>{calls++;}}),{state:'disabled'});await assert.rejects(()=>retrieveReportMedia({...refs,mediaSid:'https://attacker.test',request:()=>{calls++;}}));assert.equal(calls,0);});
test('media retrieval never forwards credentials through redirects and bounds unknown-length bodies',async()=>{
 let options;await assert.rejects(()=>retrieveReportMedia({...refs,maxBytes:3,request:async(url,opts)=>{options=opts;assert.match(url,/^https:\/\/api.twilio.com\/2010-04-01\/Accounts\/AC/);return new Response('too long',{headers:{'content-type':'application/pdf'}});}}),/safely/);assert.equal(options.redirect,'error');
 await assert.rejects(()=>retrieveReportMedia({...refs,request:async()=>new Response('disguised executable',{headers:{'content-type':'image/png'}})}),/safely/);
});

test('plain source bytes can be prepared without saving a report or care event',async()=>{
 const text='%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF';
 const result=await retrieveReportMedia({...refs,request:async()=>new Response(text,{headers:{'content-type':'application/pdf'}})});assert.equal(result.state,'screened_requires_private_upload_and_patient_review');assert.equal(new TextDecoder().decode(result.bytes),text);
});
