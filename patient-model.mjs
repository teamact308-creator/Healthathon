const patientViews=['today','journey','capture','messages','plans','context','account','trends','notifications','reports','help','rehearsal'];
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

export function patientNotifications(state){
 const occurrences=new Map((state.occurrences||[]).map(item=>[item.loopId,item]));
 const rows=[];
 for(const m of state.messages||[]){
  const item=occurrences.get(m.loopId);
  if(m.id&&m.to==='Patient'&&item&&item.planActive!==false&&['DUE','UNCONFIRMED'].includes(item.state)){
   rows.push({id:'reminder:'+m.id,loopId:m.loopId,at:m.at,title:'An activity needs your attention',label:item.label,timezone:item.timezone});
  }
 }
 for(const event of state.audit||[]){
  const item=occurrences.get(event.loopId);
  if(event.id&&event.action==='review'&&event.role==='Clinician'&&event.to==='CLOSED'&&item?.id==='test'){
   rows.push({id:'review:'+event.id,loopId:event.loopId,at:event.at,title:'Your clinician reviewed your report',label:item.label,timezone:item.timezone});
  }
 }
 return rows.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,100);
}

export function trendOverview(state,{sample=false,now=Date.now()}={}){
 let timezone=sample?'Asia/Kolkata':state.patient?.timezone||'Asia/Kolkata';
 try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{timezone='UTC';}
 const source=sample?trendSample(now):state;
 const days=trendDays(source.observations||[],source.events||[],timezone,now).map(day=>{
  const values=day.readings.map(r=>Number(r.value)).sort((a,b)=>a-b),n=values.length;
  const medication=day.events.filter(e=>e.domain==='medication');
  return {...day,low:n?values[0]:null,high:n?values[n-1]:null,median:n?(values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2:null,meals:day.events.filter(e=>e.domain==='meals').length,medication};
 });
 return {days,timezone,sample};
}
export function trendCsv({days,timezone,sample}){
 const rows=[['date','timezone','source','glucose_unit','reading_count','glucose_low','glucose_median','glucose_high','meal_logs','medication_logs','taken','missed','delayed','skipped_by_instruction','other_medication_outcome']];
 for(const d of days){
  const counts=['taken','missed','delayed','skipped_by_instruction'].map(status=>d.medication.filter(e=>e.status===status).length);
  rows.push([d.date,timezone,sample?'fictional_sample':'loaded_workspace','mg/dL',d.readings.length,d.low,d.median,d.high,d.meals,d.medication.length,...counts,d.medication.length-counts.reduce((sum,n)=>sum+n,0)]);
 }
 return rows.map(row=>row.map(v=>v==null?'':typeof v==='number'?String(v):'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';
}

export function journeyOccurrences(occurrences,domain='',status='open',now=Date.now()){
 const matches=l=>{
  if(domain&&l.domainKey!==domain)return false;
  if(status==='open')return l.planActive!==false&&['DUE','UNCONFIRMED'].includes(l.state)&&Date.parse(l.dueAt)<=now;
  if(status==='upcoming')return l.planActive!==false&&l.state==='DUE'&&Date.parse(l.dueAt)>now;
  if(status==='review')return l.state==='REVIEW_PENDING';
  if(status==='completed')return l.state==='CLOSED';
  return true;
 };
 return occurrences.filter(matches).sort((a,b)=>status==='open'||status==='upcoming'?Date.parse(a.dueAt)-Date.parse(b.dueAt):Date.parse(b.dueAt)-Date.parse(a.dueAt));
}

export function planChanges(current,plans,items,schedules){
 const date=p=>Date.parse(p.confirmed_at||p.created_at);
 const previous=plans.filter(p=>p.status==='confirmed'&&p.id!==current.id&&date(p)<date(current)).sort((a,b)=>date(b)-date(a))[0];
 if(!previous)return null;
 const signature=i=>{const s=schedules.find(x=>x.item_id===i.id);return JSON.stringify([i.label,i.source_excerpt||'',i.cadence,s?.start_date,s?.end_date,s?.times,s?.weekdays]);};
 return ['medication','meals','glucose','test'].flatMap(domain=>{
  const before=items.filter(i=>i.plan_id===previous.id&&i.domain===domain),after=items.filter(i=>i.plan_id===current.id&&i.domain===domain);
  if(JSON.stringify(before.map(signature).sort())===JSON.stringify(after.map(signature).sort()))return [];
  return [{domain,before:before.map(i=>i.label),after:after.map(i=>i.label)}];
 });
}
