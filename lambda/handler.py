"""peach: single-user backend.

One Lambda behind a Function URL does two jobs:
  1. serves the built static site from ./dist (same origin as the API, so no CORS)
  2. exposes GET/PUT /api/stays, guarded by a secret token, backed by ONE DynamoDB item
"""
import base64
import datetime
import hashlib
import hmac
import json
import logging
import os
import re
from decimal import Decimal
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

log = logging.getLogger()
log.setLevel(logging.INFO)

DIST = Path(__file__).parent / "dist"
TABLE_NAME = os.environ.get("TABLE_NAME", "peach-stays")
TOKEN_SHA256 = os.environ.get("TOKEN_SHA256", "")
PK = "stays"
MAX_BODY_BYTES = 64 * 1024
MAX_STAYS = 500
MAX_NOTE = 200
MAX_ID = 64
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
OPEN_ACCESS = os.environ.get("OPEN_ACCESS", "") == "true"

TEXT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json",
}
BINARY_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
}
SECURITY_HEADERS = {
    "content-security-policy": (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; font-src 'self' data:; connect-src 'self'; "
        "manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'"
    ),
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
}

_table = None


def table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb").Table(TABLE_NAME)
    return _table


def _json_default(o):
    if isinstance(o, Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError(f"not serializable: {type(o)}")


def json_response(status, obj):
    return {
        "statusCode": status,
        "headers": {**SECURITY_HEADERS, "content-type": "application/json", "cache-control": "no-store"},
        "body": json.dumps(obj, default=_json_default),
    }


def authorized(token):
    if OPEN_ACCESS:
        return True
    # Fail closed: no configured hash means nobody gets in.
    if not TOKEN_SHA256 or not token:
        return False
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return hmac.compare_digest(digest, TOKEN_SHA256)


def valid_date(v):
    if not isinstance(v, str) or not ISO_DATE.match(v):
        return False
    try:
        datetime.date.fromisoformat(v)
        return True
    except ValueError:
        return False


def clean_stay(s):
    """Rebuild each stay from known keys only: nothing unexpected is ever stored."""
    if not isinstance(s, dict):
        raise ValueError("stay must be an object")
    sid = s.get("id")
    if not isinstance(sid, str) or not 0 < len(sid) <= MAX_ID:
        raise ValueError("bad id")
    entry, exit_ = s.get("entry"), s.get("exit")
    if not valid_date(entry):
        raise ValueError("bad entry date")
    if exit_ is not None and not valid_date(exit_):
        raise ValueError("bad exit date")
    if exit_ is not None and exit_ < entry:  # ISO dates sort lexicographically
        raise ValueError("exit before entry")
    note = s.get("note") or ""
    if not isinstance(note, str) or len(note) > MAX_NOTE:
        raise ValueError("bad note")
    upd = s.get("updatedAt")
    if isinstance(upd, bool) or not isinstance(upd, (int, str)) or (isinstance(upd, str) and len(upd) > 40):
        raise ValueError("bad updatedAt")
    return {
        "id": sid,
        "entry": entry,
        "exit": exit_,
        "note": note,
        "updatedAt": upd,
        "deleted": bool(s.get("deleted", False)),
    }


def parse_put_body(event):
    raw = event.get("body") or ""
    data = base64.b64decode(raw) if event.get("isBase64Encoded") else raw.encode("utf-8")
    if len(data) > MAX_BODY_BYTES:
        raise ValueError("body too large")
    try:
        body = json.loads(data, parse_float=Decimal)
    except json.JSONDecodeError:
        raise ValueError("invalid json")
    if not isinstance(body, dict):
        raise ValueError("body must be an object")
    base = body.get("baseVersion")
    if base is not None and (isinstance(base, bool) or not isinstance(base, int) or base < 0):
        raise ValueError("bad baseVersion")
    stays = body.get("stays")
    if not isinstance(stays, list) or len(stays) > MAX_STAYS:
        raise ValueError("bad stays")
    return base, [clean_stay(s) for s in stays]


def api(method, event):
    headers = event.get("headers") or {}
    if not authorized(headers.get("x-peach-token", "")):
        return json_response(401, {"error": "unauthorized"})

    if method == "GET":
        item = table().get_item(Key={"pk": PK}).get("Item")
        if not item:
            return json_response(404, {"error": "not_found"})
        return json_response(200, {"version": item["version"], "stays": item["stays"]})

    try:
        base, stays = parse_put_body(event)
    except ValueError as e:
        return json_response(400, {"error": str(e)})

    new_version = 1 if base is None else base + 1
    item = {
        "pk": PK,
        "version": new_version,
        "stays": stays,
        "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    try:
        if base is None:
            table().put_item(Item=item, ConditionExpression="attribute_not_exists(pk)")
        else:
            table().put_item(
                Item=item,
                ConditionExpression="#v = :b",
                ExpressionAttributeNames={"#v": "version"},
                ExpressionAttributeValues={":b": base},
            )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        cur = table().get_item(Key={"pk": PK}).get("Item")
        return json_response(409, {"version": cur["version"] if cur else None, "stays": cur["stays"] if cur else []})
    return json_response(200, {"version": new_version})


def static(path):
    root = DIST.resolve()
    rel = path.lstrip("/") or "index.html"
    target = (DIST / rel).resolve()
    if not target.is_relative_to(root):
        return plain(404)
    if not target.is_file():
        if Path(rel).suffix:
            return plain(404)
        target = root / "index.html"  # SPA fallback for extension-less paths
    ext = target.suffix.lower()
    cache = "public, max-age=31536000, immutable" if rel.startswith("assets/") else "no-cache"
    headers = {**SECURITY_HEADERS, "cache-control": cache}
    data = target.read_bytes()
    if ext in TEXT_TYPES:
        return {"statusCode": 200, "headers": {**headers, "content-type": TEXT_TYPES[ext]}, "body": data.decode("utf-8")}
    return {
        "statusCode": 200,
        "headers": {**headers, "content-type": BINARY_TYPES.get(ext, "application/octet-stream")},
        "body": base64.b64encode(data).decode("ascii"),
        "isBase64Encoded": True,
    }


def plain(status):
    return {"statusCode": status, "headers": {**SECURITY_HEADERS, "content-type": "text/plain"}, "body": ""}


def handler(event, context=None):
    http = (event.get("requestContext") or {}).get("http") or {}
    method = (http.get("method") or "GET").upper()
    path = event.get("rawPath") or "/"
    try:
        if path == "/api/stays":
            if method not in ("GET", "PUT"):
                return plain(405)
            return api(method, event)
        if path.startswith("/api/"):
            return plain(404)
        if method not in ("GET", "HEAD"):
            return plain(405)
        return static(path)
    except Exception:
        log.exception("unhandled error")
        return json_response(500, {"error": "internal"})
