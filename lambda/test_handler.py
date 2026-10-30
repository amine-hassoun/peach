import base64
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from botocore.exceptions import ClientError

import handler as h

TOKEN = "a" * 64
GOOD = {"x-peach-token": TOKEN}


class FakeTable:
    def __init__(self):
        self.item = None

    def get_item(self, Key):
        return {"Item": self.item} if self.item else {}

    def put_item(self, Item, ConditionExpression=None, ExpressionAttributeNames=None, ExpressionAttributeValues=None):
        if "attribute_not_exists" in ConditionExpression:
            ok = self.item is None
        else:
            ok = self.item is not None and self.item["version"] == ExpressionAttributeValues[":b"]
        if not ok:
            raise ClientError({"Error": {"Code": "ConditionalCheckFailedException"}}, "PutItem")
        self.item = Item


def stay(i="s1", entry="2026-01-10", exit_="2026-01-20", upd=1):
    return {"id": i, "entry": entry, "exit": exit_, "note": "", "updatedAt": upd, "deleted": False}


def ev(method="GET", path="/api/stays", headers=None, body=None):
    e = {"rawPath": path, "requestContext": {"http": {"method": method}}, "headers": headers or {}}
    if body is not None:
        e["body"] = body if isinstance(body, str) else json.dumps(body)
    return e


class HandlerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        dist = Path(self.tmp.name)
        (dist / "assets").mkdir()
        (dist / "index.html").write_text("<html>peach</html>")
        (dist / "assets" / "app.js").write_text("console.log(1)")
        (dist / "icon.png").write_bytes(b"\x89PNG\r\n")
        h.DIST = dist
        h.TOKEN_SHA256 = hashlib.sha256(TOKEN.encode()).hexdigest()
        self.t = FakeTable()
        h._table = self.t

    def tearDown(self):
        self.tmp.cleanup()

    def test_no_token_401(self):
        self.assertEqual(h.handler(ev())["statusCode"], 401)

    def test_wrong_token_401(self):
        self.assertEqual(h.handler(ev(headers={"x-peach-token": "b" * 64}))["statusCode"], 401)

    def test_fails_closed_without_configured_hash(self):
        h.TOKEN_SHA256 = ""
        self.assertEqual(h.handler(ev(headers=GOOD))["statusCode"], 401)

    def test_get_empty_404(self):
        self.assertEqual(h.handler(ev(headers=GOOD))["statusCode"], 404)

    def test_put_then_get(self):
        r = h.handler(ev("PUT", headers=GOOD, body={"baseVersion": None, "stays": [stay()]}))
        self.assertEqual((r["statusCode"], json.loads(r["body"])["version"]), (200, 1))
        r = h.handler(ev(headers=GOOD))
        body = json.loads(r["body"])
        self.assertEqual((r["statusCode"], body["version"], body["stays"][0]["id"]), (200, 1, "s1"))

    def test_put_increments_version(self):
        h.handler(ev("PUT", headers=GOOD, body={"baseVersion": None, "stays": []}))
        r = h.handler(ev("PUT", headers=GOOD, body={"baseVersion": 1, "stays": [stay()]}))
        self.assertEqual(json.loads(r["body"])["version"], 2)

    def test_stale_put_409_returns_current(self):
        h.handler(ev("PUT", headers=GOOD, body={"baseVersion": None, "stays": [stay("a")]}))
        r = h.handler(ev("PUT", headers=GOOD, body={"baseVersion": None, "stays": [stay("b")]}))
        body = json.loads(r["body"])
        self.assertEqual((r["statusCode"], body["version"], body["stays"][0]["id"]), (409, 1, "a"))

    def test_put_with_base_when_table_empty_409_null_version(self):
        r = h.handler(ev("PUT", headers=GOOD, body={"baseVersion": 3, "stays": []}))
        self.assertEqual((r["statusCode"], json.loads(r["body"])["version"]), (409, None))

    def test_validation_400(self):
        bad = [
            {"baseVersion": None, "stays": [stay(entry="2026-13-40")]},
            {"baseVersion": None, "stays": [stay(entry="2026-02-01", exit_="2026-01-01")]},
            {"baseVersion": None, "stays": [{**stay(), "note": "x" * 201}]},
            {"baseVersion": None, "stays": [{**stay(), "id": ""}]},
            {"baseVersion": -1, "stays": []},
            {"baseVersion": None, "stays": "nope"},
            {"baseVersion": None, "stays": [stay(str(i)) for i in range(501)]},
        ]
        for body in bad:
            with self.subTest(body=str(body)[:60]):
                self.assertEqual(h.handler(ev("PUT", headers=GOOD, body=body))["statusCode"], 400)

    def test_body_too_large_and_bad_json(self):
        self.assertEqual(h.handler(ev("PUT", headers=GOOD, body="x" * 70000))["statusCode"], 400)
        self.assertEqual(h.handler(ev("PUT", headers=GOOD, body="{nope"))["statusCode"], 400)

    def test_unknown_keys_dropped(self):
        h.handler(ev("PUT", headers=GOOD, body={"baseVersion": None, "stays": [{**stay(), "evil": "x"}]}))
        self.assertNotIn("evil", self.t.item["stays"][0])

    def test_open_stay_allowed(self):
        r = h.handler(ev("PUT", headers=GOOD, body={"baseVersion": None, "stays": [stay(exit_=None)]}))
        self.assertEqual(r["statusCode"], 200)

    def test_api_method_and_unknown_path(self):
        self.assertEqual(h.handler(ev("DELETE", headers=GOOD))["statusCode"], 405)
        self.assertEqual(h.handler(ev(path="/api/other"))["statusCode"], 404)

    def test_static_index_and_headers(self):
        r = h.handler(ev(path="/"))
        self.assertEqual((r["statusCode"], r["body"]), (200, "<html>peach</html>"))
        self.assertIn("noindex", r["headers"]["x-robots-tag"])
        self.assertIn("frame-ancestors 'none'", r["headers"]["content-security-policy"])
        self.assertEqual(r["headers"]["cache-control"], "no-cache")

    def test_static_asset_immutable_and_spa_fallback(self):
        r = h.handler(ev(path="/assets/app.js"))
        self.assertIn("immutable", r["headers"]["cache-control"])
        self.assertEqual(h.handler(ev(path="/settings"))["body"], "<html>peach</html>")

    def test_static_missing_file_404_and_traversal(self):
        self.assertEqual(h.handler(ev(path="/assets/nope.js"))["statusCode"], 404)
        self.assertEqual(h.handler(ev(path="/../handler.py"))["statusCode"], 404)
        self.assertEqual(h.handler(ev(path="/%2e%2e/handler.py"))["statusCode"], 404)

    def test_static_binary_base64(self):
        r = h.handler(ev(path="/icon.png"))
        self.assertTrue(r["isBase64Encoded"])
        self.assertEqual(base64.b64decode(r["body"]), b"\x89PNG\r\n")

    def test_static_post_405(self):
        self.assertEqual(h.handler(ev("POST", path="/"))["statusCode"], 405)


if __name__ == "__main__":
    unittest.main()
