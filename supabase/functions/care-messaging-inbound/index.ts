import twilio from 'npm:twilio@5.10.3';
import {inboundProposal} from '../_shared/inbound-proposal.mjs';
Deno.serve(async request=>{
 const reject=(status:number)=>new Response('Request rejected',{status,headers:{'Cache-Control':'no-store'}});
 if(Deno.env.get('CARE_INBOUND_ENABLED')!=='true')return reject(503);
 if(request.method!=='POST'||request.url!==Deno.env.get('CARE_TWILIO_INBOUND_URL'))return reject(403);
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return reject(415);
 try{
  if(Number(request.headers.get('content-length'))>65536)return reject(413);
  const reader=request.body?.getReader();if(!reader)return reject(400);const chunks=[];let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return reject(413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const raw=new TextDecoder().decode(bytes);const params:Record<string,string>=Object.create(null);
  for(const [key,value] of new URLSearchParams(raw)){if(Object.hasOwn(params,key))return reject(400);params[key]=value;}
  const signature=request.headers.get('x-twilio-signature');if(!signature||params.AccountSid!==Deno.env.get('TWILIO_ACCOUNT_SID')||!twilio.validateRequest(Deno.env.get('TWILIO_AUTH_TOKEN'),signature,request.url,params))return reject(403);
  const from=params.From,channel=from?.startsWith('whatsapp:')?'whatsapp':'sms';if(!from||!(channel==='whatsapp'?/^whatsapp:\+[1-9]\d{7,14}$/:/^\+[1-9]\d{7,14}$/).test(from))return reject(400);
  const body=params.Body?.trim();if(!body||body.length>2000)return reject(400);
  // Media bytes are not fetched from caller URLs. Portal upload retains existing file review controls.
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,url=Deno.env.get('SUPABASE_URL')!;
  const response=await fetch(url+'/rest/v1/rpc/stage_inbound_proposal',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_channel:channel,p_sender:from,p_provider:params.MessageSid,p_text:body,p_proposal:inboundProposal(body),p_reply_provider:params.OriginalRepliedMessageSid||null}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return reject(response.status===403?403:409);
  return new Response('<Response/>',{status:200,headers:{'Content-Type':'text/xml','Cache-Control':'no-store'}});
 }catch{return reject(503);}
});
