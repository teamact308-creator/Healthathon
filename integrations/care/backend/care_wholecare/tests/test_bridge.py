"""Pure bridge regression tests: run without a live CARE or Supabase database."""
import hashlib
import json
import tempfile
import time
import unittest
from pathlib import Path
from uuid import uuid4
from care_wholecare.bridge import BridgeError, PROJECT_URL, SupabaseDelegate, load_link
from care_wholecare.reports import report_receipt, valid_receipt

P, U, C, F, I, L, PLAN, E = [str(uuid4()) for _ in range(8)]
DATA = b"%PDF-1.7\n% synthetic test only"

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
        if path.endswith('/evidence'):return [dict(id=E,loop_id=L,label='Synthetic placeholder',is_fixture=self.fixture,storage_path=P+'/synthetic.pdf',content_sha256=hashlib.sha256(DATA).hexdigest()) for _ in range(self.evidence_rows)]
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
    def test_original_is_scoped_verified_and_required_before_review(self):
        self.d.fixture = False
        self.d.receipt_key = b"synthetic-only-test-key"
        requests = []
        class FileResponse:
            status_code = 200
            headers = {"Content-Type": "application/pdf"}
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def iter_content(self, _): return [DATA]
        def get_file(*args, **kwargs):
            requests.append((args, kwargs))
            return FileResponse()
        self.d.transport = get_file
        body = self.body()
        self.assertTrue(self.d.workspace(P, "Doctor")["items"][0]["canReview"])
        with self.assertRaises(BridgeError): self.d.review(P, L, body, "Doctor")
        self.assertEqual(self.d.writes, 0)
        with self.assertRaises(BridgeError): self.d.original(str(uuid4()), E)
        self.assertEqual(requests, [])
        data, mime, receipt = self.d.original(L, E)
        self.assertEqual((data, mime), (DATA, "application/pdf"))
        self.assertFalse(requests[0][1]["allow_redirects"])
        self.assertTrue(requests[0][0][1].endswith("/authenticated/care-evidence/" + P + "/synthetic.pdf"))
        self.assertNotIn("storage_path", json.dumps(self.d.workspace(P, "Doctor")))
        body["reportReceipts"] = {E: receipt[:-1] + ("0" if receipt[-1] != "0" else "1")}
        with self.assertRaises(BridgeError): self.d.review(P, L, body, "Doctor")
        body["reportReceipts"] = {E: receipt}
        closed = self.d.review(P, L, body, "Doctor")
        self.assertEqual(closed["items"][0]["state"], "CLOSED")
        self.d.review(P, L, body, "Doctor")
        self.assertEqual(self.d.writes, 1)

    def test_corrupt_original_never_mints_a_receipt(self):
        self.d.fixture = False
        self.d.receipt_key = b"test-key"
        class Corrupt:
            status_code = 200
            headers = {"Content-Type": "application/pdf"}
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def iter_content(self, _): return [b"%PDF-corrupt"]
        self.d.transport = lambda *args, **kwargs: Corrupt()
        with self.assertRaises(BridgeError): self.d.original(L, E)
        self.assertEqual(self.d.writes, 0)

    def test_report_receipts_expire_and_cannot_move_between_links_or_file_versions(self):
        row = {"id": E, "content_sha256": "a" * 64}
        key = b"test-key"
        token = report_receipt(key, ["link1"], L, row, now=100)
        self.assertTrue(valid_receipt(key, ["link1"], L, row, token, now=101))
        self.assertFalse(valid_receipt(key, ["link2"], L, row, token, now=101))
        self.assertFalse(valid_receipt(key, ["link1"], L, {**row, "content_sha256": "b" * 64}, token, now=101))
        self.assertFalse(valid_receipt(key, ["link1"], L, row, token, now=1300))

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
