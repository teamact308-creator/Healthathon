// Synthetic-only identity setup. No emails, phone enrollment, password resets or real-patient access.
const origins=new Set(['https://healthathon.vercel.app','http://localhost:4173']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin');const cors=origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});if(req.method!=='POST')return reply(405,{error:'POST required'});
 const authorization=req.headers.get('authorization');if(!authorization?.startsWith('Bearer '))return reply(401,{error:'Sign in required'});
 const url=Deno.env.get('SUPABASE_URL')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const headers={apikey:pub,Authorization:authorization,'Content-Type':'application/json'};const admin={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 try{
  const raw=await req.text();if(raw.length>2048)return reply(413,{error:'Request too large'});const input=JSON.parse(raw);
  if(!/^[0-9a-f-]{36}$/i.test(input.request_id||'')||!['rehearsal','patient_login'].includes(input.kind)||input.synthetic_only!==true||typeof input.password!=='string'||input.password.length<20||input.password.length>128)return reply(400,{error:'Synthetic request and strong generated password required'});
  const user=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});if(!user.ok)return reply(401,{error:'Sign in required'});
  const reserve=await fetch(url+'/rest/v1/rpc/reserve_demo_provision',{method:'POST',headers,body:JSON.stringify({p_id:input.request_id,p_parent:input.parent_id,p_kind:input.kind,p_target:input.target_id||null}),signal:AbortSignal.timeout(10000)});
  if(!reserve.ok)return reply(403,{error:'Synthetic provisioning not permitted or quota reached'});if(!(await reserve.json()).reserved)return reply(409,{error:'Request already reserved. Use the saved local credentials; do not repeat provisioning.'});
  const roles=input.kind==='rehearsal'?['patient','clinician','coordinator','caregiver']:['patient'];
  const accounts=[];
  for(const role of roles){
   const email=role+'-'+input.request_id+'@wholecare.test';
   const created=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:admin,body:JSON.stringify({email,password:input.password,email_confirm:true,app_metadata:{synthetic_rehearsal:input.request_id}}),signal:AbortSignal.timeout(15000)});
   if(!created.ok)return reply(503,{error:'Synthetic identity setup interrupted. Preserve the request ID for operator reconciliation.'});
   const identity=await created.json();accounts.push({role,email,id:identity.id});
  }
  const linked=await fetch(url+'/rest/v1/rpc/complete_demo_provision',{method:'POST',headers:admin,body:JSON.stringify({p_id:input.request_id}),signal:AbortSignal.timeout(10000)});
  if(!linked.ok)return reply(503,{error:'Identity linking interrupted; no access should be assumed. Preserve the request ID.'});
  return reply(200,{...await linked.json(),accounts});
 }catch{return reply(503,{error:'Synthetic setup unavailable. Keep the request ID and check before retrying.'});}
});
