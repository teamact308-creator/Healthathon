import {SUPABASE_URL,SUPABASE_KEY} from './db-config.js';
import {normalizeWorkspace} from './connected-model.mjs';
const sessionKey='wholecare-auth-session';let session=null,refreshing=null;
try{session=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}
function save(s){session=s;try{s?sessionStorage.setItem(sessionKey,JSON.stringify(s)):sessionStorage.removeItem(sessionKey);}catch{}}
async function raw(path,method='GET',body,token){const response=await fetch(SUPABASE_URL+path,{method,headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(path.startsWith('/functions/')?100000:20000)});const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch{throw Error('The database returned an unreadable response. Please retry.');}return {response,value};}
function error(value){return Error(value?.message||value?.error||value?.msg||value?.error_description||'Unable to connect to the database.');}
async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{if(!session?.refresh_token)throw Error('Please sign in.');const {response,value}=await raw('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token});if(!response.ok){save(null);throw error(value);}save(value);})().finally(()=>refreshing=null);return refreshing;}
export const hasSession=()=>!!session?.refresh_token;
export async function signIn(email,password){const {response,value}=await raw('/auth/v1/token?grant_type=password','POST',{email,password});if(!response.ok)throw error(value);save(value);}
export async function signOut(){const token=session?.access_token;save(null);if(token)try{await raw('/auth/v1/logout?scope=local','POST',{},token);}catch{}}
async function request(path,method='GET',body){if(!session)throw Error('Please sign in.');if(!session.expires_at||session.expires_at*1000<Date.now()+30000)await refresh();let r=await raw(path,method,body,session.access_token);if(r.response.status===401){await refresh();r=await raw(path,method,body,session.access_token);}if(!r.response.ok)throw error(r.value);return r.value;}
const rpc=(name,data={})=>request('/rest/v1/rpc/'+name,'POST',data);
const rows=(table,query='')=>request('/rest/v1/'+table+'?select=*'+query);
let membership=null;
export async function loadWorkspace(){const context=await rpc('my_context');membership=context?.memberships?.[0];if(!membership)throw Error('Your account has no assigned care workspace.');const profile=(await rows('profiles'))[0]??{};const patient=membership.patient_id;const filter='&patient_id=eq.'+encodeURIComponent(patient);
 if(membership.role==='caregiver'){const support=await rows('support_tasks',filter+'&order=created_at.desc');return {role:'Caregiver',state:normalizeWorkspace({items:[],loops:[],support,profile})};}
 const [items,loops,evidence,audit,messages,observations,plans,patients,caregivers,schedules,planActivity,events,extractions]=await Promise.all([
 rows('care_plan_items',filter),rows('care_loops',filter+'&order=due_at.asc'),rows('evidence',filter+'&order=created_at.desc'),rows('audit_events',filter+'&order=created_at.desc&limit=100'),rows('message_outbox',filter+'&order=created_at.asc'),rows('glucose_observations',filter+'&order=observed_at.desc&limit=2000'),rows('care_plans',filter),rows('patients','&id=eq.'+patient),rpc('caregiver_support_context',{p_patient:patient}),rows('plan_schedules',filter),rows('plan_activity',filter+'&order=created_at.desc&limit=100'),rows('care_events',filter+'&order=occurred_at.desc&limit=200'),rows('plan_extractions',filter+'&order=created_at.desc&limit=100')]);
 return {role:membership.role[0].toUpperCase()+membership.role.slice(1),state:normalizeWorkspace({items,loops,evidence,audit,messages,observations,plans,patients,caregivers,profile,schedules,planActivity,rawItems:items,events,rawEvidence:evidence,extractions})};
}
export async function careAction(loop,action,note=''){return rpc('care_action',{p_loop:loop,p_action:action,p_note:note,p_event_key:crypto.randomUUID()});}
export async function setConsent(caregiver,granted){return rpc('set_caregiver_consent',{p_patient:membership.patient_id,p_caregiver:caregiver,p_granted:granted,p_event_key:crypto.randomUUID()});}
export async function savePlan(id,data){return rpc('save_care_plan',{p_patient:membership.patient_id,p_plan:id,p_data:data});}
export async function reviewPlan(id,action,note){return rpc('review_care_plan',{p_plan:id,p_action:action,p_note:note});}
export async function reminderPreference(enabled){return rpc('set_reminder_preference',{p_patient:membership.patient_id,p_enabled:enabled});}
export async function uploadPrivate(bucket,file){
 if(!session)throw Error('Please sign in.');if(session.expires_at*1000<Date.now()+30000)await refresh();
 const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','audio/webm':'webm','audio/mpeg':'mp3','audio/wav':'wav','audio/mp4':'m4a'}[file.type];
 if(!ext||file.size>8388608)throw Error('Use a supported file of up to 8 MB.');
 const path=membership.patient_id+'/'+crypto.randomUUID()+'.'+ext;
 const response=await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file,signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Private upload failed. Check your role, file type and size.');return path;
}
export async function privateFile(bucket,path){const result=await request(`/storage/v1/object/sign/${bucket}/${path}`,'POST',{expiresIn:120});return SUPABASE_URL+'/storage/v1'+result.signedURL;}
export async function extractPlan(data){return request('/functions/v1/plan-extract','POST',{patient_id:membership.patient_id,...data});}
export async function logActivity(loop,status,details,event){return rpc('log_care_activity',{p_loop:loop,p_status:status,p_details:details,p_event:event});}
export async function submitReport(loop,path,label,event){return request('/functions/v1/report-submit','POST',{patient_id:membership.patient_id,loop_id:loop,source_path:path,label,event_key:event});}
export async function transcribeVoice(path,language){return request('/functions/v1/voice-transcribe','POST',{patient_id:membership.patient_id,source_path:path,language});}
export async function importGlucose(readings){return rpc('import_synthetic_glucose',{p_patient:membership.patient_id,p_rows:readings});}

export async function manageLoop(loop,action,due,note,event){return rpc("manage_care_loop",{p_loop:loop,p_action:action,p_due:due,p_note:note,p_event:event});}
export async function confirmPlan(id,data,note){return rpc('confirm_care_plan',{p_patient:membership.patient_id,p_plan:id,p_data:data,p_note:note});}
