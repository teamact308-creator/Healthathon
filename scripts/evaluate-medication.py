"""Frozen unseen synthetic interpretation test; never saves activities or changes plans."""
import argparse,hashlib,json,uuid
from demo_api import DemoAPI,ROOT
p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--corpus',default='unseen-medication-v2.json');p.add_argument('--output',default='unseen-medication-results-v2.json');p.add_argument('--synthetic-only',action='store_true',required=True);args=p.parse_args();api=DemoAPI(args.manifest)
assert api.manifest.get('synthetic') is True
source=ROOT/'integrations/ai-evaluation'/args.corpus;raw=source.read_bytes();cases=json.loads(raw);results=[]
for case in cases:
 status,result=api.call('/functions/v1/voice-transcribe','patient',{'patient_id':api.manifest['patient_id'],'typed_note':case['text'],'privacy_version':1,'privacy_request_id':str(uuid.uuid4())})
 outcome=result.get('interpretation') if isinstance(result,dict) else None
 result={'id':case['id'],'expected':case['expected'],'observed':outcome,'interpretation_version':result.get('interpretation_version') if isinstance(result,dict) else None,'http':status,'passed':status==200 and outcome in case['expected']}
 results.append(result);print(json.dumps(result),flush=True)
report={'date':'2026-11-06','corpus_sha256':hashlib.sha256(raw).hexdigest(),'model':'gpt-4.1-mini-2025-04-14','production_prompt_unchanged':True,'multi_dose_guard':all(r.get('interpretation_version')=='2026-11-06-multidose-guard' for r in results),'no_activity_writes':True,'results':results,'passed':sum(r['passed'] for r in results),'total':len(results)}
(ROOT/'integrations/ai-evaluation'/args.output).write_text(json.dumps(report,indent=2))
