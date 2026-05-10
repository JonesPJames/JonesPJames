"""Backend tests for Řemeslník Pro 1.0 - V2 (multi-tenant company_code)

Tests the NEW changes:
A) Auth /auth/login-pin with new company_code parameter
B) Register creates unique company_code
C) Multi-tenant isolation (KEY TEST)
D) Regression: DELETE /api/employees/{id}
E) POST /api/employees stores company_code from owner
F) Regression of other endpoints
"""
import os
import re
import sys
import io
import time
import uuid
import json
import requests
from pathlib import Path

# Read backend URL from frontend .env
def get_base_url() -> str:
    env_path = Path("/app/frontend/.env")
    base = None
    for line in env_path.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            base = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
    if not base:
        base = "http://localhost:8001"
    return base.rstrip("/") + "/api"

BASE = get_base_url()
print(f"[INFO] Testing against: {BASE}")

OWNER_EMAIL = "admin@remeslnikpro.cz"
OWNER_PASS = "admin123"
EMPLOYEE_PIN = "4998"
EXPECTED_CODE = "JG756Z"

results = []

def record(name: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    results.append({"name": name, "ok": ok, "detail": detail})


def login_owner():
    r = requests.post(f"{BASE}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS}, timeout=20)
    r.raise_for_status()
    return r.json().get("token")


# ====== A) Auth /auth/login-pin with company_code ======
def test_a_login_pin_with_company_code():
    print("\n--- A) PIN login with company_code ---")

    # A.1 - correct code + correct PIN
    r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": "JG756Z", "pin": "4998"}, timeout=20)
    ok = r.status_code == 200
    if ok:
        emp = r.json().get("employee", {})
        ok = emp.get("id") == "ZAM-001"
        record("A.1 login-pin {JG756Z, 4998} => 200, employee=ZAM-001",
               ok, f"HTTP {r.status_code} emp_id={emp.get('id')} name={emp.get('name')} cc={emp.get('company_code')}")
    else:
        record("A.1 login-pin {JG756Z, 4998} => 200", False, f"HTTP {r.status_code}: {r.text[:200]}")

    # A.2 - case-insensitive (lowercase)
    r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": "jg756z", "pin": "4998"}, timeout=20)
    ok = r.status_code == 200
    if ok:
        emp = r.json().get("employee", {})
        ok = emp.get("id") == "ZAM-001"
    record("A.2 login-pin lowercase {jg756z, 4998} => 200 (case-insensitive)",
           ok, f"HTTP {r.status_code} body={r.text[:150]}")

    # A.3 - wrong company_code
    r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": "WRONG1", "pin": "4998"}, timeout=20)
    ok = r.status_code == 401
    msg = ""
    try:
        msg = r.json().get("detail", "")
    except Exception:
        msg = r.text[:80]
    record("A.3 login-pin wrong code => 401",
           ok and "firmy" in msg.lower(),
           f"HTTP {r.status_code} detail='{msg}'")

    # A.4 - correct code, wrong PIN
    r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": "JG756Z", "pin": "0000"}, timeout=20)
    record("A.4 login-pin correct code + wrong PIN => 401",
           r.status_code == 401, f"HTTP {r.status_code}")

    # A.5 - empty company_code
    r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": "", "pin": "4998"}, timeout=20)
    msg = ""
    try:
        msg = r.json().get("detail", "")
    except Exception:
        msg = r.text[:80]
    ok = r.status_code == 400 and "firm" in msg.lower()
    record("A.5 login-pin empty company_code => 400 'Zadejte identifikátor firmy'",
           ok, f"HTTP {r.status_code} detail='{msg}'")

    # A.6 - PIN too short
    r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": "JG756Z", "pin": "12"}, timeout=20)
    msg = ""
    try:
        msg = r.json().get("detail", "")
    except Exception:
        msg = r.text[:80]
    ok = r.status_code == 400 and "PIN" in msg
    record("A.6 login-pin pin too short => 400 'PIN musí mít 4 číslice'",
           ok, f"HTTP {r.status_code} detail='{msg}'")

    # A.7 - old format without company_code
    r = requests.post(f"{BASE}/auth/login-pin", json={"pin": "4998"}, timeout=20)
    record("A.7 login-pin without company_code => 400",
           r.status_code == 400, f"HTTP {r.status_code} body={r.text[:150]}")


# ====== B) Register creates unique company_code ======
def test_b_register_company_code():
    print("\n--- B) Register generates unique company_code ---")

    suffix_random = uuid.uuid4().hex[:8]
    email = f"test-{suffix_random}@example.cz"
    r = requests.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": "abc12345", "name": "Test Uživatel", "company": "Firma Test s.r.o."},
        timeout=20,
    )
    if r.status_code != 200:
        record("B.1 POST /auth/register", False, f"HTTP {r.status_code} body={r.text[:200]}")
        return None, None
    data = r.json()
    user = data.get("user", {})
    token = data.get("token", "")
    code = user.get("company_code", "")

    alphabet = set("ABCDEFGHJKMNPQRSTUVWXYZ23456789")
    is_valid = (
        isinstance(code, str)
        and len(code) == 6
        and all(ch in alphabet for ch in code)
    )
    record("B.1 register returns 6-char company_code from valid alphabet",
           is_valid,
           f"code='{code}' len={len(code)}")

    # B.2 - GET /auth/me has same company_code
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    if r.status_code != 200:
        record("B.2 GET /auth/me returns company_code", False, f"HTTP {r.status_code}")
    else:
        cc = r.json().get("company_code", "")
        record("B.2 /auth/me company_code matches register",
               cc == code, f"register={code} me={cc}")

    # B.3 - 5 different accounts → unique company_code
    codes = [code]
    tokens = [token]
    for i in range(5):
        suffix = uuid.uuid4().hex[:8]
        eml = f"test-uniq-{suffix}@example.cz"
        rr = requests.post(
            f"{BASE}/auth/register",
            json={"email": eml, "password": "abc12345", "name": f"User {i}", "company": f"Firma {i}"},
            timeout=20,
        )
        if rr.status_code == 200:
            cc = rr.json().get("user", {}).get("company_code", "")
            tk = rr.json().get("token", "")
            codes.append(cc)
            tokens.append(tk)

    unique = len(set(codes)) == len(codes)
    record("B.3 5+ company_codes are all unique",
           unique and len(codes) >= 5, f"codes={codes} unique={len(set(codes))}")

    return token, code


# ====== C) Multi-tenant isolation ======
def test_c_multitenant_isolation():
    print("\n--- C) Multi-tenant isolation (KEY TEST) ---")

    # Create owner A
    suf_a = uuid.uuid4().hex[:8]
    ra = requests.post(
        f"{BASE}/auth/register",
        json={"email": f"owner-a-{suf_a}@example.cz", "password": "abc12345", "name": "Owner A", "company": "Firma A"},
        timeout=20,
    )
    if ra.status_code != 200:
        record("C.0 register owner A", False, f"HTTP {ra.status_code} body={ra.text[:200]}")
        return
    a_data = ra.json()
    token_a = a_data["token"]
    code_a = a_data["user"]["company_code"]
    record("C.1 register owner A", True, f"code_a={code_a}")

    # Create owner B
    suf_b = uuid.uuid4().hex[:8]
    rb = requests.post(
        f"{BASE}/auth/register",
        json={"email": f"owner-b-{suf_b}@example.cz", "password": "abc12345", "name": "Owner B", "company": "Firma B"},
        timeout=20,
    )
    if rb.status_code != 200:
        record("C.0 register owner B", False, f"HTTP {rb.status_code} body={rb.text[:200]}")
        return
    b_data = rb.json()
    token_b = b_data["token"]
    code_b = b_data["user"]["company_code"]
    record("C.2 register owner B (different code)", code_a != code_b, f"code_a={code_a} code_b={code_b}")

    # Create employee in firma A
    ha = {"Authorization": f"Bearer {token_a}"}
    re_a = requests.post(f"{BASE}/employees", headers=ha,
                        json={"name": "Honza A", "phone": "111", "trade": "zednik"}, timeout=20)
    if re_a.status_code != 200:
        record("C.3 create employee in firma A", False, f"HTTP {re_a.status_code} body={re_a.text[:200]}")
        return
    emp_a = re_a.json()
    pin_a = emp_a["pin"]
    record("C.3 employee A created", True, f"id={emp_a['id']} pin={pin_a} cc={emp_a.get('company_code')}")
    # also check company_code matches owner A
    record("C.3a employee A company_code matches owner A",
           emp_a.get("company_code") == code_a,
           f"emp={emp_a.get('company_code')} owner={code_a}")

    # Try to create employee in firma B with attempt to get same PIN as A
    # Strategy: create up to 30 employees in firma B and check at least one collides on PIN
    hb = {"Authorization": f"Bearer {token_b}"}
    emp_b_with_same_pin = None
    employees_b = []
    for i in range(30):
        rr = requests.post(f"{BASE}/employees", headers=hb,
                          json={"name": f"Honza B{i}", "phone": "222", "trade": "zednik"}, timeout=20)
        if rr.status_code != 200:
            record(f"C.4 create employee B[{i}]", False, f"HTTP {rr.status_code} body={rr.text[:150]}")
            break
        e = rr.json()
        employees_b.append(e)
        # check company_code matches B
        if e.get("company_code") != code_b:
            record(f"C.4a employee B[{i}] has wrong company_code", False,
                   f"emp={e.get('company_code')} owner={code_b}")
        if e["pin"] == pin_a:
            emp_b_with_same_pin = e
            break

    record("C.4 30 employees created in firma B without global PIN-collision error",
           len(employees_b) > 0, f"created {len(employees_b)} employees in firma B")

    # Check that employees were properly created with correct company_code
    all_have_b_code = all(e.get("company_code") == code_b for e in employees_b)
    record("C.4a all employees in firma B have company_code = code_b",
           all_have_b_code, f"all={all_have_b_code}")

    # If we got a PIN collision in firma B same as firma A → KEY proof of multi-tenant index works
    if emp_b_with_same_pin:
        record("C.5 KEY: identical PIN allowed across firms (composite index)",
               True, f"PIN {pin_a} now exists in both firma A (emp={emp_a['id']}) and firma B (emp={emp_b_with_same_pin['id']})")
    else:
        # Fall back: try direct DB insertion to force a collision
        try:
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            mdb = mc["remeslnik_pro"]
            # find owner B id
            owner_b = mdb.users.find_one({"company_code": code_b})
            forced_emp = {
                "id": "ZAM-FORCE-99",
                "owner_user_id": owner_b["id"],
                "company_code": code_b,
                "name": "Forced Same PIN",
                "phone": "999",
                "pin": pin_a,
                "trade": "zednik",
                "active": True,
            }
            try:
                mdb.employees.insert_one(forced_emp)
                emp_b_with_same_pin = forced_emp
                record("C.5 KEY: composite index permits same PIN across firms (forced via direct DB)",
                       True, f"PIN {pin_a} forced in firma B (id=ZAM-FORCE-99); insertion succeeded.")
            except Exception as ex:
                record("C.5 KEY: composite index permits same PIN across firms",
                       False, f"DB insertion failed: {ex}")
        except Exception as ex:
            record("C.5 KEY: composite index permits same PIN across firms (fallback)",
                   False, f"could not reach mongo: {ex}")

    # C.6 - login firm A with PIN A
    r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": code_a, "pin": pin_a}, timeout=20)
    ok = r.status_code == 200
    if ok:
        emp = r.json().get("employee", {})
        ok = emp.get("id") == emp_a["id"]
    record("C.6 login {code_a, pin_a} returns Honza A", ok,
           f"HTTP {r.status_code} body={r.text[:200]}")

    # C.7 - login firm B with PIN A (should be valid in B if collision exists, OR 401)
    if emp_b_with_same_pin:
        # PIN A also exists in firma B as Honza B*
        r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": code_b, "pin": pin_a}, timeout=20)
        ok = r.status_code == 200
        if ok:
            emp = r.json().get("employee", {})
            # MUST return Honza B (not Honza A)
            returned_id = emp.get("id")
            is_b_employee = returned_id == emp_b_with_same_pin["id"]
            record("C.7 KEY: login {code_b, pin_a} returns Honza B (NOT Honza A)",
                   is_b_employee,
                   f"returned id={returned_id} expected={emp_b_with_same_pin['id']} (Honza A id={emp_a['id']})")
        else:
            record("C.7 login {code_b, pin_a} returned non-200", False,
                   f"HTTP {r.status_code} body={r.text[:200]}")

    # C.8 - cross login: firma A + a PIN that ONLY exists in firma B (find one)
    pin_b_only = None
    pins_a = {pin_a}
    for e in employees_b:
        if e["pin"] not in pins_a:
            pin_b_only = e["pin"]
            break
    if pin_b_only:
        r = requests.post(f"{BASE}/auth/login-pin", json={"company_code": code_a, "pin": pin_b_only}, timeout=20)
        # Either 401 (typical) or 200 returning some other employee in A — the second case must NEVER return Honza B
        if r.status_code == 401:
            record("C.8 cross login {code_a, pin_b_only} => 401",
                   True, f"HTTP 401 (correct - PIN does not exist in firma A)")
        elif r.status_code == 200:
            emp = r.json().get("employee", {})
            # If returned must NOT be a firma-B employee
            owner = emp.get("owner_user_id")
            # Get owner A id
            try:
                ome = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token_a}"}, timeout=20)
                owner_a_id = ome.json().get("id")
            except Exception:
                owner_a_id = None
            record("C.8 cross login {code_a, pin_b_only} - returned employee belongs to A only",
                   owner == owner_a_id,
                   f"HTTP 200 returned owner_user_id={owner}, owner_a_id={owner_a_id}")
        else:
            record("C.8 cross login {code_a, pin_b_only}", False, f"HTTP {r.status_code}")


