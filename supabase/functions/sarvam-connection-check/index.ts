import {authorizeTransfer} from '../_shared/ai-transfer.mjs';
const origins=new Set(['https://healthathon.vercel.app','http://localhost:4173']);
const fixtures=new Map([
 ['c7914bcd06765704f0f54a4b434519bca71039afb95f7e66f39e375604570b9a','en-IN'],
 ['a2767d6a58817b2bf0873448665145c6e2caf56cfed2e98de45b347395d9228b','hi-IN']
]);
Deno.serve(async request=>{
 const origin=request.headers.get('origin');
 const cors=origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply(405,{error:'POST required'});
 const authorization=request.headers.get('authorization');
 if(!authorization?.startsWith('Bearer '))return reply(401,{error:'Sign in required'});
 const url=Deno.env.get('SUPABASE_URL')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!,key=Deno.env.get('SARVAM_API_KEY');
 const headers={apikey:pub,Authorization:authorization,'Content-Type':'application/json'};
 try{
  const auth=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!auth.ok)return reply(401,{error:'Sign in required'});
  const input=await request.json();
  if(!/^[0-9a-f-]{36}$/i.test(input.patient_id||''))return reply(400,{error:'Patient required'});
  const context=await fetch(url+'/rest/v1/rpc/my_context',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});
  if(!context.ok)return reply(403,{error:'Workspace required'});
  if(!(await context.json()).memberships?.some((m:{patient_id:string;role:string})=>m.patient_id===input.patient_id&&m.role==='clinician'))return reply(403,{error:'Assigned clinician required'});
  const patient=await fetch(url+'/rest/v1/patients?select=id&id=eq.'+input.patient_id+'&synthetic=eq.true',{headers,signal:AbortSignal.timeout(10000)});
  if(!patient.ok||!(await patient.json()).length)return reply(403,{error:'Demo workspace required'});
  if(input.operation==='status')return reply(200,{configured:!!key,provider:'sarvam',model:'saaras:v3',mode:'transcribe'});
  if(!key)return reply(503,{error:'SARVAM_API_KEY is not configured'});
  if(input.operation!=='transcribe'||input.synthetic_only!==true||input.approved!==true)return reply(400,{error:'Explicit synthetic trial approval required'});
  const path=input.source_path;
  if(typeof path!=='string'||!path.startsWith(input.patient_id+'/')||path.includes('..'))return reply(400,{error:'Invalid recording path'});
  const file=await fetch(url+'/storage/v1/object/authenticated/voice-notes/'+path,{headers,signal:AbortSignal.timeout(15000)});
  if(!file.ok)return reply(403,{error:'Recording unavailable'});
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength>200000)return reply(413,{error:'Only bundled short synthetic fixtures are accepted'});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const language=fixtures.get(hash);
  if(!language)return reply(400,{error:'Recording is not a bundled synthetic test fixture'});
  await authorizeTransfer({url,headers,input,operation:'transcription',kind:'audio'});
  const form=new FormData();
  form.append('file',new Blob([bytes],{type:'audio/wav'}),'synthetic-fixture.wav');
  form.append('model','saaras:v3');form.append('mode','transcribe');form.append('language_code',language);
  const started=Date.now();
  const response=await fetch('https://api.sarvam.ai/speech-to-text',{method:'POST',headers:{'api-subscription-key':key},body:form,signal:AbortSignal.timeout(60000)});
  if(!response.ok)return reply(502,{error:'Sarvam did not accept the trial request',provider_status:response.status});
  const result=await response.json();
  if(typeof result.transcript!=='string'||!result.transcript.trim())return reply(502,{error:'Sarvam returned no transcript'});
  return reply(200,{provider:'sarvam',model:'saaras:v3',mode:'transcribe',language,fixture_hash:hash,transcript:result.transcript,elapsed_ms:Date.now()-started,trial_only:true});
 }catch{return reply(503,{error:'Sarvam trial unavailable'});}
});
