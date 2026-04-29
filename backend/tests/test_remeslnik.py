"""Backend tests for Remeslnik Pro 1.0"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://tradesmen-quotes.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@remeslnikpro.cz"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# -------------------- Auth --------------------
class TestAuth:
    def test_login_admin_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == ADMIN_EMAIL
        assert d["token"]

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_register_and_me(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.cz"
        payload = {"email": email, "password": "test1234", "name": "TEST User", "company": "TEST s.r.o.", "phone": "+420 111 222 333"}
        r = requests.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == email.lower()
        assert d["user"]["name"] == "TEST User"
        token = d["token"]

        # GET /auth/me
        rm = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert rm.status_code == 200
        assert rm.json()["email"] == email.lower()

        # without token
        rno = requests.get(f"{API}/auth/me", timeout=15)
        assert rno.status_code == 401

        # PUT /auth/me
        ru = requests.put(f"{API}/auth/me", json={"name": "Updated", "company": "C2", "phone": "+420 999"},
                          headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, timeout=15)
        assert ru.status_code == 200
        assert ru.json()["name"] == "Updated"
        assert ru.json()["company"] == "C2"

    def test_register_duplicate(self):
        email = f"dup_{uuid.uuid4().hex[:8]}@example.cz"
        payload = {"email": email, "password": "x1234", "name": "Dup"}
        r1 = requests.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/auth/register", json=payload, timeout=15)
        assert r2.status_code == 400


# -------------------- Jobs --------------------
class TestJobs:
    def test_create_job_with_lines(self, auth_headers):
        payload = {
            "client_name": "TEST Klient",
            "address": "Praha 1",
            "title": "TEST Rekonstrukce",
            "prace": [{"popis": "Bourání", "mnozstvi": 4, "jednotka": "h", "cena": 500}],
            "material": [{"popis": "Cement", "mnozstvi": 10, "jednotka": "ks", "cena": 200}],
            "doprava": [{"popis": "Doprava", "mnozstvi": 1, "jednotka": "ks", "cena": 600}],
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "rozpracovano"
        assert j["job_number"].startswith(str(time.gmtime().tm_year) + "-")
        assert len(j["job_number"].split("-")[1]) == 3  # NNN
        # totals
        assert j["totals"]["cena_prace"] == 2000
        assert j["totals"]["cena_material"] == 2000
        assert j["totals"]["cena_doprava"] == 600
        assert j["totals"]["celkem"] == 4600
        pytest.job_id = j["id"]

    def test_get_job(self, auth_headers):
        jid = pytest.job_id
        r = requests.get(f"{API}/jobs/{jid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == jid

    def test_list_jobs_filter(self, auth_headers):
        r = requests.get(f"{API}/jobs?status=rozpracovano&q=TEST", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert any(j["id"] == pytest.job_id for j in items)

    def test_update_job_recompute_and_status(self, auth_headers):
        jid = pytest.job_id
        r = requests.put(f"{API}/jobs/{jid}",
                         json={"prace": [{"popis": "X", "mnozstvi": 2, "jednotka": "h", "cena": 1000}], "status": "schvaleno"},
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "schvaleno"
        assert d["totals"]["cena_prace"] == 2000

    def test_odlozeno_and_renew(self, auth_headers):
        jid = pytest.job_id
        r = requests.put(f"{API}/jobs/{jid}", json={"status": "odlozeno"}, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["postponed_at"]
        assert r.json()["effective_status"] == "odlozeno"

        r2 = requests.post(f"{API}/jobs/{jid}/renew", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["status"] == "odlozeno"
        assert r2.json()["postponed_at"]

    def test_diary_and_extras_and_finalize(self, auth_headers):
        jid = pytest.job_id
        # add diary entries + vicepracovne + material_navic, set dokonceno
        body = {
            "status": "dokonceno",
            "diary_entries": [{"date": "2026-01-01", "work": "Bourání", "weather": "Slunečno", "workers": "2", "notes": "OK"}],
            "vicepracovne": [{"popis": "Extra prace", "mnozstvi": 2, "jednotka": "h", "cena": 500}],
            "material_navic": [{"popis": "Extra mat", "mnozstvi": 3, "jednotka": "ks", "cena": 100}],
        }
        r = requests.put(f"{API}/jobs/{jid}", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "dokonceno"
        assert d["totals"]["vicepracovne_total"] == 1300
        assert d["totals"]["celkem_k_fakturaci"] == d["totals"]["celkem"] + 1300
        assert len(d["diary_entries"]) == 1

        # finalize
        rf = requests.put(f"{API}/jobs/{jid}", json={"finalized": True}, headers=auth_headers, timeout=15)
        assert rf.status_code == 200
        assert rf.json()["finalized"] is True

        # locked: subsequent PUT should 400
        rl = requests.put(f"{API}/jobs/{jid}", json={"title": "blocked"}, headers=auth_headers, timeout=15)
        assert rl.status_code == 400


# -------------------- PDFs --------------------
class TestPDFs:
    def test_quote_pdf(self, auth_headers, admin_token):
        jid = pytest.job_id
        r = requests.get(f"{API}/jobs/{jid}/pdf", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_billing_pdf_with_query_token(self, admin_token):
        jid = pytest.job_id
        r = requests.get(f"{API}/jobs/{jid}/billing-pdf?token={admin_token}", timeout=20)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"


# -------------------- AI --------------------
class TestAI:
    def test_material_price(self, auth_headers):
        r = requests.post(f"{API}/ai/material-price", json={"name": "keramická dlažba"}, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "jednotka" in d and "cena" in d and "poznamka" in d
        assert isinstance(d["cena"], (int, float))

    def test_enhance_description(self, auth_headers):
        r = requests.post(f"{API}/ai/enhance-description", json={"text": "rekonstrukce koupelny vcetne dlazby a obkladu"},
                          headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert len(r.json()["text"]) > 10

    def test_generate_variants_and_pdf(self, auth_headers, admin_token):
        payload = {
            "title": "TEST Rekonstrukce koupelny",
            "client": "TEST",
            "address": "Praha",
            "cena_material": 30000,
            "cena_prace": 20000,
            "cena_doprava": 2000,
            "description": "Kompletní rekonstrukce koupelny",
            "narocnost": "stredni",
            "urgence": "bezna",
            "typ_klienta": "bezny",
        }
        r = requests.post(f"{API}/ai/generate-variants", json=payload, headers=auth_headers, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        assert isinstance(d["variants"], list) and len(d["variants"]) == 3
        bundle_id = d["id"]

        # PDF for the bundle
        pr = requests.get(f"{API}/quote-variants/{bundle_id}/pdf?token={admin_token}", timeout=30)
        assert pr.status_code == 200
        assert pr.content[:4] == b"%PDF"


# -------------------- Import --------------------
class TestImport:
    def test_remeslnik_ai_import(self, auth_headers):
        body = {
            "cinnost": "Pokládka dlažby",
            "parametry": "20 m2 koupelna",
            "material": [{"nazev": "Dlažba", "mnozstvi": 22, "jednotka": "m2", "cena": 350}],
            "pracovni_postup": [{"krok": "Příprava podlahy", "hodiny": 4, "cena_hodina": 400}],
            "cas_hodiny": 8,
        }
        r = requests.post(f"{API}/import/remeslnik-ai", json=body, headers=auth_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "Pokládka dlažby"
        assert len(d["material"]) == 1 and d["material"][0]["popis"] == "Dlažba"
        assert len(d["prace"]) == 1 and d["prace"][0]["mnozstvi"] == 4
