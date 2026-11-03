#!/usr/bin/env python3
"""Create/renew one short-lived, user-delegated synthetic development link.

Run interactively on the operator's machine, never in a browser bundle or CI.
No password, refresh token or service-role key is written to disk.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request
from uuid import UUID

PROJECT = 'https://gylnitduoasmybadblcp.supabase.co'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):return None

def canonical(value):return str(UUID(value))
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--links-file',required=True,type=Path)
    for name in ('care-user-id','care-patient-id','care-facility-id','wholecare-patient-id'):p.add_argument('--'+name,required=True,type=canonical)
    a=p.parse_args();cfg=Path(__file__).resolve().parents[4]/'db-config.js'
    key=re.search(r"SUPABASE_KEY='([^']+)'",cfg.read_text())[1]
    assert key.startswith('sb_publishable_'), 'Only the public project key is supported.'
    if a.links_file.is_symlink():raise ValueError('Credential path must not be a symlink.')
    previous=json.loads(a.links_file.read_text()) if a.links_file.exists() else {'version':1,'links':[]}
    if previous.get('version')!=1 or not isinstance(previous.get('links'),list):raise ValueError('Invalid existing links file.')
    email=input('Existing WholeCare clinician email: ').strip()
    password=getpass.getpass('Existing password (not saved): ')
    opener=urllib.request.build_opener(NoRedirect)
    def call(path,body=None,token=None):
        headers={'apikey':key,'Content-Type':'application/json'}
        if token:headers['Authorization']='Bearer '+token
        req=urllib.request.Request(PROJECT+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        with opener.open(req,timeout=20) as r:return json.load(r)
    session=call('/auth/v1/token?grant_type=password',{'email':email,'password':password});password=None
    token=session['access_token'];user=call('/auth/v1/user',token=token);context=call('/rest/v1/rpc/my_context',{},token)
    if user['id']!=context['user_id'] or not any(m.get('patient_id')==a.wholecare_patient_id and m.get('role')=='clinician' for m in context.get('memberships',[])):raise ValueError('The authenticated clinician is not assigned to this patient.')
    patient=call('/rest/v1/patients?select=id,synthetic&id=eq.'+a.wholecare_patient_id,token=token)
    if len(patient)!=1 or patient[0].get('synthetic') is not True:raise ValueError('A mapped synthetic patient is required.')
    remaining=[]
    for old in previous['links']:
        same_scope=old.get('care_user_id')==a.care_user_id and old.get('care_patient_id')==a.care_patient_id
        if same_scope:
            if old.get('supabase_user_id')!=user['id'] or old.get('supabase_patient_id')!=a.wholecare_patient_id or old.get('care_facility_id')!=a.care_facility_id:raise ValueError('Renewal cannot retarget an existing identity or facility.')
        else:
            if old.get('supabase_user_id')==user['id']:raise ValueError('This bounded experiment supports one CARE scope per WholeCare actor.')
            remaining.append(old)
    link=dict(project_url=PROJECT,publishable_key=key,access_token=token,expires_at=session.get('expires_at',time.time()+session['expires_in']),supabase_user_id=user['id'],supabase_patient_id=a.wholecare_patient_id,care_user_id=a.care_user_id,care_patient_id=a.care_patient_id,care_facility_id=a.care_facility_id,role='clinician',synthetic_only=True)
    # Keep the inode: a running Docker stack bind-mounts this exact file.
    fd=os.open(a.links_file,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    try:
        os.fchmod(fd,0o600)
        with os.fdopen(fd,'w') as f:json.dump({'version':1,'links':remaining+[link]},f,indent=2)
    except Exception:
        try:os.close(fd)
        except OSError:pass
        raise
    print('Verified synthetic clinician link saved. No password or refresh token was stored. Reload CARE; the link expires with this user session.')

if __name__=='__main__':
    try:main()
    except urllib.error.HTTPError as e:raise SystemExit('Account linking failed (HTTP '+str(e.code)+'). No credentials were printed.')
    except Exception as e:raise SystemExit('Account linking stopped ('+type(e).__name__+'). Check inputs and file permissions; no credentials were printed.')
