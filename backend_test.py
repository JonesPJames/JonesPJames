"""Backend tests for Řemeslník Pro 1.0

Tests against the public preview URL: EXPO_PUBLIC_BACKEND_URL.
"""
import os
import re
import sys
import json
import time
import requests
from pathlib import Path

# Read backend URL from frontend .env
def get_base_url() -> str:
    from pathlib import Path
    env_path = Path("/app/frontend/.env")
    base = None
    
    # Zkontrolujeme, zda .env vůbec existuje, než ho zkusíme přečíst
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
                base = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
    
    # Pokud soubor neexistuje, nespadneme, ale skočíme na localhost
    if not base:
        base = "http://localhost:8001"
    return base.rstrip("/") + "/api"

BASE = get_base_url()
print(f"[INFO] Testing against: {BASE}")

OWNER_EMAIL = "admin@remeslnikpro.cz"
OWNER_PASS = "admin123"
EMPLOYEE_PIN = "4998"

results = []

def record(name: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    results.append({"name": name, "ok": ok, "detail": detail})

def assert_true(cond, name, detail=""):
    record(name, bool(cond), detail)
    return bool(cond)

# ----- 1. Auth -----
def test_auth():
    r = requests.post(f"{BASE}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS}, timeout=20)
    if r.status_code != 200:
        record("auth/login owner", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return None, None
    data = r.json()
    owner_token = data.get("token")
    record("auth/login owner", bool(owner_token), f"user={data.get('user',{}).get('email')}")

    # /auth/me with Bearer
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {owner_token}"}, timeout=20)
    record("auth/me owner", r.status_code == 200 and r.json().get("email") == OWNER_EMAIL, f"HTTP {r.status_code}")

    # /auth/me without token must 401
    r = requests.get(f"{BASE}/auth/me", timeout=20)
    record("auth/me without token => 401", r.status_code == 401, f"HTTP {r.status_code}")

    # PIN login
    r = requests.post(f"{BASE}/auth/login-pin", json={"pin": EMPLOYEE_PIN}, timeout=20)
    if r.status_code != 200:
        record("auth/login-pin", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return owner_token, None
    edata = r.json()
    emp_token = edata.get("token")
    record("auth/login-pin", bool(emp_token), f"emp={edata.get('employee',{}).get('id')}")

    # /auth/me-employee
    r = requests.get(f"{BASE}/auth/me-employee", headers={"Authorization": f"Bearer {emp_token}"}, timeout=20)
    record("auth/me-employee", r.status_code == 200 and r.json().get("pin") == EMPLOYEE_PIN, f"HTTP {r.status_code}")

    # /auth/me-employee with owner token must 403
    r = requests.get(f"{BASE}/auth/me-employee", headers={"Authorization": f"Bearer {owner_token}"}, timeout=20)
    record("auth/me-employee owner token => 403", r.status_code == 403, f"HTTP {r.status_code}")

    # invalid PIN
    r = requests.post(f"{BASE}/auth/login-pin", json={"pin": "0000"}, timeout=20)
    record("auth/login-pin invalid => 401", r.status_code == 401, f"HTTP {r.status_code}")

    return owner_token, emp_token

# ----- 2. Job CRUD + auto-save -----
def test_job_crud(owner_token):
    h = {"Authorization": f"Bearer {owner_token}"}
    # CREATE
    create_payload = {
        "client_name": "Jana Nováková",
        "address": "Husova 12, Praha 5",
        "title": "Rekonstrukce koupelny",
        "prace": [{"popis": "Demontáž obkladů", "mnozstvi": 8, "jednotka": "h", "cena": 450}],
        "material": [{"popis": "Lepidlo na obklady", "mnozstvi": 5, "jednotka": "ks", "cena": 320}],
        "doprava": [{"popis": "Doprava materiálu", "mnozstvi": 1, "jednotka": "ks", "cena": 800}],
    }
    r = requests.post(f"{BASE}/jobs", json=create_payload, headers=h, timeout=20)
    if r.status_code != 200:
        record("POST /jobs", False, f"HTTP {r.status_code}: {r.text[:300]}")
        return None
    job = r.json()
    job_id = job["id"]
    record("POST /jobs", True, f"id={job_id}, number={job.get('job_number')}")

    # PUT autosave each field
    fields = {
        "client_name": "Jan Dvořák",
        "address": "Vodičkova 1, Praha 1",
        "title": "Zednické práce - opravy",
        "photo_url": "https://drive.google.com/folder/abc123",
        "payment_note": "Splatnost 21 dní, převodem.",
        "prace": [{"popis": "Omítky", "mnozstvi": 12, "jednotka": "m2", "cena": 600}],
        "material": [{"popis": "Cement 25kg", "mnozstvi": 10, "jednotka": "ks", "cena": 180}],
        "doprava": [{"popis": "Doprava", "mnozstvi": 1, "jednotka": "ks", "cena": 1000}],
        "vicepracovne": [{"popis": "Demolice", "mnozstvi": 2, "jednotka": "h", "cena": 500}],
        "material_navic": [{"popis": "Spárovačka", "mnozstvi": 3, "jednotka": "kg", "cena": 120}],
        "diary_entries": [{"date": "2026-05-04", "work": "Příprava povrchu", "weather": "slunečno", "workers": "2", "notes": "Bez problémů"}],
    }
    for k, v in fields.items():
        payload = {k: v}
        r = requests.put(f"{BASE}/jobs/{job_id}", json=payload, headers=h, timeout=20)
        ok = r.status_code == 200
        if ok:
            data = r.json()
            if k in ("prace", "material", "doprava", "vicepracovne", "material_navic", "diary_entries"):
                ok = isinstance(data.get(k), list) and len(data[k]) >= len(v)
            else:
                ok = data.get(k) == v
        record(f"PUT /jobs autosave: {k}", ok, f"HTTP {r.status_code}")

    # GET
    r = requests.get(f"{BASE}/jobs/{job_id}", headers=h, timeout=20)
    record("GET /jobs/{id}", r.status_code == 200 and r.json().get("id") == job_id, f"HTTP {r.status_code}")

    return job_id

# ----- 3. Job assignment -----
def test_assign(owner_token, job_id, emp_id="ZAM-001"):
    h = {"Authorization": f"Bearer {owner_token}"}

    # Without status=schvaleno -> 400
    r = requests.put(f"{BASE}/jobs/{job_id}/assign", json={"employee_ids": [emp_id]}, headers=h, timeout=20)
    record("PUT /jobs/{id}/assign rejects when status != schvaleno", r.status_code == 400, f"HTTP {r.status_code} body={r.text[:150]}")

    # set status = schvaleno
    r = requests.put(f"{BASE}/jobs/{job_id}", json={"status": "schvaleno"}, headers=h, timeout=20)
    record("PUT /jobs status=schvaleno", r.status_code == 200, f"HTTP {r.status_code}")

    # now assign
    r = requests.put(f"{BASE}/jobs/{job_id}/assign", json={"employee_ids": [emp_id]}, headers=h, timeout=20)
    if r.status_code != 200:
        record("PUT /jobs/{id}/assign success", False, f"HTTP {r.status_code} body={r.text[:200]}")
        return False
    data = r.json()
    ok = emp_id in (data.get("assigned_employee_ids") or [])
    record("PUT /jobs/{id}/assign success", ok, f"assigned={data.get('assigned_employee_ids')}")

    # GET also shows it
    r = requests.get(f"{BASE}/jobs/{job_id}", headers=h, timeout=20)
    ok = r.status_code == 200 and emp_id in (r.json().get("assigned_employee_ids") or [])
    record("GET /jobs after assign returns assigned_employee_ids", ok, f"HTTP {r.status_code}")
    return ok

# ----- 4. AI generator -----
def test_ai_variants(owner_token):
    h = {"Authorization": f"Bearer {owner_token}"}
    payload = {
        "title": "Rekonstrukce koupelny 4m2",
        "client": "Jan Novák",
        "address": "Praha 5",
        "cena_material": 18000,
        "cena_prace": 22000,
        "cena_doprava": 1500,
        "description": "Kompletní rekonstrukce koupelny - obklady, dlažba, sanita.",
        "narocnost": "stredni",
        "urgence": "bezna",
        "typ_klienta": "bezny",
    }
    r = requests.post(f"{BASE}/ai/generate-variants", json=payload, headers=h, timeout=120)
    if r.status_code != 200:
        record("POST /ai/generate-variants", False, f"HTTP {r.status_code}: {r.text[:300]}")
        return None
    data = r.json()
    bundle_id = data.get("id")
    base = data.get("base_price")
    variants = data.get("variants") or []
    if len(variants) < 3:
        record("AI variants count==3", False, f"got {len(variants)}")
        return None
    record("AI variants count==3", True, f"base={base}")

    A = variants[0]["cena_kc"]
    B = variants[1]["cena_kc"]
    C = variants[2]["cena_kc"]
    record("AI invariant: A >= base", A >= base, f"A={A} base={base}")
    # tests requested: B <= A*1.15+1, C <= B*1.20+1 (use small epsilon for rounding)
    record("AI invariant: B <= A*1.15+1", B <= A * 1.15 + 1, f"A={A} B={B} A*1.15={A*1.15}")
    record("AI invariant: C <= B*1.20+1", C <= B * 1.20 + 1, f"B={B} C={C} B*1.20={B*1.20}")
    record("AI invariant: B > A", B > A, f"A={A} B={B}")
    record("AI invariant: C > B", C > B, f"B={B} C={C}")

    # warranty cap 48 months
    def parse_months(z: str) -> int:
        m = re.search(r"(\d{1,3})", z or "")
        if not m:
            return 0
        n = int(m.group(1))
        if "rok" in (z or "").lower() or "let" in (z or "").lower():
            n *= 12
        return n
    all_ok = True
    for i, v in enumerate(variants):
        months = parse_months(v.get("zaruka", ""))
        ok = months <= 48
        if not ok:
            all_ok = False
        record(f"AI variant[{i}] záruka <= 48m", ok, f"zaruka='{v.get('zaruka')}' months={months}")
    return bundle_id

# ----- 5. Employee flow -----
def test_employee_flow(emp_token, owner_token, job_id):
    eh = {"Authorization": f"Bearer {emp_token}"}

    # GET /employee/jobs - must include job, no prices
    r = requests.get(f"{BASE}/employee/jobs", headers=eh, timeout=20)
    if r.status_code != 200:
        record("GET /employee/jobs", False, f"HTTP {r.status_code}: {r.text[:200]}")
        return
    jobs = r.json()
    found = next((j for j in jobs if j.get("id") == job_id), None)
    record("GET /employee/jobs contains assigned job", bool(found), f"count={len(jobs)}")
    if found:
        # ensure no prices in prace/material
        no_prices = True
        for r_ in (found.get("prace") or []) + (found.get("material") or []):
            if "cena" in r_:
                no_prices = False
                break
        record("Employee jobs view has no prices", no_prices, "")

    # PUT checklist
    r = requests.put(
        f"{BASE}/employee/jobs/{job_id}/checklist",
        json={"trade": "zednik", "basic_tools": ["zednická lžíce", "vodováha"], "extra_tools": ["míchačka"]},
        headers=eh,
        timeout=20,
    )
    record("PUT /employee/jobs/{id}/checklist (1st)", r.status_code == 200, f"HTTP {r.status_code} body={r.text[:200]}")

    # POST confirm
    r = requests.post(f"{BASE}/employee/jobs/{job_id}/checklist/confirm", headers=eh, timeout=20)
    record("POST /employee/jobs/{id}/checklist/confirm", r.status_code == 200, f"HTTP {r.status_code}")

    # PUT checklist again -> 400
    r = requests.put(
        f"{BASE}/employee/jobs/{job_id}/checklist",
        json={"trade": "zednik", "basic_tools": ["x"], "extra_tools": []},
        headers=eh,
        timeout=20,
    )
    record("PUT checklist after confirm => 400", r.status_code == 400, f"HTTP {r.status_code}")

    # POST diary
    r = requests.post(
        f"{BASE}/employee/jobs/{job_id}/diary",
        json={"date": "2026-05-04", "work": "Bourání staré dlažby", "weather": "polojasno", "workers": "2", "notes": "Hotovo dle plánu"},
        headers=eh,
        timeout=20,
    )
    record("POST /employee/jobs/{id}/diary", r.status_code == 200, f"HTTP {r.status_code}")

    # POST propose-vicepracovne
    r = requests.post(
        f"{BASE}/employee/jobs/{job_id}/propose-vicepracovne",
        json={"popis": "Dodatečná instalace zásuvky", "mnozstvi": 1, "jednotka": "ks", "note": "Na žádost klientky"},
        headers=eh,
        timeout=20,
    )
    if r.status_code != 200:
        record("POST /employee/jobs/{id}/propose-vicepracovne", False, f"HTTP {r.status_code} body={r.text[:200]}")
        return None
    proposal = r.json().get("proposal")
    record("POST /employee/jobs/{id}/propose-vicepracovne", True, f"pid={proposal.get('id')}")
    return proposal.get("id")

# ----- 6. Owner approve proposal -----
def test_resolve_proposal(owner_token, job_id, proposal_id):
    h = {"Authorization": f"Bearer {owner_token}"}
    r = requests.post(
        f"{BASE}/jobs/{job_id}/proposals/{proposal_id}/resolve",
        json={"action": "approve", "cena": 1500},
        headers=h,
        timeout=20,
    )
    if r.status_code != 200:
        record("POST proposals/{pid}/resolve approve", False, f"HTTP {r.status_code} body={r.text[:200]}")
        return
    data = r.json()
    rows = data.get("vicepracovne") or []
    found = any(abs((row.get("cena") or 0) - 1500) < 0.01 for row in rows)
    record("Approved proposal added to vicepracovne with cena=1500", found, f"vicepracovne={rows}")

# ----- 7. PDF endpoints -----
COPYRIGHT = "James P. Jones 2026"

def _pdf_contains(content: bytes, needle: str) -> bool:
    # Try to extract text from the PDF using pdfplumber/pypdf, fallback to raw scan
    try:
        from pypdf import PdfReader
        import io as _io
        reader = PdfReader(_io.BytesIO(content))
        text = ""
        for page in reader.pages:
            try:
                text += page.extract_text() or ""
            except Exception:
                pass
        if needle in text:
            return True
    except Exception:
        pass
    # raw scan (fonts may encode chars)
    if needle.encode("utf-8") in content:
        return True
    if needle.encode("latin-1", errors="ignore") in content:
        return True
    return False

def test_pdfs(owner_token, job_id, bundle_id):
    # uses ?token= query parameter
    r = requests.get(f"{BASE}/jobs/{job_id}/pdf", params={"token": owner_token}, timeout=60)
    ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf")
    record("GET /jobs/{id}/pdf via ?token=", ok, f"HTTP {r.status_code} ct={r.headers.get('content-type')} bytes={len(r.content)}")
    if ok:
        record("Quote PDF contains 'James P. Jones 2026'", _pdf_contains(r.content, COPYRIGHT), "")

    r = requests.get(f"{BASE}/jobs/{job_id}/billing-pdf", params={"token": owner_token}, timeout=60)
    ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf")
    record("GET /jobs/{id}/billing-pdf via ?token=", ok, f"HTTP {r.status_code} bytes={len(r.content)}")
    if ok:
        record("Billing PDF contains 'James P. Jones 2026'", _pdf_contains(r.content, COPYRIGHT), "")

    if bundle_id:
        r = requests.get(f"{BASE}/quote-variants/{bundle_id}/pdf", params={"token": owner_token}, timeout=60)
        ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf")
        record("GET /quote-variants/{id}/pdf via ?token=", ok, f"HTTP {r.status_code} bytes={len(r.content)}")
        if ok:
            record("Variants PDF contains 'James P. Jones 2026'", _pdf_contains(r.content, COPYRIGHT), "")

# ----- 8. 14d migration -----
def test_migration():
    # Use direct mongo to verify
    try:
        from pymongo import MongoClient
        c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        n = c["remeslnik_pro"]["jobs"].count_documents(
            {"payment_note": "Splatnost 14 dní od vystavení faktury."}
        )
        record("Migration: no jobs with old default payment_note", n == 0, f"count={n}")
    except Exception as e:
        record("Migration check", False, f"error: {e}")

# ----- DELETE -----
def test_delete(owner_token, job_id):
    h = {"Authorization": f"Bearer {owner_token}"}
    r = requests.delete(f"{BASE}/jobs/{job_id}", headers=h, timeout=20)
    record("DELETE /jobs/{id}", r.status_code == 200, f"HTTP {r.status_code}")

# ----- Run -----
def main():
    owner_token, emp_token = test_auth()
    if not owner_token:
        print("OWNER LOGIN FAILED — aborting further tests")
        return
    job_id = test_job_crud(owner_token)
    if not job_id:
        print("JOB CREATE FAILED — aborting")
        return
    test_assign(owner_token, job_id)
    bundle_id = test_ai_variants(owner_token)

    proposal_id = None
    if emp_token:
        proposal_id = test_employee_flow(emp_token, owner_token, job_id)
    if proposal_id:
        test_resolve_proposal(owner_token, job_id, proposal_id)

    test_pdfs(owner_token, job_id, bundle_id)
    test_migration()
    test_delete(owner_token, job_id)

    # ----- summary -----
    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    failed = total - passed
    print("\n========== SUMMARY ==========")
    print(f"Total: {total}, Passed: {passed}, Failed: {failed}")
    if failed:
        print("\nFAILED:")
        for r in results:
            if not r["ok"]:
                print(f"  - {r['name']}: {r['detail']}")
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
