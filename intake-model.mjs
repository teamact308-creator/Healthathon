// Suggestions only. Source clauses remain visible; a human chooses occurrence/status/time.
export function splitIntake(text){
 if(typeof text!=='string'||!text.trim()||text.length>20000)throw Error('Enter 1–20,000 characters.');
 const clauses=text.split(/(?:\r?\n|[;।]|(?<=[.!?])\s+|\s+(?:and|और)\s+|,\s*(?=(?:i |had |took |booked |will |my |मैं|दवा|नाश्ता)))/iu).map(t=>t.trim()).filter(Boolean);
 if(clauses.length>20)throw Error('Split this note into batches of at most 20 actions.');
 return clauses.map(source=>{
 const future=/\b(tomorrow|will|next|booked|scheduled|plan(?:ned)?|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b|कल|अगले|बुक/iu.test(source);
 const negated=/\b(not|didn.t|haven.t|never)\b|नहीं/iu.test(source);
 let domain=/\b(medic|medicine|tablet|dose|pill)\w*\b|दवा/iu.test(source)?'med':/\b(breakfast|lunch|dinner|meal|ate|eaten)\b|नाश्ता|खाना/iu.test(source)?'meal':/\b(test|report|investigation|lab)\b|जांच|रिपोर्ट/iu.test(source)?'test':/\b(glucose|monitor|sensor|cgm)\b|ग्लूकोज/iu.test(source)?'cgm':'';
 let status='';if(!future&&!negated){if(domain==='med')status=/\bmissed\b|छूट/iu.test(source)?'missed':/\bdelay/iu.test(source)?'delayed':/\b(took|taken)\b|ली|लिया/iu.test(source)?'taken':'';if(domain==='meal')status=/\b(had|ate|eaten|logged)\b|खाया/iu.test(source)?'meal_logged':'';}
 return {source,domain,status,kind:future?'planned':domain==='test'||!status?'clarify':'activity'};
 });
}
export const activityStatuses={med:[['taken','Taken'],['missed','Missed'],['delayed','Delayed'],['skipped_by_instruction','Skipped by clinician instruction']],meal:[['meal_logged','Meal logged']],cgm:[['availability_confirmed','Monitoring data availability confirmed']]};
export function contextCurrent(entries){const replaced=new Set(entries.map(x=>x.supersedes).filter(Boolean));return entries.filter(x=>!replaced.has(x.id)).sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at));}
export function workflowMetrics(data){
 const policy=data.policy?.policy,cutoff=Math.min(Date.parse(data.to),Date.parse(data.generated_at));const start=Date.parse(data.from);
 const itemMap=new Map(data.items.map(x=>[x.id,x]));const due=data.loops.filter(l=>Date.parse(l.due_at)>=start&&Date.parse(l.due_at)<cutoff&&l.state!=='CANCELLED');
 const windows=policy?.windows||{};const eligible=due.filter(l=>Number.isInteger(windows[itemMap.get(l.item_id)?.domain]));
 const onTime=eligible.filter(l=>l.state==='CLOSED'&&Date.parse(l.closed_at)<cutoff&&Date.parse(l.closed_at)<=Date.parse(l.due_at)+windows[itemMap.get(l.item_id)?.domain]*60000);
 const ids=new Set(due.map(x=>x.id));const participation=new Set((data.events||[]).filter(e=>ids.has(e.loop_id)&&Date.parse(e.details?.recorded_at||e.occurred_at)<cutoff).map(e=>e.loop_id));
 const overdue=Number.isInteger(policy?.overdue_hours)?due.filter(l=>!['CLOSED','CANCELLED'].includes(l.state)&&Date.parse(l.due_at)+policy.overdue_hours*3600000<cutoff).length:null;
 const latest=(data.observations||[]).filter(x=>Date.parse(x.observed_at)<cutoff).sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at))[0];
 return {windowEligible:eligible.length,onTime:onTime.length,onTimePercent:eligible.length?100*onTime.length/eligible.length:null,participated:participation.size,due:due.length,overdue,monitoring:!policy?.stale_hours?'Window not configured':!latest?'No observation available':cutoff-Date.parse(latest.observed_at)>policy.stale_hours*3600000?'Outside configured availability window':'Within configured availability window',corrections:(data.corrections||[]).length};
}

export const contextValue=e=>e.kind==='bp'?`${e.value.systolic}/${e.value.diastolic}`:e.kind==='investigation'?e.value.reference:e.value.value;
export const policyText=p=>['medication','meals','glucose','test'].map(k=>`${k}: ${p.windows[k]===null?'unconfigured':p.windows[k]+' min'}`).join('; ')+`; outstanding age: ${p.overdue_hours??'unconfigured'} hours; monitoring availability: ${p.stale_hours??'unconfigured'} hours`;

export function matchLogSuggestion(proposal,items,now=Date.now()){
 const valid=activityStatuses[proposal.domain]?.some(([status])=>status===proposal.status);
 const kind=proposal.kind==='planned'?'planned':proposal.kind==='activity'&&valid?'activity':'clarify';
 const candidates=kind==='activity'?items.filter(i=>i.id===proposal.domain&&i.planActive!==false&&['DUE','UNCONFIRMED'].includes(i.state)&&Date.parse(i.dueAt)<=now):[];
 return {...proposal,kind,candidates:candidates.map(i=>i.loopId),loop:candidates.length===1?candidates[0].loopId:'',status:valid?proposal.status:''};
}
