const origins=new Set(['https://healthathon.vercel.app','http://localhost:4173']);
Deno.serve(async request=>{
 const origin=request.headers.get('origin');
 const cors=origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply(405,{error:'POST required'});
 const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!;
 const admin={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
 const rpc=(name:string,body:unknown)=>fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:admin,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 try{
  const workerToken=request.headers.get('x-retention-token');
  if(workerToken){
   const claimed=await rpc('claim_voice_retention',{p_token:workerToken});
   if(!claimed.ok)return reply(403,{error:'Worker access denied'});
   const jobs=await claimed.json();let removed=0,failed=0;
   for(const job of jobs){
    const deletion=await fetch(url+'/storage/v1/object/voice-notes',{method:'DELETE',headers:admin,body:JSON.stringify({prefixes:[job.path]}),signal:AbortSignal.timeout(15000)});
    if(!deletion.ok){failed++;continue;}
    const result=await rpc('finish_voice_retention',{p_token:workerToken,p_path:job.path});
    if(result.ok)removed++;else failed++;
   }
   return reply(200,{removed,failed});
  }
  const authorization=request.headers.get('authorization');
  if(!authorization)return reply(401,{error:'Sign in required'});
  const headers={apikey:pub,Authorization:authorization,'Content-Type':'application/json'};
  const auth=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return reply(401,{error:'Sign in required'});
  const input=await request.json();
  if(input.operation!=='install')return reply(400,{error:'Unknown operation'});
  const context=await fetch(url+'/rest/v1/rpc/my_context',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});
  if(!context.ok)return reply(403,{error:'Workspace required'});
  const memberships=(await context.json()).memberships||[];
  if(!memberships.some((m:{patient_id:string;role:string})=>m.patient_id===input.patient_id&&m.role==='clinician'))return reply(403,{error:'Assigned clinician required'});
  const patient=await fetch(url+'/rest/v1/patients?select=id&id=eq.'+encodeURIComponent(input.patient_id)+'&synthetic=eq.true',{headers,signal:AbortSignal.timeout(10000)});
  if(!patient.ok||!(await patient.json()).length)return reply(403,{error:'Demo workspace required'});
  const bytes=crypto.getRandomValues(new Uint8Array(48));
  const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  if(!service.startsWith('eyJ'))return reply(503,{error:'A JWT scheduler credential must be configured before cleanup can be enabled.'});
  const installed=await rpc('install_voice_retention_worker',{p_token:token,p_url:url,p_anon:service});
  return installed.ok?reply(200,{scheduled:true}):reply(503,{error:'Retention scheduler unavailable'});
 }catch{return reply(503,{error:'Retention operation could not be completed'});}
});
