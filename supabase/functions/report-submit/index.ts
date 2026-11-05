import {inspectDocument,scopedObjectPath} from '../_shared/file-safety.mjs';
const origins = new Set(['https://healthathon.vercel.app','http://localhost:4173']);
const model = 'gpt-4o-mini-transcribe';
Deno.serve(async(req: Request) => {
 const origin=req.headers.get('origin');
 const cors=origin && origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{};
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'POST required'},405);
 const auth=req.headers.get('authorization');if(!auth?.startsWith('Bearer '))return json({error:'Sign in required'},401);
 const url=Deno.env.get('SUPABASE_URL')!,pub=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('OPENAI_API_KEY');
 const headers={apikey:pub,Authorization:auth,'Content-Type':'application/json'};
 try{
 const u=await fetch(`${url}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)});if(!u.ok)return json({error:'Sign in required'},401);const user=await u.json();
 if(Number(req.headers.get('content-length'))>30000)return json({error:'Input too large'},413);
 const input=await req.json();if(!/^[0-9a-f-]{36}$/i.test(input.patient_id||''))return json({error:'Patient required'},400);
 const c=await fetch(`${url}/rest/v1/rpc/my_context`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});const context=await c.json();
 if(!c.ok||!context.memberships?.some((m:{patient_id:string;role:string})=>m.patient_id===input.patient_id&&m.role==='patient'))return json({error:'Assigned patient required'},403);
 const path=input.source_path;
 if(!scopedObjectPath(input.patient_id,path)||typeof input.loop_id!=='string'||!input.event_key)return json({error:'Invalid report request'},400);
 const loops=await fetch(`${url}/rest/v1/care_loops?id=eq.${encodeURIComponent(input.loop_id)}&patient_id=eq.${input.patient_id}&select=id`,{headers,signal:AbortSignal.timeout(5000)});
 if(!loops.ok||!(await loops.json()).length)return json({error:'Task not accessible'},403);
 const file=await fetch(`${url}/storage/v1/object/authenticated/care-evidence/${path}`,{headers:{apikey:service,Authorization:`Bearer ${service}`},signal:AbortSignal.timeout(15000)});
 if(!file.ok)return json({error:'Private report not found'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.length>8388608||bytes.length<5)return json({error:'Invalid report size'},400);
 const screen=inspectDocument(bytes,file.headers.get('content-type')||'');if(!screen.ok)return json({error:screen.reason},415);
 const pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-',png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!pdf&&!png&&!jpeg)return json({error:'Report must contain a valid PDF, PNG or JPEG file'},415);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const result=await fetch(`${url}/rest/v1/rpc/register_verified_report`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:JSON.stringify({p_actor:user.id,p_loop:input.loop_id,p_path:path,p_hash:hash,p_label:String(input.label||'Uploaded fictional report').slice(0,200),p_event:input.event_key}),signal:AbortSignal.timeout(10000)});
 if(!result.ok)return json({error:'Report could not be attached. Check that the task is due, active and has no report already.'},409);
 return json(await result.json());
 }catch{return json({error:'Report submission failed. Refresh to check whether it was saved before retrying.'},503);}
});
