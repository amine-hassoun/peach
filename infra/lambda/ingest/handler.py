import base64
import hmac
import json
import os
import re
import time
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
SSM = boto3.client("ssm")
SECRET_PARAM = os.environ["SECRET_PARAM_NAME"]

SOURCE = "linkedin-extension"
TTL_SECONDS = 30 * 24 * 3600
MAX_BATCH = 100
JOB_ID_RE = re.compile(r"^\d{5,20}$")

_secret = None


def get_secret():
    global _secret
    if _secret is None:
        _secret = SSM.get_parameter(Name=SECRET_PARAM, WithDecryption=True)["Parameter"]["Value"]
    return _secret


def reply(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def to_item(job):
    if not isinstance(job, dict):
        return None
    job_id = str(job.get("jobId", "")).strip()
    title = str(job.get("title", "")).strip()[:300]
    company = str(job.get("company", "")).strip()[:200]
    description = str(job.get("description", "")).strip()[:15000]
    if not JOB_ID_RE.match(job_id) or not title or not company or len(description) < 100:
        return None
    item = {
        "job_id": f"{SOURCE}#{job_id}",
        "source": SOURCE,
        "title": title,
        "company": company,
        "description": description,
        "url": f"https://www.linkedin.com/jobs/view/{job_id}/",
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": int(time.time()) + TTL_SECONDS,
    }
    location = str(job.get("location") or "").strip()[:200]
    if location:
        item["location"] = location
    return item


def handler(event, context):
    sent = (event.get("headers") or {}).get("x-peach-key", "")
    if not hmac.compare_digest(sent.encode(), get_secret().encode()):
        return reply(401, {"error": "unauthorized"})

    try:
        raw = event.get("body") or ""
        if event.get("isBase64Encoded"):
            raw = base64.b64decode(raw).decode("utf-8")
        jobs = json.loads(raw)["jobs"]
        if not isinstance(jobs, list) or not 1 <= len(jobs) <= MAX_BATCH:
            raise ValueError("bad batch size")
    except (ValueError, KeyError, TypeError):
        return reply(400, {"error": 'expected JSON {"jobs": [1-100 items]}'})

    stored, duplicates, rejected = 0, 0, []
    for index, job in enumerate(jobs):
        item = to_item(job)
        if item is None:
            rejected.append(index)
            continue
        try:
            TABLE.put_item(Item=item, ConditionExpression="attribute_not_exists(job_id)")
            stored += 1
        except ClientError as err:
            code = err.response["Error"]["Code"]
            if code == "ConditionalCheckFailedException":
                duplicates += 1
            else:
                print(json.dumps({"error": code, "job_id": item["job_id"]}))
                return reply(500, {"error": "storage_error"})

    return reply(200, {"stored": stored, "duplicates": duplicates, "rejected": rejected})