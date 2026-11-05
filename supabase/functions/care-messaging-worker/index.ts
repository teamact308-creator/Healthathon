import {createDeliveryRepository} from '../../../delivery-repository.mjs';
import {createDeliveryWorker} from '../../../messaging-service.mjs';
import {createTwilioAdapter} from '../../../twilio-adapter.mjs';
Deno.serve(async req=>{
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!service||req.headers.get('authorization')!=='Bearer '+service)return reply(403,{error:'Service invocation required'});
 // Independent deployment opt-in and per-channel database gates must both allow dispatch.
 if(Deno.env.get('CARE_MESSAGING_ENABLED')!=='true')return reply(200,{state:'disabled',sent:0});
 const url=Deno.env.get('SUPABASE_URL')!;const repository=createDeliveryRepository({url,serviceKey:service});
 try{
  const candidates=await repository.candidates();const adapters:Record<string,unknown>={};
  for(const channel of ['whatsapp','sms']){
   if(!candidates.some((j:{channel:string})=>j.channel===channel))continue;
   const from=Deno.env.get(channel==='whatsapp'?'TWILIO_WHATSAPP_FROM':'TWILIO_SMS_FROM');
   adapters[channel]=createTwilioAdapter({channel,accountSid:Deno.env.get('TWILIO_ACCOUNT_SID'),apiKeySid:Deno.env.get('TWILIO_API_KEY_SID'),apiKeySecret:Deno.env.get('TWILIO_API_KEY_SECRET'),from,contentSid:Deno.env.get('CARE_WHATSAPP_CONTENT_SID'),approvedSmsBody:Deno.env.get('CARE_SMS_APPROVED_BODY'),resolveRecipient:(p:string,c:string)=>repository.recipient(p,c)});
  }
  const deliver=createDeliveryWorker({repository,adapters,enabled:true});const states=[];
  for(const candidate of candidates)states.push(await deliver(candidate));
  return reply(200,{processed:states.length,accepted:states.filter(s=>s.state==='accepted').length,unknown:states.filter(s=>s.state==='unknown').length});
 }catch{return reply(503,{error:'Dispatch paused; inspect durable reservations before retrying.'});}
});
