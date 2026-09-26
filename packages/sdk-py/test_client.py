import io
import json
import unittest
import urllib.error
from unittest import mock

from pgcloud import Pgcloud, PgcloudError


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def opener_with(answers):
    calls = []

    def opener(req, timeout=None):
        calls.append(req)
        status, body = answers.pop(0)
        raw = json.dumps(body).encode()
        if status >= 400:
            raise urllib.error.HTTPError(req.full_url, status, "err", {}, io.BytesIO(raw))
        return FakeResponse(raw)

    return opener, calls


class ClientTest(unittest.TestCase):
    def test_headers_and_idempotency(self):
        opener, calls = opener_with([(200, {"data": []}), (202, {"id": "srv_1", "status": "new"})])
        pg = Pgcloud(token="pgc_x", base_url="http://api.test/v1", project="staging", opener=opener)
        pg.servers.list()
        pg.servers.create(name="web-1", size="s-1vcpu-1gb", image="ubuntu-24-04")
        self.assertEqual(calls[0].full_url, "http://api.test/v1/servers?project=staging")
        self.assertEqual(calls[0].get_header("Authorization"), "Bearer pgc_x")
        self.assertIsNone(calls[0].get_header("Idempotency-key"))
        self.assertEqual(calls[1].get_method(), "POST")
        self.assertTrue(calls[1].get_header("Idempotency-key"))
        self.assertEqual(json.loads(calls[1].data), {"project": "staging", "name": "web-1", "size": "s-1vcpu-1gb", "image": "ubuntu-24-04"})

    def test_error_mapping(self):
        opener, _ = opener_with([(403, {"error": {"code": "approval_required", "message": "A team owner must approve this first", "details": {"approvalId": "apr_1"}}})])
        pg = Pgcloud(token="t", base_url="http://api.test", opener=opener)
        with self.assertRaises(PgcloudError) as cm:
            pg.servers.delete("srv_1")
        self.assertEqual(cm.exception.status, 403)
        self.assertTrue(cm.exception.needs_approval)
        self.assertEqual(cm.exception.details["approvalId"], "apr_1")

    def test_wait_until_active(self):
        opener, calls = opener_with([(200, {"id": "s", "status": "provisioning"}), (200, {"id": "s", "status": "active"})])
        pg = Pgcloud(token="t", base_url="http://api.test", opener=opener)
        with mock.patch("time.sleep"):
            s = pg.servers.wait_until_active("s")
        self.assertEqual(s["status"], "active")
        self.assertEqual(len(calls), 2)
        opener, _ = opener_with([(200, {"id": "s", "status": "failed", "statusMessage": "No capacity"})])
        pg = Pgcloud(token="t", base_url="http://api.test", opener=opener)
        with self.assertRaisesRegex(PgcloudError, "No capacity"):
            pg.servers.wait_until_active("s")


if __name__ == "__main__":
    unittest.main()
