// Provider-neutral, no network calls. Real adapters remain gated by account/consent setup.
export const terminal=new Set(['delivered','cancelled']);
export function deliveryTransition(job,event,now=Date.now()){
 if(!event?.key)throw Error('Stable provider event key required');
 if(job.eventKeys?.includes(event.key))return job;
 const next={...job,eventKeys:[...(job.eventKeys||[]),event.key]};
 if(terminal.has(job.state))return next;
 const allowed=['accepted','delivered','failed','unknown'];if(!allowed.includes(event.status))throw Error('Unsupported delivery status');
 // A late accepted callback cannot undo a failure or uncertain send.
 if(event.status==='accepted'&&['failed','unknown'].includes(job.state))return next;
 next.state=event.status;next.providerId=event.providerId||job.providerId;
 next.retryAt=event.status==='failed'&&event.retryable&&!job.providerId&&job.attempts<3?now+Math.min(3600000,30000*2**job.attempts):null;
 return next;
}
export async function dispatch(job,adapter,{enabled=false,consented=false,now=Date.now(),reserve}={}){
 if(!enabled||!consented)return {...job,state:'blocked'};
 if(job.state!=='pending'||job.providerId||job.attempts>=3||job.notBefore>now)return job;
 if(typeof reserve!=='function')throw Error('Durable reservation required before provider call');
 const reserved=await reserve(job.id,job.version);if(!reserved)return job;
 try{const result=await adapter.send({...job,idempotencyKey:job.id});return {...job,state:'accepted',providerId:result.id,attempts:job.attempts+1};}
 catch{return {...job,state:'unknown',attempts:job.attempts+1,retryAt:null};} // Never retry an ambiguous send automatically.
}
export const fixtureAdapter={send:async job=>({id:'fixture-'+job.id})};
