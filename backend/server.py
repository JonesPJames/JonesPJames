"""Řemeslník Pro 1.0 - Backend"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, field_validator


# ---------- Config ----------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 30  # mobile app: long lived

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI(title="Remeslnik Pro API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("remeslnik")

# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": "access",
        "role": "owner",
        "exp": now_utc() + timedelta(days=ACCESS_TOKEN_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_employee_token(employee_id: str, owner_user_id: str) -> str:
    payload = {
        "sub": employee_id,
        "owner_user_id": owner_user_id,
        "type": "access",
        "role": "employee",
        "exp": now_utc() + timedelta(days=ACCESS_TOKEN_DAYS),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "company": u.get("company", ""),
        "phone": u.get("phone", ""),
        "company_code": u.get("company_code", ""),
    }

def clean_comma_float(v):
    if isinstance(v, str):
        v = v.replace(",", ".").replace(" ", "").strip()
    return v

def safe_float(v, default=0.0) -> float:
    if v is None:
        return default
    try:
        return float(str(v).replace(",", ".").replace(" ", "").strip())
    except Exception:
        return default

def _ensure_fonts():
    import urllib.request
    font_dir = ROOT_DIR / "fonts"
    font_dir.mkdir(exist_ok=True)
    urls = {
        "Roboto-Regular.ttf": "https://github.com/kivy/kivy/raw/master/kivy/data/fonts/Roboto-Regular.ttf",
        "Roboto-Bold.ttf": "https://github.com/kivy/kivy/raw/master/kivy/data/fonts/Roboto-Bold.ttf"
    }
    for name, url in urls.items():
        p = font_dir / name
        if not p.exists():
            try:
                logger.info(f"Stahuji nezbytný český font {name} pro PDF...")
                urllib.request.urlretrieve(url, p)
                logger.info(f"Font {name} byl úspěšně stažen.")
            except Exception as e:
                logger.error(f"Selhalo stahování fontu {name}: {e}")

# Easily-readable code generator
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

def _gen_company_code() -> str:
    import secrets
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))

async def get_current_user(request: Request) -> dict:
    actor = await get_current_actor(request)
    if actor.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Pouze pro vlastníka účtu")
    return actor["user"]

async def get_current_actor(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Nepřihlášený uživatel")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Vypršela platnost tokenu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Neplatný token")
    role = payload.get("role", "owner")
    if role == "employee":
        emp = await db.employees.find_one({"id": payload["sub"]}, {"_id": 0})
        if not emp or not emp.get("active", True):
            raise HTTPException(status_code=401, detail="Zaměstnanec neexistuje")
        return {
            "role": "employee",
            "employee": emp,
            "owner_user_id": payload.get("owner_user_id"),
            "user": None,
        }
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Uživatel neexistuje")
    return {"role": "owner", "user": user, "employee": None, "owner_user_id": user["id"]}

async def require_employee(request: Request) -> dict:
    actor = await get_current_actor(request)
    if actor.get("role") != "employee":
        raise HTTPException(status_code=403, detail="Pouze pro zaměstnance")
    return actor

# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)
    name: str
    company: str = ""
    phone: str = ""

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class LineItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    popis: str = ""
    mnozstvi: float = 1
    jednotka: str = "ks"
    cena: float = 0

    @field_validator("mnozstvi", "cena", mode="before")
    @classmethod
    def parse_floats(cls, v):
        return clean_comma_float(v)

class JobBase(BaseModel):
    client_name: str = ""
    address: str = ""
    title: str = ""
    prace: List[LineItem] = []
    material: List[LineItem] = []
    doprava: List[LineItem] = []

class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    client_name: Optional[str] = None
    address: Optional[str] = None
    title: Optional[str] = None
    prace: Optional[List[LineItem]] = None
    material: Optional[List[LineItem]] = None
    doprava: Optional[List[LineItem]] = None
    status: Optional[Literal["rozpracovano", "schvaleno", "odlozeno", "dokonceno"]] = None
    photo_url: Optional[str] = None
    payment_note: Optional[str] = None
    finalized: Optional[bool] = None
    vicepracovne: Optional[List[LineItem]] = None
    material_navic: Optional[List[LineItem]] = None
    diary_entries: Optional[List["DiaryEntry"]] = None

class DiaryEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    work: str = ""
    weather: str = ""
    workers: str = ""
    notes: str = ""
    photo_base64: Optional[str] = None

JobUpdate.model_rebuild()

async def next_job_number(user_id: str) -> str:
    year = datetime.now().year
    prefix = f"{year}-"
    last = await db.jobs.find_one(
        {"user_id": user_id, "job_number": {"$regex": f"^{prefix}"}},
        sort=[("job_number", -1)],
        projection={"_id": 0, "job_number": 1},
    )
    n = 1
    if last and last.get("job_number"):
        try:
            n = int(last["job_number"].split("-")[1]) + 1
        except Exception:
            n = 1
    return f"{prefix}{n:03d}"

def compute_totals(job: dict) -> dict:
    def sum_lines(lines):
        return sum((safe_float(it.get("mnozstvi")) or 0) * (safe_float(it.get("cena")) or 0) for it in (lines or []))
    work = sum_lines(job.get("prace"))
    mat = sum_lines(job.get("material"))
    trans = sum_lines(job.get("doprava"))
    extra_work = sum_lines(job.get("vicepracovne"))
    extra_mat = sum_lines(job.get("material_navic"))
    return {
        "cena_prace": work,
        "cena_material": mat,
        "cena_doprava": trans,
        "celkem": work + mat + trans,
        "vicepracovne_total": extra_work + extra_mat,
        "celkem_k_fakturaci": work + mat + trans + extra_work + extra_mat,
    }

def serialize_job(job: dict) -> dict:
    job = dict(job)
    job.pop("_id", None)
    if isinstance(job.get("created_at"), datetime):
        job["created_at"] = job["created_at"].isoformat()
    if isinstance(job.get("updated_at"), datetime):
        job["updated_at"] = job["updated_at"].isoformat()
    if isinstance(job.get("postponed_at"), datetime):
        job["postponed_at"] = job["postponed_at"].isoformat()
    job["totals"] = compute_totals(job)
    if job.get("status") == "odlozeno" and job.get("postponed_at"):
        try:
            pd = datetime.fromisoformat(job["postponed_at"].replace("Z", "+00:00")) if isinstance(job["postponed_at"], str) else job["postponed_at"]
            expire = pd + timedelta(days=30)
            days_left = (expire - now_utc()).days
            job["days_left"] = days_left
            if days_left < 0:
                job["effective_status"] = "expirovano"
            else:
                job["effective_status"] = "odlozeno"
        except Exception:
            job["effective_status"] = "odlozeno"
    else:
        job["effective_status"] = job.get("status", "rozpracovano")
    return job

# ---------- Auth Endpoints ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email je již registrován")
    user_id = str(uuid.uuid4())
    code = _gen_company_code()
    while await db.users.find_one({"company_code": code}):
        code = _gen_company_code()
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "company": payload.company or "",
        "phone": payload.phone or "",
        "company_code": code,
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    return {"user": public_user(user_doc), "token": token}

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Neplatné přihlašovací údaje")
    token = create_access_token(user["id"], email)
    return {"user": public_user(user), "token": token}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)

@api.put("/auth/me")
async def update_me(payload: dict, user: dict = Depends(get_current_user)):
    allowed = {k: v for k, v in payload.items() if k in ("name", "company", "phone")}
    if allowed:
        await db.users.update_one({"id": user["id"]}, {"$set": allowed})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)

# ---------- Jobs ----------
@api.post("/jobs")
async def create_job(payload: JobCreate, user: dict = Depends(get_current_user)):
    job_id = str(uuid.uuid4())
    job_number = await next_job_number(user["id"])
    job = {
        "id": job_id,
        "user_id": user["id"],
        "job_number": job_number,
        "client_name": payload.client_name,
        "address": payload.address,
        "title": payload.title,
        "prace": [it.model_dump() for it in payload.prace],
        "material": [it.model_dump() for it in payload.material],
        "doprava": [it.model_dump() for it in payload.doprava],
        "vicepracovne": [],
        "material_navic": [],
        "diary_entries": [],
        "status": "rozpracovano",
        "photo_url": "",
        "payment_note": "",
        "finalized": False,
        "created_at": now_utc(),
        "updated_at": now_utc(),
        "postponed_at": None,
    }
    await db.jobs.insert_one(job.copy())
    return serialize_job(job)

@api.get("/jobs")
async def list_jobs(user: dict = Depends(get_current_user), q: str = "", status: str = ""):
    flt = {"user_id": user["id"]}
    if q:
        flt["$or"] = [
            {"client_name": {"$regex": q, "$options": "i"}},
            {"job_number": {"$regex": q, "$options": "i"}},
            {"title": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.jobs.find(flt, {"_id": 0}).sort("created_at", -1)
    items = [serialize_job(j) async for j in cursor]
    if status and status != "vse":
        items = [j for j in items if j.get("effective_status") == status]
    return items

@api.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Zakázka nenalezena")
    return serialize_job(job)

@api.put("/jobs/{job_id}")
async def update_job(job_id: str, payload: JobUpdate, user: dict = Depends(get_current_user)):
    existing = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Zakázka nenalezena")
    if existing.get("finalized"):
        if payload.finalized is None or payload.finalized is True:
            raise HTTPException(400, "Vyúčtování je uzamčeno")

    update = {}
    data = payload.model_dump(exclude_unset=True)
    for k in ["client_name", "address", "title", "photo_url", "payment_note", "finalized"]:
        if k in data:
            update[k] = data[k]
    for k in ["prace", "material", "doprava", "vicepracovne", "material_navic", "diary_entries"]:
        if k in data and data[k] is not None:
            update[k] = data[k]
    if "status" in data and data["status"]:
        new_status = data["status"]
        update["status"] = new_status
        if new_status == "odlozeno":
            if existing.get("status") != "odlozeno" or not existing.get("postponed_at"):
                update["postponed_at"] = now_utc()
    update["updated_at"] = now_utc()
    await db.jobs.update_one({"id": job_id}, {"$set": update})
    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return serialize_job(fresh)

@api.post("/jobs/{job_id}/renew")
async def renew_job(job_id: str, user: dict = Depends(get_current_user)):
    existing = await db.jobs.find_one({"id": job_id, "user_id": user["id"]})
    if not existing:
        raise HTTPException(404, "Zakázka nenalezena")
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"postponed_at": now_utc(), "status": "odlozeno", "updated_at": now_utc()}},
    )
    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return serialize_job(fresh)

@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    res = await db.jobs.delete_one({"id": job_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Zakázka nenalezena")
    return {"ok": True}

# ---------- AI ----------
async def _llm_call(system: str, prompt: str, session_id: Optional[str] = None) -> str:
    import asyncio
    import google.generativeai as genai

    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="V nastavení chybí API klíč pro Gemini (EMERGENT_LLM_KEY)")

    def _run_request():
        genai.configure(api_key=EMERGENT_LLM_KEY)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system
        )
        response = model.generate_content(prompt)
        return response.text

    try:
        return await asyncio.to_thread(_run_request)
    except Exception as e:
        logger.error(f"Gemini API chyba: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini API selhalo: {e}")

class MaterialPriceIn(BaseModel):
    name: str

@api.post("/ai/material-price")
async def ai_material_price(payload: MaterialPriceIn, user: dict = Depends(get_current_user)):
    if not payload.name.strip():
        raise HTTPException(400, "Zadejte název materiálu")
    sys = (
        "Jsi český odborník na stavební materiály. Odpověz pouze ve formátu: "
        "'<jednotka>|<orientační_cena_Kč_za_jednotku>|<krátký_popis>'. "
        "Příklad: 'm2|350|Standardní cena za běžnou keramickou dlažbu'. "
        "Žádné další texty, žádné uvozovky."
    )
    prompt = f"Materiál: {payload.name}. Uveď orientační cenu na českém trhu v roce 2026."
    try:
        out = await _llm_call(sys, prompt)
        out = out.strip().strip('"').strip("'")
        parts = out.split("|")
        if len(parts) >= 3:
            return {
                "jednotka": parts[0].strip(),
                "cena": safe_float(parts[1]),
                "poznamka": parts[2].strip(),
            }
        return {"jednotka": "ks", "cena": 0, "poznamka": out}
    except Exception as e:
        logger.exception("ai_material_price failed")
        raise HTTPException(500, f"AI selhala: {e}")

class EnhanceIn(BaseModel):
    text: str

@api.post("/ai/enhance-description")
async def ai_enhance(payload: EnhanceIn, user: dict = Depends(get_current_user)):
    sys = (
        "Jsi profesionální český řemeslník a copywriter. Přepiš vstup do jasného, "
        "profesionálního a strukturovaného popisu rozsahu zakázky pro klienta. "
        "Použij krátké odstavce a odrážky. Maximálně 200 slov. Pouze česky."
    )
    try:
        out = await _llm_call(sys, payload.text)
        return {"text": out.strip()}
    except Exception as e:
        logger.exception("ai_enhance failed")
        raise HTTPException(500, f"AI selhala: {e}")

class GenerateVariantsIn(BaseModel):
    title: str
    client: str = ""
    address: str = ""
    cena_material: float = 0
    cena_prace: float = 0
    cena_doprava: float = 0
    description: str = ""
    narocnost: Literal["nizka", "stredni", "vysoka"] = "stredni"
    urgence: Literal["bezna", "zvysena", "expresni"] = "bezna"
    typ_klienta: Literal["bezny", "firemni", "vip"] = "bezny"

    @field_validator("cena_material", "cena_prace", "cena_doprava", mode="before")
    @classmethod
    def parse_floats(cls, v):
        return clean_comma_float(v)

@api.post("/ai/generate-variants")
async def ai_generate_variants(payload: GenerateVariantsIn, user: dict = Depends(get_current_user)):
    base = float(payload.cena_material + payload.cena_prace + payload.cena_doprava)
    if base <= 0:
        base = 50000.0

    narocnost_mult = {"nizka": 1.00, "stredni": 1.04, "vysoka": 1.10}[payload.narocnost]
    urgence_mult = {"bezna": 1.00, "zvysena": 1.06, "expresni": 1.15}[payload.urgence]
    klient_mult = {"bezny": 1.00, "firemni": 1.03, "vip": 1.08}[payload.typ_klienta]
    a_factor = max(1.0, narocnost_mult * urgence_mult * klient_mult)

    b_spread = 0.10
    c_spread = 0.15
    if payload.urgence == "expresni":
        b_spread = 0.13
    if payload.typ_klienta == "vip":
        c_spread = 0.18

    def round_clean(n: float) -> float:
        return float(int(round(n / 100.0) * 100))

    A = round_clean(base * a_factor)
    if A < base:
        A = round_clean(base)
    B = round_clean(A * (1.0 + b_spread))
    if B <= A:
        B = A + 100.0
    if B > A * 1.15:
        B = round_clean(A * 1.15)
        if B <= A:
            B = A + 100.0
    C = round_clean(B * (1.0 + c_spread))
    if C <= B:
        C = B + 100.0
    if C > B * 1.20:
        C = round_clean(B * 1.20)
        if C <= B:
            C = B + 100.0

    sys = (
        "Jsi expert na cenotvorbu a tvorbu nabídek pro české řemeslné firmy. "
        "Vytvoř TŘI varianty nabídky ve formátu JSON pole se 3 prvky a NIC JINÉHO. "
        "Klíče v každém prvku: nazev, rozsah (string s odrážkami oddělenými novým řádkem), "
        "zaruka (string, např. '24 měsíců'), termin (string, např. '4-6 týdnů'), "
        "included (pole 4-6 stringů), excluded (pole 2-4 stringů), popis (1-2 věty co odlišuje variantu). "
        "Varianta 1 = 'Základní' — pouze nezbytný rozsah, standardní materiály, kratší záruka (24 měsíců). "
        "Varianta 2 = 'Zlatá střední cesta' — DOPORUČENÁ. Vyšší cena ospravedlněná: kvalitnější materiály, "
        "důkladnější příprava povrchů, prodloužená záruka (36 měsíců), drobné nadstandardní detaily. "
        "Varianta 3 = 'Premium' — Prémiové značkové materiály, rozšířený rozsah včetně dodatečných úprav, "
        "MAXIMÁLNÍ záruka 48 měsíců, prioritní termín a servis, finální úklid. "
        "DŮLEŽITÉ: Maximální záruka u jakékoli varianty je 48 měsíců — nikdy nenavrhuj delší."
        "POZOR: Ceny NEZADÁVEJ — vrať pouze obsah. Jazyk: česky. "
        "Vrať POUZE validní JSON pole."
    )

    diff_b_pct = round((B / A - 1.0) * 100)
    diff_c_pct = round((C / B - 1.0) * 100)
    prompt = (
        f"Název: {payload.title}\nKlient: {payload.client} (typ: {payload.typ_klienta})\n"
        f"Adresa: {payload.address}\nNáročnost: {payload.narocnost}\nUrgence: {payload.urgence}\n"
        f"Vstupní podklad — kalkulovaná základní cena: {int(base)} Kč "
        f"(práce {int(payload.cena_prace)} + materiál {int(payload.cena_material)} + doprava {int(payload.cena_doprava)})\n"
        f"Popis: {payload.description}\n\n"
        f"Tři varianty mají tyto pevné ceny (Kč):\n"
        f"  A Základní: {int(A)}\n"
        f"  B Zlatá střední cesta: {int(B)} (+{diff_b_pct} % oproti A)\n"
        f"  C Premium: {int(C)} (+{diff_c_pct} % oproti B)\n\n"
        f"V popisu varianty B vysvětli, v čem konkrétně dává smysl utratit těch +{diff_b_pct} % "
        f"(typicky lepší materiály, prodloužená záruka, důkladnější detaily). "
        f"V popisu varianty C vysvětli, v čem dává smysl těch +{diff_c_pct} % oproti B "
        f"(prémiové značkové materiály, dlouhá záruka, prioritní termín)."
    )
    try:
        out = await _llm_call(sys, prompt)
        import json, re
        m = re.search(r"\[.*\]", out, re.S)
        if not m:
            raise ValueError("AI nevrátila JSON")
        variants_raw = json.loads(m.group(0))
        if not isinstance(variants_raw, list) or len(variants_raw) < 3:
            raise ValueError("AI nevrátila 3 varianty")

        prices = [A, B, C]
        defaults_nazev = ["🥉 Základní", "🥇 Zlatá střední cesta", "💎 Premium"]
        variants = []
        for i, v in enumerate(variants_raw[:3]):
            if not isinstance(v, dict):
                v = {}
            v["cena_kc"] = float(prices[i])
            v["nazev"] = v.get("nazev") or defaults_nazev[i]
            v["rozsah"] = v.get("rozsah", "")
            v["zaruka"] = v.get("zaruka") or ["24 měsíců", "36 měsíců", "48 měsíců"][i]
            v["termin"] = v.get("termin") or ["4-6 týdnů", "3-5 týdnů", "2-4 týdny (priorita)"][i]
            v["included"] = v.get("included") or []
            v["excluded"] = v.get("excluded") or []
            v["popis"] = v.get("popis", "")
            variants.append(v)

        if not (variants[0]["cena_kc"] >= base):
            variants[0]["cena_kc"] = round_clean(base)
        if not (variants[1]["cena_kc"] > variants[0]["cena_kc"]):
            variants[1]["cena_kc"] = variants[0]["cena_kc"] + 100
        if not (variants[1]["cena_kc"] <= variants[0]["cena_kc"] * 1.15):
            variants[1]["cena_kc"] = round_clean(variants[0]["cena_kc"] * 1.15)
        if not (variants[2]["cena_kc"] > variants[1]["cena_kc"]):
            variants[2]["cena_kc"] = variants[1]["cena_kc"] + 100
        if not (variants[2]["cena_kc"] <= variants[1]["cena_kc"] * 1.20):
            variants[2]["cena_kc"] = round_clean(variants[1]["cena_kc"] * 1.20)

        import re as _re
        warranty_defaults = ["24 měsíců", "36 měsíců", "48 měsíců"]
        for i, v in enumerate(variants):
            z = str(v.get("zaruka", "") or "")
            m = _re.search(r"(\d{1,3})", z)
            if m:
                months = int(m.group(1))
                if "rok" in z.lower() or "let" in z.lower():
                    months = months * 12
                if months > 48:
                    v["zaruka"] = warranty_defaults[i]
            else:
                v["zaruka"] = warranty_defaults[i]

        bundle_id = str(uuid.uuid4())
        await db.quote_variants.insert_one({
            "id": bundle_id,
            "user_id": user["id"],
            "input": payload.model_dump(),
            "base_price": base,
            "variants": variants,
            "created_at": now_utc(),
        })
        return {"id": bundle_id, "base_price": base, "variants": variants}
    except Exception as e:
        logger.exception("ai_generate_variants failed")
        raise HTTPException(500, f"AI selhala: {e}")

# ---------- PDF ----------
def _czech_currency(n: float) -> str:
    s = f"{int(round(n)):,}".replace(",", " ")
    return f"{s} Kč"

def _czech_date(dt: datetime) -> str:
    return f"{dt.day}. {dt.month}. {dt.year}"

def _build_pdf_quote(job: dict, user: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    try:
        pdfmetrics.registerFont(TTFont("Roboto", str(ROOT_DIR / "fonts" / "Roboto-Regular.ttf")))
        pdfmetrics.registerFont(TTFont("Roboto-Bold", str(ROOT_DIR / "fonts" / "Roboto-Bold.ttf")))
        font_name = "Roboto"
        font_bold = "Roboto-Bold"
    except Exception:
        font_name = "Helvetica"
        font_bold = "Helvetica-Bold"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName=font_bold, fontSize=20, textColor=colors.HexColor("#2d2926"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName=font_bold, fontSize=13, textColor=colors.HexColor("#c9820a"), spaceBefore=10)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontName=font_name, fontSize=10, textColor=colors.HexColor("#2d2926"), leading=13)
    small = ParagraphStyle("small", parent=body, fontSize=9, textColor=colors.HexColor("#68635c"))

    elems = []
    header = Table([[
        Paragraph(f"<b>Cenová nabídka č. {job['job_number']}</b>", h1),
        Paragraph(f"<b>{user.get('company') or user.get('name','')}</b><br/>{user.get('name','')}<br/>Tel: {user.get('phone','')}<br/>{user.get('email','')}", small),
    ]], colWidths=[110*mm, 70*mm])
    header.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP")]))
    elems.append(header)
    elems.append(Spacer(1, 6))

    info = [
        ["Klient:", job.get("client_name", "")],
        ["Adresa realizace:", job.get("address", "")],
        ["Název nabídky:", job.get("title", "")],
        ["Datum vystavení:", _czech_date(now_utc())],
    ]
    t = Table(info, colWidths=[40*mm, 140*mm])
    t.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), font_name),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor("#68635c")),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 6))

    def section(title: str, lines: list):
        elems.append(Paragraph(title, h2))
        if not lines:
            elems.append(Paragraph("— bez položek —", small))
            return 0
        data = [["#", "Popis", "Množství", "Jedn.", "Cena/jedn.", "Celkem"]]
        total = 0.0
        for i, it in enumerate(lines, 1):
            row_total = (safe_float(it.get("mnozstvi")) or 0) * (safe_float(it.get("cena")) or 0)
            total += row_total
            data.append([
                str(i),
                Paragraph(it.get("popis", ""), body),
                f"{it.get('mnozstvi', 0)}",
                it.get("jednotka", ""),
                _czech_currency(safe_float(it.get("cena", 0))),
                _czech_currency(row_total),
            ])
        data.append(["", "", "", "", "Mezisoučet:", _czech_currency(total)])
        tbl = Table(data, colWidths=[10*mm, 80*mm, 20*mm, 15*mm, 25*mm, 30*mm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0,0), (-1,-1), font_name),
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f4f1eb")),
            ("FONTNAME", (0,0), (-1,0), font_bold),
            ("LINEBELOW", (0,0), (-1,0), 0.5, colors.HexColor("#c9820a")),
            ("LINEABOVE", (0,-1), (-1,-1), 0.5, colors.HexColor("#e2ded7")),
            ("FONTNAME", (4,-1), (5,-1), font_bold),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("TOPPADDING", (0,0), (-1,-1), 4),
        ]))
        elems.append(tbl)
        return total

    work = section("Práce", job.get("prace", []))
    mat = section("Materiál", job.get("material", []))
    trans = section("Doprava, závoz a manipulace", job.get("doprava", []))

    elems.append(Spacer(1, 8))
    rec = Table([
        ["Cena práce:", _czech_currency(work)],
        ["Cena materiálu:", _czech_currency(mat)],
        ["Doprava a manipulace:", _czech_currency(trans)],
        ["CELKEM:", _czech_currency(work + mat + trans)],
    ], colWidths=[120*mm, 60*mm])
    rec.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), font_name),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("FONTNAME", (0,-1), (-1,-1), font_bold),
        ("FONTSIZE", (0,-1), (-1,-1), 13),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#fcede3")),
        ("TEXTCOLOR", (0,-1), (-1,-1), colors.HexColor("#c9820a")),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
    ]))
    elems.append(rec)

    elems.append(Spacer(1, 12))
    if job.get("payment_note"):
        elems.append(Paragraph(job["payment_note"], small))
        elems.append(Spacer(1, 4))
    elems.append(Paragraph("Nabídka platí 30 dní od data vystavení.", small))
    elems.append(Spacer(1, 14))
    elems.append(Paragraph("<font color='#9ca3af'>Vytvořil © James P. Jones 2026</font>", small))

    doc.build(elems)
    return buf.getvalue()

def _build_pdf_billing(job: dict, user: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    try:
        pdfmetrics.registerFont(TTFont("Roboto", str(ROOT_DIR / "fonts" / "Roboto-Regular.ttf")))
        pdfmetrics.registerFont(TTFont("Roboto-Bold", str(ROOT_DIR / "fonts" / "Roboto-Bold.ttf")))
        fn, fb = "Roboto", "Roboto-Bold"
    except Exception:
        fn, fb = "Helvetica", "Helvetica-Bold"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    h1 = ParagraphStyle("h1", fontName=fb, fontSize=20, textColor=colors.HexColor("#2d2926"))
    h2 = ParagraphStyle("h2", fontName=fb, fontSize=13, textColor=colors.HexColor("#c9820a"), spaceBefore=10)
    body = ParagraphStyle("body", fontName=fn, fontSize=10, textColor=colors.HexColor("#2d2926"), leading=13)
    small = ParagraphStyle("small", fontName=fn, fontSize=9, textColor=colors.HexColor("#68635c"))

    elems = []
    elems.append(Paragraph(f"<b>Celkové vyúčtování — zakázka č. {job['job_number']}</b>", h1))
    elems.append(Spacer(1, 6))
    info = [
        ["Klient:", job.get("client_name", "")],
        ["Adresa realizace:", job.get("address", "")],
        ["Datum dokončení:", _czech_date(now_utc())],
    ]
    t = Table(info, colWidths=[40*mm, 140*mm])
    t.setStyle(TableStyle([("FONTNAME", (0,0), (-1,-1), fn), ("FONTSIZE", (0,0), (-1,-1), 10), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    elems.append(t)

    def lines_table(lines, header):
        elems.append(Paragraph(header, h2))
        if not lines:
            elems.append(Paragraph("— bez položek —", small))
            return 0.0
        data = [["#", "Popis", "Mn.", "Jedn.", "Cena/jedn.", "Celkem"]]
        total = 0.0
        for i, it in enumerate(lines, 1):
            rt = (safe_float(it.get("mnozstvi")) or 0) * (safe_float(it.get("cena")) or 0)
            total += rt
            data.append([str(i), Paragraph(it.get("popis", ""), body), f"{it.get('mnozstvi', 0)}", it.get("jednotka",""), _czech_currency(safe_float(it.get("cena", 0))), _czech_currency(rt)])
        data.append(["", "", "", "", "Mezisoučet:", _czech_currency(total)])
        tbl = Table(data, colWidths=[10*mm, 80*mm, 20*mm, 15*mm, 25*mm, 30*mm], repeatRows=1)
        tbl.setStyle(TableStyle([
            ("FONTNAME", (0,0), (-1,-1), fn), ("FONTSIZE", (0,0), (-1,-1), 9),
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#f4f1eb")), ("FONTNAME", (0,0), (-1,0), fb),
            ("LINEBELOW", (0,0), (-1,0), 0.5, colors.HexColor("#c9820a")),
            ("FONTNAME", (4,-1), (5,-1), fb),
        ]))
        elems.append(tbl)
        return total

    elems.append(Paragraph("Sekce 1 — Původní nabídka", h2))
    s1 = lines_table(job.get("prace", []), "Práce")
    s2 = lines_table(job.get("material", []), "Materiál")
    s3 = lines_table(job.get("doprava", []), "Doprava a manipulace")
    original_total = s1 + s2 + s3

    elems.append(Paragraph("Sekce 2 — Vícepráce a materiál navíc", h2))
    e1 = lines_table(job.get("vicepracovne", []), "Vícepráce")
    e2 = lines_table(job.get("material_navic", []), "Materiál navíc")
    extra_total = e1 + e2

    elems.append(Paragraph("Sekce 3 — Výpis ze stavebního deníku", h2))
    diary = job.get("diary_entries", [])
    if diary:
        for d in diary:
            line = f"<b>{d.get('date','')}</b> — {d.get('work','')}"
            if d.get("weather"):
                line += f" | Počasí: {d.get('weather')}"
            if d.get("workers"):
                line += f" | Pracovníci: {d.get('workers')}"
            elems.append(Paragraph(line, body))
            if d.get("notes"):
                elems.append(Paragraph(f"<i>Poznámka: {d.get('notes')}</i>", small))
            elems.append(Spacer(1, 2))
    else:
        elems.append(Paragraph("— bez záznamů —", small))

    if job.get("photo_url"):
        elems.append(Spacer(1, 6))
        link = job["photo_url"]
        elems.append(Paragraph(f'<link href="{link}" color="#c9820a"><b>📷 Fotodokumentace zakázky →</b></link>', body))

    elems.append(Paragraph("Sekce 4 — Rekapitulace", h2))
    rec = Table([
        ["Původní nabídka celkem:", _czech_currency(original_total)],
        ["Vícepráce a materiál navíc:", _czech_currency(extra_total)],
        ["CELKEM K FAKTURACI:", _czech_currency(original_total + extra_total)],
    ], colWidths=[120*mm, 60*mm])
    rec.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), fn), ("FONTSIZE", (0,0), (-1,-1), 11),
        ("FONTNAME", (0,-1), (-1,-1), fb), ("FONTSIZE", (0,-1), (-1,-1), 14),
        ("BACKGROUND", (0,-1), (-1,-1), colors.HexColor("#fcede3")),
        ("TEXTCOLOR", (0,-1), (-1,-1), colors.HexColor("#c9820a")),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6), ("TOPPADDING", (0,0), (-1,-1), 6),
    ]))
    elems.append(Spacer(1, 6))
    elems.append(rec)
    elems.append(Spacer(1, 8))
    if job.get("payment_note"):
        elems.append(Paragraph(job["payment_note"], small))
    elems.append(Spacer(1, 14))
    elems.append(Paragraph("<font color='#9ca3af'>Vytvořil © James P. Jones 2026</font>", small))

    doc.build(elems)
    return buf.getvalue()

def _build_pdf_variants(variants: list, input_data: dict, user: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    try:
        pdfmetrics.registerFont(TTFont("Roboto", str(ROOT_DIR / "fonts" / "Roboto-Regular.ttf")))
        pdfmetrics.registerFont(TTFont("Roboto-Bold", str(ROOT_DIR / "fonts" / "Roboto-Bold.ttf")))
        fn, fb = "Roboto", "Roboto-Bold"
    except Exception:
        fn, fb = "Helvetica", "Helvetica-Bold"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=12*mm, bottomMargin=12*mm)
    h1 = ParagraphStyle("h1", fontName=fb, fontSize=18, textColor=colors.HexColor("#2d2926"))
    h2 = ParagraphStyle("h2", fontName=fb, fontSize=12, textColor=colors.HexColor("#c9820a"))
    body = ParagraphStyle("body", fontName=fn, fontSize=9, textColor=colors.HexColor("#2d2926"), leading=12)
    small = ParagraphStyle("small", fontName=fn, fontSize=8, textColor=colors.HexColor("#68635c"))

    elems = []
    elems.append(Paragraph(f"<b>Tři varianty nabídky</b>", h1))
    elems.append(Paragraph(input_data.get("title", ""), small))
    elems.append(Paragraph(f"Klient: {input_data.get('client','')} | {input_data.get('address','')}", small))
    elems.append(Spacer(1, 6))

    icons = ["🥉", "🥇", "💎"]
    for i, v in enumerate(variants[:3]):
        icon = icons[i] if i < len(icons) else ""
        title_line = f"<b>{icon} {v.get('nazev','')}</b>"
        price_line = f"<b>{_czech_currency(safe_float(v.get('cena_kc', 0)))}</b>"
        elems.append(Paragraph(title_line, h2))
        elems.append(Paragraph(price_line, h1))
        elems.append(Paragraph(v.get("popis", ""), body))
        elems.append(Spacer(1, 3))
        elems.append(Paragraph(f"<b>Záruka:</b> {v.get('zaruka','')} &nbsp;&nbsp; <b>Termín:</b> {v.get('termin','')}", body))
        elems.append(Paragraph("<b>Rozsah:</b>", body))
        elems.append(Paragraph(v.get("rozsah", "").replace("\n", "<br/>"), body))
        included = v.get("included") or []
        if included:
            elems.append(Paragraph("<b>Zahrnuto:</b>", body))
            for it in included:
                elems.append(Paragraph(f"✓ {it}", body))
        excluded = v.get("excluded") or []
        if excluded:
            elems.append(Paragraph("<b>Není zahrnuto:</b>", body))
            for it in excluded:
                elems.append(Paragraph(f"✗ {it}", body))
        elems.append(Spacer(1, 8))

    elems.append(Spacer(1, 6))
    elems.append(Paragraph(f"Vystavil: {user.get('company') or user.get('name','')} | {user.get('phone','')} | {user.get('email','')}", small))
    elems.append(Spacer(1, 10))
    elems.append(Paragraph("<font color='#9ca3af'>Vytvořil © James P. Jones 2026</font>", small))
    doc.build(elems)
    return buf.getvalue()

@api.get("/jobs/{job_id}/pdf")
async def get_job_pdf(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Zakázka nenalezena")
    pdf = _build_pdf_quote(job, user)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="nabidka-{job["job_number"]}.pdf"'},
    )

@api.get("/jobs/{job_id}/billing-pdf")
async def get_billing_pdf(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Zakázka nenalezena")
    pdf = _build_pdf_billing(job, user)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="vyuctovani-{job["job_number"]}.pdf"'},
    )

@api.get("/quote-variants/{bundle_id}/pdf")
async def get_variants_pdf(bundle_id: str, user: dict = Depends(get_current_user)):
    b = await db.quote_variants.find_one({"id": bundle_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Sada nenalezena")
    pdf = _build_pdf_variants(b["variants"], b["input"], user)
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="varianty-{bundle_id[:8]}.pdf"'},
    )

# ---------- Import ----------
class ImportPayload(BaseModel):
    cinnost: Optional[str] = ""
    parametry: Optional[str] = ""
    material: List[dict] = []
    pracovni_postup: List[dict] = []
    cas_hodiny: Optional[float] = 0

    @field_validator("cas_hodiny", mode="before")
    @classmethod
    def parse_floats(cls, v):
        return clean_comma_float(v)

@api.post("/import/remeslnik-ai")
async def import_remeslnik(payload: ImportPayload, user: dict = Depends(get_current_user)):
    prace_lines: List[dict] = []
    material_lines: List[dict] = []

    for m in payload.material:
        material_lines.append({
            "id": str(uuid.uuid4()),
            "popis": m.get("nazev") or m.get("name") or m.get("popis") or "",
            "mnozstvi": safe_float(m.get("mnozstvi") or m.get("quantity"), 1.0),
            "jednotka": m.get("jednotka") or m.get("unit") or "ks",
            "cena": safe_float(m.get("cena") or m.get("price"), 0.0),
        })

    for p in payload.pracovni_postup:
        prace_lines.append({
            "id": str(uuid.uuid4()),
            "popis": p.get("krok") or p.get("popis") or p.get("name") or "",
            "mnozstvi": safe_float(p.get("hodiny") or p.get("mnozstvi"), 1.0),
            "jednotka": p.get("jednotka") or "h",
            "cena": safe_float(p.get("cena_hodina") or p.get("cena"), 0.0),
        })

    return {
        "title": payload.cinnost or "",
        "description": payload.parametry or "",
        "prace": prace_lines,
        "material": material_lines,
    }

# ---------- Employees & PIN auth ----------
import random as _random

def _gen_pin(existing: set[str]) -> str:
    for _ in range(200):
        p = f"{_random.randint(0, 9999):04d}"
        if p not in existing:
            return p
    raise HTTPException(500, "Nepodařilo se vygenerovat PIN")

class EmployeeCreate(BaseModel):
    name: str
    phone: str = ""
    trade: str = ""

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None
    trade: Optional[str] = None

class PinLoginIn(BaseModel):
    pin: str
    company_code: str = ""

def public_employee(e: dict) -> dict:
    return {
        "id": e["id"],
        "name": e.get("name", ""),
        "phone": e.get("phone", ""),
        "pin": e.get("pin", ""),
        "trade": e.get("trade", ""),
        "active": e.get("active", True),
        "owner_user_id": e.get("owner_user_id"),
        "company_code": e.get("company_code", ""),
    }

@api.get("/employees")
async def list_employees(user: dict = Depends(get_current_user)):
    cursor = db.employees.find({"owner_user_id": user["id"]}, {"_id": 0}).sort("id", 1)
    return [public_employee(e) async for e in cursor]

@api.post("/employees")
async def create_employee(payload: EmployeeCreate, user: dict = Depends(get_current_user)):
    cursor = db.employees.find({"owner_user_id": user["id"]}, {"_id": 0, "id": 1, "pin": 1})
    items = [e async for e in cursor]
    used_pins = {e["pin"] for e in items}
    n = 1
    nums = []
    for it in items:
        try:
            nums.append(int(it["id"].split("-")[1]))
        except Exception:
            pass
    if nums:
        n = max(nums) + 1
    emp_id = f"ZAM-{n:03d}"
    pin = _gen_pin(used_pins)
    doc = {
        "id": emp_id,
        "owner_user_id": user["id"],
        "company_code": user.get("company_code", ""),
        "name": payload.name,
        "phone": payload.phone,
        "pin": pin,
        "trade": payload.trade,
        "active": True,
        "created_at": now_utc(),
    }
    await db.employees.insert_one(doc.copy())
    return public_employee(doc)

@api.put("/employees/{emp_id}")
async def update_employee(emp_id: str, payload: EmployeeUpdate, user: dict = Depends(get_current_user)):
    existing = await db.employees.find_one({"id": emp_id, "owner_user_id": user["id"]})
    if not existing:
        raise HTTPException(404, "Zaměstnanec nenalezen")
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if update:
        await db.employees.update_one({"id": emp_id}, {"$set": update})
    fresh = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    return public_employee(fresh)

@api.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, user: dict = Depends(get_current_user)):
    res = await db.employees.delete_one({"id": emp_id, "owner_user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Zaměstnanec nenalezen")
    await db.jobs.update_many(
        {"user_id": user["id"]},
        {"$pull": {"assigned_employee_ids": emp_id}},
    )
    return {"ok": True}

@api.post("/auth/login-pin")
async def login_pin(payload: PinLoginIn):
    pin = (payload.pin or "").strip()
    code = (payload.company_code or "").strip().upper()
    if len(pin) != 4 or not pin.isdigit():
        raise HTTPException(400, "PIN musí mít 4 číslice")
    if not code:
        raise HTTPException(400, "Zadejte identifikátor firmy (6 znaků)")
    owner = await db.users.find_one({"company_code": code}, {"_id": 0, "id": 1})
    if not owner:
        raise HTTPException(401, "Neplatný identifikátor firmy nebo PIN")
    emp = await db.employees.find_one(
        {"pin": pin, "owner_user_id": owner["id"], "active": True},
        {"_id": 0},
    )
    if not emp:
        raise HTTPException(401, "Neplatný identifikátor firmy nebo PIN")
    token = create_employee_token(emp["id"], emp["owner_user_id"])
    return {
        "employee": public_employee(emp),
        "token": token,
    }

@api.get("/auth/me-employee")
async def me_employee(actor: dict = Depends(require_employee)):
    return public_employee(actor["employee"])

# ---------- Job assignment ----------
class AssignIn(BaseModel):
    employee_ids: List[str]

@api.put("/jobs/{job_id}/assign")
async def assign_employees(job_id: str, payload: AssignIn, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Zakázka nenalezena")
    if job.get("status") != "schvaleno":
        raise HTTPException(400, "Zaměstnance lze přiřadit jen ke schválené zakázce")
    valid_ids = []
    for eid in payload.employee_ids:
        emp = await db.employees.find_one({"id": eid, "owner_user_id": user["id"]})
        if emp:
            valid_ids.append(eid)
    await db.jobs.update_one({"id": job_id}, {"$set": {"assigned_employee_ids": valid_ids, "updated_at": now_utc()}})
    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return serialize_job(fresh)

# ---------- Employee read-only views ----------
def _strip_prices(rows):
    out = []
    for r in rows or []:
        out.append({"id": r.get("id"), "popis": r.get("popis", ""), "mnozstvi": r.get("mnozstvi", 0), "jednotka": r.get("jednotka", "")})
    return out

def _employee_job_view(job: dict) -> dict:
    return {
        "id": job["id"],
        "job_number": job.get("job_number"),
        "client_name": job.get("client_name", ""),
        "address": job.get("address", ""),
        "title": job.get("title", ""),
        "status": job.get("status"),
        "effective_status": job.get("effective_status"),
        "material": _strip_prices(job.get("material", [])),
        "prace": _strip_prices(job.get("prace", [])),
        "diary_entries": job.get("diary_entries", []),
        "vicepracovne_proposals": job.get("vicepracovne_proposals", []),
        "assigned_employee_ids": job.get("assigned_employee_ids", []),
        "tool_checklists": job.get("tool_checklists", {}),
        "created_at": job.get("created_at"),
    }

@api.get("/employee/jobs")
async def employee_jobs(actor: dict = Depends(require_employee)):
    emp = actor["employee"]
    cursor = db.jobs.find(
        {"user_id": emp["owner_user_id"], "assigned_employee_ids": emp["id"]},
        {"_id": 0},
    ).sort("created_at", -1)
    items = []
    async for j in cursor:
        items.append(_employee_job_view(serialize_job(j)))
    return items

@api.get("/employee/jobs/{job_id}")
async def employee_job_detail(job_id: str, actor: dict = Depends(require_employee)):
    emp = actor["employee"]
    job = await db.jobs.find_one(
        {"id": job_id, "user_id": emp["owner_user_id"], "assigned_employee_ids": emp["id"]},
        {"_id": 0},
    )
    if not job:
        raise HTTPException(404, "Zakázka nenalezena nebo nepřiřazena")
    return _employee_job_view(serialize_job(job))

class EmployeeDiaryIn(BaseModel):
    date: str
    work: str
    weather: str = ""
    workers: str = ""
    notes: str = ""
    photo_base64: Optional[str] = None

@api.post("/employee/jobs/{job_id}/diary")
async def employee_add_diary(job_id: str, payload: EmployeeDiaryIn, actor: dict = Depends(require_employee)):
    emp = actor["employee"]
    job = await db.jobs.find_one(
        {"id": job_id, "user_id": emp["owner_user_id"], "assigned_employee_ids": emp["id"]}
    )
    if not job:
        raise HTTPException(404, "Zakázka nenalezena nebo nepřiřazena")
    entry = payload.model_dump()
    entry["id"] = str(uuid.uuid4())
    entry["created_by"] = emp["id"]
    entry["author_name"] = emp.get("name", "")
    entries = (job.get("diary_entries") or []) + [entry]
    await db.jobs.update_one({"id": job_id}, {"$set": {"diary_entries": entries, "updated_at": now_utc()}})
    return {"ok": True, "entry": entry}

class ProposalIn(BaseModel):
    popis: str
    mnozstvi: float = 1
    jednotka: str = "ks"
    note: str = ""

    @field_validator("mnozstvi", mode="before")
    @classmethod
    def parse_floats(cls, v):
        return clean_comma_float(v)

@api.post("/employee/jobs/{job_id}/propose-vicepracovne")
async def employee_propose(job_id: str, payload: ProposalIn, actor: dict = Depends(require_employee)):
    emp = actor["employee"]
    job = await db.jobs.find_one(
        {"id": job_id, "user_id": emp["owner_user_id"], "assigned_employee_ids": emp["id"]}
    )
    if not job:
        raise HTTPException(404, "Zakázka nenalezena nebo nepřiřazena")
    proposal = {
        "id": str(uuid.uuid4()),
        "proposed_by": emp["id"],
        "proposed_by_name": emp.get("name", ""),
        "popis": payload.popis,
        "mnozstvi": payload.mnozstvi,
        "jednotka": payload.jednotka,
        "note": payload.note,
        "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    proposals = (job.get("vicepracovne_proposals") or []) + [proposal]
    await db.jobs.update_one({"id": job_id}, {"$set": {"vicepracovne_proposals": proposals, "updated_at": now_utc()}})
    return {"ok": True, "proposal": proposal}

# ---------- Tool Checklist ----------
class ChecklistIn(BaseModel):
    trade: str = ""
    basic_tools: List[str] = []
    extra_tools: List[str] = []

@api.put("/employee/jobs/{job_id}/checklist")
async def employee_update_checklist(job_id: str, payload: ChecklistIn, actor: dict = Depends(require_employee)):
    emp = actor["employee"]
    job = await db.jobs.find_one(
        {"id": job_id, "user_id": emp["owner_user_id"], "assigned_employee_ids": emp["id"]}
    )
    if not job:
        raise HTTPException(404, "Zakázka nenalezena nebo nepřiřazena")
    checklists = job.get("tool_checklists") or {}
    existing = checklists.get(emp["id"]) or {}
    if existing.get("confirmed"):
        raise HTTPException(400, "Checklist je již potvrzen a nelze jej měnit")
    checklists[emp["id"]] = {
        "employee_id": emp["id"],
        "employee_name": emp.get("name", ""),
        "trade": payload.trade,
        "basic_tools": payload.basic_tools,
        "extra_tools": payload.extra_tools,
        "confirmed": False,
        "updated_at": now_utc().isoformat(),
    }
    await db.jobs.update_one({"id": job_id}, {"$set": {"tool_checklists": checklists, "updated_at": now_utc()}})
    return {"ok": True, "checklist": checklists[emp["id"]]}

@api.post("/employee/jobs/{job_id}/checklist/confirm")
async def employee_confirm_checklist(job_id: str, actor: dict = Depends(require_employee)):
    emp = actor["employee"]
    job = await db.jobs.find_one(
        {"id": job_id, "user_id": emp["owner_user_id"], "assigned_employee_ids": emp["id"]}
    )
    if not job:
        raise HTTPException(404, "Zakázka nenalezena nebo nepřiřazena")
    checklists = job.get("tool_checklists") or {}
    cur = checklists.get(emp["id"]) or {}
    if cur.get("confirmed"):
        raise HTTPException(400, "Checklist je již potvrzen")
    if not cur.get("basic_tools") and not cur.get("extra_tools"):
        raise HTTPException(400, "Checklist je prázdný — nejdřív vyberte nebo přidejte nářadí")
    cur["confirmed"] = True
    cur["confirmed_at"] = now_utc().isoformat()
    cur["employee_id"] = emp["id"]
    cur["employee_name"] = emp.get("name", "")
    checklists[emp["id"]] = cur
    await db.jobs.update_one({"id": job_id}, {"$set": {"tool_checklists": checklists, "updated_at": now_utc()}})
    return {"ok": True, "checklist": cur}

class ResolveProposalIn(BaseModel):
    action: Literal["approve", "reject"]
    cena: Optional[float] = 0

    @field_validator("cena", mode="before")
    @classmethod
    def parse_floats(cls, v):
        return clean_comma_float(v)

@api.post("/jobs/{job_id}/proposals/{proposal_id}/resolve")
async def resolve_proposal(job_id: str, proposal_id: str, payload: ResolveProposalIn, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Zakázka nenalezena")
    proposals = job.get("vicepracovne_proposals") or []
    target = next((p for p in proposals if p.get("id") == proposal_id), None)
    if not target:
        raise HTTPException(404, "Návrh nenalezen")
    if target.get("status") != "pending":
        raise HTTPException(400, "Návrh už byl vyřízen")
    target["status"] = "approved" if payload.action == "approve" else "rejected"
    target["resolved_at"] = now_utc().isoformat()
    update = {"vicepracovne_proposals": proposals, "updated_at": now_utc()}
    if payload.action == "approve":
        new_row = {
            "id": str(uuid.uuid4()),
            "popis": target["popis"],
            "mnozstvi": target.get("mnozstvi", 1),
            "jednotka": target.get("jednotka", "ks"),
            "cena": float(payload.cena or 0),
        }
        update["vicepracovne"] = (job.get("vicepracovne") or []) + [new_row]
    await db.jobs.update_one({"id": job_id}, {"$set": update})
    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return serialize_job(fresh)

# ---------- Health ----------
@app.get("/")  # OPRAVENO: Navázáno přímo na kořen celého webu pro bezchybný Railway Health Check!
async def root():
    return {"app": "Remeslnik Pro 1.0", "status": "ok"}

# ---------- App init ----------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    _ensure_fonts()
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index([("user_id", 1), ("created_at", -1)])
    await db.jobs.create_index("id", unique=True)
    await db.quote_variants.create_index("id", unique=True)
    await db.employees.create_index([("owner_user_id", 1), ("id", 1)], unique=True)
    try:
        idx_info = await db.employees.index_information()
        if "pin_1" in idx_info:
            await db.employees.drop_index("pin_1")
            logger.info("Dropped legacy global-unique pin_1 index")
    except Exception as e:
        logger.warning("Could not inspect/drop pin_1 index: %s", e)
    await db.employees.create_index([("owner_user_id", 1), ("pin", 1)], unique=True, sparse=True)
    await db.users.create_index("company_code", unique=True, sparse=True)

    legacy_cursor = db.users.find({"$or": [{"company_code": {"$exists": False}}, {"company_code": ""}]})
    async for u in legacy_cursor:
        code = _gen_company_code()
        for _ in range(10):
            if not await db.users.find_one({"company_code": code}):
                break
            code = _gen_company_code()
        await db.users.update_one({"id": u["id"]}, {"$set": {"company_code": code}})

    emp_cursor = db.employees.find({"$or": [{"company_code": {"$exists": False}}, {"company_code": ""}]})
    async for e in emp_cursor:
        owner = await db.users.find_one({"id": e.get("owner_user_id")}, {"_id": 0, "company_code": 1})
        if owner and owner.get("company_code"):
            await db.employees.update_one({"id": e["id"], "owner_user_id": e["owner_user_id"]}, {"$set": {"company_code": owner["company_code"]}})

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_pass = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        code = _gen_company_code()
        while await db.users.find_one({"company_code": code}):
            code = _gen_company_code()
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_pass),
            "name": "Admin Řemeslník",
            "company": "Řemeslník Pro s.r.o.",
            "phone": "+420 777 123 456",
            "company_code": code,
            "created_at": now_utc(),
        })
    elif not verify_password(admin_pass, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pass)}})

    try:
        await db.jobs.update_many(
            {"payment_note": "Splatnost 14 dní od vystavení faktury."},
            {"$set": {"payment_note": ""}},
        )
    except Exception:
        pass

@app.on_event("shutdown")
async def shutdown():
    client.close()