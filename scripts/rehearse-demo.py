"""Run a fresh isolated synthetic journey. Refuses non-rehearsal manifests or an existing plan.
Retains rehearsal provenance. Does not reset or delete shared data, send messages or change original accounts.
"""
import argparse,datetime,io,json,uuid,pathlib
from demo_api import DemoAPI,ROOT
parser=argparse.ArgumentParser();parser.add_argument('--manifest',required=True);parser.add_argument('--resume',action='store_true');parser.add_argument('--synthetic-only',action='store_true',required=True);args=parser.parse_args();api=DemoAPI(args.manifest)
assert api.manifest['kind']=='rehearsal' and api.manifest['synthetic'] is True
patient=api.manifest['patient_id'];checks=[]
def check(name,condition):
 assert condition,name
 checks.append(name);print('PASS '+name,flush=True)
def rpc(name,role,**body):
 status,data=api.rpc(name,role,**body);check(name+' '+role+' persisted',status==200);return data
status,plans=api.call('/rest/v1/care_plans?select=id&patient_id=eq.'+patient,'clinician');assert status==200 and (plans==[] or args.resume and len(plans)==1), 'Use a new rehearsal manifest or explicitly resume its isolated plan.'
date=datetime.datetime.now(datetime.timezone.utc).date().isoformat();plan=plans[0]['id'] if plans else str(uuid.uuid4())
body={'source_note':'Synthetic rehearsal instructions only. No clinical findings or treatment advice.','timezone':'UTC','items':[{'domain':d,'label':'Rehearsal '+d,'source_excerpt':'Synthetic operational instruction','cadence':'once','start_date':date,'end_date':date,'times':['00:00']} for d in ['medication','meals','glucose','test']]}
status,_=api.rpc('save_care_plan','patient',p_patient=patient,p_plan=plan,p_data=body);check('patient cannot author clinician plan',status==403)
if not plans:
 rpc('set_reminder_preference','patient',p_patient=patient,p_enabled=False)
 rpc('save_care_plan','clinician',p_patient=patient,p_plan=plan,p_data=body)
 status,rows=api.call('/rest/v1/care_loops?select=id&patient_id=eq.'+patient,'patient');check('draft creates no patient tasks',status==200 and rows==[])
 rpc('confirm_care_plan','clinician',p_patient=patient,p_plan=plan,p_data=body,p_note='Reviewed the complete synthetic manual source.')
 
_,items=api.call('/rest/v1/care_plan_items?select=id,domain&patient_id=eq.'+patient,'patient');domains={i['id']:i['domain'] for i in items}
_,loops=api.call('/rest/v1/care_loops?select=id,item_id,state&patient_id=eq.'+patient,'patient');by_domain={domains[l['item_id']]:l['id'] for l in loops};check('confirmed plan creates four independently scoped tasks',len(by_domain)==4)
key=str(uuid.uuid4());payload={'p_loop':by_domain['medication'],'p_status':'taken','p_details':{'note':'I recorded this synthetic dose as taken.'},'p_event':key}
_,existing=api.call('/rest/v1/care_events?select=id&loop_id=eq.'+by_domain['medication'],'patient')
if not existing:
 rpc('log_care_activity','patient',**payload);rpc('log_care_activity','patient',**payload)
_,events=api.call('/rest/v1/care_events?select=id&loop_id=eq.'+by_domain['medication'],'patient');check('one activity retained after replay/resume',len(events)==1)
# Invalid original remains unsubmitted, then a valid PNG is uploaded and reviewed.
invalid=patient+'/'+str(uuid.uuid4())+'.png';api.call('/storage/v1/object/care-evidence/'+invalid,'patient',b'not a valid image',mime='image/png')
status,_=api.call('/functions/v1/report-submit','patient',{'patient_id':patient,'loop_id':by_domain['test'],'source_path':invalid,'label':'Invalid synthetic upload','event_key':str(uuid.uuid4())});check('invalid report rejected without closure',status>=400)
def pdf(lines):
 content='BT /F1 14 Tf 30 750 Td '+' Tj 0 -24 Td '.join('('+line.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')+')' for line in lines)+' Tj ET'
 objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+str(len(content))+' >>\nstream\n'+content+'\nendstream']
 data=b'%PDF-1.4\n';offsets=[]
 for i,obj in enumerate(objects):offsets.append(len(data));data+=(str(i+1)+' 0 obj\n'+obj+'\nendobj\n').encode('ascii')
 xref=len(data);data+=b'xref\n0 6\n0000000000 65535 f \n'+''.join(f'{offset:010d} 00000 n \n' for offset in offsets).encode();data+=('trailer << /Size 6 /Root 1 0 R >>\nstartxref\n'+str(xref)+'\n%%EOF').encode();return data
