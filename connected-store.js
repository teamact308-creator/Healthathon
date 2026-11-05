import {reviewAITransfer,clearAITransfers} from './ai-privacy-ui.js';
import {SUPABASE_URL,SUPABASE_KEY} from './db-config.js';
import {normalizeWorkspace} from './connected-model.mjs';
const sessionKey='wholecare-auth-session';let session=null,refreshing=null;
try{session=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}
function save(s){session=s;if(!s){clearAITransfers();membership=null;historyLimits={audit:100,events:200,observations:2000,planActivity:100,extractions:100,failures:100,delivery:100};}try{s?sessionStorage.setItem(sessionKey,JSON.stringify(s)):sessionStorage.removeItem(sessionKey);}catch{}}
async function raw(path,method='GET',body,token){const response=await fetch(SUPABASE_URL+path,{method,headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(path.startsWith('/functions/')?100000:20000)});const text=await response.text();let value;try{value=text?JSON.parse(text):null;}catch{throw Error('The database returned an unreadable response. Please retry.');}return {response,value};}
function error(value){return Error(value?.message||value?.error||value?.msg||value?.error_description||'Unable to connect to the database.');}
async function refresh(){if(refreshing)return refreshing;refreshing=(async()=>{if(!session?.refresh_token)throw Error('Please sign in.');const {response,value}=await raw('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token});if(!response.ok){save(null);throw error(value);}save(value);})().finally(()=>refreshing=null);return refreshing;}
export const hasSession=()=>!!session?.refresh_token;
export async function signIn(email,password){save(null);const {response,value}=await raw('/auth/v1/token?grant_type=password','POST',{email,password});if(!response.ok)throw error(value);save(value);}
export async function signOut(){const token=session?.access_token;save(null);if(token)try{await raw('/auth/v1/logout?scope=local','POST',{},token);}catch{}}
async function baseRequest(path,method='GET',body){if(!session)throw Error('Please sign in.');if(!session.expires_at||session.expires_at*1000<Date.now()+30000)await refresh();let r=await raw(path,method,body,session.access_token);if(r.response.status===401){await refresh();r=await raw(path,method,body,session.access_token);}if(!r.response.ok)throw error(r.value);return r.value;}
async function request(path,method='GET',body){
 try{return await baseRequest(path,method,body);}catch(e){
  if(!path.includes('record_processing_failure')&&path.startsWith('/functions/'))await recordFailure(path.includes('plan-extract')?'extraction':path.includes('voice-transcribe')?'transcription':'report',e.name==='TimeoutError'?'timeout':e instanceof TypeError?'network':'rejected');
  throw e;
 }
}
const rpc=(name,data={})=>request('/rest/v1/rpc/'+name,'POST',data);
const rows=(table,query='')=>request('/rest/v1/'+table+'?select=*'+query);
async function allRows(table,query=''){
 const out=[];for(let offset=0;offset<50000;offset+=500){const page=await rows(table,query+'&limit=500&offset='+offset);out.push(...page);if(page.length<500)return out;}
 throw Error('Workspace exceeds the current loading limit. Narrow the data scope before continuing.');
}
let membership=null,historyLimits={audit:100,events:200,observations:2000,planActivity:100,extractions:100,failures:100,delivery:100};
async function historyRows(table,filter,time,limit){
 const result=[];let cursor='';
 while(result.length<limit){const size=Math.min(500,limit-result.length),page=await rows(table,filter+'&order='+time+'.desc,id.desc&limit='+size+cursor);result.push(...page);if(page.length<size)break;const last=page.at(-1);cursor='&or='+encodeURIComponent('('+time+'.lt.'+last[time]+',and('+time+'.eq.'+last[time]+',id.lt.'+last.id+'))');}
 return result;
}
export function expandHistory(kind){if(!Object.hasOwn(historyLimits,kind))throw Error('Unknown history view');if(historyLimits[kind]>=50000)throw Error('Export or narrow this history before loading more than 50,000 records.');historyLimits[kind]=Math.min(50000,historyLimits[kind]+(kind==='observations'?2000:200));}
export async function loadWorkspace(){const context=await rpc('my_context');membership=context?.memberships?.[0];if(!membership)throw Error('Your account has no assigned care workspace.');const profile=(await rows('profiles'))[0]??{};const patient=membership.patient_id;const filter='&patient_id=eq.'+encodeURIComponent(patient);
 if(membership.role==='caregiver'){const support=await rows('support_tasks',filter+'&order=created_at.desc');return {role:'Caregiver',state:normalizeWorkspace({items:[],loops:[],support,profile})};}
 const [items,loops,evidence,audit,messages,observations,plans,patients,caregivers,schedules,planActivity,events,extractions,intake,intakeActivity,failures,delivery,health,contextEntries,policies,corrections]=await Promise.all([
 allRows('care_plan_items',filter+'&order=id.asc'),allRows('care_loops',filter+'&order=due_at.asc,id.asc'),allRows('evidence',filter+'&order=created_at.desc,id.asc'),historyRows('audit_events',filter,'created_at',historyLimits.audit),allRows('message_outbox',filter+'&order=created_at.asc,id.asc'),historyRows('glucose_observations',filter,'observed_at',historyLimits.observations),allRows('care_plans',filter+'&order=id.asc'),rows('patients','&id=eq.'+patient),rpc('caregiver_support_context',{p_patient:patient}),allRows('plan_schedules',filter+'&order=item_id.asc'),historyRows('plan_activity',filter,'created_at',historyLimits.planActivity),historyRows('care_events',filter,'occurred_at',historyLimits.events),historyRows('plan_extractions',filter,'created_at',historyLimits.extractions),allRows('intake_items',filter+'&order=created_at.desc,id.asc'),allRows('intake_activity',filter+'&order=created_at.asc,id.asc'),historyRows('processing_events',filter,'created_at',historyLimits.failures),historyRows('delivery_jobs',filter,'created_at',historyLimits.delivery),['clinician','coordinator'].includes(membership.role)?rpc('operational_health',{p_patient:patient}):Promise.resolve(null),allRows('patient_context_entries',filter+'&order=observed_at.desc,id.asc'),allRows('workflow_policy_versions',filter+'&order=created_at.desc,id.desc'),allRows('activity_corrections',filter+'&order=created_at.desc,id.asc')]);
 return {role:membership.role[0].toUpperCase()+membership.role.slice(1),state:normalizeWorkspace({items,loops,evidence,audit,messages,observations,plans,patients,caregivers,profile,schedules,planActivity,rawItems:items,events,rawEvidence:evidence,extractions,intake,intakeActivity,failures,delivery,health,contextEntries,policies,corrections,historyLimits:{...historyLimits}})};
}
export async function careAction(loop,action,note='',event=crypto.randomUUID()){return rpc('care_action',{p_loop:loop,p_action:action,p_note:note,p_event_key:event});}
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
export async function extractPlan(data){const input=await approveAITransfer({patient_id:membership.patient_id,...data},{file:!!data.source_path});return request('/functions/v1/plan-extract','POST',input);}
export async function logActivity(loop,status,details,event){return rpc('log_care_activity',{p_loop:loop,p_status:status,p_details:details,p_event:event});}
export async function submitReport(loop,path,label,event){return request('/functions/v1/report-submit','POST',{patient_id:membership.patient_id,loop_id:loop,source_path:path,label,event_key:event});}
export async function transcribeVoice(path,language,interpretMedication=false){return request('/functions/v1/voice-transcribe','POST',await approveAITransfer({patient_id:membership.patient_id,source_path:path,language,interpret_medication:interpretMedication},{audio:true}));}
export async function importGlucose(readings){return rpc('import_synthetic_glucose',{p_patient:membership.patient_id,p_rows:readings});}

export async function manageLoop(loop,action,due,note,event){return rpc("manage_care_loop",{p_loop:loop,p_action:action,p_due:due,p_note:note,p_event:event});}
export async function confirmPlan(id,data,note){return rpc('confirm_care_plan',{p_patient:membership.patient_id,p_plan:id,p_data:data,p_note:note});}

export const operationalSnapshot=(from,to)=>rpc('operational_snapshot',{p_patient:membership.patient_id,p_from:from,p_to:to});
export const submitIntake=(label,text,path,event)=>rpc('submit_intake',{p_patient:membership.patient_id,p_label:label,p_text:text,p_path:path,p_event:event});
export const resolveIntake=(id,action,loop,reason)=>rpc('resolve_intake',{p_intake:id,p_action:action,p_loop:loop,p_reason:reason});
export const resolveFailure=id=>rpc('resolve_processing_failure',{p_id:id});
export async function recordFailure(operation,code,event=crypto.randomUUID()){
 if(!membership||!session)return;
 try{await rpc('record_processing_failure',{p_patient:membership.patient_id,p_operation:operation,p_code:code,p_event:event});}catch{} // Logging must not hide the original error.
}

export const recordContext=(kind,time,value,unit,source,previous,reason,key)=>rpc('record_patient_context',{p_patient:membership.patient_id,p_kind:kind,p_time:time,p_value:value,p_unit:unit,p_source:source,p_previous:previous,p_reason:reason,p_key:key});
export const saveWorkflowPolicy=(policy,previous,reason,key)=>rpc('save_workflow_policy',{p_patient:membership.patient_id,p_policy:policy,p_previous:previous,p_reason:reason,p_key:key});
export const correctActivity=(id,expected,status,note,time,reason,key)=>rpc('correct_care_activity',{p_id:id,p_expected:expected,p_status:status,p_note:note,p_time:time,p_reason:reason,p_key:key});

// Re-authenticate with the current password before a signed-in password change.
export async function changeOwnPassword(current,password,confirmation){
 if(password!==confirmation||password.length<12||password.length>128)throw Error('Use matching passwords of 12–128 characters.');
 if(!session)throw Error('Sign in first.');
 const {response:identityResponse,value:user}=await raw('/auth/v1/user','GET',undefined,session.access_token);
 if(!identityResponse.ok||!user?.email)throw Error('Your session has expired. Sign in again.');
 const {response,value}=await raw('/auth/v1/token?grant_type=password','POST',{email:user.email,password:current});
 if(!response.ok||value?.user?.id!==user.id)throw Error('Current password was not accepted.');
 const updated=await raw('/auth/v1/user','PUT',{password},value.access_token);
 if(!updated.response.ok){try{await raw('/auth/v1/logout?scope=local','POST',{},value.access_token);}catch{}throw Error('Password could not be updated. Choose a different password or sign in again.');}
 try{await raw('/auth/v1/logout?scope=global','POST',{},value.access_token);}finally{save(null);}
}

// Clinician-only transport diagnostic; the server enforces clinical membership.
// This does not send a message or change messaging channel settings.
export async function checkPersonalTwilioConnection() {
  return request('/functions/v1/twilio-personal-connection-check', 'POST', {});
}

export const sendPersonalWhatsAppTest=(action,confirmed=false)=>request('/functions/v1/twilio-personal-freeform-test','POST',action==='send'?{action,confirmed}:{action});

export async function interpretMedicationNote(note){return request('/functions/v1/voice-transcribe','POST',await approveAITransfer({patient_id:membership.patient_id,typed_note:note}));}

export const requestActivityHelp=(loop,text,event)=>rpc('request_activity_help',{p_loop:loop,p_text:text,p_event:event});

export const suggestActivityNote=async note=>request('/functions/v1/voice-transcribe','POST',await approveAITransfer({patient_id:membership.patient_id,activity_note:note}));

export const updateHelpThread=(id,action,message,event)=>rpc('update_help_thread',{p_request:id,p_action:action,p_text:message,p_event:event});

export async function suggestVisitNotes(ids){
 const notes=await baseRequest('/rest/v1/care_events?select=id,details&patient_id=eq.'+membership.patient_id+'&id=in.('+ids.join(',')+')');
 const input=await approveAITransfer({patient_id:membership.patient_id,ids},{notes:notes.map(note=>({id:note.id,text:note.details?.note||''}))});
 return request('/functions/v1/visit-note-picks','POST',input);
}

async function approveAITransfer(input,{audio=false,file=false,notes=null}={}){
 const current=membership;
 if(!current||!session)throw Error('Sign in before using AI.');
 const [patients,profiles]=await Promise.all([baseRequest('/rest/v1/patients?select=display_name&id=eq.'+current.patient_id),baseRequest('/rest/v1/profiles?select=display_name')]);
 const names=[patients[0]?.display_name,profiles[0]?.display_name].filter(Boolean);
 const reviewed=await reviewAITransfer({text:input.text||input.typed_note||input.activity_note||'',audio,file,notes,names,maxLength:Object.hasOwn(input,'text')?20000:2000});
 if(membership!==current||!session)throw Error('Your workspace changed. Review the AI transfer again.');
 const approval={privacy_version:reviewed.privacy_version,privacy_request_id:reviewed.privacy_request_id};
 if(audio)return {...input,...approval};
 if(notes)return {...input,...approval,ids:reviewed.ids};
 const field=Object.hasOwn(input,'text')?'text':Object.hasOwn(input,'typed_note')?'typed_note':'activity_note';
 return {...input,...approval,[field]:reviewed.text,...(file?{source_path:reviewed.includeFile?input.source_path:null}:{})};
}

export const listVoiceRecordings=()=>rpc('unused_voice_recordings',{p_patient:membership.patient_id});
export async function removeVoiceRecording(path){const patient=membership.patient_id;await rpc('prepare_voice_removal',{p_patient:patient,p_path:path});await request('/storage/v1/object/voice-notes','DELETE',{prefixes:[path]});}
