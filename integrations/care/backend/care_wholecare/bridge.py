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

PROJECT_URL = "https://gylnitduoasmybadblcp.supabase.co"


class BridgeError(Exception):
    def __init__(self, detail, status=503):
        self.detail, self.status = detail, status


def uuid_string(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise BridgeError("Mapped resource not available.", 404) from None


def load_link(path, care_user_id, care_patient_id):
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
        if float(selected["expires_at"]) <= time.time():
            raise BridgeError("The WholeCare account link expired. Relink the development account.")
        return selected
    except BridgeError:
        raise
    except (OSError, ValueError, KeyError, TypeError):
        raise BridgeError("The WholeCare account link is not configured safely.") from None


class SupabaseDelegate:
    """Every operation runs under the mapped user's normal Supabase RLS/RPC identity."""
    def __init__(self, link, transport=requests.request):
        self.link, self.transport = link, transport
        self.patient_id = uuid_string(link["supabase_patient_id"])

    def call(self, path, method="GET", data=None, params=None):
        try:
            response = self.transport(
                method, PROJECT_URL + path,
                headers={"apikey": self.link["publishable_key"], "Authorization": "Bearer " + self.link["access_token"], "Content-Type": "application/json"},
                json=data, params=params, timeout=12, allow_redirects=False,
            )
            if response.status_code == 401:
                raise BridgeError("The WholeCare account link expired. Relink the development account.")
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

    def workspace(self, care_patient_id, actor_name, patient=None):
        patient = patient or self.verify_identity()
        now = datetime.now(timezone.utc).isoformat()
        loops = self.rows("care_loops", "id,item_id,state,next_owner,due_at,review_note,closed_at", state="neq.CANCELLED", due_at="lte." + now, order="due_at.desc,id.desc", limit="40")
        items = {row["id"]: row for row in self.rows("care_plan_items", "id,plan_id,domain,label,source_excerpt,requires_human_review", limit="1000")}
        evidence = self.rows("evidence", "id,loop_id,label,is_fixture", order="created_at.desc,id.desc", limit="1000")
        # A capped evidence read cannot establish that every attached report is a
        # fixture. Preserve read access but require the original app for review.
        evidence_complete = len(evidence) < 1000
        plans = self.rows("care_plans", "id,status,active,source_note", status="eq.confirmed", limit="100")
        plan_ids = {row["id"] for row in plans}
        audit = self.rows("audit_events", "id,actor_id,action,note,created_at,loop_id,event_key", action="eq.review", order="created_at.desc,id.desc", limit="20")
        entries = []
        for loop in loops:
            item = items.get(loop["item_id"])
            if not item or item["plan_id"] not in plan_ids:
                continue
            reports = [r for r in evidence if r["loop_id"] == loop["id"]]
            fixture = evidence_complete and bool(reports) and all(r["is_fixture"] for r in reports)
            summary = {
                "REVIEW_PENDING": "Evidence is waiting for clinician review.",
                "CLOSED": "Completion or review is recorded in WholeCare.",
                "DUE": "This scheduled action is due; completion is not yet confirmed.",
                "UNCONFIRMED": "Participation is unresolved; this does not establish a missed dose.",
            }.get(loop["state"], "Inspect the source in WholeCare.")
            source = item.get("source_excerpt") or "Clinician-confirmed WholeCare care-plan item."
            if reports:
                source += "\nEvidence: " + "; ".join(r["label"] for r in reports)
                source += "\nSynthetic fixture placeholder; no clinical findings." if fixture else "\nOriginal private-file review remains in the existing WholeCare app."
            if loop.get("review_note"):
                source += "\nRecorded review: " + loop["review_note"]
            entries.append({
                "id": loop["id"], "domain": {"medication": "Medication", "meals": "Meals", "glucose": "Monitoring", "test": "Investigation"}[item["domain"]],
                "label": item["label"], "state": loop["state"], "nextOwner": loop["next_owner"].capitalize(),
                "summary": summary, "source": source, "recordedAt": loop["due_at"],
                "canReview": loop["state"] == "REVIEW_PENDING" and item["requires_human_review"] and fixture,
            })
        entries.sort(key=lambda i: (i["state"] != "REVIEW_PENDING", i["state"] == "CLOSED", i["recordedAt"]))
        trail = [{"id": r["id"], "actor": actor_name if r["actor_id"] == self.link["supabase_user_id"] else "WholeCare care team", "action": "report_reviewed", "taskId": r["loop_id"], "note": r["note"], "recordedAt": r["created_at"]} for r in audit]
        version = hashlib.sha256(json.dumps({"items": entries, "trail": trail}, sort_keys=True).encode()).hexdigest()
        return {
            "carePatientId": str(care_patient_id), "mode": "connected", "version": version, "snapshotAt": now,
            "patient": {"displayName": patient["display_name"] + " · synthetic", "reference": "WholeCare linked patient", "facility": "Isolated CARE demonstration"},
            "actor": {"displayName": actor_name},
            "planSource": next((p["source_note"] for p in plans if p["active"]), "No active confirmed plan."),
            "items": entries, "trail": trail,
        }

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
        current = self.workspace(care_patient_id, actor_name, patient)
        if body.get("expectedVersion") != current["version"]:
            raise BridgeError("This view changed. Refresh before confirming.", 409)
        item = next((i for i in current["items"] if i["id"] == loop_id), None)
        if not item or not item["canReview"]:
            raise BridgeError("Only a pending synthetic fixture report can be reviewed here.", 403)
        self.call("/rest/v1/rpc/care_action", "POST", {"p_loop": loop_id, "p_action": "review", "p_event_key": key, "p_note": note})
        receipt = self.audit_for(key)
        if not receipt:
            raise BridgeError("The review outcome is not confirmed. Refresh before retrying.")
        self.verify_receipt(receipt, loop_id, note)
        return self.workspace(care_patient_id, actor_name, patient)
