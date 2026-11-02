// Server-only orchestration contract. Not deployed, scheduled or included in the browser build.
// Repository implementation must use private.claim_delivery and private.delivery_result.
// Claim must atomically check current consent, verified enrollment, channel gate and due task.
export function createDeliveryWorker({repository,adapters,enabled=false}){
 if(!repository||typeof repository.claim!=='function'||typeof repository.result!=='function')throw Error('Durable delivery repository required');
 return async function deliver(candidate){
  if(!enabled)return {state:'disabled'};
  const adapter=adapters?.[candidate.channel];if(!adapter)return {state:'unsupported'};
  const job=await repository.claim(candidate.id,candidate.version);
  if(!job)return {state:'not_claimed'};
  if(job.id!==candidate.id||job.channel!==candidate.channel||job.state!=='reserved'||job.attempts<1)throw Error('Invalid durable reservation; reconcile');
  let result;
  try{result=await adapter.send(job);if(typeof result?.id!=='string'||!result.id)throw Error('Missing provider identity');}
  catch{await repository.result(job.id,'attempt:'+job.id+':'+job.attempts,'unknown',null);return {state:'unknown'};}
  // If persistence fails after sending, leave the durable reservation for reconciliation.
  // Never send again merely because the response/result could not be recorded.
  await repository.result(job.id,'attempt:'+job.id+':'+job.attempts,'accepted',result.id);
  return {state:'accepted'};
 };
}
const statusMap={queued:'accepted',accepted:'accepted',sending:'accepted',sent:'accepted',delivered:'delivered',read:'delivered',failed:'failed',undelivered:'failed'};
// validateRequest must be the official Twilio SDK validator with the exact external URL.
export function createStatusHandler({url,accountSid,authToken,validateRequest,repository,enabled=false}){
 if(!/^https:\/\//.test(url||'')||!accountSid||!authToken||typeof validateRequest!=='function'||typeof repository?.findProvider!=='function'||typeof repository?.result!=='function')throw Error('Complete callback configuration required');
 const reject=status=>new Response('Request rejected',{status,headers:{'Cache-Control':'no-store'}});
 return async request=>{
  if(!enabled)return reject(503);
  if(request.method!=='POST')return reject(405);
  if(request.url!==url)return reject(403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/x-www-form-urlencoded'))return reject(415);
  const signature=request.headers.get('x-twilio-signature');if(!signature)return reject(403);
  const reader=request.body?.getReader();if(!reader)return reject(400);
  try{
   const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return reject(413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const params=Object.create(null);for(const [key,value] of new URLSearchParams(new TextDecoder().decode(bytes))){if(Object.hasOwn(params,key))return reject(400);params[key]=value;}
   if(!validateRequest(authToken,signature,url,params)||params.AccountSid!==accountSid)return reject(403);
   if(!/^(SM|MM)[a-f0-9]{32}$/i.test(params.MessageSid||'')||!Object.hasOwn(statusMap,params.MessageStatus))return reject(400);
   // Provider identity must resolve to an existing reserved/accepted job; never accept a job id from caller input.
   const job=await repository.findProvider(params.MessageSid);if(!job)return reject(409);
   await repository.result(job.id,'status:'+params.MessageSid+':'+params.MessageStatus,statusMap[params.MessageStatus],params.MessageSid);
   return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
  }catch{return reject(503);} // No body, phone, signature, token or raw provider errors are logged.
 };
}