# ====== D) Regression: DELETE /api/employees/{id} ======
def test_d_delete_employee():
    print("\n--- D) Regression: DELETE /api/employees/{id} ---")
    token = login_owner()
    h = {"Authorization": f"Bearer {token}"}

    r = requests.post(f"{BASE}/employees", headers=h,
                     json={"name": "Test Mazat", "phone": "555", "trade": "zednik"}, timeout=20)
    if r.status_code != 200:
        record("D.0 create employee for delete", False, f"HTTP {r.status_code} body={r.text[:200]}")
        return
    emp = r.json()
    eid = emp["id"]
    record("D.0 create employee", True, f"id={eid}")

    # delete
    r = requests.delete(f"{BASE}/employees/{eid}", headers=h, timeout=20)
    ok = r.status_code == 200
    body = {}
    try:
        body = r.json()
    except Exception:
        pass
    record("D.1 DELETE /employees/{id} => 200 ok=true",
           ok and body.get("ok") is True, f"HTTP {r.status_code} body={body}")

    # GET /employees - should not contain it
    r = requests.get(f"{BASE}/employees", headers=h, timeout=20)
    contains = any(e.get("id") == eid for e in r.json())
    record("D.2 GET /employees does not contain deleted",
           r.status_code == 200 and not contains, f"contains={contains}")

    # DELETE invalid
    r = requests.delete(f"{BASE}/employees/INVALID-XYZ", headers=h, timeout=20)
    record("D.3 DELETE /employees/INVALID => 404",
           r.status_code == 404, f"HTTP {r.status_code}")