original=pdf(['SYNTHETIC REHEARSAL REPORT','No laboratory findings. Operational review only.','Run '+api.manifest['request_id']]);path=patient+'/'+str(uuid.uuid4())+'.pdf'
status,_=api.call('/storage/v1/object/care-evidence/'+path,'patient',original,mime='application/pdf');check('private original uploaded',status==200)
report={'patient_id':patient,'loop_id':by_domain['test'],'source_path':path,'label':'Synthetic rehearsal original','event_key':str(uuid.uuid4())}
status,result=api.call('/functions/v1/report-submit','patient',report);check('report receipt awaits clinician review',status==200 and result['state']=='REVIEW_PENDING')
status,_=api.call('/functions/v1/report-submit','patient',report);check('report retry accepted without duplication',status==200)
_,evidence=api.call('/rest/v1/evidence?select=id&loop_id=eq.'+by_domain['test'],'patient');check('one evidence record after retry',len(evidence)==1)
for role in ['patient','coordinator','caregiver']:
 status,_=api.rpc('care_action',role,p_loop=by_domain['test'],p_action='review',p_note='Denied review',p_event_key=str(uuid.uuid4()));check(role+' cannot perform clinician review',status==403)
status,link=api.call('/storage/v1/object/sign/care-evidence/'+path,'clinician',{'expiresIn':30});check('clinician can prepare original link',status==200)
rpc('care_action','clinician',p_loop=by_domain['test'],p_action='review',p_note='Reviewed the synthetic original; operational follow-up complete.',p_event_key=str(uuid.uuid4()))
_,reviewed=api.call('/rest/v1/care_loops?select=state&patient_id=eq.'+patient+'&id=eq.'+by_domain['test'],'patient');check('patient reads clinician-reviewed result',reviewed[0]['state']=='CLOSED')
help_key=str(uuid.uuid4());help=rpc('request_activity_help','patient',p_loop=by_domain['meals'],p_text='Please help organise this practical lunch step.',p_event=help_key)
assert rpc('request_activity_help','patient',p_loop=by_domain['meals'],p_text='Please help organise this practical lunch step.',p_event=help_key)==help
rpc('update_help_thread','coordinator',p_request=help,p_action='claim',p_text='',p_event=str(uuid.uuid4()))
status,_=api.rpc('update_help_thread','clinician',p_request=help,p_action='resolve',p_text='Wrong owner',p_event=str(uuid.uuid4()));check('non-owner cannot resolve claimed help',status>=400)
rpc('update_help_thread','coordinator',p_request=help,p_action='reply',p_text='I can help organise the next practical step.',p_event=str(uuid.uuid4()))
rpc('update_help_thread','patient',p_request=help,p_action='reply',p_text='Thank you. Please proceed.',p_event=str(uuid.uuid4()))
rpc('update_help_thread','coordinator',p_request=help,p_action='resolve',p_text='Practical support completed.',p_event=str(uuid.uuid4()))
_,meal=api.call('/rest/v1/care_loops?select=state&id=eq.'+by_domain['meals'],'patient');check('help resolution leaves care task open',meal[0]['state']=='DUE')
cg=next(a['id'] for a in api.manifest['accounts'] if a['role']=='caregiver')
rpc('care_action','coordinator',p_loop=by_domain['glucose'],p_action='remind',p_note='In-app synthetic reminder',p_event_key=str(uuid.uuid4()))
status,_=api.rpc('care_action','coordinator',p_loop=by_domain['glucose'],p_action='support',p_note='No consent yet',p_event_key=str(uuid.uuid4()));check('support routing requires patient consent',status>=400)
rpc('set_caregiver_consent','patient',p_patient=patient,p_caregiver=cg,p_granted=True,p_event_key=str(uuid.uuid4()))
rpc('care_action','coordinator',p_loop=by_domain['glucose'],p_action='support',p_note='Consented support',p_event_key=str(uuid.uuid4()))
_,support=api.call('/rest/v1/support_tasks?select=id','caregiver');check('caregiver sees assigned support',len(support)==1)
rpc('set_caregiver_consent','patient',p_patient=patient,p_caregiver=cg,p_granted=False,p_event_key=str(uuid.uuid4()))
_,support=api.call('/rest/v1/support_tasks?select=id','caregiver');check('revocation removes caregiver visibility',support==[])
for table in ['patients','evidence','care_events']:
 _,rows=api.call('/rest/v1/'+table+'?select=*','caregiver');check('caregiver clinical '+table+' denied',rows==[])
_,rows=api.call('/rest/v1/patients?select=id','patient');check('patient sees own identity only',len(rows)==1 and rows[0]['id']==patient)
report_out={'date':'2026-11-06','kind':'isolated live API rehearsal','run_id':api.manifest['request_id'],'checks':checks,'passed':len(checks),'external_messages_sent':0,'retained_history':True,'browser_verified':False}
(ROOT/'docs/evidence'/('journey-'+api.manifest['request_id']+'.json')).write_text(json.dumps(report_out,indent=2))
api.manifest['journey_completed']=True;pathlib.Path(args.manifest).write_text(json.dumps(api.manifest,indent=2));pathlib.Path(args.manifest).chmod(0o600)
