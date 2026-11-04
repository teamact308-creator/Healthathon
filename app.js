import {allowedViews,safeView,defaultView,loopMeaning,patientNotifications,trendOverview,trendCsv,isHelpRequest,helpThread} from './patient-model.mjs';
import {patientToday,patientJourney,patientPlan,patientLog,patientTask,loopDetail,patientLogMenu,patientAccount,patientTrends,notificationInbox,patientReports,patientHelp} from './patient-ui.js';
import {bindPasswordUI} from './auth-ui.js';
import {multiPanel,bindMulti,contextPanel,bindContext,correctionButtons,bindCorrections,clearBucket} from './bucket-ui.js';
import {messagingPanel,bindMessaging,clearMessaging} from './messaging-ui.js';
import {operationsPanel,bindOperations,intakePanel,bindIntake,clearOperations} from './operations-ui.js';
import {paginate} from './operations-model.mjs';
import {capturePanel,bindCapturePanel,openCapture,openManage,chart} from './capture-ui.js';
import {renderPlans,bindPlans,clearPlanEditor} from './plan-ui.js';
import {hasSession,signIn,signOut,loadWorkspace,careAction,setConsent,privateFile,recordFailure,expandHistory,requestActivityHelp,uploadPrivate,submitIntake,updateHelpThread,suggestVisitNotes} from './connected-store.js';
const $=s=>document.querySelector(s);
let state=null,view='today',role='',pending=null,busy=false,epoch=0,feedPage=0,taskPage=0,journeyPage=0,journeyDomain='',journeyStatus='open',journeyRange='all',documentCategory='all',reportStatus='all',logSection='note',trendOptions={};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',3500);}
const labels={DUE:'Due today',UNCONFIRMED:'Awaiting confirmation',REVIEW_PENDING:'Human review pending',CLOSED:'Completed'};
const icons={med:'◈',meal:'◒',cgm:'∿',test:'▧'};
function button(id,action,text,primary=false){return `<button class="${primary?'primary':'action'}" data-id="${id}" data-action="${action}">${text}</button>`;}
function task(i){let actions='';
 if(role==='Patient'&&['DUE','UNCONFIRMED'].includes(i.state)){actions=button(i.loopId,'capture',i.id==='test'?'Upload report ↗':i.id==='med'?'Record medication activity':i.id==='meal'?'Log meal +':'Confirm data availability');}
 if(role==='Coordinator'&&['DUE','UNCONFIRMED'].includes(i.state)){actions=!i.reminded?button(i.loopId,'remind','Simulate reminder ↗'):state.consent&&i.owner==='Patient'?button(i.loopId,'support','Request caregiver help ↗'):`<span class="mini">${i.owner==='Caregiver'?'Support routed':'Patient consent required'}</span>`;}
 if(role==='Clinician'&&i.state==='REVIEW_PENDING')actions=button(i.loopId,'review','Review evidence →',true);
 if(role==='Clinician'&&i.state==='CLOSED')actions=button(i.loopId,'reopen','Reopen with reason');
 if(['Clinician','Coordinator'].includes(role)&&['DUE','UNCONFIRMED'].includes(i.state)){actions+=button(i.loopId,'snooze','Reschedule');if(role==='Clinician')actions+=button(i.loopId,'cancel','Cancel occurrence');}
 return `<article class="card task" id="loop-${i.loopId}" tabindex="-1"><div class="icon ${i.domain.split(' ')[0]}">${icons[i.id]}</div><div class="task-body"><div class="task-top"><span class="domain">${escape(i.domain)} · ${escape(i.time)}</span><span class="badge ${i.state==='CLOSED'?'done':i.state==='REVIEW_PENDING'?'review':''}">${i.state==='DUE'&&Date.parse(i.dueAt)<Date.now()-30*60000?'Overdue':labels[i.state]}</span></div><h3>${escape(i.label)}</h3><p>${escape(i.detail)}</p>${i.evidence?`<p>▧ ${escape(i.evidence)}</p>`:''}${i.evidencePath?button(i.loopId,'open-evidence','Open original report'):''}${i.reviewNote?`<p>Review: ${escape(i.reviewNote)}</p>`:''}<div class="task-bottom"><span class="owner">${i.owner==='None'?'✓ Loop closed':`Next action: <strong>${escape(i.owner)}</strong>`}${i.reminded?' · Reminder '+escape(i.reminderStatus||'recorded'):''}</span>${actions}</div></div></article>`;
}
function rail(){return `<div class="rail"><section class="card"><p class="eyebrow">YOUR CARE CIRCLE</p><div class="profile-line"><div class="avatar">AS</div><div><strong>${escape(state.patient?.display_name??'Assigned patient')}</strong><small>Fictional demo patient · WC-001</small></div></div><div class="detail"><span>Care team</span><strong>Team Act Clinic</strong></div><div class="detail"><span>Caregiver</span><strong>${escape(state.caregivers[0]?.name??'No assigned caregiver')} · logistics support</strong></div><div class="detail"><span>Plan</span><strong>Diabetes care journey</strong></div><label class="consent"><input id="consent" type="checkbox" ${state.consent?'checked':''} ${role!=='Patient'||!state.caregivers.length?'disabled':''}> Allow ${escape(state.caregivers[0]?.name??'assigned caregiver')} to receive task names and help requests.</label><p class="mini">Only consented support tasks appear in the caregiver view. Your signed-in account determines your permissions.</p></section><section class="card tip"><p class="eyebrow">SMALL STEPS, SHARED SUPPORT</p><h2>You don’t have to do it all alone.</h2><p>Your care circle can help with practical next steps. Your clinician remains responsible for clinical review.</p><span class="pill">Meals</span><span class="pill">Medication</span><span class="pill">Glucose data</span><span class="pill">Tests</span></section></div>`;}
function taskList(items){const p=paginate(items,taskPage,12);return p.items.map(task).join('')+(p.pages>1?`<div class="card dialog-actions"><button class="quiet" id="tasks-prev" ${p.page===0?'disabled':''}>Previous tasks</button><span>${p.page+1} / ${p.pages} · ${p.total} actions</span><button class="quiet" id="tasks-next" ${p.page+1===p.pages?'disabled':''}>Next tasks</button></div>`:'');}
let notificationRead=new Set(),notificationScope='';
function notificationState(){
 const key=state?.profile?.id&&state?.patient?.id?'wholecare:read:'+state.profile.id+':'+state.patient.id:'';
 if(key!==notificationScope){notificationScope=key;notificationRead=new Set();try{const ids=key&&JSON.parse(localStorage.getItem(key));if(Array.isArray(ids))notificationRead=new Set(ids);}catch{}}
 const items=role==='Patient'?patientNotifications(state):[];
 const count=items.filter(n=>!notificationRead.has(n.id)).length,bell=$('#notification-bell'),badge=$('#notification-count');
 bell.hidden=role!=='Patient';bell.setAttribute('aria-label',count?'Notifications, '+count+' unread':'Notifications');badge.hidden=!count;badge.textContent=count;
 return items;
}
function markNotificationsRead(ids){for(const id of ids)notificationRead.add(id);try{if(notificationScope)localStorage.setItem(notificationScope,JSON.stringify([...notificationRead].slice(-500)));}catch{}}
function render(){if(!state)return;if(role==='Patient')$('.notice').textContent=view==='rehearsal'?'Fictional demo · This rehearsal does not send phone messages.':'Fictional demo · Care-team replies appear in the app. WhatsApp/SMS delivery is unavailable.';const notifications=notificationState();const total=state.items.length;const count=state.items.filter(i=>i.state==='CLOSED').length;const copy={rehearsal:['DEMO TOOL','Messaging rehearsal','Try a simulated reply. No phone messages are sent.'],reports:['YOUR RECORDS','Documents','Find reports, care-plan documents and other uploads.'],help:['YOUR CARE TEAM','Help requests','Track practical help for a scheduled activity.'],notifications:['YOUR CARE UPDATES','Notifications','See reminders and updates from your care team.'],trends:['GLUCOSE IN CONTEXT','30-day trends','See readings and logged activities on the same timeline.'],account:['YOUR CARE CIRCLE','Your account and preferences.','Choose who can support you and manage your preferences.'],today:['YOUR DAILY COMPANION','A little progress, every day.','Your care plan, made manageable. Let’s take it one step at a time.'],journey:['ONE SHARED JOURNEY','See how care comes together.','Four dimensions, with a clear owner for every next step.'],queue:['CARE TEAM WORKSPACE','The next step needs a person.','Review evidence and coordinate the work that remains open.'],messages:['DEMO CHANNEL','A conversation that moves care forward.','Simulated outreach, connected to the same care journey.'],plans:['CLINICIAN REVIEW','From instructions to daily actions.','Review the source, confirm the plan, and schedule the next steps.'],capture:['YOUR ACTIVITY','Capture the details that matter.','Meals, medication, voice notes and synthetic monitoring data.'],operations:['CARE TEAM REPORT','Ready for the next review.','Source-linked execution history and operational measures.'],context:['PATIENT HISTORY','The context behind the journey.','Dated manual values, original sources and operational windows.'],inbox:['HUMAN ASSOCIATION','Keep uncertain inputs visible.','Review unmatched documents and processing issues before changing care state.'],audit:['ACTIVITY TRAIL','Every handoff, accounted for.','Inspect the actor, state change, ownership, and reason for each demo action.']}[view];
 if(role==='Patient'){if(view==='today')copy.splice(0,3,'YOUR DAY','Your next steps.','What needs doing, and who acts next.');if(view==='plans')copy.splice(0,3,'YOUR AGREED INSTRUCTIONS','My care plan.','Confirmed by your clinician, with a clear next step.');if(view==='journey')copy.splice(0,3,'YOUR CARE JOURNEY','See each step through.','Instructions, activity and review, together in one place.');if(view==='messages')copy.splice(0,3,'YOUR CARE TEAM','Messages','Find your help requests and care-team replies.');if(view==='context')copy.splice(0,3,'YOUR HEALTH HISTORY','Your records, with their sources.','Review what is recorded, add a value or correct an entry.');if(view==='capture')copy.splice(0,3,'RECORD AN ACTIVITY','Log what happened.','Choose an activity, check the details and confirm.');}if(role==='Caregiver')copy.splice(0,3,'YOUR SUPPORT WORKSPACE','Your support tasks.','Help with the practical next step, within the patient’s consent.');$('#kicker').textContent=copy[0];$('#title').textContent=copy[1];$('#subtitle').textContent=copy[2];document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 let body='';
 if(role==='Caregiver'){const assigned=state.supportTasks;body=`<section class="card"><h2>Your support tasks</h2><p class="mini">Consent-scoped logistics only. Clinical details and reports are not shown.</p>${assigned.length?assigned.map(i=>`<div class="event"><h3>${escape(i.label)}</h3><p><strong>Next:</strong> Check with the patient about what practical help they need. Ask them to record the activity once it happens.</p><p class="mini">Support requested ${new Date(i.created_at).toLocaleString()}</p></div>`).join(''):'<div class="empty">No support tasks assigned.</div>'}</section>`;
 }else if(role==='Patient'&&view==='today'){body=patientToday(state);
 }else if(role==='Patient'&&view==='journey'){body=patientJourney(state,journeyDomain,journeyPage,journeyStatus,journeyRange);
 }else if(role==='Patient'&&view==='reports'){body=patientReports(state,documentCategory,reportStatus);
 }else if(role==='Patient'&&view==='help'){body=patientHelp(state);
 }else if(role==='Patient'&&view==='plans'){body=patientPlan(state);
 }else if(role==='Patient'&&view==='account'){body=patientAccount(state);
 }else if(view==='notifications'){body=notificationInbox(notifications,notificationRead);
 }else if(view==='trends'){body=patientTrends(state,{...trendOptions,prepareVisit:role==='Patient'});
 }else if(view==='operations'){body=(role==='Clinician'?'<p><button class="quiet" data-go="trends">30-day patient trends</button></p>':'')+operationsPanel(state,role);
 }else if(view==='inbox'){body=intakePanel(state,role);
 }else if(view==='context'){body=contextPanel(state,role);
 }else if(view==='capture'){body=role==='Patient'?patientLogMenu(logSection)+(logSection==='record'?patientLog(state):logSection==='note'?multiPanel(state,role):logSection==='history'?capturePanel(state,role,'history'):logSection==='monitoring'?'<p><button class="quiet" data-go="trends">Explore 30-day trends</button></p>'+capturePanel(state,role,'monitoring'):correctionButtons(state,role)):multiPanel(state,role)+capturePanel(state,role)+correctionButtons(state,role);
 }else if(view==='plans'){body=renderPlans(state,role);
 }else if(view==='today'){body=`<div class="grid"><div><section class="hero"><div><p class="eyebrow">A PLAN THAT FITS YOUR DAY</p><h2>${total>0&&count===total?'Today’s loops are complete.':'One step at a time.<br>With your care team beside you.'}</h2><p>${total-count} ${total-count===1?'action remains':'actions remain'} in your shared journey.</p></div><div class="progress"><strong>${count}<span style="opacity:.5;font-size:17px"> / ${total}</span></strong><small>LOOPS CLOSED</small></div></section><div class="section-title"><h2>Your next steps</h2><small>${total} CURRENT CARE ITEMS</small></div>${taskList(state.items)}${state.upcoming.length?`<section class="card"><h2>Coming up</h2><p class="mini">${state.upcoming.length} separate scheduled actions. Completing a current task does not complete these.</p>${state.upcoming.map(i=>`<div class="detail"><span>${escape(i.label)}</span><strong>${new Date(i.dueAt).toLocaleString()}</strong>${['Clinician','Coordinator'].includes(role)?button(i.loopId,'snooze','Reschedule'):''}${role==='Clinician'?button(i.loopId,'cancel','Cancel'):''}</div>`).join('')}</section>`:''}</div>${rail()}</div>`;
 }else if(view==='journey'){body=`<div class="grid"><div><section class="card"><h2>Agreed care plan</h2><div class="source">${escape(state.plans.find(p=>p.status==='confirmed'&&p.active)?.source_note??'No confirmed plan available.')}</div><p class="mini">Clinician-confirmed instructions. Source and proposal history are available in Care plans.</p></section>${taskList(state.items)}<section class="card"><h2>Monitoring data availability</h2><p class="mini">${state.observations.length} synthetic readings in the shared database. Values are displayed without clinical interpretation.</p>${state.observations.map(o=>`<span class="pill">${new Date(o.observed_at).toLocaleTimeString()} · ${escape(o.value)} ${escape(o.unit)}</span>`).join('')}</section></div>${rail()}</div>`;
 }else if(view==='queue'){const open=state.items.filter(i=>!['CLOSED','CANCELLED'].includes(i.state)).sort((a,b)=>Number(b.state==='REVIEW_PENDING')-Number(a.state==='REVIEW_PENDING')||Date.parse(a.dueAt)-Date.parse(b.dueAt));const help=(state.intake||[]).filter(isHelpRequest).map(i=>helpThread(state,i)).filter(t=>t.open&&!t.waitingForPatient);body=`<div class="stats"><div class="card"><small>Open loops</small><strong>${open.length}</strong></div><div class="card"><small>Awaiting human review</small><strong>${open.filter(i=>i.state==='REVIEW_PENDING').length}</strong></div><div class="card"><small>Closed loops</small><strong>${count}</strong></div></div><p class="mini">Current due-task closure: ${total?Math.round(count/total*100):0}% (${count}/${total}); ${state.messages.filter(m=>m.status==='pending').length} in-app reminders queued; ${state.upcoming.length} future occurrences. These are fictional operational counts, not clinical outcomes.</p><p class="mini">Coordinator can simulate reminders and route support. Clinician can review evidence and reopen loops.</p>${help.length?`<section class="card"><h2>Help requests needing a team response</h2><p>${help.length} open · ${help.filter(t=>!t.owner).length} unassigned</p><button type="button" class="quiet" data-go="inbox">Open help queue</button></section>`:''}${open.length?taskList(open):'<div class="card empty">All loops closed. View the journey to reopen an item.</div>'}`;
 }else if(view==='messages'&&role==='Patient'){body=patientHelp(state,{inbox:true});
 }else if(view==='rehearsal'){body='<p><button type="button" class="quiet" data-go="messages">Back to Messages</button></p>'+messagingPanel(state,role);
 }else if(view==='messages'){body=messagingPanel(state,role);
 }else{body=`<section class="card"><h2>Demo activity</h2><p class="mini">Server-recorded actions from the shared database. App users cannot edit this history.</p>${state.audit.length?paginate(state.audit,feedPage,20).items.map(e=>`<div class="event"><h3>${escape(e.label)} · ${escape(e.action)}</h3><p>${escape(e.role)} · ${escape(e.from)} → ${escape(e.to)}</p>${e.note?`<p>${escape(e.note)}</p>`:''}<time>${new Date(e.at).toLocaleString()}</time></div>`).join(''):'<div class="empty">Complete an action to begin the activity trail.</div>'}${state.audit.length>=state.historyLimits.audit?'<button class="quiet" data-history="audit">Load earlier audit records</button>':''}<div class="dialog-actions"><button id="feed-prev" class="quiet" ${feedPage===0?'disabled':''}>Previous</button><span>${state.audit.length} loaded audit records · page ${paginate(state.audit,feedPage,20).page+1} / ${paginate(state.audit,feedPage,20).pages}</span><button id="feed-next" class="quiet" ${feedPage+1>=paginate(state.audit,feedPage,20).pages?'disabled':''}>Next</button></div></section>`;}
 const journeySubview=role==='Patient'&&['plans','reports','help','trends','context','account'].includes(view);
 const journeyBack=journeySubview?'<div class="patient-links"><button type="button" class="quiet" data-go="journey">← Back to Journey</button></div>':'';
 $('#content').innerHTML=journeyBack+body;bindHelpThreads();if(view==='reports'&&role==='Patient')bindDocumentLibrary();$('#start-help')?.addEventListener('click',showHelpPicker);if(view==='notifications'){$('#notifications-read-all')?.addEventListener('click',()=>{markNotificationsRead(notifications.map(n=>n.id));render();$('#title').focus();});document.querySelectorAll('[data-notification]').forEach((b,index)=>b.onclick=()=>{if(busy)return;const n=notifications.find(n=>n.id===b.dataset.notification);if(!n)return;markNotificationsRead([n.id]);if(n.threadId){view='messages';render();document.getElementById('help-'+n.threadId)?.focus();return;}render();document.querySelectorAll('[data-notification]')[index]?.focus();showLoop(n.loopId);});}if(view==='trends'){bindVisitPrep();$('#trend-day').onchange=e=>{trendOptions.date=e.target.value;render();$('#trend-day').focus();};$('#trend-source').onchange=e=>{trendOptions={sample:e.target.value==='sample'};render();$('#trend-source').focus();};$('#trend-export').onclick=()=>{const data=trendOverview(state,trendOptions),url=URL.createObjectURL(new Blob([trendCsv(data)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='wholecare-'+(data.sample?'sample-':'')+'trends-'+data.days.at(-1).date+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('#trend-close-day')?.addEventListener('click',()=>{trendOptions.date='';render();$('#trend-day').focus();});document.querySelectorAll('[data-trend-date]').forEach(b=>{const select=()=>{trendOptions.date=b.dataset.trendDate;render();document.querySelector('[data-trend-date][aria-pressed="true"]')?.focus();};b.addEventListener('click',select);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});});}if(role==='Patient'){document.querySelectorAll('[data-log-section]').forEach(b=>b.onclick=()=>{logSection=b.dataset.logSection;render();document.querySelector('[data-log-section][aria-pressed="true"]')?.focus();});$('#journey-range')?.addEventListener('change',e=>{journeyRange=e.target.value;journeyPage=0;render();$('#journey-range').focus();});document.querySelector('#journey-status')?.addEventListener('change',e=>{journeyStatus=e.target.value;journeyPage=0;render();$('#journey-status').focus();});document.querySelector('#journey-domain')?.addEventListener('change',e=>{journeyDomain=e.target.value;journeyPage=0;render();});document.querySelector('#journey-prev')?.addEventListener('click',()=>{journeyPage--;render();});document.querySelector('#journey-next')?.addEventListener('click',()=>{journeyPage++;render();});if(view==='account')bindCapturePanel($('#content'),state,{run:update,toast});}$('#content').querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>update(async()=>expandHistory(b.dataset.history),'Earlier records loaded.'));$('#tasks-prev')?.addEventListener('click',()=>{taskPage--;render();});$('#tasks-next')?.addEventListener('click',()=>{taskPage++;render();});if(view==='operations')bindOperations($('#content'),{render,navigate:v=>{view=v;render();},locate:id=>{view='journey';taskPage=Math.max(0,Math.floor(state.items.findIndex(l=>l.loopId===id)/12));render();const node=document.getElementById('loop-'+id);if(node){node.scrollIntoView({behavior:'smooth'});node.focus();}else toast('This historical occurrence remains in the source-linked report and activity trail.');}});if(view==='rehearsal'||view==='messages'&&role!=='Patient')bindMessaging($('#content'),state,{run:update,render,toast});if(view==='inbox')bindIntake($('#content'),state,{run:update,toast});$('#feed-prev')?.addEventListener('click',()=>{feedPage--;render();});$('#feed-next')?.addEventListener('click',()=>{feedPage++;render();});if(view==='context')bindContext($('#content'),state,{run:update,render,toast});if(view==='capture'){bindCapturePanel($('#content'),state,{run:update,toast});bindMulti($('#content'),state,{run:update,render,toast});bindCorrections($('#content'),state,{run:update});}if(view==='plans'&&role!=='Patient')bindPlans($('#content'),state,{refresh:refreshWorkspace,toast,setBusy:v=>busy=v});
}

function navigate(target){if(!state||busy)return;view=safeView(role,target);feedPage=0;taskPage=0;journeyPage=0;document.querySelector('#account-menu').open=false;render();$('#title').focus();window.scrollTo({top:0});}
function bindVisitPrep(){
 const form=$('#visit-prep');
 if(!form)return;
 const status=$('#visit-status'),noticed=$('#visit-noticed'),records=$('#visit-records'),discuss=$('#visit-discuss');
 form.onsubmit=event=>{
  event.preventDefault();
  const notes=new FormData(form).getAll('visit-note');
  if(notes.length>3){status.textContent='Choose up to three notes.';return;}
  const facts=[...form.querySelectorAll('[data-visit-fact]')].map(point=>point.textContent);
  noticed.value=notes.join('\n');
  records.value=facts.join('\n');
  discuss.value='I’d like to review these entries with you.';
  $('#visit-result').hidden=false;
  status.textContent='Visit draft ready to review.';
  noticed.focus();
 };
 const ai=$('#visit-ai');
 if(ai)ai.onclick=async()=>{
  const selected=[...form.querySelectorAll('[data-note-id]:checked')];
  if(!selected.length||selected.length>12){status.textContent='Choose 1–12 notes for AI selection.';return;}
  ai.disabled=true;status.textContent='Selecting notes…';
  try{
   const {ids}=await suggestVisitNotes(selected.map(input=>input.dataset.noteId));
   if(!form.isConnected)return;
   if(!ids?.length){status.textContent='No notes suggested. You can choose up to three yourself.';return;}
   const chosen=new Set(ids);
   for(const input of selected)input.checked=chosen.has(input.dataset.noteId);
   status.textContent='AI selected up to three notes. Review your selections and create the draft.';
  }catch{if(form.isConnected)status.textContent='AI selection is unavailable. You can still choose notes yourself.';}
  finally{ai.disabled=false;}
 };
 $('#visit-copy').onclick=async()=>{
  const text=[['What I noticed',noticed.value],['What my records show',records.value],['What I’d like to discuss',discuss.value]].map(([heading,value])=>heading+'\n'+value.trim()).join('\n\n');
  try{await navigator.clipboard.writeText(text);status.textContent='Visit note copied.';}
  catch{
   let fallback=$('#visit-copy-text');
   if(!fallback){
    fallback=document.createElement('textarea');
    fallback.id='visit-copy-text';
    fallback.readOnly=true;
    fallback.setAttribute('aria-label','Complete visit draft for manual copying');
    status.before(fallback);
   }
   fallback.value=text;
   fallback.select();
   status.textContent='Copy the selected visit note using your device controls.';
  }
 };
 form.querySelectorAll('[data-visit-date]').forEach(button=>button.onclick=()=>{
  trendOptions.date=button.dataset.visitDate;
  render();
  $('#trend-close-day')?.focus();
 });
}
function bindHelpThreads(){
 $('#content').querySelectorAll('[data-help-thread]').forEach(form=>{
  let key=crypto.randomUUID(),previous='';
  form.onsubmit=event=>{
   event.preventDefault();
   const {helpThread:action,helpId:id}=form.dataset,message=form.elements.message?.value.trim()||'';
   if(previous!==message){key=crypto.randomUUID();previous=message;}
   const notices={claim:'Request assigned to you.',reply:'Reply saved in Messages.',resolve:'Help request resolved.'};
   update(()=>updateHelpThread(id,action,message,key),notices[action]);
  };
 });
}
function showLoop(id,{saved=false}={}){if(!state)return;const item=state.occurrences.find(l=>l.loopId===id);if(!item)return;let d=document.querySelector('#loop-detail-dialog');if(!d){d=document.createElement('dialog');d.id='loop-detail-dialog';d.setAttribute('aria-labelledby','loop-detail-title');document.body.append(d);}d.innerHTML=loopDetail(state,item,role,{saved});d.querySelector('[data-return-today]')?.addEventListener('click',()=>{d.close();view='today';render();$('#title').focus();});d.querySelector('[data-close-loop]').onclick=()=>d.close();if(!d.open)d.showModal();}
function bindDocumentLibrary(){
 bindIntake($('#content'),state,{run:update,toast});
 $('#report-status')?.addEventListener('change',e=>{reportStatus=e.target.value;render();$('#report-status').focus();});
 $('#document-category').onchange=e=>{documentCategory=e.target.value;render();$('#document-category').focus();};
 document.querySelectorAll('[data-library-file]').forEach(b=>b.onclick=async()=>{
  const {libraryFile:type,libraryId:id}=b.dataset;
  const row=type==='plan'?state.plans.find(p=>p.id===id&&p.status==='confirmed'):type==='report'?state.rawEvidence.find(e=>e.id===id):state.intake.find(i=>i.id===id);
  const path=type==='report'?row?.storage_path:row?.source_path;if(!path)return;
  b.disabled=true;
  try{const url=await privateFile(type==='plan'?'plan-documents':'care-evidence',path);const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open private original';b.replaceWith(link);link.focus();}catch(e){b.disabled=false;toast(e.message);}
 });
 const form=$('#library-upload');
 let path,key=crypto.randomUUID();
 form.oninput=()=>{key=crypto.randomUUID();};form.elements.document.onchange=()=>{path=null;};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;
  const file=form.elements.document.files[0],label=form.elements.label.value.trim(),note=form.elements.note.value.trim();
  if(!label||!file)return;
  e.submitter.disabled=true;
  try{if(await update(async()=>{path??=await uploadPrivate('care-evidence',file);await submitIntake(label,note,path,key);},'Document saved and available to your care team.')){documentCategory='uploads';render();$('#title').focus();}}finally{e.submitter.disabled=false;}
 };
}
function showHelpPicker(){
 if(role!=='Patient'||busy)return;
 const waiting=new Set((state.intake||[]).filter(i=>i.state==='unmatched'&&!i.source_path&&i.label.startsWith('Help request: ')).map(i=>i.loop_id));
 const items=state.occurrences.filter(i=>loopMeaning(i).recordable&&!waiting.has(i.loopId));
 const d=document.createElement('dialog');d.setAttribute('aria-labelledby','help-picker-title');
 d.innerHTML=`<form><h2 id="help-picker-title">Which activity do you need help with?</h2>${items.length?`<label>Due activity<select name="activity" required><option value="">Choose an activity</option>${items.map(i=>`<option value="${escape(i.loopId)}">${escape(i.label)} · ${escape(new Date(i.dueAt).toLocaleString())}</option>`).join('')}</select></label>`:'<p>No due activities are available for a new request. Any existing requests are listed in Messages.</p>'}<div class="dialog-actions"><button class="quiet" type="button">Close</button>${items.length?'<button class="primary" type="submit">Continue</button>':''}</div></form>`;
 d.querySelector('[type=button]').onclick=()=>d.close();
 d.querySelector('form').onsubmit=e=>{e.preventDefault();const id=e.target.elements.activity.value;if(!items.some(i=>i.loopId===id))return;d.close();showHelp(id,'messages');};
 d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();
}
function showHelp(id,destination='help'){
 const item=state?.occurrences.find(l=>l.loopId===id);
 if(role!=='Patient'||!item||!loopMeaning(item).recordable)return;
 let d=$('#activity-help-dialog');
 if(!d){d=document.createElement('dialog');d.id='activity-help-dialog';d.setAttribute('aria-labelledby','help-title');document.body.append(d);}
 let key=crypto.randomUUID(),sentText='';
 d.innerHTML=`<form><h2 id="help-title">Ask for practical help</h2><p>${escape(item.label)}</p><p>Your care team can reply in Journey → Help requests. This does not complete the activity.</p><label>What do you need help with?<textarea required maxlength="1000" name="note"></textarea></label><div class="dialog-actions"><button type="button" class="quiet">Cancel</button><button type="submit" class="primary">Send request</button></div></form>`;
 d.querySelector('[type=button]').onclick=()=>d.close();
 d.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const text=e.target.elements.note.value.trim(),b=e.submitter;if(!text||busy)return;
  if(sentText&&sentText!==text)key=crypto.randomUUID();sentText=text;b.disabled=true;
  try{if(await update(()=>requestActivityHelp(id,text,key),'Help request sent to your care team.')){d.close();$('#loop-detail-dialog')?.close();navigate(destination);}}finally{b.disabled=false;}
 };
 d.showModal();
}
document.addEventListener('click',e=>{const go=e.target.closest('[data-go]'),loop=e.target.closest('[data-open-loop]');if(busy||!state)return;if(go)navigate(go.dataset.go);if(loop)showLoop(loop.dataset.openLoop);const help=e.target.closest('[data-request-help]');if(help)showHelp(help.dataset.requestHelp);});

