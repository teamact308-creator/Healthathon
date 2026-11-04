const patientViews=['today','journey','capture','messages','plans','context','account','trends'];
export function allowedViews(role){return role==='Patient'?patientViews:role==='Caregiver'?['today']:['Clinician','Coordinator'].includes(role)?['today','journey','capture','messages','plans','context','queue','operations','inbox','audit',...(role==='Clinician'?['trends']:[])]:[];}
export const defaultView=role=>['Clinician','Coordinator'].includes(role)?'queue':'today';
export function safeView(role,view){return allowedViews(role).includes(view)?view:defaultView(role);}
export function dayKey(value,timezone='Asia/Kolkata'){
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
 try{return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}catch{return dayKey(value,'UTC');}
}
export function todayGroups(loops,now=Date.now()){
 const attention=[],upcoming=[],completed=[],waiting=[];let scheduled=0,future=0;
 for(const l of loops){if(l.state==='CANCELLED'||l.planActive===false&&l.state!=='REVIEW_PENDING')continue;
  const today=dayKey(now,l.timezone),dueToday=dayKey(l.dueAt,l.timezone)===today;
  if(dueToday)scheduled++;
  if(l.state==='REVIEW_PENDING'){waiting.push(l);continue;}
  if(l.state==='CLOSED'){if(l.closedAt&&dayKey(l.closedAt,l.timezone)===today)completed.push(l);continue;}
  if(Date.parse(l.dueAt)<=now)attention.push(l);else if(dueToday)upcoming.push(l);else future++;
 }
 const chronological=(a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt);
 attention.sort(chronological);upcoming.sort(chronological);waiting.sort(chronological);completed.sort((a,b)=>Date.parse(b.closedAt)-Date.parse(a.closedAt));
 return {attention,upcoming,completed,waiting,scheduled,future};
}
export function loopMeaning(loop,now=Date.now()){
 const test=loop.id==='test',closed=loop.state==='CLOSED',waiting=loop.state==='REVIEW_PENDING';
 const recordable=['DUE','UNCONFIRMED'].includes(loop.state)&&loop.planActive!==false&&Date.parse(loop.dueAt)<=now;
 if(loop.state==='CANCELLED')return {label:'Cancelled',next:'This occurrence was cancelled by your care team.',recordable:false,steps:[]};
 if(loop.planActive===false&&!closed&&!waiting)return {label:'Previous plan',next:'This instruction is no longer active. Follow your current confirmed plan.',recordable:false,steps:[]};
 const label=closed?(test?'Follow-up complete':'Activity recorded'):waiting?'With your clinician':loop.state==='UNCONFIRMED'?'Follow-up needed':recordable?(Date.parse(loop.dueAt)<now?'Needs attention':'Ready to record'):'Coming up';
 const next=closed?(test?'Your clinician completed the operational review. This does not describe the medical result.':'Your activity has been recorded. Other scheduled activities remain separate.'):waiting?'Your report is received. Your clinician acts next; this submission is waiting for review.':loop.state==='UNCONFIRMED'?'The reported outcome remains open for follow-up. It is not counted as successful completion.':!recordable?'This is a future scheduled activity. You can review its instructions now.':test?'Upload the report for this investigation. Your clinician will review it before this follow-up is complete.':'Record what happened for this scheduled activity. Check the details before saving.';
 const names=test?['Scheduled','Report submitted','Clinician review','Follow-up complete']:['Scheduled','Record activity','Activity recorded'];
 const current=closed?names.length:waiting?2:recordable||loop.state==='UNCONFIRMED'?1:0;
 return {label,next,recordable,steps:names.map((text,index)=>({text,state:index<current?'complete':index===current?'current':'pending'}))};
}

export function trendDays(observations,events,timezone,now=Date.now()){
 const today=dayKey(now,timezone);
 const days=Array.from({length:30},(_,i)=>({date:new Date(Date.parse(today)-(29-i)*86400000).toISOString().slice(0,10),readings:[],events:[]}));
 const byDate=new Map(days.map(d=>[d.date,d]));
 for(const r of observations){
  if(r.unit!=='mg/dL'||r.value==null||r.value===''||!Number.isFinite(Number(r.value))||Date.parse(r.observed_at)>now)continue;
  byDate.get(dayKey(r.observed_at,timezone))?.readings.push(r);
 }
 for(const e of events){
  if(!['meals','medication'].includes(e.domain)||Date.parse(e.occurred_at)>now)continue;
  byDate.get(dayKey(e.occurred_at,timezone))?.events.push(e);
 }
 for(const d of days){d.readings.sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));d.events.sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at));}
 return days;
}
export function trendSample(now=Date.now()){
 const observations=[],events=[],end=Date.parse(new Date(now).toISOString().slice(0,10));
 for(let i=1;i<30;i++){
  const at=h=>new Date(end-i*86400000+h*3600000).toISOString();
  if(i%6!==0)for(const [h,value] of (i%4===0?[[4,109],[6,152]]:[[4,106],[6,128]]))observations.push({observed_at:at(h),value:value+i%8,unit:'mg/dL'});
  events.push({domain:'meals',status:'meal_logged',occurred_at:at(5),details:{note:'Fictional lunch'}},{domain:'medication',status:i%4===0?'missed':'taken',occurred_at:at(2)});
 }
 return {observations,events};
}

// Only recognize explicit first-person reports about this dose. Other wording needs review.
export function medicationOutcomeFromTranscript(text){
 const value=String(text??'').normalize('NFKC').replace(/[‘’]/gu,"'").trim().toLowerCase().replace(/[.!।]+$/u,'').trim();
 const explicitTaken=/^(?:i took|i(?:'ve| have) taken|took) (?:it|(?:my|the) (?:dose|medication|medicine))(?:,? (on time|late))?$/u.exec(value);
 if(explicitTaken)return explicitTaken[1]==='late'?'delayed':'taken';
 if(/^(?:i )?(?:took (?:it|my (?:dose|medication)|the (?:dose|medication))|(?:मैंने )?(?:दवा|खुराक) ली)$/u.test(value))return 'taken';
 if(/^(?:i )?(?:missed (?:it|my (?:dose|medication)|the (?:dose|medication))|did not take (?:it|my (?:dose|medication)|the (?:dose|medication))|(?:मैंने )?(?:दवा|खुराक) नहीं ली)$/u.test(value))return 'missed';
 if(/^(?:i )?(?:took (?:it|my (?:dose|medication)|the (?:dose|medication)) late|(?:मैंने )?(?:दवा|खुराक) देर से ली)$/u.test(value))return 'delayed';
 if(/^i skipped (?:it|my (?:dose|medication)|the (?:dose|medication)) as (?:my doctor|my clinician) instructed$/u.test(value))return 'skipped_by_instruction';
 return null;
}
