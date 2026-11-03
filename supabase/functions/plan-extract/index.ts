import {extractionSchema, extractionContract, validateProposal} from '../_shared/vcpi.mjs';
const origins = new Set(['https://healthathon.vercel.app','http://localhost:4173']);
const model = 'gpt-4.1-mini-2025-04-14';
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
 const input=await req.json();if(input.synthetic_only!==true)return json({error:'Synthetic-only acknowledgement required'},400);if(!/^[0-9a-f-]{36}$/i.test(input.patient_id||''))return json({error:'Patient required'},400);
 const c=await fetch(`${url}/rest/v1/rpc/my_context`,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(10000)});const context=await c.json();
 if(!c.ok||!context.memberships?.some((m:{patient_id:string;role:string})=>m.patient_id===input.patient_id&&m.role==='clinician'))return json({error:'Assigned clinician required'},403);
 const patientCheck=await fetch(`${url}/rest/v1/patients?id=eq.${input.patient_id}&select=synthetic`,{headers,signal:AbortSignal.timeout(5000)});if(!patientCheck.ok||(await patientCheck.json())[0]?.synthetic!==true)return json({error:'Synthetic patient required'},403);
 if(!key)return json({error:'AI is not configured. You can still enter the plan manually.'},503);
 let sourceFingerprint='';
 const path=input.source_path||null,text=String(input.text||'').trim();if(text.length>20000)return json({error:'Source note is too long'},400);
 const content:Record<string,unknown>[]=[{type:'input_text',text:`Extract only explicit care tasks from this fictional source. Source text:\n${text||'(uploaded file)'}`}];
 if(path){
 if(typeof path!=='string'||!path.startsWith(input.patient_id+'/')||path.includes('..'))return json({error:'Invalid source path'},400);
 const file=await fetch(`${url}/storage/v1/object/authenticated/plan-documents/${path}`,{headers:{apikey:pub,Authorization:auth},signal:AbortSignal.timeout(15000)});
 if(!file.ok)return json({error:'Unable to read the private source document'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length>8388608)return json({error:'File exceeds 8 MB'},413);
 const pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!pdf&&!png&&!jpeg)return json({error:'Use a valid PDF, PNG or JPEG source'},415);
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
 sourceFingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const data=btoa(binary);
 content.push(pdf?{type:'input_file',filename:'fictional-prescription.pdf',file_data:'data:application/pdf;base64,'+data}:{type:'input_image',image_url:`data:image/${png?'png':'jpeg'};base64,${data}`});
 }else if(!text)return json({error:'Upload a source document or enter a source note'},400);
 const rate=await fetch(`${url}/rest/v1/plan_extractions?actor_id=eq.${user.id}&created_at=gte.${new Date(Date.now()-86400000).toISOString()}&select=id&limit=20`,{headers:{apikey:service,Authorization:`Bearer ${service}`},signal:AbortSignal.timeout(5000)});
 if(!rate.ok)return json({error:'Unable to check extraction allowance'},503);if((await rate.json()).length>=20)return json({error:'Daily demo extraction limit reached. Use manual entry.'},429);
 const schema=extractionSchema;
 const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model,store:false,max_output_tokens:5000,instructions:extractionContract,input:[{role:'user',content}],text:{format:{type:'json_schema',name:'care_plan_proposal',strict:true,schema}}})});
 if(!upstream.ok)return json({error:'AI extraction is unavailable. Enter the plan manually or retry later.',provider_status:upstream.status},502);
 const response=await upstream.json();if(response.status!=='completed')return json({error:'Extraction was incomplete; use manual entry or retry'},502);
 const answer=response.output?.flatMap((o:{content?:{type:string;text?:string}[]})=>o.content||[]).find((v:{type:string})=>v.type==='output_text')?.text;
 if(!answer)return json({error:'AI could not extract a proposal. Use manual entry.'},422);
 const proposal=JSON.parse(answer);proposal.validation=validateProposal(proposal,{text,document:!!path});proposal.contract_version=1;proposal.source_fingerprint=sourceFingerprint||Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');const id=crypto.randomUUID();
 const saved=await fetch(`${url}/rest/v1/plan_extractions`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:JSON.stringify({id,patient_id:input.patient_id,actor_id:user.id,source_path:path,source_text:text,model,proposal}),signal:AbortSignal.timeout(5000)});
 if(!saved.ok)return json({error:'Unable to retain extraction provenance; no plan was activated'},503);
 return json({id,model,proposal});
 }catch{return json({error:'Extraction timed out or failed. No plan was activated; manual entry remains available.'},503);}
});
