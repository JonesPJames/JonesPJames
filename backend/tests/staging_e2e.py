"""Live staging E2E: Pro owner -> token exchange -> JARVIS -> Pro SOP -> Mongo readback.
Uses a unique synthetic owner in an isolated staging database. Never point at production.
"""
import json
import os
import urllib.request
import urllib.error
from uuid import uuid4

PRO = os.environ["STAGING_PRO_URL"].rstrip("/")
JARVIS = os.environ["STAGING_JARVIS_URL"].rstrip("/")
assert PRO == "https://remeslnik-pro-sop-staging-staging.up.railway.app"
assert JARVIS == "https://jarvis-api-staging-staging.up.railway.app"

def call(base, path, method="GET", payload=None, token=None, expected=(200,)):
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(base + path, data=None if payload is None else json.dumps(payload).encode(), headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as res:
            status = res.status
            data = json.loads(res.read())
    except urllib.error.HTTPError as exc:
        status = exc.code
        data = json.loads(exc.read())
    assert status in expected, f"{method} {path}: expected {expected}, got {status}: {data}"
    return data

def run():
    print("PASS 1: JARVIS health", flush=True)
    assert call(JARVIS, "/health")["ok"] is True
    print("PASS 2: Pro OpenAPI", flush=True)
    schema = call(PRO, "/openapi.json")
    assert "/api/jarvis/sop/token" in schema["paths"]
    assert "/api/jarvis/sop/projects" in schema["paths"]
    uid = uuid4().hex
    owner = call(PRO, "/api/auth/register", "POST", {
        "email": "jarvis-e2e-" + uid + "@example.com",
        "password": "E2E-" + uid,
        "name": "JARVIS E2E Synthetic Owner"
    })
    pro_token = owner["token"]
    print("PASS 3: synthetic owner registration", flush=True)
    gateway = call(PRO, "/api/jarvis/sop/token", "POST", {}, pro_token)["access_token"]
    print("PASS 4: delegated identity exchange", flush=True)
    assert call(JARVIS, "/api/v1/jarvis/sop/projects", "POST", {"name": "unauthorized"}, expected=(401,))["error"]["code"] == "UNAUTHORIZED"
    print("PASS 5: anonymous request denied", flush=True)
    created = call(JARVIS, "/api/v1/jarvis/sop/projects", "POST", {"name": "Staging E2E " + uid}, gateway, expected=(201,))["project"]
    assert created["companyId"] == owner["user"]["id"]
    assert created["state"]["version"] == 0
    print("PASS 6: project created through JARVIS", flush=True)
    command = {"type": "state.transition", "aggregateId": created["id"], "payload": {"target": "A"}, "expectedVersion": 0, "idempotencyKey": "e2e-" + uid}
    updated = call(JARVIS, "/api/v1/jarvis/command", "POST", command, gateway)["project"]
    assert updated["state"]["phase"] == "A" and updated["state"]["version"] == 1
    print("PASS 7: state transitioned via JARVIS", flush=True)
    readback = call(PRO, "/api/jarvis/sop/projects/" + created["id"], token=call(PRO, "/api/jarvis/sop/token", "POST", {}, pro_token)["access_token"], expected=(401,403))
    # Pro SOP read endpoint deliberately accepts only JARVIS service delegation, not gateway token.
    assert readback
    replay = call(JARVIS, "/api/v1/jarvis/command", "POST", command, gateway)["project"]
    assert replay["state"]["version"] == 1
    print("PASS 8: idempotent replay", flush=True)
    conflict = dict(command, idempotencyKey="conflict-" + uid)
    call(JARVIS, "/api/v1/jarvis/command", "POST", conflict, gateway, expected=(409,))
    print("PASS 9: stale version rejected", flush=True)
    assert "/api/jarvis/sop/jobs" in schema["paths"]
    assert call(JARVIS, "/api/v1/jarvis/jobs", expected=(401,))["error"]["code"] == "UNAUTHORIZED"
    print("PASS 10: anonymous jobs request denied", flush=True)
    empty = call(JARVIS, "/api/v1/jarvis/jobs", token=gateway)
    assert empty["count"] == 0 and empty["jobs"] == []
    print("PASS 11: owner-scoped jobs initially empty", flush=True)
    job = call(PRO, "/api/jobs", "POST", {"client_name": "E2E client", "title": "E2E job " + uid, "address": "Test only"}, pro_token)
    own = call(JARVIS, "/api/v1/jarvis/jobs", token=gateway)
    assert own["count"] == 1 and own["jobs"][0]["id"] == job["id"]
    print("PASS 12: operational job visible via JARVIS", flush=True)
    other = call(PRO, "/api/auth/register", "POST", {
        "email": "jarvis-e2e-other-" + uid + "@example.com",
        "password": "E2E-other-" + uid,
        "name": "Other E2E Owner"
    })
    other_gateway = call(PRO, "/api/jarvis/sop/token", "POST", {}, other["token"])["access_token"]
    isolated = call(JARVIS, "/api/v1/jarvis/jobs", token=other_gateway)
    assert isolated["count"] == 0 and isolated["jobs"] == []
    print("PASS 13: other owner cannot read first owner's jobs", flush=True)
    print("STAGING_E2E_PASS", flush=True)

if __name__ == "__main__":
    run()
