const patientViews=['today','journey','capture','messages','plans','context','account'];
export function allowedViews(role){return role==='Patient'?patientViews:role==='Caregiver'?['today']:['Clinician','Coordinator'].includes(role)?['today','journey','capture','messages','plans','context','queue','operations','inbox','audit']:[];}
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
