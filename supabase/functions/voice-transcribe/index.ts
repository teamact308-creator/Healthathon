import {interpretMedication} from './interpret.mjs';
const origins = new Set(['https://healthathon.vercel.app','http://localhost:4173']);
const model = 'gpt-4o-mini-transcribe';
Deno.serve(async(req: Request) => {
 const started=Date.now();
 const origin=req.headers.get('origin');
 const cors=origin && origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'POST required'},405);
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return json({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!,key=Deno.env.get('OPENAI_API_KEY');
 const headers={apikey:pub,Authorization:auth,'Content-Type':'application/json'};
 try{
 const u=await fetch(`${url}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)});if(!u.ok)return json({error:'Sign in required'},401);const user=await u.json();
 if(Number(req.headers.get('content-length'))>30000)return json({error:'Input too large'},413);
 const input=await req.json();if(!/^[0-9a-f-]{36}$/i.test(input.patient_id||''))return json({error:'Patient required'},400);
 const c=await fetch(`${url}/rest/v1/rpc/my_context`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});const context=await c.json();
 if(!c.ok||!context.memberships?.some((m:{patient_id:string;role:string})=>m.patient_id===input.patient_id&&['patient','clinician'].includes(m.role)))return json({error:'Assigned patient or clinician required'},403);
 if(!key)return json({error:'Transcription is not configured'},503);
 const path=input.source_path;
 if(typeof path!=='string'||!path.startsWith(input.patient_id+'/')||path.includes('..'))return json({error:'Invalid recording path'},400);
 if(!['en','hi'].includes(input.language))return json({error:'Choose English or Hindi'},400);
 const file=await fetch(`${url}/storage/v1/object/authenticated/voice-notes/${path}`,{headers,signal:AbortSignal.timeout(15000)});
 if(!file.ok)return json({error:'Recording not accessible'},400);
 const bytes=await file.arrayBuffer();if(bytes.byteLength>8388608)return json({error:'Recording exceeds 8 MB'},413);
 const form=new FormData();form.append('file',new Blob([bytes],{type:file.headers.get('content-type')||'audio/webm'}),path.split('/').pop()!);form.append('model',model);form.append('language',input.language);form.append('response_format','json');
 const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:form,signal:AbortSignal.timeout(90000)});
 if(!response.ok)return json({error:'Transcription unavailable. You can type the activity instead.',provider_status:response.status},502);
 const result=await response.json();
 const text=typeof result.text==='string'?result.text:'';
 const interpretation=input.interpret_medication===true&&text.trim()&&text.length<=2000&&Date.now()-started<83000?await interpretMedication(text,key):null;
 return json({text,language:input.language,source_path:path,requires_confirmation:true,interpretation});
 }catch{return json({error:'Transcription failed. Type the activity or try another audio file.'},503);}
});