# ====== E) POST /api/employees stores company_code ======
def test_e_create_employee_company_code():
    print("\n--- E) POST /api/employees stores owner's company_code ---")
    token = login_owner()
    h = {"Authorization": f"Bearer {token}"}

    # owner code
    rome = requests.get(f"{BASE}/auth/me", headers=h, timeout=20)
    owner_code = rome.json().get("company_code", "")

    r = requests.post(f"{BASE}/employees", headers=h,
                     json={"name": "Karel Code", "phone": "777", "trade": "obkladac"}, timeout=20)
    if r.status_code != 200:
        record("E.1 POST /employees", False, f"HTTP {r.status_code} body={r.text[:200]}")
        return
    emp = r.json()
    record("E.1 POST /employees response.company_code matches owner",
           emp.get("company_code") == owner_code,
           f"emp.company_code={emp.get('company_code')} owner.company_code={owner_code}")

    # cleanup
    requests.delete(f"{BASE}/employees/{emp['id']}", headers=h, timeout=20)


# ====== F) Regression of other endpoints (quick) ======
def test_f_regression():
    print("\n--- F) Regression of other endpoints ---")
    # F.1 owner login
    r = requests.post(f"{BASE}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASS}, timeout=20)
    record("F.1 POST /auth/login owner => 200", r.status_code == 200, f"HTTP {r.status_code}")
    token = r.json().get("token")

    h = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE}/auth/me", headers=h, timeout=20)
    me = r.json() if r.status_code == 200 else {}
    record("F.2 GET /auth/me => 200 with company_code",
           r.status_code == 200 and bool(me.get("company_code")),
           f"HTTP {r.status_code} cc='{me.get('company_code')}'")

    # admin should be JG756Z
    record("F.2a admin company_code == JG756Z (per spec)",
           me.get("company_code") == EXPECTED_CODE,
           f"got '{me.get('company_code')}', expected '{EXPECTED_CODE}'")

    # F.3 POST /jobs
    r = requests.post(f"{BASE}/jobs", headers=h,
                     json={"client_name": "Reg client", "address": "X 1", "title": "Reg test"}, timeout=20)
    record("F.3 POST /jobs => 200",
           r.status_code == 200, f"HTTP {r.status_code}")
    job_id = r.json().get("id") if r.status_code == 200 else None

    # F.4 AI generate-variants invariants
    payload = {
        "title": "Rekonstrukce regrese",
        "client": "X",
        "address": "Y",
        "cena_material": 18000,
        "cena_prace": 22000,
        "cena_doprava": 1500,
        "description": "Testovací popis",
        "narocnost": "stredni",
        "urgence": "bezna",
        "typ_klienta": "bezny",
    }
    r = requests.post(f"{BASE}/ai/generate-variants", headers=h, json=payload, timeout=120)
    if r.status_code == 200:
        d = r.json()
        base = d.get("base_price")
        vs = d.get("variants", [])
        if len(vs) == 3:
            A = vs[0]["cena_kc"]; B = vs[1]["cena_kc"]; C = vs[2]["cena_kc"]
            record("F.4 AI invariant A>=base", A >= base, f"A={A} base={base}")
            record("F.4 AI invariant B<=A*1.15", B <= A * 1.15 + 1, f"A={A} B={B}")
            record("F.4 AI invariant C<=B*1.20", C <= B * 1.20 + 1, f"B={B} C={C}")
            # warranty
            def parse_months(z):
                m = re.search(r"(\d{1,3})", z or "")
                if not m:
                    return 0
                n = int(m.group(1))
                if "rok" in (z or "").lower() or "let" in (z or "").lower():
                    n *= 12
                return n
            all_ok = all(parse_months(v.get("zaruka", "")) <= 48 for v in vs)
            record("F.4 AI all warranties <= 48m", all_ok,
                   f"warranties={[v.get('zaruka') for v in vs]}")
        else:
            record("F.4 AI returned 3 variants", False, f"got {len(vs)}")
        bundle_id = d.get("id")
    else:
        record("F.4 POST /ai/generate-variants", False, f"HTTP {r.status_code}: {r.text[:150]}")
        bundle_id = None

    # F.5 PDF endpoints copyright
    if job_id:
        for endpoint in [f"{BASE}/jobs/{job_id}/pdf", f"{BASE}/jobs/{job_id}/billing-pdf"]:
            rr = requests.get(endpoint, params={"token": token}, timeout=60)
            ok = rr.status_code == 200 and rr.headers.get("content-type", "").startswith("application/pdf")
            if ok:
                # extract text
                try:
                    from pypdf import PdfReader
                    reader = PdfReader(io.BytesIO(rr.content))
                    text = ""
                    for page in reader.pages:
                        text += page.extract_text() or ""
                    has_copyright = "James P. Jones 2026" in text
                except Exception:
                    has_copyright = b"James P. Jones 2026" in rr.content
                record(f"F.5 {endpoint.rsplit('/',1)[-1]} has 'James P. Jones 2026'",
                       has_copyright,
                       f"HTTP {rr.status_code} bytes={len(rr.content)}")
            else:
                record(f"F.5 GET {endpoint}", False, f"HTTP {rr.status_code}")

        # cleanup job
        requests.delete(f"{BASE}/jobs/{job_id}", headers=h, timeout=20)

    if bundle_id:
        rr = requests.get(f"{BASE}/quote-variants/{bundle_id}/pdf", params={"token": token}, timeout=60)
        ok = rr.status_code == 200 and rr.headers.get("content-type", "").startswith("application/pdf")
        if ok:
            try:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(rr.content))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                has_copyright = "James P. Jones 2026" in text
            except Exception:
                has_copyright = b"James P. Jones 2026" in rr.content
            record("F.5 quote-variants/{id}/pdf has copyright",
                   has_copyright, f"HTTP {rr.status_code} bytes={len(rr.content)}")
        else:
            record("F.5 quote-variants/{id}/pdf", False, f"HTTP {rr.status_code}")


# ====== Run all ======
def main():
    test_a_login_pin_with_company_code()
    test_b_register_company_code()
    test_c_multitenant_isolation()
    test_d_delete_employee()
    test_e_create_employee_company_code()
    test_f_regression()

    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    failed = total - passed
    print("\n========== SUMMARY (V2) ==========")
    print(f"Total: {total}, Passed: {passed}, Failed: {failed}")
    if failed:
        print("\nFAILED:")
        for r in results:
            if not r["ok"]:
                print(f"  - {r['name']}: {r['detail']}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
