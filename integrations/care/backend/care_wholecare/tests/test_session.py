import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from cryptography.fernet import Fernet
from care_wholecare.bridge import BridgeError
from care_wholecare.session import SessionStore
from test_bridge import link


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.dir = root / "sessions"
        self.dir.mkdir(mode=0o700)
        self.key = root / "key"
        self.key.touch(mode=0o600)
        self.key.write_bytes(Fernet.generate_key())
        self.mapping = link()
        self.now, self.rotations = 10000, []
        def exchange(mapping, token):
            self.rotations.append(token)
            n = len(self.rotations)
            return dict(access_token=f"access-{n}", refresh_token=f"refresh-{n}", expires_at=self.now + 120)
        self.store = SessionStore(self.dir, self.key, refresh=exchange, clock=lambda: self.now)

    def attach(self):
        with patch("care_wholecare.session.SupabaseDelegate.verify_identity"):
            self.store.link(self.mapping, "initial-refresh")

    def test_wrong_identity_never_persists(self):
        with patch("care_wholecare.session.SupabaseDelegate.verify_identity", side_effect=BridgeError("denied", 403)):
            with self.assertRaises(BridgeError):
                self.store.link(self.mapping, "wrong-account")
        self.assertFalse(list(self.dir.glob("*.session")))

    def test_encrypted_reopen_and_single_rotation_across_concurrent_requests(self):
        self.attach()
        self.assertNotIn(b"refresh-1", next(self.dir.glob("*.session")).read_bytes())
        self.now += 120
        def get_access(_):
            store = SessionStore(self.dir, self.key, refresh=self.store.refresh, clock=lambda: self.now)
            with store.delegation(self.mapping) as delegate:
                return delegate.link["access_token"]
        with ThreadPoolExecutor(4) as pool:
            self.assertEqual(list(pool.map(get_access, range(4))), ["access-2"] * 4)
        self.assertEqual(self.rotations, ["initial-refresh", "refresh-1"])

    def test_disconnect_revokes_only_its_provider_session_and_disables_legacy_fallback(self):
        self.attach()
        with patch("care_wholecare.session.requests.post") as post:
            post.return_value.status_code = 204
            self.assertTrue(self.store.disconnect(self.mapping))
            self.assertEqual(post.call_args.kwargs["params"], {"scope": "local"})
        with self.assertRaises(BridgeError) as err:
            with self.store.delegation(self.mapping): self.fail("delegation survived")
        self.assertEqual(err.exception.status, 428)

    def test_invalid_provider_refresh_clears_link_but_temporary_error_does_not(self):
        self.attach()
        self.now += 120
        for code, retained in [(503, True), (428, False)]:
            with patch.object(self.store, "refresh", side_effect=BridgeError("safe error", code)):
                with self.assertRaises(BridgeError):
                    with self.store.delegation(self.mapping): self.fail("must not use stale token")
            self.assertEqual(bool(list(self.dir.glob("*.session"))), retained)
