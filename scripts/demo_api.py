"""Private-credential synthetic test transport. Never logs payloads, tokens or passwords."""
import json,pathlib,re,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parent.parent
class DemoAPI:
 def __init__(self,manifest):
  self.manifest=json.loads(pathlib.Path(manifest).read_text());cfg=(ROOT/'db-config.js').read_text()
  self.base=re.search("SUPABASE_URL='([^']+)'",cfg)[1];self.key=re.search("SUPABASE_KEY='([^']+)'",cfg)[1];self.tokens={}
  for account in self.manifest['accounts']:
   status,session=self.call('/auth/v1/token?grant_type=password',body={'email':account['email'],'password':account['password']})
   if status!=200:raise RuntimeError('Synthetic '+account['role']+' sign-in failed with HTTP '+str(status))
   self.tokens[account['role']]=session['access_token']
 def call(self,path,role=None,body=None,method=None,mime='application/json'):
  headers={'apikey':self.key,'Content-Type':mime}
  if role:headers['Authorization']='Bearer '+self.tokens[role]
  data=body if isinstance(body,bytes) else json.dumps(body).encode() if body is not None else None
  req=urllib.request.Request(self.base+path,data=data,headers=headers,method=method or ('POST' if body is not None else 'GET'))
  try:
   with urllib.request.urlopen(req,timeout=100) as r:
    raw=r.read();return r.status,json.loads(raw) if raw and 'json' in r.headers.get('content-type','') else raw
  except urllib.error.HTTPError as e:
   try:data=json.loads(e.read())
   except Exception:data=None
   return e.code,data
 def rpc(self,name,role,**body):return self.call('/rest/v1/rpc/'+name,role,body)
