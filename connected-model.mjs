const domains={medication:['med','Medication'],meals:['meal','Meals'],glucose:['cgm','Glucose data'],test:['test','Tests']};
const title=s=>s?s[0].toUpperCase()+s.slice(1):'';
export function normalizeWorkspace({items,loops,evidence=[],audit=[],messages=[],observations=[],plans=[],patients=[],support=[],profile={},caregivers=[]},now=Date.now()){
 const itemMap=new Map(items.map(i=>[i.id,i]));
 const decorate=l=>{const i=itemMap.get(l.item_id);if(!i)return null;const [id,domain]=domains[i.domain]??[i.domain,i.domain];return {id,loopId:l.id,domain,label:i.label,time:new Date(l.due_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:patients[0]?.timezone??'Asia/Kolkata'}),dueAt:l.due_at,state:l.state,owner:title(l.next_owner),reminded:!!l.reminded_at,reviewNote:l.review_note,evidence:['REVIEW_PENDING','CLOSED'].includes(l.state)?evidence.find(e=>e.loop_id===l.id)?.label:null,detail:i.domain==='test'?'Attach the sample report, then send it for clinician review.':i.domain==='glucose'?'Sample readings from the shared database · availability only.':'Record your activity from the agreed care plan.'};};
 const current=loops.filter(l=>Date.parse(l.due_at)<=now).sort((a,b)=>Date.parse(a.due_at)-Date.parse(b.due_at));
 const allMap=new Map(loops.map(l=>[l.id,l]));
 return {items:current.map(decorate).filter(Boolean),upcoming:loops.filter(l=>Date.parse(l.due_at)>now).map(decorate).filter(Boolean),
 audit:audit.map(a=>({label:itemMap.get(allMap.get(a.loop_id)?.item_id)?.label??'Caregiver support consent',action:a.action,role:title(a.actor_role),from:a.previous_state??'—',to:a.next_state??'—',note:a.note,at:a.created_at})),
 messages:messages.map(m=>({text:m.body,to:title(m.recipient_role),at:m.created_at,status:m.delivery_status})),observations,plans,patient:patients[0],profile,supportTasks:support.filter(t=>t.status==='open'),caregivers,consent:caregivers[0]?.granted??false};
}
