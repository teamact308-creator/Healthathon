"""User-delegated bridge. No service-role key and no Supabase password are accepted."""
from __future__ import annotations

import hashlib
import json
import stat
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import requests

from care_wholecare.reports import MAX_BYTES, REPORT_LIMIT, report_receipt, report_type, valid_receipt

PROJECT_URL = "https://gylnitduoasmybadblcp.supabase.co"


class BridgeError(Exception):
    def __init__(self, detail, status=503):
        self.detail, self.status = detail, status


def uuid_string(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise BridgeError("Mapped resource not available.", 404) from None


def load_link(path, care_user_id, care_patient_id, *, require_session=True):
    user_id, patient_id = uuid_string(care_user_id), uuid_string(care_patient_id)
    try:
        file = Path(path)
        if stat.S_IMODE(file.stat().st_mode) & 0o077:
            raise ValueError("Unsafe credential-file permissions")
        config = json.loads(file.read_text())
        if config.get("version") != 1 or not isinstance(config.get("links"), list):
            raise ValueError("Invalid link configuration")
        seen_actors, seen_scopes = set(), set()
        selected = None
        for link in config["links"]:
            actor = uuid_string(link["supabase_user_id"])
            owner = uuid_string(link["care_user_id"])
            patient = uuid_string(link["care_patient_id"])
            scope = (owner, patient)
            if actor in seen_actors or scope in seen_scopes:
                raise ValueError("Ambiguous identity mapping")
            seen_actors.add(actor)
            seen_scopes.add(scope)
            if scope == (user_id, patient_id):
                selected = link
        if selected is None:
            raise BridgeError("Mapped resource not available.", 404)
        if selected.get("project_url") != PROJECT_URL or selected.get("role") != "clinician":
            raise ValueError("Unsupported integration scope")
        for key in ("supabase_patient_id", "care_facility_id"):
            uuid_string(selected[key])
        if selected.get("synthetic_only") is not True:
            raise ValueError("Synthetic scope required")
        if require_session and float(selected["expires_at"]) <= time.time():
            raise BridgeError("The WholeCare account link expired. Relink the development account.")
        return selected
    except BridgeError:
        raise
    except (OSError, ValueError, KeyError, TypeError):
        raise BridgeError("The WholeCare account link is not configured safely.") from None


class SupabaseDelegate:
    """Every operation runs under the mapped user's normal Supabase RLS/RPC identity."""
    def __init__(self, link, transport=requests.request, receipt_key=None):
        self.link, self.transport = link, transport
        self.receipt_key = receipt_key
        self.receipt_scope = [link.get(k) for k in ("care_user_id", "care_patient_id", "care_facility_id", "supabase_user_id", "link_id")]
        self.patient_id = uuid_string(link["supabase_patient_id"])

    def call(self, path, method="GET", data=None, params=None):
        try:
            response = self.transport(
                method, PROJECT_URL + path,
                headers={"apikey": self.link["publishable_key"], "Authorization": "Bearer " + self.link["access_token"], "Content-Type": "application/json"},
                json=data, params=params, timeout=12, allow_redirects=False,
            )
            if response.status_code == 401:
                raise BridgeError("Connect to WholeCare to continue.", 428)
            if response.status_code == 403:
                raise BridgeError("The linked account cannot perform this operation.", 403)
            if not 200 <= response.status_code < 300 or len(response.content) > 2_000_000:
                raise BridgeError("WholeCare could not confirm this request. Refresh before retrying.")
            return response.json()
        except (requests.RequestException, ValueError, TypeError):
            raise BridgeError("WholeCare could not confirm this request. Refresh before retrying.") from None

    def rows(self, table, select, **extra):
        result = self.call("/rest/v1/" + table, params={"select": select, "patient_id": "eq." + self.patient_id, **extra})
        if not isinstance(result, list):
            raise BridgeError("WholeCare returned an unexpected response.")
        return result

    def verify_identity(self):
        user = self.call("/auth/v1/user")
        context = self.call("/rest/v1/rpc/my_context", "POST", {})
        expected = self.link["supabase_user_id"]
        if user.get("id") != expected or context.get("user_id") != expected:
            raise BridgeError("The linked account identity does not match.", 403)
        if not any(m.get("patient_id") == self.patient_id and m.get("role") == "clinician" for m in context.get("memberships", [])):
            raise BridgeError("The linked clinician is not assigned to this patient.", 403)
        patients = self.call("/rest/v1/patients", params={"select": "id,display_name,synthetic", "id": "eq." + self.patient_id})
        if len(patients) != 1 or patients[0].get("synthetic") is not True:
            raise BridgeError("Only the mapped synthetic development patient is supported.", 403)
        return patients[0]

    def workspace(self, care_patient_id, actor_name, patient=None, evidence_by_loop=None):
        patient = patient or self.verify_identity()
        now = datetime.now(timezone.utc).isoformat()
        loops = self.rows("care_loops", "id,item_id,state,next_owner,due_at,review_note,closed_at", state="neq.CANCELLED", due_at="lte." + now, order="due_at.desc,id.desc", limit="40")
        items = {row["id"]: row for row in self.rows("care_plan_items", "id,plan_id,domain,label,source_excerpt,requires_human_review", limit="1000")}
        evidence = self.rows("evidence", "id,loop_id,label,is_fixture,storage_path,content_sha256", order="created_at.desc,id.desc", limit="1000")
        # A capped evidence read cannot establish that every attached report is a
        # fixture. Preserve read access but require the original app for review.
        evidence_complete = len(evidence) < 1000
        plans = self.rows("care_plans", "id,status,active,source_note", status="eq.confirmed", limit="100")
        plan_ids = {row["id"] for row in plans}
        audit = self.rows("audit_events", "id,actor_id,action,note,created_at,loop_id,event_key", action="eq.review", order="created_at.desc,id.desc", limit="20")
        entries, revisions = [], {}
        for loop in loops:
            item = items.get(loop["item_id"])
            if not item or item["plan_id"] not in plan_ids:
                continue
            reports = [r for r in evidence if r["loop_id"] == loop["id"]]
            fixture = evidence_complete and bool(reports) and all(r["is_fixture"] for r in reports)
            originals = [r for r in reports if not r["is_fixture"]]
            reviewable = (evidence_complete and 0 < len(originals) <= REPORT_LIMIT
                          and self.receipt_key is not None
                          and all(report_type(self.patient_id, r) for r in originals))
            if originals:
                revisions[loop["id"]] = [(r["id"], r.get("content_sha256"), r.get("storage_path")) for r in originals]
            if evidence_by_loop is not None:
                evidence_by_loop[loop["id"]] = originals
            summary = {
                "REVIEW_PENDING": "Evidence is waiting for clinician review.",
                "CLOSED": "Completion or review is recorded in WholeCare.",
                "DUE": "This scheduled action is due; completion is not yet confirmed.",
                "UNCONFIRMED": "Participation is unresolved; this does not establish a missed dose.",
            }.get(loop["state"], "Inspect the source in WholeCare.")
            source = item.get("source_excerpt") or "Clinician-confirmed WholeCare care-plan item."
            if reports:
                source += "\nEvidence: " + "; ".join(r["label"] for r in reports)
                source += "\nSynthetic fixture placeholder; no clinical findings." if fixture else "\nUploaded evidence is available to authorized clinicians where the original can be verified."
            if loop.get("review_note"):
                source += "\nRecorded review: " + loop["review_note"]
            entries.append({
                "id": loop["id"], "domain": {"medication": "Medication", "meals": "Meals", "glucose": "Monitoring", "test": "Investigation"}[item["domain"]],
                "label": item["label"], "state": loop["state"], "nextOwner": loop["next_owner"].capitalize(),
                "summary": summary, "source": source, "recordedAt": loop["due_at"],
                "canReview": loop["state"] == "REVIEW_PENDING" and item["requires_human_review"] and (fixture or reviewable),
                "reports": [{"id": r["id"], "label": r["label"]} for r in originals if self.receipt_key is not None and report_type(self.patient_id, r)],
            })
        entries.sort(key=lambda i: (i["state"] != "REVIEW_PENDING", i["state"] == "CLOSED", i["recordedAt"]))
        trail = [{"id": r["id"], "actor": actor_name if r["actor_id"] == self.link["supabase_user_id"] else "WholeCare care team", "action": "report_reviewed", "taskId": r["loop_id"], "note": r["note"], "recordedAt": r["created_at"]} for r in audit]
        version = hashlib.sha256(json.dumps({"items": entries, "trail": trail, "evidence": revisions}, sort_keys=True).encode()).hexdigest()
        return {
            "carePatientId": str(care_patient_id), "mode": "connected", "version": version, "snapshotAt": now,
            "patient": {"displayName": patient["display_name"] + " · synthetic", "reference": "WholeCare linked patient", "facility": "Isolated CARE demonstration"},
            "actor": {"displayName": actor_name},
            "planSource": next((p["source_note"] for p in plans if p["active"]), "No active confirmed plan."),
            "items": entries, "trail": trail,
        }

    def original(self, loop_id, evidence_id):
        self.verify_identity()
        if self.receipt_key is None:
            raise BridgeError("Connect to WholeCare to open originals.", 428)
        loop_id, evidence_id = uuid_string(loop_id), uuid_string(evidence_id)
        rows = self.rows("evidence", "id,loop_id,storage_path,content_sha256,is_fixture", id="eq." + evidence_id,
                         loop_id="eq." + loop_id, limit="2")
        media = report_type(self.patient_id, rows[0]) if len(rows) == 1 and rows[0]["id"] == evidence_id and rows[0]["loop_id"] == loop_id else None
        if not media:
            raise BridgeError("Original report is not available for this task.", 404)
        row, (mime, magic) = rows[0], media
        try:
            with self.transport("GET", PROJECT_URL + "/storage/v1/object/authenticated/care-evidence/" + row["storage_path"],
                headers={"apikey": self.link["publishable_key"], "Authorization": "Bearer " + self.link["access_token"]},
                timeout=12, allow_redirects=False, stream=True) as response:
                if response.status_code != 200 or response.headers.get("Content-Type", "").split(";")[0].strip().lower() != mime:
                    raise ValueError()
                data = bytearray()
                deadline = time.monotonic() + 20
                for chunk in response.iter_content(65536):
                    if time.monotonic() > deadline or len(data) + len(chunk) > MAX_BYTES:
                        raise ValueError()
                    data.extend(chunk)
                if not data.startswith(magic) or hashlib.sha256(data).hexdigest() != row["content_sha256"]:
                    raise ValueError()
        except (requests.RequestException, ValueError):
            raise BridgeError("The original report could not be verified or opened.") from None
        return bytes(data), mime, report_receipt(self.receipt_key, self.receipt_scope, loop_id, row)

    def audit_for(self, event_key):
        rows = self.rows("audit_events", "id,actor_id,loop_id,action,note,event_key", actor_id="eq." + self.link["supabase_user_id"], event_key="eq." + event_key, limit="2")
        if len(rows) > 1:
            raise BridgeError("Ambiguous confirmation receipt.", 409)
        return rows[0] if rows else None

    @staticmethod
    def verify_receipt(receipt, loop_id, note):
        if receipt["loop_id"] != loop_id or receipt["action"] != "review" or receipt["note"] != note:
            raise BridgeError("This request key was already used for a different action.", 409)

    def review(self, care_patient_id, loop_id, body, actor_name):
        patient = self.verify_identity()
        loop_id, key = uuid_string(loop_id), uuid_string(body.get("eventKey"))
        note = body.get("note")
        if not isinstance(note, str) or not 5 <= len(note.strip()) <= 1000:
            raise BridgeError("Enter a review note of 5–1,000 characters.", 400)
        note = note.strip()
        receipt = self.audit_for(key)
        if receipt:
            self.verify_receipt(receipt, loop_id, note)
            return self.workspace(care_patient_id, actor_name, patient)
        evidence_by_loop = {}
        current = self.workspace(care_patient_id, actor_name, patient, evidence_by_loop)
        if body.get("expectedVersion") != current["version"]:
            raise BridgeError("This view changed. Refresh before confirming.", 409)
        item = next((i for i in current["items"] if i["id"] == loop_id), None)
        if not item or not item["canReview"]:
            raise BridgeError("This pending report cannot be reviewed here.", 403)
        originals = evidence_by_loop[loop_id]
        receipts = body.get("reportReceipts", {})
        if (not isinstance(receipts, dict) or set(receipts) != {r["id"] for r in originals}
                or any(not valid_receipt(self.receipt_key, self.receipt_scope, loop_id, r, receipts[r["id"]]) for r in originals)):
            raise BridgeError("Open each current original report before confirming the review.", 409)
        self.call("/rest/v1/rpc/care_action", "POST", {"p_loop": loop_id, "p_action": "review", "p_event_key": key, "p_note": note})
        receipt = self.audit_for(key)
        if not receipt:
            raise BridgeError("The review outcome is not confirmed. Refresh before retrying.")
        self.verify_receipt(receipt, loop_id, note)
        return self.workspace(care_patient_id, actor_name, patient)
