import {proposeReply,eligibleTasks} from './conversation-model.mjs';
import {deliveryTransition} from './messaging-core.mjs';
import {openCapture} from './capture-ui.js';
import {submitIntake,checkPersonalTwilioConnection,sendPersonalWhatsAppTest} from './connected-store.js';
import {escapeHTML as esc} from './operations-model.mjs';
let context=null;
export function clearMessaging(){context=null;}
function workspace(state){const id=state.patient?.id;if(context?.patient!==id)context={patient:id,allowed:false,channel:'whatsapp',task:'',entries:[],proposal:null,job:null,draft:''};return context;}
function add(speaker,text){context.entries.push({speaker,text});context.entries=context.entries.slice(-40);}
export function messagingPanel(state,role){
 const c=workspace(state),tasks=eligibleTasks(state.items);
 const outbox=`<section class="card"><details><summary>In-app reminder history (${state.messages.length})</summary><h2>Reminders recorded in WholeCare</h2><p class="mini">Database-backed in-app reminders. These entries do not prove WhatsApp or SMS delivery.</p>${state.messages.map(m=>`<div class="event"><strong>${esc(m.to)} · ${esc(m.status)}</strong><p>${esc(m.text)}</p><time>${new Date(m.at).toLocaleString()}</time></div>`).join('')||'<p>No reminders recorded yet.</p>'}</details></section>`;
 if(role!=='Patient')return `${role==='Clinician'?'<section class="card"><h2>Personal Twilio connection</h2><p>Verify credentials without sending any messages.</p><button type="button" class="quiet" id="twilio-personal-check">Check Twilio connection</button><p id="twilio-personal-result" role="status" aria-live="polite">Not tested.</p><h3>One-time WhatsApp Sandbox test</h3><p>Send one synthetic WholeCare message to your configured test phone. Confirm the 24-hour Sandbox window is open first.</p><button type="button" class="quiet" id="twilio-test-status">Check test status</button> <button type="button" class="primary" id="twilio-test-send" disabled>Send one test message</button><p id="twilio-test-result" role="status" aria-live="polite">Checking the saved test status…</p></section>':''}<section class="card"><h2>Messaging rehearsal</h2><p>Sign in as the assigned demo patient to rehearse replies and uploads. Review saved reports in Attention queue and notes in Intake & issues. Caregiver access remains limited to consented support tasks.</p><p>Live WhatsApp/SMS are disabled while the provider account is suspended.</p></section>${outbox}`;
 const selected=state.items.find(i=>i.loopId===c.task);
 return `<section class="card"><p class="eyebrow">SIMULATOR · NO PHONE MESSAGES</p><h2>1. Choose an activity to practise</h2><p>Nothing here sends a message to your phone. The conversation is a practice session; an activity or report saves to the shared demo only after you explicitly confirm it.</p><details class="message-boundaries"><summary>What is simulated, and what is saved?</summary><p>Channel permission, delivery receipts and conversation text last only in this page session. Reloading clears them. Confirmed activities, care-team notes and report uploads remain in the shared database.</p></details><div class="message-setup"><label>Practice channel<select id="sim-channel"><option value="whatsapp" ${c.channel==='whatsapp'?'selected':''}>WhatsApp</option><option value="sms" ${c.channel==='sms'?'selected':''}>SMS</option></select></label><label><input id="sim-permission" type="checkbox" ${c.allowed?'checked':''}> Allow practice reminders in this session</label></div><p class="mini">This does not enroll a phone, grant live messaging consent or enable SMS fallback. STOP withdraws this simulation permission.</p><label>Scheduled activity<select id="sim-task"><option value="">Choose an outstanding activity</option>${selected&&!tasks.some(i=>i.loopId===c.task)?`<option value="${selected.loopId}" selected disabled>${esc(selected.label)} · ${esc(selected.state)}</option>`:''}${tasks.map(i=>`<option value="${i.loopId}" ${c.task===i.loopId?'selected':''}>${esc(i.label)} · ${new Date(i.dueAt).toLocaleString()}</option>`).join('')}</select></label><h3>2. Try a reminder</h3><p class="mini">Enable practice reminders and choose an outstanding activity above.</p><button class="quiet" id="sim-remind" ${!c.allowed||!tasks.some(i=>i.loopId===c.task)?'disabled':''}>Simulate reminder</button>${selected?`<p>This activity is ${esc(selected.state==='DUE'?'waiting for your entry':selected.state==='UNCONFIRMED'?'open for follow-up':selected.state.toLowerCase().replaceAll('_',' '))}. <strong>Next: ${esc(selected.owner)}</strong>. A reminder does not complete it.</p>`:''}${c.job?`<details><summary>Delivery simulation controls</summary><fieldset><legend>Practice receipt</legend><p aria-live="polite">${esc(c.channel)} · ${esc(c.job.state)} · no provider request made</p><button class="quiet" data-sim-receipt="delivered">Simulate delivered</button><button class="quiet" data-sim-receipt="failed">Simulate failed</button><button class="quiet" data-sim-receipt="unknown">Simulate uncertain</button><button class="quiet" data-sim-receipt="accepted">Replay late accepted</button></fieldset></details>`:''}</section>
 <section class="card"><h2>3. Reply, then check the proposed action</h2><p class="mini">Pick an example to fill the reply box, or type your own. Previewing does not save a care record.</p><div class="patient-section-buttons" role="group" aria-label="Example replies">${['HELP','TAKEN','MEAL','DATA','REPORT','NOTE: I need help arranging my next step.','STOP'].map(text=>`<button type="button" class="quiet" data-sim-example="${esc(text)}">${text.startsWith('NOTE:')?'Ask for help':esc(text)}</button>`).join('')}</div><div role="log" aria-label="Simulated conversation">${c.entries.map(e=>`<div class="event"><strong>${esc(e.speaker)}</strong><p>${esc(e.text)}</p></div>`).join('')||'<p>No simulated messages yet.</p>'}</div><form id="sim-reply"><label>Your simulated reply<textarea id="sim-text" maxlength="2000" required placeholder="HELP, REPORT, TAKEN, MISSED, DELAYED, MEAL, DATA, STOP or NOTE: your note">${esc(c.draft||'')}</textarea></label><button class="primary">Preview reply</button></form>${c.proposal?`<div class="event" role="status"><h3>Review proposed action</h3><p>${esc(c.proposal.message)}</p>${c.proposal.loopId?`<p>Task: ${esc(state.items.find(i=>i.loopId===c.proposal.loopId)?.label||'Unavailable')} · ${esc(c.proposal.command)}</p>`:`<p>${esc(c.proposal.note)}</p>`}<button class="primary" id="sim-confirm">${c.proposal.kind==='note'?'Confirm and send note':'Review details before saving'}</button><button class="quiet" id="sim-reject">Discard proposal</button></div>`:''}<p class="mini">SMS rehearsal supports text only. Report commands direct you to the private web upload. This is not an emergency service or a clinical advice chatbot.</p></section>${outbox}`;
}
export function bindMessaging(root,state,{run,render,toast}){
 const c=workspace(state);
 root.querySelector('#twilio-personal-check')?.addEventListener('click',async e=>{
  const button=e.currentTarget,output=root.querySelector('#twilio-personal-result');
  button.disabled=true;output.textContent='Checking credentials… Personal account: NOT VERIFIED. Personal API key: NOT VERIFIED.';
  try{
   const result=await checkPersonalTwilioConnection();
   const verified=result.connected===true;
   const match=value=>!verified?'NOT VERIFIED':value===true?'MATCH':value===false?'MISMATCH':'NOT VERIFIED';
   const connection=verified?'Connected: API key and Auth Token verified.':Array.isArray(result.missing)?'Connection not verified: required configuration is missing.':'Connection not verified.';
   output.textContent=connection+' Personal account: '+match(result.identity?.account_matches_personal_console)+'. Personal API key: '+match(result.identity?.api_key_matches_personal_console)+'. No messages sent.';
  }catch{output.textContent='Connection check unavailable. Personal account: NOT VERIFIED. Personal API key: NOT VERIFIED. No messages sent.';}
  finally{if(button.isConnected)button.disabled=false;}
 });
 const testStatusButton=root.querySelector('#twilio-test-status');
 const testSendButton=root.querySelector('#twilio-test-send');
 const testResult=root.querySelector('#twilio-test-result');
 async function refreshTestStatus(){
  if(!testResult)return;
  if(testStatusButton)testStatusButton.disabled=true;
  if(testSendButton)testSendButton.disabled=true;
  testResult.textContent='Checking saved test status…';
  try{
   const r=await sendPersonalWhatsAppTest('status');
   const state=r.state||'unknown';
   testResult.textContent='Test: '+state
    +(r.provider_status?' · Provider: '+r.provider_status:'')
    +(r.error_code?' · Twilio error '+r.error_code+(r.error_code===20003?' (permission denied)':''):'');
   if(testSendButton){
    testSendButton.disabled=state!=='not_started';
    testSendButton.textContent=state==='not_started'?'Send one test message':'Test already attempted';
   }
  }catch(err){testResult.textContent='Status unavailable: '+err.message+' · Sending disabled until status is confirmed.';}
  finally{if(testStatusButton)testStatusButton.disabled=false;}
 }
 testStatusButton?.addEventListener('click',refreshTestStatus);
 if(testResult)void refreshTestStatus();
 root.querySelector('#twilio-test-send')?.addEventListener('click',async e=>{
  if(!window.confirm('Send ONE synthetic WholeCare WhatsApp message to your configured Sandbox test number?'))return;
  const b=e.currentTarget,o=root.querySelector('#twilio-test-result');b.disabled=true;o.textContent='Submitting single test…';
  try{const r=await sendPersonalWhatsAppTest('send',true);o.textContent='Test: '+(r.state||'unknown')+(r.provider_status?' · Provider: '+r.provider_status:'')+'. Check WhatsApp or test status.';}
  catch(err){o.textContent='Test not completed: '+err.message+'. Do not retry blindly; check status.';}
  finally{b.disabled=false;}
 });
 root.querySelector('#sim-text')?.addEventListener('input',e=>{c.draft=e.target.value;});
 root.querySelectorAll('[data-sim-example]').forEach(b=>b.onclick=()=>{const input=root.querySelector('#sim-text');input.value=b.dataset.simExample;c.draft=input.value;input.focus();});
 root.querySelector('#sim-channel')?.addEventListener('change',e=>{c.channel=e.target.value;c.proposal=null;c.job=null;render();});
 root.querySelector('#sim-permission')?.addEventListener('change',e=>{c.allowed=e.target.checked;c.proposal=null;if(!c.allowed&&c.job&&!['delivered','failed','unknown'].includes(c.job.state))c.job={...c.job,state:'cancelled'};add('System',c.allowed?'Simulation permission enabled. No live channel was enrolled.':'Simulation permission withdrawn. No care task changed.');render();});
 root.querySelector('#sim-task')?.addEventListener('change',e=>{c.task=e.target.value;c.proposal=null;c.job=null;render();});
 root.querySelector('#sim-remind')?.addEventListener('click',()=>{const task=eligibleTasks(state.items).find(i=>i.loopId===c.task);if(!c.allowed||!task)return;c.job={id:crypto.randomUUID(),state:'accepted',attempts:1,eventKeys:[]};add('WholeCare · simulated',`You have an outstanding care action: ${task.label}. Due ${new Date(task.dueAt).toLocaleString()}. Open your secure care workspace to review it. Reply HELP for options or STOP to stop this simulation.`);render();});
 root.querySelectorAll('[data-sim-receipt]').forEach(b=>b.onclick=()=>{if(!c.job)return;const status=b.dataset.simReceipt;c.job=deliveryTransition(c.job,{key:c.job.id+':'+status,status});add('Delivery simulation',`${status} receipt processed; simulated job is ${c.job.state}. No care state changed.`);render();});
 root.querySelector('#sim-reply')?.addEventListener('submit',e=>{e.preventDefault();const text=root.querySelector('#sim-text').value,item=state.items.find(i=>i.loopId===c.task),p=proposeReply(text,item,{consented:c.allowed});add('Patient · simulated',text);c.draft='';c.proposal=null;
 if(p.kind==='stop'){c.allowed=false;if(c.job&&!['delivered','failed','unknown'].includes(c.job.state))c.job={...c.job,state:'cancelled'};}
 if(['note','report','activity'].includes(p.kind))c.proposal={...p,event:crypto.randomUUID()};else add('WholeCare · simulated',p.message);render();});
 root.querySelector('#sim-reject')?.addEventListener('click',()=>{c.proposal=null;add('System','Proposal discarded. No care task changed.');render();});
 root.querySelector('#sim-confirm')?.addEventListener('click',async()=>{
 const p=c.proposal;if(!p||!c.allowed)return;
 if(p.kind==='note'){await run(async()=>{await submitIntake('Messaging simulator note',p.note,null,p.event);if(context===c){c.proposal=null;add('Saved to database','Note sent for human association. No task completed.');}},'Note saved to the shared intake queue.');return;}
 const item=state.items.find(i=>i.loopId===p.loopId);const checked=proposeReply(p.command,item,{consented:c.allowed});if(checked.kind!==p.kind){c.proposal=null;toast('Task changed. Refresh and choose an open due occurrence.');render();return;}
 openCapture(item,state,{run,toast,initialStatus:p.status,onSaved:()=>{if(context!==c)return;c.proposal=null;add('Saved to database',p.kind==='report'?'Report submitted for clinician review. Delivery and upload do not close this investigation.':'Confirmed activity saved. Refresh the care journey to see its current state.');render();}});
 });
}