function showLogin(message=''){notificationScope='';notificationRead=new Set();clearPlanEditor();clearOperations();clearMessaging();clearBucket();feedPage=0;view='today';taskPage=0;journeyPage=0;journeyDomain='';journeyStatus='open';journeyRange='all';documentCategory='all';reportStatus='all';logSection='note';trendOptions={};state=null;role='';document.body.classList.remove('patient-workspace');$('#app-shell').hidden=true;$('#auth-screen').hidden=false;$('#content').innerHTML='';$('#auth-status').textContent=message;document.querySelectorAll('dialog').forEach(d=>{d.close();if(d.id!=='review-dialog')d.innerHTML='';});}
async function refreshWorkspace(){const version=epoch;const result=await loadWorkspace();if(version!==epoch)return;state=result.state;const changedRole=role!==result.role;role=result.role;view=changedRole?defaultView(role):safeView(role,view);$('#role').textContent=role;document.body.classList.toggle('patient-workspace',role==='Patient');const primary=role==='Patient'?['today','journey','capture','messages']:allowedViews(role);const patientNames={today:'Today',journey:'Journey',capture:'Log',messages:'Messages'};document.querySelectorAll('nav [data-view]').forEach(b=>{b.hidden=!primary.includes(b.dataset.view);b.querySelector('span').textContent=role==='Patient'?patientNames[b.dataset.view]||b.dataset.view:role==='Caregiver'?'Support tasks':b.dataset.title;});document.querySelector('#profile-link').hidden=role!=='Patient';$('.notice').textContent=role==='Patient'?'Fictional demo · WhatsApp/SMS delivery is unavailable. Messages are a simulation.':'Connected fictional demo · AI proposals need confirmation. WhatsApp/SMS care delivery is unavailable.';$('#auth-screen').hidden=true;$('#app-shell').hidden=false;const sidebar=$('.side-bottom');sidebar.querySelector('strong').textContent=state.patient?.display_name??state.profile.display_name??'Care workspace';sidebar.querySelector('small').textContent=role+' · development workspace';sidebar.querySelector('.avatar').textContent=(state.patient?.display_name??state.profile.display_name??'WC').split(' ').map(x=>x[0]).slice(0,2).join('');render();}
async function update(operation,message){if(busy)return false;busy=true;document.querySelectorAll('[data-action],#consent,#refresh').forEach(b=>b.disabled=true);try{await operation();await refreshWorkspace();toast(message);return true;}catch(e){await recordFailure('action',e.name==='TimeoutError'?'timeout':e instanceof TypeError?'network':'rejected');toast(e.name==='TimeoutError'?'Connection timed out. Refresh to check the saved status.':e.message);try{await refreshWorkspace();}catch{if(!hasSession())showLogin('Session ended. Please sign in again.');}return false;}finally{busy=false;if(state)render();$('#refresh').disabled=false;}}
document.querySelector('nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b&&!busy){navigate(b.dataset.view);}});
$('#content').addEventListener('change',e=>{if(e.target.id==='consent'&&role==='Patient'&&state.caregivers[0]){const granted=e.target.checked;update(()=>setConsent(state.caregivers[0].id,granted),granted?'Caregiver consent saved.':'Caregiver consent revoked.');}});
async function act(id,action,note=''){return update(()=>careAction(id,action,note|| (action==='complete'?'Synthetic activity self-report':'')),action==='evidence'?'Sample evidence saved. Clinician review required.':action==='remind'?'Simulated reminder saved. No WhatsApp message sent.':'Saved to the shared care journey.');}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||busy)return;const {id,action}=b.dataset;if(action==='open-evidence'){const item=state.occurrences.find(i=>i.loopId===id);if(!item?.evidencePath&&!b.dataset.evidencePath){toast('No private report is attached to this occurrence.');return;}b.disabled=true;privateFile('care-evidence',b.dataset.evidencePath||item.evidencePath).then(url=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='View private report';a.className='action';b.replaceWith(a);}).catch(e=>{b.disabled=false;toast(e.message);});return;}if(['snooze','cancel'].includes(action)){openManage([...state.items,...state.upcoming].find(i=>i.loopId===id),action,{run:update});return;}if(action==='capture'){const item=state.occurrences.find(i=>i.loopId===id);if(!item||role!=='Patient'||!loopMeaning(item).recordable){toast('This occurrence is not ready for a new patient entry.');return;}document.querySelector('#loop-detail-dialog')?.close();openCapture(item,state,{run:update,toast,onSaved:()=>showLoop(id,{saved:true})});return;}if(['review','reopen'].includes(action)){pending={id,action};$('#review-dialog h2').textContent=action==='review'?'Review the sample report':'Reopen this care loop';$('.sample').hidden=action==='reopen';if(action==='review'){const ev=state.rawEvidence.find(e=>e.loop_id===id);$('.sample').innerHTML=ev&&!ev.is_fixture?`<strong>Uploaded fictional report</strong><p>Open the original file before recording your review. WholeCare does not interpret results.</p><button type="button" class="quiet" id="open-review-file">Prepare private file link</button>`:'<strong>Synthetic report fixture</strong><p>No clinical findings. This is a built-in demonstration record.</p>';if(ev&&!ev.is_fixture)$('#open-review-file').onclick=async()=>{try{const url=await privateFile('care-evidence',ev.storage_path);const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='Open original report';$('#open-review-file').replaceWith(a);}catch(e){toast(e.message);}};}$('#review-form button[type=submit]').textContent=action==='review'?'Confirm review and close':'Reopen with reason';$('#review-note').value='';$('#review-dialog').showModal();}else act(id,action);});
$('#cancel-review').addEventListener('click',()=>{if(!busy)document.querySelectorAll('dialog').forEach(d=>{d.close();if(d.id!=='review-dialog')d.innerHTML='';});});
$('#review-form').addEventListener('submit',async e=>{e.preventDefault();const note=$('#review-note').value.trim();if(!note||busy)return;const b=$('#review-form button[type=submit]');b.disabled=true;try{if(await act(pending.id,pending.action,note))document.querySelectorAll('dialog').forEach(d=>{d.close();if(d.id!=='review-dialog')d.innerHTML='';});}finally{b.disabled=false;}});
$('#refresh').addEventListener('click',()=>update(async()=>{},'Shared records refreshed.'));
$('#signout').addEventListener('click',async()=>{if(busy)return;busy=true;epoch++;const b=$('#signin-form button');b.disabled=true;showLogin('Signing out…');try{await signOut();showLogin('Signed out.');}finally{busy=false;b.disabled=false;}});
$('#signin-form').addEventListener('submit',async e=>{e.preventDefault();const b=$('#signin-form button');b.disabled=true;$('#auth-status').textContent='Connecting to your care workspace…';epoch++;try{await signIn($('#signin-email').value,$('#signin-password').value);$('#signin-password').value='';await refreshWorkspace();}catch(e){showLogin(e.message);}finally{b.disabled=false;}});
window.addEventListener('focus',()=>{if(state&&!busy&&!['plans','capture','context'].includes(view)&&!document.querySelector('dialog[open]'))update(async()=>{},'Shared records refreshed.');});
const startPasswordRecovery=bindPasswordUI({showLogin,toast,isBusy:()=>busy,setBusy:v=>busy=v});
document.documentElement.dataset.workspaceReady='true';
$('#signin-form button[type=submit]').disabled=false;
startPasswordRecovery().then(handled=>{if(handled)return;if(hasSession()){showLogin('Restoring your session…');refreshWorkspace().catch(e=>showLogin(e.message));}else showLogin();});
