"""Prepare a new isolated demo through checked APIs. Never reset existing work."""
import argparse,json,datetime,uuid,pathlib
from demo_api import DemoAPI,ROOT
from synthetic_files import pdf
p=argparse.ArgumentParser();p.add_argument('--manifest',required=True);p.add_argument('--synthetic-only',action='store_true',required=True);args=p.parse_args();api=DemoAPI(args.manifest);patient=api.manifest['patient_id']
assert api.manifest.get('kind')=='rehearsal' and api.manifest.get('synthetic') is True
status,plans=api.call('/rest/v1/care_plans?select=id&patient_id=eq.'+patient,'clinician');assert status==200 and not plans,'Refusing to reset an existing plan'
api.rpc('set_reminder_preference','patient',p_patient=patient,p_enabled=False)
date=datetime.datetime.now(datetime.timezone.utc).date().isoformat();plan=str(uuid.uuid4());body={'source_note':'Synthetic demonstration: record medication, lunch and monitoring availability; submit a report for human review. No treatment advice.','timezone':'UTC','items':[{'domain':domain,'label':'Demo '+domain,'source_excerpt':'Synthetic operational instruction','cadence':'once','start_date':date,'end_date':date,'times':['00:00']} for domain in ['medication','meals','glucose','test']]}
for action,payload in [('save_care_plan',{'p_patient':patient,'p_plan':plan,'p_data':body}),('confirm_care_plan',{'p_patient':patient,'p_plan':plan,'p_data':body,'p_note':'Checked all synthetic instructions for the rehearsal.'})]:
 status,_=api.rpc(action,'clinician',**payload);assert status==200,action
folder=ROOT/'.local/rehearsals';report=folder/(api.manifest['request_id']+'-report.pdf');report.write_bytes(pdf(['SYNTHETIC DEMONSTRATION REPORT','No laboratory findings. For workflow review only.','Run '+api.manifest['request_id']]))
api.manifest.update(prepared=True,plan_id=plan,report_path=str(report));pathlib.Path(args.manifest).write_text(json.dumps(api.manifest,indent=2));pathlib.Path(args.manifest).chmod(0o600)
print(json.dumps({'prepared':True,'patient_id':patient,'manifest':args.manifest,'report_path':str(report)}))
