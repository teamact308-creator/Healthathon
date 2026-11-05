"""Evaluate frozen synthetic multi-action proposals; never saves activities."""
import json,uuid,argparse,hashlib
from demo_api import DemoAPI,ROOT
p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--synthetic-only',action='store_true',required=True);p.add_argument('--output',default='log-actions-v1-results.json');a=p.parse_args();api=DemoAPI(a.manifest);assert api.manifest['synthetic'];raw=(ROOT/'integrations/ai-evaluation/log-actions-v1.json').read_bytes();out=[]
for case in json.loads(raw):
 status,data=api.call('/functions/v1/voice-transcribe','patient',{'patient_id':api.manifest['patient_id'],'activity_note':case['text'],'privacy_version':1,'privacy_request_id':str(uuid.uuid4())})
 actions=data.get('actions') or [];observed=sorted([[x.get('domain'),x.get('status'),x.get('kind')] for x in actions]);result={'id':case['id'],'expected':sorted(case['expected']),'observed':observed,'passed':status==200 and observed==sorted(case['expected']),'http':status,'version':data.get('interpretation_version')};out.append(result);print(json.dumps(result),flush=True)
(ROOT/'integrations/ai-evaluation'/a.output).write_text(json.dumps({'date':'2026-11-06','corpus_sha256':hashlib.sha256(raw).hexdigest(),'no_care_writes':True,'results':out,'passed':sum(x['passed'] for x in out),'total':len(out)},indent=2))
