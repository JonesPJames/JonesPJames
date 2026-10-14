"""Live read-only JARVIS <-> Remeslnik Pro staging integration test."""
import json
import os
import time
import urllib.error
import urllib.request
from uuid import uuid4

PRO = os.environ.get("PRO_URL", "https://remeslnik-pro-sop-staging-staging.up.railway.app").rstrip("/")
JARVIS = os.environ.get("JARVIS_URL", "https://jarvis-api-staging-staging.up.railway.app").rstrip("/")

def call(base, path, method="GET", payload=None, token=None, expected=(200,)):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(base + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status, result = response.status, json.loads(response.read())
    except urllib.error.HTTPError as exc:
        status, result = exc.code, json.loads(exc.read())
    assert status in expected, f"{method} {path}: expected {expected}, got {status}: {result}"
    return result

def run():
    assert call(JARVIS, "/health")["ok"]
    print("PASS 1: JARVIS healthy", flush=True)
    schema = call(PRO, "/openapi.json")
    assert "/api/integrations/jarvis/token" in schema["paths"]
    assert "/api/integrations/jarvis/jobs" in schema["paths"]
    print("PASS 2: independent integration API available", flush=True)
    uid = uuid4().hex
    def create_owner(label):
        owner = call(PRO, "/api/auth/register", "POST", {
            "email": f"jarvis-pro-{label}-{uid}@example.com",
            "password": "E2E-" + uid, "name": label
        })
        gateway = call(PRO, "/api/integrations/jarvis/token", "POST", {}, owner["token"])["access_token"]
        return owner, gateway
    owner, gateway = create_owner("First")
    print("PASS 3: Pro identity exchanged independently", flush=True)
    call(JARVIS, "/api/v1/jarvis/jobs", expected=(401,))
    print("PASS 4: unauthenticated request rejected", flush=True)
    empty = call(JARVIS, "/api/v1/jarvis/jobs", token=gateway)
    assert empty["count"] == 0
    print("PASS 5: new account initially empty", flush=True)
    job = call(PRO, "/api/jobs", "POST", {
        "client_name": "E2E customer", "title": "E2E " + uid, "address": "Test"
    }, owner["token"])
    jobs = call(JARVIS, "/api/v1/jarvis/jobs", token=gateway)
    assert jobs["count"] == 1 and jobs["jobs"][0]["id"] == job["id"]
    print("PASS 6: owner sees own operational job", flush=True)
    detail = call(JARVIS, "/api/v1/jarvis/jobs/" + job["id"], token=gateway)
    assert detail["id"] == job["id"]
    print("PASS 7: owner sees own job detail", flush=True)
    other, other_gateway = create_owner("Second")
    assert call(JARVIS, "/api/v1/jarvis/jobs", token=other_gateway)["count"] == 0
    print("PASS 8: jobs isolated by owner", flush=True)
    call(JARVIS, "/api/v1/jarvis/jobs/" + job["id"], token=other_gateway, expected=(404,))
    print("PASS 9: detail isolated by owner", flush=True)
    print("JARVIS_PRO_E2E_PASS", flush=True)

if __name__ == "__main__":
    run()
