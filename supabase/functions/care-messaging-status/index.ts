import twilio from 'npm:twilio@5.10.3';
import {createDeliveryRepository} from '../../../delivery-repository.mjs';
import {createStatusHandler} from '../../../messaging-service.mjs';
Deno.serve(async request=>{
 if(Deno.env.get('CARE_CALLBACKS_ENABLED')!=='true')return new Response('Disabled',{status:503});
 try{
  const repository=createDeliveryRepository({url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')});
  return await createStatusHandler({enabled:true,url:Deno.env.get('CARE_TWILIO_STATUS_URL'),accountSid:Deno.env.get('TWILIO_ACCOUNT_SID'),authToken:Deno.env.get('TWILIO_AUTH_TOKEN'),validateRequest:twilio.validateRequest,repository})(request);
 }catch{return new Response('Callback unavailable',{status:503});}
});
