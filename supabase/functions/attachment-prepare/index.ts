import {attachmentReference,prepareAttachment,boundedDocument} from '../_shared/attachment-preparation.mjs';
const origins=new Set(['https://healthathon.vercel.app','http://localhost:4173']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin');const cors=origin&&origins.has(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const reply=(status:number,value:unknown)=>Response.json(value,{status,headers:{...cors,'Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return reply(200,{});if(req.method!=='POST')return reply(405,{error:'POST required'});
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return reply(401,{error:'Sign in required'});
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;const headers={apikey:key,Authorization:auth,'Content-Type':'application/json'};
 try{
  if(Number(req.headers.get('content-length'))>4096)return reply(413,{error:'Request too large'});
  const u=await fetch(url+'/auth/v1/user',{headers,signal:AbortSignal.timeout(10000)});if(!u.ok)return reply(401,{error:'Sign in required'});
  const input=JSON.parse(new TextDecoder().decode(await boundedDocument(new Response(req.body),4096)));if(!attachmentReference(input.patient_id,input.bucket,input.source_path))return reply(400,{error:'Choose a document in this patient workspace'});
  const context=await fetch(url+'/rest/v1/rpc/my_context',{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});const data=await context.json();
  if(!context.ok||!data.memberships?.some((m:{patient_id:string;role:string})=>m.patient_id===input.patient_id&&['patient','clinician','coordinator'].includes(m.role)))return reply(403,{error:'Assigned access required'});
  // The caller's JWT enforces private object policies; association precedes preparation.
  const file=await fetch(url+'/storage/v1/object/authenticated/'+input.bucket+'/'+input.source_path,{headers,signal:AbortSignal.timeout(15000)});
  if(!file.ok)return reply(file.status===403?403:404,{error:'Private document unavailable'});
  return reply(200,await prepareAttachment(file));
 }catch{return reply(415,{error:'This document could not be safely prepared. Use a plain PDF, PNG or JPEG up to 8 MB. No care task changed.'});}
});
