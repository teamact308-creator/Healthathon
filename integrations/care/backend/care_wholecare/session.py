"""Encrypted, serialized session rotation for the single-host CARE demo."""
import fcntl
import hashlib
import hmac
import json
import math
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

import requests
from cryptography.fernet import Fernet

from care_wholecare.bridge import BridgeError, PROJECT_URL, SupabaseDelegate

LINK_LIFETIME = 7 * 86400
RECONNECT = "Connect to WholeCare to continue."


def exchange(mapping, refresh_token, transport=requests.request):
    if not isinstance(refresh_token, str) or not 1 <= len(refresh_token) <= 4096:
        raise BridgeError("A valid WholeCare sign-in is required.", 400)
    try:
        response = transport("POST", PROJECT_URL + "/auth/v1/token",
            params={"grant_type": "refresh_token"},
            headers={"apikey": mapping["publishable_key"]},
            json={"refresh_token": refresh_token}, timeout=12, allow_redirects=False)
        if response.status_code in (400, 401, 403):
            raise BridgeError(RECONNECT, 428)
        if response.status_code != 200 or len(response.content) > 100_000:
            raise ValueError()
        data = response.json()
        ttl = float(data["expires_in"])
        if not math.isfinite(ttl) or not 0 < ttl <= 86400:
            raise ValueError()
        session = {k: data[k] for k in ("access_token", "refresh_token")}
        if not all(isinstance(v, str) and 0 < len(v) <= 16384 for v in session.values()):
            raise ValueError()
        session["expires_at"] = time.time() + ttl
        return session
    except (requests.RequestException, ValueError, TypeError, KeyError):
        raise BridgeError("WholeCare sign-in is temporarily unavailable. Try again.") from None


class SessionStore:
    def __init__(self, directory, key_file, refresh=exchange, clock=time.time):
        self.root, self.clock, self.refresh = Path(directory), clock, refresh
        key = Path(key_file)
        if not directory or not key_file or self.root.stat().st_mode & 0o077 or key.stat().st_mode & 0o077:
            raise BridgeError("WholeCare account linking is not configured safely.")
        raw_key = key.read_bytes().strip()
        self.cipher = Fernet(raw_key)
        self.receipt_key = hmac.digest(raw_key, b"wholecare-report-receipt-v1", "sha256")

    @staticmethod
    def scope_key(mapping):
        return hashlib.sha256(json.dumps([mapping[k] for k in (
            "care_user_id", "care_patient_id", "care_facility_id",
            "supabase_user_id", "supabase_patient_id",
        )]).encode()).hexdigest()

    @contextmanager
    def locked(self, mapping):
        scope = self.scope_key(mapping)
        fd = os.open(self.root / (scope + ".lock"), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, "rb") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            yield self.root / (scope + ".session")

    def read(self, path):
        if not path.exists():
            return None
        if path.stat().st_mode & 0o077:
            raise BridgeError("WholeCare account linking is not configured safely.")
        return json.loads(self.cipher.decrypt(path.read_bytes()))

    def save(self, path, session):
        fd, tmp = tempfile.mkstemp(dir=self.root)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(self.cipher.encrypt(json.dumps(session).encode()))
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp, path)
            self.sync_dir()
        finally:
            Path(tmp).unlink(missing_ok=True)

    def sync_dir(self):
        fd = os.open(self.root, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)

    def delete(self, path):
        path.unlink(missing_ok=True)
        self.sync_dir()

    def link(self, mapping, refresh_token):
        with self.locked(mapping) as path:
            previous = self.read(path)
            if previous and previous["bound_until"] > self.clock():
                raise BridgeError("Disconnect the existing WholeCare link before connecting another session.", 409)
            session = self.refresh(mapping, refresh_token)
            SupabaseDelegate({**mapping, **session}).verify_identity()
            self.save(path, {**session, "bound_until": self.clock() + LINK_LIFETIME, "link_id": str(uuid4())})

    @contextmanager
    def delegation(self, mapping):
        # Hold the same scope lock through each operation so disconnect cannot race a review.
        with self.locked(mapping) as path:
            session = self.read(path)
            if not session or session["bound_until"] <= self.clock():
                self.delete(path)
                raise BridgeError(RECONNECT, 428)
            if session["expires_at"] <= self.clock() + 60:
                try:
                    updated = self.refresh(mapping, session["refresh_token"])
                except BridgeError as e:
                    if e.status == 428:
                        self.delete(path)
                    raise
                session.update(updated)
                self.save(path, session)
            try:
                yield SupabaseDelegate({**mapping, **session}, receipt_key=self.receipt_key)
            except BridgeError as e:
                if e.status == 428:
                    self.delete(path)
                raise

    def disconnect(self, mapping):
        with self.locked(mapping) as path:
            session = self.read(path)
            self.delete(path)
            if not session:
                return True
            try:
                if session["expires_at"] <= self.clock() + 15:
                    session.update(self.refresh(mapping, session["refresh_token"]))
                result = requests.post(PROJECT_URL + "/auth/v1/logout",
                    params={"scope": "local"}, headers={"apikey": mapping["publishable_key"],
                    "Authorization": "Bearer " + session["access_token"]},
                    timeout=12, allow_redirects=False)
                return result.status_code in (200, 204)
            except (requests.RequestException, BridgeError):
                return False
