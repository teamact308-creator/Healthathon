import {test} from 'node:test';import assert from 'node:assert/strict';
import {proposeReply,eligibleTasks} from './conversation-model.mjs';
const item={id:'test',loopId:'a',state:'DUE',dueAt:'2026-01-01T00:00:00Z'},options={consented:true,now:Date.parse('2026-01-02T00:00:00Z')};
test('simulation consent gates care proposals while STOP and HELP always work',()=>{assert.equal(proposeReply('REPORT',item).kind,'blocked');assert.equal(proposeReply('STOP',null).kind,'stop');assert.equal(proposeReply('HELP',null).kind,'help');assert.equal(proposeReply('START',null).kind,'start');});
test('report proposal binds the selected due occurrence and does not close it',()=>{assert.equal(proposeReply('REPORT',item,options).loopId,'a');assert.equal(item.state,'DUE');for(const state of ['CLOSED','REVIEW_PENDING','CANCELLED'])assert.equal(proposeReply('REPORT',{...item,state},options).kind,'clarify');assert.equal(proposeReply('REPORT',{...item,dueAt:'2027-01-01T00:00:00Z'},options).kind,'clarify');});
test('wrong domain, unknown and multi-action text require clarification',()=>{assert.equal(proposeReply('TAKEN',item,options).kind,'clarify');assert.equal(proposeReply('TAKEN and MEAL',item,options).kind,'clarify');assert.equal(proposeReply('NOTE: fictional test',null,options).note,'fictional test');assert.equal(proposeReply('NOTE:',null,options).kind,'clarify');});
test('medication command preserves explicit status for human confirmation',()=>{assert.equal(proposeReply('MISSED',{...item,id:'med'},options).status,'missed');assert.equal(proposeReply('DELAYED',{...item,id:'med'},options).status,'delayed');assert.equal(proposeReply('TAKEN',{...item,id:'med'},options).status,'taken');});
test('task choices exclude future, closed and invalid dates',()=>{assert.deepEqual(eligibleTasks([item,{...item,state:'CLOSED'},{...item,dueAt:'invalid'},{...item,dueAt:'2027-01-01'}],options.now),[item]);});
test('multi-dose safety guard cannot populate a single occurrence from distinct reported doses',async()=>{
 const {interpretMedication,multipleDoseReports}=await import('./supabase/functions/voice-transcribe/interpret.mjs');
 for(const text of ['I took the morning tablet, but missed the evening tablet.','सुबह की गोली ली, शाम की गोली नहीं ली।','Subah ki goli li, shaam ki goli miss hui.']){
  assert.equal(multipleDoseReports(text),true);assert.equal(await interpretMedication(text,'unused',()=>{throw Error('Should not infer one dose')}),'unclear');
 }
 assert.equal(multipleDoseReports('I planned my morning dose but took it in the evening.'),false);
});
test('explicit not-swallowed future intent cannot ask a timing-only question',async()=>{
 const {interpretMedication}=await import('./supabase/functions/voice-transcribe/interpret.mjs');
 assert.equal(await interpretMedication('I have not swallowed it. I plan to do that later.','unused',()=>{throw Error('Guard should clarify completion')}),'unclear_taken');
});
test('structured medication evidence rejects other people, uncertainty, future doses and invented quotes',async()=>{
 const {verifiedMedicationOutcome}=await import('./supabase/functions/voice-transcribe/interpret.mjs');
 const source='I took this dose on time.';const good={outcome:'taken',actor:'self',certainty:'explicit',phase:'reported_outcome',multiple_occurrences:false,evidence:source};
 assert.equal(verifiedMedicationOutcome(good,source),'taken');
 for(const patch of [{actor:'other'},{certainty:'uncertain'},{phase:'pending_or_future'},{multiple_occurrences:true},{evidence:''}])assert.equal(verifiedMedicationOutcome({...good,...patch},source),'unclear_taken');
 assert.equal(verifiedMedicationOutcome({...good,evidence:'invented'},source),null);
});


test('a self-decided skip cannot become clinician instruction without a source clause',async()=>{
 const {verifiedMedicationOutcome}=await import('./supabase/functions/voice-transcribe/interpret.mjs');
 const base={outcome:'skipped_by_instruction',actor:'self',certainty:'explicit',phase:'reported_outcome',multiple_occurrences:false,evidence:'I skipped it',clinician_instruction:'absent',instruction_evidence:''};
 assert.equal(verifiedMedicationOutcome(base,'I skipped it'),'unclear_skip');
 assert.equal(verifiedMedicationOutcome({...base,clinician_instruction:'explicitly_reported',instruction_evidence:'doctor said skip'},'I skipped it'),'unclear_skip');
 assert.equal(verifiedMedicationOutcome({...base,clinician_instruction:'explicitly_reported',instruction_evidence:'doctor said skip'},'I skipped it; doctor said skip'),'skipped_by_instruction');
});
