"""Live development-only verification. Reads local credentials; never prints tokens/passwords.
Run: python3 database/verify.py. Mutates synthetic fixture loops and then reopens them.
"""
import concurrent.futures,json,pathlib,re,urllib.request,urllib.error,uuid,datetime
root=pathlib.Path(__file__).resolve().parent.parent
config=(root/'db-config.js').read_text()
url=re.search("SUPABASE_URL='([^']+)'",config)[1]
key=re.search("SUPABASE_KEY='([^']+)'",config)[1]
accounts=json.loads((root/'.local/demo-accounts.json').read_text())
tokens={}
def request(path,role=None,data=None,method=None):
    headers={'apikey':key,'Content-Type':'application/json'}
    if role:headers['Authorization']='Bearer '+tokens[role]
    req=urllib.request.Request(url+path,headers=headers,data=json.dumps(data).encode() if data is not None else None,method=method or ('POST' if data is not None else 'GET'))
    try:
        with urllib.request.urlopen(req,timeout=30) as r:
            body=r.read();return r.status,json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        return e.code,json.loads(e.read())
def rpc(name,role,**data):return request('/rest/v1/rpc/'+name,role,data)
def action(loop,act,role,note='',event=None):return rpc('care_action',role,p_loop=loop,p_action=act,p_event_key=event or str(uuid.uuid4()),p_note=note)
def check(condition,description):
    if not condition:raise AssertionError(description)
    print('PASS:',description)
for a in accounts:
    status,data=request('/auth/v1/token?grant_type=password',data={'email':a['email'],'password':a['password']})
    check(status==200,'Real Auth password sign-in: '+a['role'])
    tokens[a['role']]=data['access_token']
status,ctx=rpc('my_context','patient');patient=ctx['memberships'][0]['patient_id']
for role in ('patient','clinician','coordinator'):
    status,rows=request('/rest/v1/patients?select=id',role)
    check(status==200 and len(rows)==1,'Assigned patient visible: '+role)
for table in ('patients','care_plans','care_plan_items','care_loops','evidence','audit_events','glucose_observations'):
    status,rows=request('/rest/v1/'+table+'?select=*','caregiver')
    check(status==200 and rows==[],'Caregiver denied clinical rows: '+table)
status,_=request('/rest/v1/patients?select=id')
check(status in (401,403),'Anonymous reads blocked')
status,_=request('/rest/v1/care_loops?id=not.is.null','patient',{'state':'CLOSED'},'PATCH')
check(status in (401,403),'Direct state mutation blocked')
status,rows=request('/rest/v1/patients?id=eq.'+str(uuid.uuid4()),'patient')
check(status==200 and rows==[],'Unassigned patient inaccessible')
_,loops=request('/rest/v1/care_loops?select=*','patient')
_,items=request('/rest/v1/care_plan_items?select=*','patient')
domains={i['id']:i['domain'] for i in items}
now=datetime.datetime.now(datetime.timezone.utc)
today={domains[l['item_id']]:l for l in loops if datetime.datetime.fromisoformat(l['due_at'])<=now}
tomorrow=[l for l in loops if datetime.datetime.fromisoformat(l['due_at'])>now]
check(len(today)==4 and len(tomorrow)==3,'Separate current and future occurrences seeded')
for l in tomorrow:
    status,_=action(l['id'],'complete','patient')
    check(status>=400,'Future occurrence cannot be completed early: '+domains[l['item_id']])
test=today['test']['id'];med=today['medication']['id']
for l in today.values():
    if l['state']=='CLOSED':
        status,_=action(l['id'],'reopen','clinician','Prepare repeatable synthetic verification.')
        check(status==200,'Prepare previously completed fixture')
_,prior_outbox=request('/rest/v1/message_outbox?select=id&loop_id=eq.'+test,'coordinator')
_,prior_audit=request('/rest/v1/audit_events?select=id','clinician')
status,_=action(test,'review','patient','Forged review')
check(status>=400,'Patient cannot approve evidence')
status,_=action(test,'support','coordinator')
check(status>=400,'Support requires reminder and consent')
event=str(uuid.uuid4())
with concurrent.futures.ThreadPoolExecutor(2) as pool:
    results=list(pool.map(lambda _:action(test,'remind','coordinator',event=event),range(2)))
check(all(s==200 for s,d in results) and results[0][1]==results[1][1],'Concurrent duplicate event is idempotent')
_,outbox=request('/rest/v1/message_outbox?select=id&loop_id=eq.'+test,'coordinator')
check(len(outbox)==len(prior_outbox)+1,'One outbox message for duplicate delivery attempt')
status,_=action(test,'support','coordinator')
check(status>=400,'No caregiver routing before consent')
status,_=rpc('demo_caregiver_consent','patient',p_patient=patient,p_granted=True,p_event_key=str(uuid.uuid4()))
check(status==200,'Patient grants caregiver consent')
status,_=action(test,'support','coordinator');check(status==200,'Coordinator routes consented support')
_,tasks=request('/rest/v1/support_tasks?select=*','caregiver');check(len(tasks)==1,'Caregiver sees only assigned support task')
status,_=rpc('demo_caregiver_consent','patient',p_patient=patient,p_granted=False,p_event_key=str(uuid.uuid4()))
_,tasks=request('/rest/v1/support_tasks?select=*','caregiver');check(status==200 and tasks==[],'Consent revocation immediately hides support tasks')
status,data=action(test,'evidence','patient');check(status==200 and data['state']=='REVIEW_PENDING','Evidence requires human review')
status,_=action(test,'review','coordinator','Attempt');check(status>=400,'Coordinator cannot approve reports')
status,_=action(test,'review','clinician',' ');check(status>=400,'Review requires a nonempty note')
status,data=action(test,'review','clinician','Synthetic evidence receipt checked in automated verification.')
check(status==200 and data['state']=='CLOSED','Clinician explicitly closes reviewed loop')
for d in ('medication','meals','glucose'):
    status,_=action(today[d]['id'],'complete','patient');check(status==200,'Patient confirms '+d)
_,future=request('/rest/v1/care_loops?select=*&state=neq.CLOSED','patient')
check(len(future)==3 and all(l['id'] in {x['id'] for x in tomorrow} for l in future),'Tomorrow remains open after completing today')
_,audit=request('/rest/v1/audit_events?select=*','clinician')
check(len(audit)>=len(prior_audit)+9 and all(a['actor_id'] for a in audit),'Server records actors and transitions')
for l in today.values():
    status,_=action(l['id'],'reopen','clinician','Reopen synthetic fixture after verification.')
    check(status==200,'Reopen fixture with recorded reason')
for role in tokens:request('/auth/v1/logout',role,data={})
print('All live checks passed. Test sessions signed out; synthetic loops reopened.')
