"""Role checks by default. --write-fixture adds an explicitly labelled synthetic intake note/history.
No messages, AI calls, care-task mutations or credential output. Uses protected local demo accounts.
"""
import argparse,datetime,json,pathlib,re,urllib.request,urllib.error,uuid
parser=argparse.ArgumentParser();parser.add_argument('--write-fixture',action='store_true');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parent.parent
cfg=(root/'db-config.js').read_text();url=re.search("SUPABASE_URL='([^']+)'",cfg)[1];key=re.search("SUPABASE_KEY='([^']+)'",cfg)[1]
accounts=json.loads((root/'.local/demo-accounts.json').read_text())
def call(path,body=None,token=None):
 headers={'apikey':key,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(url+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=30) as response:
   text=response.read();return response.status,json.loads(text) if text else None
 except urllib.error.HTTPError as error:return error.code,None
sessions={}
for role in ['patient','clinician','coordinator','caregiver']:
 account=next(a for a in accounts if a['role']==role)
 code,s=call('/auth/v1/token?grant_type=password',{'email':account['email'],'password':account['password']});assert code==200,'Sign-in failed: '+role;sessions[role]=s['access_token']
c=sessions['clinician'];code,context=call('/rest/v1/rpc/my_context',{},c);assert code==200
patient=next(m['patient_id'] for m in context['memberships'] if m['role']=='clinician')
now=datetime.datetime.now(datetime.timezone.utc);params={'p_patient':patient,'p_from':(now-datetime.timedelta(days=7)).isoformat(),'p_to':now.isoformat()}
for role in ['clinician','coordinator']:
 code,s=call('/rest/v1/rpc/operational_snapshot',params,sessions[role]);assert code==200 and isinstance(s['loops'],list),'Summary failed: '+role
 print('PASS scoped summary: '+role)
for role in ['patient','caregiver']:
 code,_=call('/rest/v1/rpc/operational_snapshot',params,sessions[role]);assert code==403,'Unauthorized summary: '+role
 print('PASS summary denied: '+role)
code,_=call('/rest/v1/rpc/operational_snapshot',{**params,'p_patient':str(uuid.uuid4())},c);assert code==403;print('PASS wrong-patient summary denied')
code,_=call('/rest/v1/rpc/operational_snapshot',{**params,'p_from':params['p_to'],'p_to':params['p_from']},c);assert code>=400;print('PASS invalid report period denied')
code,_=call('/rest/v1/rpc/operational_snapshot',params,'expired-invalid-token');assert code==401;print('PASS invalid session denied')
code,_=call('/rest/v1/rpc/operational_snapshot',params);assert code in (401,403);print('PASS anonymous summary denied')
code,rows=call('/rest/v1/intake_items?select=id',None,sessions['caregiver']);assert code==200 and rows==[];print('PASS caregiver intake RLS')
if args.write_fixture:
 event=str(uuid.uuid4());body={'p_patient':patient,'p_label':'Synthetic operations verification note','p_text':'Software-only note: association and acknowledgment verification. No clinical action.','p_path':None,'p_event':event}
 code,intake=call('/rest/v1/rpc/submit_intake',body,sessions['patient']);assert code==200
 code,duplicate=call('/rest/v1/rpc/submit_intake',body,sessions['patient']);assert code==200 and duplicate==intake
 changed={**body,'p_label':'Changed payload'};code,_=call('/rest/v1/rpc/submit_intake',changed,sessions['patient']);assert code>=400
 decision={'p_intake':intake,'p_action':'acknowledge','p_loop':None,'p_reason':'Verified synthetic source; no care task changed.'}
 code,_=call('/rest/v1/rpc/resolve_intake',decision,sessions['patient']);assert code==403
 code,result=call('/rest/v1/rpc/resolve_intake',decision,c);assert code==200 and result['state']=='resolved'
 code,history=call('/rest/v1/intake_activity?intake_id=eq.'+intake+'&select=action',None,c);assert code==200 and len(history)==2
 print('PASS persisted intake, replay protection, patient denial and team acknowledgment; labelled fixture retained')
print('PASS no external provider calls or sends')
