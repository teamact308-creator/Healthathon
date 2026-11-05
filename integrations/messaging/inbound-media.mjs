// Prepared adapter only. No route invokes this while external messaging is on hold.
import {inspectDocument} from '../../supabase/functions/_shared/file-safety.mjs';
export async function retrieveReportMedia({enabled=false,accountSid,messageSid,mediaSid,authorization,request=fetch,maxBytes=8*1024*1024}){
 if(!enabled)return {state:'disabled'};
 if(!/^AC[0-9a-f]{32}$/i.test(accountSid||'')||!/^(SM|MM)[0-9a-f]{32}$/i.test(messageSid||'')||!/^ME[0-9a-f]{32}$/i.test(mediaSid||'')||typeof authorization!=='string'||!authorization.startsWith('Basic ')||maxBytes<1||maxBytes>8*1024*1024)throw Error('Invalid media reference');
 // Construct the one permitted provider URL; never accept an inbound arbitrary URL.
 const url=`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/${mediaSid}`;
 try{
  const response=await request(url,{headers:{Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok||response.redirected)throw Error('Media unavailable');
  const mime=response.headers.get('content-type')?.split(';')[0].trim();
  if(!['application/pdf','image/png','image/jpeg'].includes(mime)||Number(response.headers.get('content-length'))>maxBytes||!response.body)throw Error('Unsupported media');
  const reader=response.body.getReader();const chunks=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maxBytes)throw Error('Media too large');chunks.push(part.value);}}catch(error){await reader.cancel();throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const extension={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[mime];
  if(!inspectDocument(bytes,mime).ok)throw Error('Unsupported media');
  return {state:'screened_requires_private_upload_and_patient_review',bytes,mime,extension};
 }catch{throw Error('Media could not be safely retrieved');}
}
