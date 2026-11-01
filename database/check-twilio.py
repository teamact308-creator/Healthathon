"""Validate the saved backend secret without reading it or sending patient data."""
import json,pathlib,re,urllib.request,urllib.error
root=pathlib.Path(__file__).resolve().parent.parent
config=(root/'db-config.js').read_text()
url=re.search("SUPABASE_URL='([^']+)'",config)[1]
key=re.search("SUPABASE_KEY='([^']+)'",config)[1]
accounts=json.loads((root/'.local/demo-accounts.json').read_text())
def call(path,body,token=None):
    headers={'apikey':key,'Content-Type':'application/json'}
    if token:headers['Authorization']='Bearer '+token
    request=urllib.request.Request(url+path,data=json.dumps(body).encode(),headers=headers,method='POST')
    try:
        with urllib.request.urlopen(request,timeout=60) as response:
            content=response.read();return response.status,json.loads(content) if content else None
    except urllib.error.HTTPError as e:
        return e.code,json.loads(e.read())
status,_=call('/functions/v1/twilio-connection-check',{})
assert status==401, 'Unauthenticated diagnostic must be blocked'
print('PASS: unauthenticated access blocked',flush=True)
for role in ('patient','clinician'):
    a=next(a for a in accounts if a['role']==role)
    status,session=call('/auth/v1/token?grant_type=password',{'email':a['email'],'password':a['password']})
    assert status==200,'Test sign-in failed: '+role
    token=session['access_token']
    try:
        status,result=call('/functions/v1/twilio-connection-check',{},token)
        print(json.dumps({'role':role,'status':status,'result':result}),flush=True)
        assert status==(403 if role=='patient' else 200),'Unexpected diagnostic result'
        if role=='clinician':assert result.get('connected') is True,'Twilio did not accept the configured key'
    finally:
        call('/auth/v1/logout?scope=local',{},token)
print('PASS: saved Twilio key accepted; no messages sent.')
