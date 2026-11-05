import {authorizeTransfer} from '../_shared/ai-transfer.mjs';
import {fixtures,model,messages,validExtraction} from '../_shared/filly-trial.mjs';
const origins=new Set(['https://healthathon.vercel.app','http://localhost:4173']);
Deno.serve(async request=>{
 const origin=request.headers.get('origin');
 const cors=origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply(405,{error:'POST required'});
 if(Number(request.headers.get('content-length'))>4096)return reply(413,{error:'Request too large'});
 const auth=request.headers.get('authorization');
 if(!auth?.startsWith('Bearer '))return reply(401,{error:'Sign in required'});
 const url=Deno.env.get('SUPABASE_URL')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!,openai=Deno.env.get('OPENAI_API_KEY'),sarvam=Deno.env.get('SARVAM_API_KEY');
 const headers={apikey:pub,Authorization:auth,'Content-Type':'application/json'};
 try{
  const user=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});
  if(!user.ok)return reply(401,{error:'Sign in required'});
  const input=await request.json();
  if(!/^[0-9a-f-]{36}$/i.test(input.patient_id||''))return reply(400,{error:'Patient required'});
  const context=await fetch(url+'/rest/v1/rpc/my_context',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});
  if(!context.ok||!(await context.json()).memberships?.some((m:{patient_id:string;role:string})=>m.patient_id===input.patient_id&&m.role==='clinician'))return reply(403,{error:'Assigned clinician required'});
  const patient=await fetch(url+'/rest/v1/patients?select=id&id=eq.'+input.patient_id+'&synthetic=eq.true',{headers,signal:AbortSignal.timeout(10000)});
  if(!patient.ok||!(await patient.json()).length)return reply(403,{error:'Synthetic workspace required'});
  if(input.synthetic_only!==true||input.approved!==true||!['sarvam','openai'].includes(input.provider))return reply(400,{error:'Approve the fixed synthetic trial'});
  if(!openai||input.provider==='sarvam'&&!sarvam)return reply(503,{error:'Trial provider not configured'});
  const path=input.source_path;
  if(typeof path!=='string'||!path.startsWith(input.patient_id+'/')||path.includes('..'))return reply(400,{error:'Invalid source'});
  const file=await fetch(url+'/storage/v1/object/authenticated/voice-notes/'+path,{headers,signal:AbortSignal.timeout(15000)});
  if(!file.ok)return reply(403,{error:'Source unavailable'});
  const bytes=await file.arrayBuffer();
  if(bytes.byteLength>200000)return reply(413,{error:'Only short fixed fixtures are accepted'});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const fixture=fixtures.find(f=>f.sha256===hash);
  if(!fixture)return reply(400,{error:'Source is not a frozen synthetic fixture'});
  await authorizeTransfer({url,headers,input,operation:'transcription',kind:'audio'});
  const audio=new FormData();audio.append('file',new Blob([bytes],{type:'audio/wav'}),'synthetic-fixture.wav');
  const sarvamFlow=input.provider==='sarvam';
  audio.append('model',sarvamFlow?'saaras:v3':'gpt-4o-mini-transcribe');
  if(sarvamFlow){audio.append('mode','transcribe');audio.append('language_code',fixture.language+'-IN');}
  else{audio.append('language',fixture.language);audio.append('response_format','json');}
  const asrStart=Date.now();
  const asr=await fetch(sarvamFlow?'https://api.sarvam.ai/speech-to-text':'https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:sarvamFlow?{'api-subscription-key':sarvam!}:{Authorization:'Bearer '+openai},body:audio,signal:AbortSignal.timeout(45000)});
  if(!asr.ok)return reply(502,{error:'Trial transcription failed',provider_status:asr.status});
  const raw=await asr.json();const transcript=sarvamFlow?raw.transcript:raw.text;
  const asrMs=Date.now()-asrStart;
  if(typeof transcript!=='string'||!transcript.trim()||transcript.length>2000)return reply(502,{error:'No bounded transcript returned'});
  const extractionStart=Date.now();
  const extracted=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+openai,'Content-Type':'application/json'},body:JSON.stringify({model,messages:messages(transcript),temperature:0,response_format:{type:'json_object'},store:false,max_tokens:1000}),signal:AbortSignal.timeout(30000)});
  if(!extracted.ok)return reply(502,{error:'Trial extraction failed',provider_status:extracted.status});
  const output=await extracted.json();
  let data=null;try{data=JSON.parse(output.choices?.[0]?.message?.content||'');}catch{}
  return reply(200,{fixture:fixture.id,fixture_hash:hash,provider:input.provider,asr_model:sarvamFlow?'saaras:v3':'gpt-4o-mini-transcribe',mode:'transcribe',language:fixture.language,transcript,extraction_model:model,extraction_valid:validExtraction(data,transcript),data,asr_ms:asrMs,extraction_ms:Date.now()-extractionStart,trial_only:true});
 }catch{return reply(503,{error:'Synthetic trial unavailable'});}
});
