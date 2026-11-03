"""Pure bridge regression tests: run without a live CARE or Supabase database."""
import json
import tempfile
import time
import unittest
from pathlib import Path
from uuid import uuid4
from care_wholecare.bridge import BridgeError, PROJECT_URL, SupabaseDelegate, load_link

P, U, C, F, I, L, PLAN = [str(uuid4()) for _ in range(7)]

def link():
    return dict(care_user_id=C, care_patient_id=P, care_facility_id=F, supabase_user_id=U, supabase_patient_id=P, project_url=PROJECT_URL, role='clinician', synthetic_only=True, expires_at=time.time()+300, publishable_key='public-test', access_token='user-test')

class ConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.path = Path(self.temp.name)/'links.json'
        self.path.touch(mode=0o600)
        self.save([link()])
    def tearDown(self): self.temp.cleanup()
    def save(self, links): self.path.write_text(json.dumps(dict(version=1,links=links)))
    def test_exact_scope(self):
        self.assertEqual(load_link(self.path,C,P)['supabase_user_id'],U)
        with self.assertRaises(BridgeError) as e:load_link(self.path,str(uuid4()),P)
        self.assertEqual(e.exception.status,404)
    def test_expired_link(self):
        v=link();v['expires_at']=0;self.save([v])
        with self.assertRaises(BridgeError):load_link(self.path,C,P)
    def test_duplicate_mapping_fails_closed(self):
        self.save([link(),link()])
        with self.assertRaises(BridgeError):load_link(self.path,C,P)
    def test_permissions_and_project(self):
        self.path.chmod(0o644)
        with self.assertRaises(BridgeError):load_link(self.path,C,P)
        self.path.chmod(0o600);v=link();v['project_url']='https://other.invalid';self.save([v])
        with self.assertRaises(BridgeError):load_link(self.path,C,P)

class FakeDelegate(SupabaseDelegate):
    def __init__(self):
        super().__init__(link());self.receipt=None;self.writes=0;self.fixture=True;self.assigned=True;self.state='REVIEW_PENDING';self.evidence_rows=1
    def call(self,path,method='GET',data=None,params=None):
        if path=='/auth/v1/user':return {'id':U}
        if path.endswith('/my_context'):return {'user_id':U,'memberships':[{'patient_id':P,'role':'clinician'}] if self.assigned else []}
        if path.endswith('/patients'):return [{'id':P,'display_name':'Synthetic','synthetic':True}]
        if path.endswith('/care_loops'):return [dict(id=L,item_id=I,state=self.state,next_owner='clinician' if self.state!='CLOSED' else 'none',due_at='2026-01-01T01:00:00Z',review_note='',closed_at=None)]
        if path.endswith('/care_plan_items'):return [dict(id=I,plan_id=PLAN,domain='test',label='Fixture review',source_excerpt='Fictional',requires_human_review=True)]
        if path.endswith('/evidence'):return [dict(id=str(uuid4()),loop_id=L,label='Synthetic placeholder',is_fixture=self.fixture) for _ in range(self.evidence_rows)]
        if path.endswith('/care_plans'):return [dict(id=PLAN,status='confirmed',active=True,source_note='Fictional plan')]
        if path.endswith('/audit_events'):return [self.receipt] if self.receipt else []
        if path.endswith('/care_action'):
            self.writes+=1;self.state='CLOSED';self.receipt=dict(id=str(uuid4()),actor_id=U,loop_id=L,action='review',note=data['p_note'],event_key=data['p_event_key'],created_at='2026-01-02T01:00:00Z');return {}
        raise AssertionError(path)

class DelegateTests(unittest.TestCase):
    def setUp(self):self.d=FakeDelegate()
    def body(self):return dict(eventKey=str(uuid4()),expectedVersion=self.d.workspace(P,'Doctor')['version'],note='Synthetic software review only.')
    def test_active_assignment_required(self):
        self.d.assigned=False
        with self.assertRaises(BridgeError) as e:self.d.workspace(P,'Doctor')
        self.assertEqual(e.exception.status,403)
    def test_real_file_review_disabled(self):
        self.d.fixture=False;self.assertFalse(self.d.workspace(P,'Doctor')['items'][0]['canReview'])
        with self.assertRaises(BridgeError):self.d.review(P,L,self.body(),'Doctor')
        self.assertEqual(self.d.writes,0)
    def test_capped_evidence_read_disables_review(self):
        self.d.evidence_rows=1000
        self.assertFalse(self.d.workspace(P,'Doctor')['items'][0]['canReview'])
    def test_stale_version_rejected(self):
        body=self.body();body['expectedVersion']='stale'
        with self.assertRaises(BridgeError) as e:self.d.review(P,L,body,'Doctor')
        self.assertEqual(e.exception.status,409);self.assertEqual(self.d.writes,0)
    def test_review_replay_and_changed_payload(self):
        body=self.body();result=self.d.review(P,L,body,'Doctor')
        self.assertEqual(result['items'][0]['state'],'CLOSED');self.assertEqual(self.d.writes,1)
        self.d.review(P,L,body,'Doctor');self.assertEqual(self.d.writes,1)
        body['note']='Changed note after committed receipt'
        with self.assertRaises(BridgeError) as e:self.d.review(P,L,body,'Doctor')
        self.assertEqual(e.exception.status,409);self.assertEqual(self.d.writes,1)
    def test_transport_uses_only_delegated_identity_and_no_redirects(self):
        class Response:
            status_code=200;content=b'{}'
            def json(self):return {}
        calls=[]
        def transport(*a,**kw):calls.append((a,kw));return Response()
        SupabaseDelegate(link(),transport).call('/auth/v1/user')
        self.assertEqual(calls[0][1]['headers']['Authorization'],'Bearer user-test')
        self.assertFalse(calls[0][1]['allow_redirects'])
        self.assertEqual(calls[0][0][1],PROJECT_URL+'/auth/v1/user')

if __name__=='__main__':unittest.main()
