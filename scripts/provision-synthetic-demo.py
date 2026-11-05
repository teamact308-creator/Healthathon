"""Create isolated .test identities through the protected demo endpoint; never send invitations.
Writes generated credentials only to a mode-0600 .local manifest. Does not reset existing accounts.
"""
import argparse,json,pathlib,re,secrets,uuid,urllib.request,urllib.error
root=pathlib.Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--synthetic-only',action='store_true',required=True);parser.add_argument('--target-patient');parser.add_argument('--credentials',default=str(root/'.local/demo-accounts.json'));args=parser.parse_args()
cfg=(root/'db-config.js').read_text();base=re.search("SUPABASE_URL='([^']+)'",cfg)[1];key=re.search("SUPABASE_KEY='([^']+)'",cfg)[1]
def call(path,body,token=None):
 headers={'apikey':key,'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 request=urllib.request.Request(base+path,data=json.dumps(body).encode(),headers=headers)
 try:
  with urllib.request.urlopen(request,timeout=90) as response:return json.load(response)
 except urllib.error.HTTPError as error:raise RuntimeError('Setup request failed with HTTP '+str(error.code)) from None
operator=next(a for a in json.loads(pathlib.Path(args.credentials).read_text()) if a['role'].lower()=='clinician')
session=call('/auth/v1/token?grant_type=password',{'email':operator['email'],'password':operator['password']});token=session['access_token']
context=call('/rest/v1/rpc/my_context',{},token);parent=next(m['patient_id'] for m in context['memberships'] if m['role']=='clinician')
request_id=str(uuid.uuid4());password=secrets.token_urlsafe(30);kind='patient_login' if args.target_patient else 'rehearsal'
folder=root/'.local/rehearsals';folder.mkdir(exist_ok=True);destination=folder/(request_id+'.json')
manifest={'request_id':request_id,'kind':kind,'password':password,'state':'reserved locally','target_id':args.target_patient}
destination.write_text(json.dumps(manifest,indent=2));destination.chmod(0o600)
result=call('/functions/v1/demo-provision',{'request_id':request_id,'parent_id':parent,'kind':kind,'target_id':args.target_patient,'synthetic_only':True,'password':password},token)
manifest.update(result,state='ready');manifest['accounts']=[dict(a,password=password) for a in result['accounts']];destination.write_text(json.dumps(manifest,indent=2));destination.chmod(0o600)
print(json.dumps({'manifest':str(destination),'kind':kind,'patient_id':result['patient_id'],'identities':len(result['accounts'])}))
