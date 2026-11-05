"""Isolated synthetic PDF extraction and recorded-source acceptance; not clinical validation."""
import argparse,json,uuid,datetime,pathlib
from demo_api import DemoAPI,ROOT
from synthetic_files import pdf
p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--resume',action='store_true');p.add_argument('--synthetic-only',action='store_true',required=True);a=p.parse_args();api=DemoAPI(a.manifest);patient=api.manifest['patient_id'];assert api.manifest['synthetic'];checks=[]
def check(label,yes):
 checks.append({'check':label,'passed':bool(yes)});(ROOT/'docs/evidence/source-to-plan-and-voice.json').write_text(json.dumps({'date':'2026-11-06','synthetic':True,'patient_id':patient,'status':'in_progress' if yes else 'failed','checks':checks},indent=2));print(label+': '+str(bool(yes)),flush=True);assert yes,label
_,existing=api.call('/rest/v1/care_plans?select=id&patient_id=eq.'+patient,'clinician');assert not existing or a.resume and len(existing)==1,'Fresh scenario or explicit resume required; never resets an existing plan'
if not existing:
 date=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5,minutes=30))).date().isoformat();lines=['SYNTHETIC WORKFLOW INSTRUCTIONS - NOT A PRESCRIPTION'];source_by={}
 for name,domain in [('Medication','medication'),('Meals','meals'),('Monitoring','glucose'),('Investigation','test')]:
  chunk=[name+': record Demo '+domain+'.','Cadence once. Start '+date+'; end '+date+'.','Time 00:00. Timezone Asia/Kolkata.'];lines+=chunk;source_by[domain]='\n'.join(chunk)
 original=pdf(lines);path=patient+'/'+str(uuid.uuid4())+'.pdf';status,_=api.call('/storage/v1/object/plan-documents/'+path,'clinician',original,mime='application/pdf');check('private clinician instruction PDF uploaded',status==200)
 status,prepared=api.call('/functions/v1/attachment-prepare','clinician',{'patient_id':patient,'bucket':'plan-documents','source_path':path});check('source structurally prepared before use',status==200)
 request={'patient_id':patient,'source_path':path,'text':'','synthetic_only':True,'privacy_version':1,'privacy_request_id':str(uuid.uuid4())}
 status,_=api.call('/functions/v1/plan-extract-vcpi','patient',request);check('patient cannot extract a clinician plan',status==403)
 status,result=api.call('/functions/v1/plan-extract-vcpi','clinician',{**request,'privacy_request_id':str(uuid.uuid4())});check('PDF extraction returned retained proposal',status==200 and bool(result.get('id')))
 _,loops=api.call('/rest/v1/care_loops?select=id&patient_id=eq.'+patient,'patient');check('AI extraction did not activate any care task',loops==[])
 items=result['proposal']['items'];check('four expected dimensions extracted',len(items)==4 and {i['domain'] for i in items}==set(source_by))
 fields=['domain','label','source_excerpt','cadence','weekdays','start_date','end_date','times'];reviewed=[]
 for index,item in enumerate(items):
  domain=item['domain'];reviewed.append({**item,'label':'Demo '+domain,'source_excerpt':source_by[domain],'cadence':'once','weekdays':[],'start_date':date,'end_date':date,'times':['00:00'],'proposal_index':index,'original':item,'review':{f:True for f in fields},'reason':'Compared with the generated synthetic source text; explicitly normalized label and once-only start/end/time. No medical interpretation.'})
 body={'source_note':'\n'.join(lines),'source_path':path,'extraction_id':result['id'],'timezone':'Asia/Kolkata','items':reviewed,'vcpi':{'version':1,'source_reviewed':True,'completeness_reviewed':True,'excluded':[]}};plan=str(uuid.uuid4())
 status,_=api.rpc('save_care_plan','clinician',p_patient=patient,p_plan=plan,p_data=body);check('reviewed proposal saved as draft',status==200)
 unreviewed={**body,'vcpi':{**body['vcpi'],'source_reviewed':False}};status,_=api.rpc('confirm_care_plan','clinician',p_patient=patient,p_plan=plan,p_data=unreviewed,p_note='Expected denial');check('missing source review blocks activation',status>=400)
 api.rpc('set_reminder_preference','patient',p_patient=patient,p_enabled=False)
 status,_=api.rpc('confirm_care_plan','clinician',p_patient=patient,p_plan=plan,p_data=body,p_note='Synthetic clerical review against known generated instructions. Real clinical review is outside this test.');check('explicit reviewed confirmation activates four tasks',status==200)
 _,loops=api.call('/rest/v1/care_loops?select=id&patient_id=eq.'+patient,'patient');check('patient sees four scheduled tasks',len(loops)==4)
else:
 plan=existing[0]['id']
 previous=ROOT/'docs/evidence/source-to-plan-and-voice.json'
 if previous.exists():
  saved=json.loads(previous.read_text())
  if saved.get('patient_id')==patient:checks=saved.get('checks',[])
# Exercise the actual audio-transcription route with a frozen synthetic voice source.
audio=(ROOT/'.local/filly-corpus/taken-en.wav').read_bytes();voice=patient+'/'+str(uuid.uuid4())+'.wav';status,_=api.call('/storage/v1/object/voice-notes/'+voice,'patient',audio,mime='audio/wav');check('synthetic recorded source uploaded privately',status==200)
_,before_voice=api.call('/rest/v1/care_events?select=id&patient_id=eq.'+patient,'patient')
status,text=api.call('/functions/v1/voice-transcribe','patient',{'patient_id':patient,'source_path':voice,'language':'en','interpret_medication':True,'privacy_version':1,'privacy_request_id':str(uuid.uuid4())});check('audio returns original and English transcription for review',status==200 and bool(text.get('text')) and bool(text.get('english')) and text.get('requires_confirmation') is True)
_,events=api.call('/rest/v1/care_events?select=id&patient_id=eq.'+patient,'patient');check('transcription did not record any activity',events==before_voice)
status,_=api.call('/functions/v1/voice-transcribe','patient',{'patient_id':patient,'source_path':patient+'/'+str(uuid.uuid4())+'.wav','language':'en','privacy_version':1,'privacy_request_id':str(uuid.uuid4())});check('missing recording fails explicitly for manual fallback',status>=400)
api.manifest.update(plan_id=plan,prepared=True);pathlib.Path(a.manifest).write_text(json.dumps(api.manifest,indent=2));pathlib.Path(a.manifest).chmod(0o600)
report={'date':'2026-11-06','synthetic':True,'patient_id':patient,'scope':'Hosted API boundary acceptance; not a complete browser-only or clinical acceptance test','checks':checks,'transcript_nonempty':True,'provider_care_writes':False};(ROOT/'docs/evidence/source-to-plan-and-voice.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':len(checks),'manifest':a.manifest}))
