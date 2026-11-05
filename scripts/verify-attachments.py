"""Synthetic endpoint acceptance. Never sends source bytes to an AI or messaging provider."""
import argparse,json,uuid,hashlib
from demo_api import DemoAPI,ROOT
from synthetic_files import pdf
p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--synthetic-only',action='store_true',required=True);a=p.parse_args();api=DemoAPI(a.manifest);patient=api.manifest['patient_id'];assert api.manifest['synthetic'] is True
checks=[]
def check(name,yes):
 checks.append({'check':name,'passed':bool(yes)});assert yes,name
_,before=api.call('/rest/v1/care_events?select=id&patient_id=eq.'+patient,'patient')
original=pdf(['SYNTHETIC PREPARATION FIXTURE','No clinical content. Provider-independent file preparation.']);path=patient+'/'+str(uuid.uuid4())+'.pdf'
status,_=api.call('/storage/v1/object/care-evidence/'+path,'patient',original,mime='application/pdf');check('private upload',status==200)
body={'patient_id':patient,'bucket':'care-evidence','source_path':path}
status,_=api.call('/functions/v1/attachment-prepare','patient',body);check('unassociated report remains unreadable under existing policies',status==404)
status,_=api.rpc('submit_intake','patient',p_patient=patient,p_label='Synthetic prepared source',p_text='Internal preparation verification; not clinical data.',p_path=path,p_event=str(uuid.uuid4()));check('source enters association queue without care completion',status==200)
for role in ['patient','clinician','coordinator']:
 status,data=api.call('/functions/v1/attachment-prepare',role,body);print({'role':role,'http':status,'size':data.get('size'),'expected_size':len(original),'error':data.get('error')},flush=True);check(role+' preparation reads only currently authorized source',status==200 and data.get('sha256')==hashlib.sha256(original).hexdigest() and data.get('size')==len(original))
status,_=api.call('/functions/v1/attachment-prepare','caregiver',body);check('caregiver cannot prepare clinical source',status==403)
status,_=api.call('/functions/v1/attachment-prepare',body=body);check('anonymous request denied',status in [401,403])
status,_=api.call('/functions/v1/attachment-prepare','patient',{**body,'source_path':str(uuid.uuid4())+'/wrong.pdf'});check('cross patient path denied',status==400)
invalid=patient+'/'+str(uuid.uuid4())+'.pdf';api.call('/storage/v1/object/care-evidence/'+invalid,'patient',b'NOT A VALID DOCUMENT',mime='application/pdf')
api.rpc('submit_intake','patient',p_patient=patient,p_label='Invalid synthetic preparation fixture',p_text='Expected source screening failure.',p_path=invalid,p_event=str(uuid.uuid4()))
status,_=api.call('/functions/v1/attachment-prepare','patient',{**body,'source_path':invalid});check('disguised document rejected',status==415)
status,_=api.call('/functions/v1/attachment-prepare','patient',{**body,'source_path':patient+'/'+str(uuid.uuid4())+'.pdf'});check('missing source is explicit failure',status==404)
_,after=api.call('/rest/v1/care_events?select=id&patient_id=eq.'+patient,'patient');check('preparation never records care',before==after)
report={'date':'2026-11-06','synthetic':True,'provider_transfer':False,'checks':checks};(ROOT/'docs/evidence/attachment-preparation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
