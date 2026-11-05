import {test} from 'node:test';import assert from 'node:assert/strict';import {suggestLogActions} from './supabase/functions/voice-transcribe/interpret.mjs';
const respond=actions=>async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({actions})}]}]});
test('a model suggestion cannot use another actor, future dose or unsupported instruction as completed care',async()=>{
 const source='I might take it later.';const base={source,domain:'med',status:'taken',kind:'activity',actor:'self',certainty:'explicit',phase:'reported_outcome',medication:{outcome:'taken',actor:'self',certainty:'explicit',phase:'reported_outcome',reported_action:'taken',multiple_occurrences:false,evidence:source}};
 for(const change of [{actor:'other'},{phase:'pending_or_future'},{certainty:'uncertain'},{medication:{...base.medication,evidence:'invented source'}},{medication:{...base.medication,reported_action:'skipped',clinician_instruction:'absent'}}]){
  const [result]=await suggestLogActions(source,'fixture',respond([{...base,...change}]));assert.equal(result.status,'unknown');assert.notEqual(result.kind,'activity');
 }
});
test('source excerpts must be exact and investigations never become activity completion proposals',async()=>{
 assert.equal(await suggestLogActions('Original text','fixture',respond([{source:'invented',domain:'med',status:'taken',kind:'activity'}])),null);
 const [report]=await suggestLogActions('I have a report.','fixture',respond([{source:'I have a report.',domain:'test',status:'taken',kind:'activity',actor:'self',certainty:'explicit',phase:'reported_outcome',medication:null}]));assert.equal(report.kind,'clarify');assert.equal(report.status,'unknown');
});
