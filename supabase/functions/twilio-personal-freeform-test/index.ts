// WholeCare clinician-only, one-time Twilio Sandbox self-test.
// Fixed synthetic copy and configured recipient. No patient data or bulk delivery.
const cors={'Access-Control-Allow-Origin':'https://healthathon.vercel.app','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info'};
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{...cors,'Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'POST only'},405);
 const bearer=req.headers.get('Authorization');
 if(!bearer?.startsWith('Bearer '))return reply({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const anon=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!service||!anon)return reply({error:'Backend unavailable'},503);
 const h={apikey:anon,Authorization:bearer,'Content-Type':'application/json'};
 try{
  const [u,c]=await Promise.all([fetch(url+'/auth/v1/user',{headers:h,signal:AbortSignal.timeout(10000)}),fetch(url+'/rest/v1/rpc/my_context',{method:'POST',headers:h,body:'{}',signal:AbortSignal.timeout(10000)})]);
  if(!u.ok||!c.ok)return reply({error:'Sign-in required'},401);
  const user=await u.json(),ctx=await c.json();
  if(!ctx.memberships?.some((m:{role?:string})=>m.role==='clinician'))return reply({error:'Clinician required'},403);
  const input=await req.json().catch(()=>null);
  if(!input||Array.isArray(input)||!['status','send'].includes(input.action)||Object.keys(input).some(k=>!['action','confirmed'].includes(k))||input.action==='send'&&input.confirmed!==true)return reply({error:'Unsupported action'},400);
  const [account,key,secret,from,to]=['TWILIO_PERSONAL_ACCOUNT_SID','TWILIO_PERSONAL_API_KEY_SID','TWILIO_PERSONAL_API_KEY_SECRET','TWILIO_PERSONAL_WHATSAPP_FROM','TWILIO_PERSONAL_WHATSAPP_TO'].map(x=>Deno.env.get(x)?.trim()||'');
  if(!/^AC[0-9a-f]{32}$/i.test(account)||!/^SK[0-9a-f]{32}$/i.test(key)||!secret||from!=='whatsapp:+14155238886'||!/^whatsapp:\+[1-9][0-9]{7,14}$/.test(to))return reply({error:'Sandbox secrets invalid'},503);
  const dbh={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const ledger=url+'/rest/v1/twilio_test_sends',testKey='personal_whatsapp_freeform_20261103';
  const get=async()=>{
    const r=await fetch(ledger+'?test_key=eq.'+testKey+'&select=state,message_sid,provider_status,error_code',{headers:dbh,signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw Error('Ledger unavailable');
    return (await r.json())[0]??null;
  };
  const patch=async(v:Record<string,unknown>)=>{
    const r=await fetch(ledger+'?test_key=eq.'+testKey,{method:'PATCH',headers:dbh,body:JSON.stringify(v),signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw Error('Ledger unavailable');
  };
  const basic={Authorization:'Basic '+btoa(key+':'+secret)};
  const endpoint='https://api.twilio.com/2010-04-01/Accounts/'+account+'/Messages';
  let existing=await get();
  if(input.action==='status'){
    if(!existing)return reply({state:'not_started'});
    if(/^(SM|MM)[0-9a-f]{32}$/i.test(existing.message_sid||'')){
      const r=await fetch(endpoint+'/'+existing.message_sid+'.json',{headers:basic,signal:AbortSignal.timeout(10000)});
      if(r.ok){
       const p=await r.json();existing.provider_status=p.status;existing.error_code=p.error_code||null;
       await patch({provider_status:existing.provider_status,error_code:existing.error_code});
      }
    }
    return reply(existing);
  }
  if(existing)return reply({state:existing.state,duplicate_suppressed:true},409);
  const claimed=await fetch(ledger+'?on_conflict=test_key',{method:'POST',headers:{...dbh,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({test_key:testKey,actor_id:user.id,state:'reserved'}),signal:AbortSignal.timeout(5000)});
  if(!claimed.ok)return reply({error:'Reservation unavailable'},503);
  if(!(await claimed.json()).length)return reply({duplicate_suppressed:true,state:(await get())?.state},409);
  const message='WholeCare | Your Care Companion\n\nHello Anita! This is a personalized demonstration for a fictional WholeCare patient.\n\nAn activity is waiting in your care plan. Sign in securely to review it: https://healthathon.vercel.app/\n\nThis is a demo message, not medical advice.';
  let r:Response;
  try{
    r=await fetch(endpoint+'.json',{method:'POST',headers:{...basic,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:from,To:to,Body:message}),signal:AbortSignal.timeout(15000),redirect:'error'});
  }catch{
    await patch({state:'unknown'});
    return reply({state:'unknown',error:'Outcome uncertain; no retry permitted'},504);
  }
  const result=await r.json().catch(()=>({}));
  if(!r.ok){
    await patch({state:'rejected',error_code:typeof result.code==='number'?result.code:null});
    return reply({state:'rejected',error_code:result.code??null},502);
  }
  if(!/^(SM|MM)[0-9a-f]{32}$/i.test(result.sid||'')){
    await patch({state:'unknown'});return reply({state:'unknown'},502);
  }
  await patch({state:'submitted',message_sid:result.sid,provider_status:result.status??'queued'});
  return reply({state:'submitted',provider_status:result.status??'queued',message_sid:result.sid});
 }catch{return reply({error:'Request could not be completed; no automatic retry'},503)}
});