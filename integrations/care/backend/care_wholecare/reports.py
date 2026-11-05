"""Only verified PDF/PNG/JPEG evidence bound to the current patient and loop."""
import hashlib
import hmac
import json
import re
import time

REPORT_LIMIT = 8
MAX_BYTES = 10 * 1024 * 1024
TYPES = {"pdf": ("application/pdf", b"%PDF-"), "png": ("image/png", b"\x89PNG\r\n\x1a\n"), "jpg": ("image/jpeg", b"\xff\xd8\xff"), "jpeg": ("image/jpeg", b"\xff\xd8\xff")}


def report_type(patient_id, row):
    path, checksum = row.get("storage_path"), row.get("content_sha256")
    if row.get("is_fixture") is not False or not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-f]{64}", checksum):
        return None
    if not isinstance(path, str) or not re.fullmatch(re.escape(patient_id) + r"/[a-zA-Z0-9_-]{1,120}\.(pdf|png|jpe?g)", path, re.I):
        return None
    return TYPES[path.rsplit(".", 1)[1].lower()]


def report_receipt(key, scope, loop_id, row, now=None):
    expires = int(time.time() if now is None else now) + 1200
    return str(expires) + "." + receipt_signature(key, scope, loop_id, row, expires)


def receipt_signature(key, scope, loop_id, row, expires):
    data = json.dumps([scope, loop_id, row["id"], row["content_sha256"], expires], separators=(",", ":")).encode()
    return hmac.new(key, data, hashlib.sha256).hexdigest()


def valid_receipt(key, scope, loop_id, row, token, now=None):
    if not isinstance(token, str) or not re.fullmatch(r"[0-9]{1,12}\.[0-9a-f]{64}", token):
        return False
    exp, signature = token.split(".")
    return int(exp) > (time.time() if now is None else now) and hmac.compare_digest(
        signature, receipt_signature(key, scope, loop_id, row, int(exp)))
