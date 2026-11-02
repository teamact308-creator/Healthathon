// Deterministic operational reporting. No clinical thresholds or AI inference.
export function periodSummary(data,from,to){
 const start=Date.parse(from),end=Date.parse(to);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>91*86400000)throw Error('Choose a period of up to 90 days.');
 const cutoff=Math.min(end,Number.isFinite(Date.parse(data.generated_at))?Date.parse(data.generated_at):end);
 const inPeriod=t=>Date.parse(t)>=start&&Date.parse(t)<cutoff;
 const plans=new Map((data.plans||[]).map(p=>[p.id,p]));const items=new Map((data.items||[]).map(i=>[i.id,i]));
 const cohort=(data.loops||[]).filter(l=>inPeriod(l.due_at));const excluded=cohort.filter(l=>l.state==='CANCELLED');const eligible=cohort.filter(l=>l.state!=='CANCELLED');
 const closed=eligible.filter(l=>l.state==='CLOSED'&&l.closed_at&&Date.parse(l.closed_at)<cutoff);
 const deltas=closed.map(l=>(Date.parse(l.closed_at)-Date.parse(l.due_at))/3600000).sort((a,b)=>a-b);
 const median=deltas.length?(deltas[Math.floor((deltas.length-1)/2)]+deltas[Math.ceil((deltas.length-1)/2)])/2:null;
 const unresolved=(data.loops||[]).filter(l=>!['CLOSED','CANCELLED'].includes(l.state)&&Date.parse(l.due_at)<cutoff&&(plans.get(items.get(l.item_id)?.plan_id)?.active!==false||l.state==='REVIEW_PENDING'));
 return {cohort:cohort.length,excluded:excluded.length,eligible:eligible.length,closed:closed.length,closurePercent:eligible.length?100*closed.length/eligible.length:null,medianHoursFromDue:median,
  unresolved:unresolved.map(l=>({...l,label:items.get(l.item_id)?.label||'Care action',domain:items.get(l.item_id)?.domain||'unknown',superseded:plans.get(items.get(l.item_id)?.plan_id)?.active===false})),
  completed:closed.map(l=>({...l,label:items.get(l.item_id)?.label||'Care action',domain:items.get(l.item_id)?.domain})),
  activities:(data.events||[]).filter(e=>inPeriod(e.details?.recorded_at||e.occurred_at)).length,
  interventions:(data.audit||[]).filter(e=>inPeriod(e.created_at)&&['cancel','snooze','reopen'].includes(e.action)).length,
  reviews:(data.audit||[]).filter(e=>inPeriod(e.created_at)&&e.action==='review').length,
  rejectedPlans:(data.planActivity||[]).filter(e=>inPeriod(e.created_at)&&e.action==='reject').length,
  latestObservation:(data.observations||[]).filter(o=>Date.parse(o.observed_at)<cutoff).sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at))[0]||null};
}
export function paginate(items,page=0,size=20){const pages=Math.max(1,Math.ceil(items.length/size));const index=Math.min(Math.max(0,page),pages-1);return {items:items.slice(index*size,(index+1)*size),page:index,pages,total:items.length};}
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
