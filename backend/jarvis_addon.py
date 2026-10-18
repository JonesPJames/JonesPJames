"""JARVIS add-on gateway. Pro owns access, drafts and resulting jobs."""
import json
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict, FiniteFloat


class Activation(BaseModel):
    token: str = Field(min_length=20, max_length=8192)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    client_name: str = Field(min_length=1, max_length=200)
    address: str = Field(default="", max_length=500)
    description: str = Field(min_length=10, max_length=10000)
    dimensions: str = Field(default="", max_length=2000)
    photos: list[str] = Field(min_length=3, max_length=5)

    def validate_photos(self):
        import base64
        for photo in self.photos:
            if len(photo) > 1_500_000 or not photo.startswith(("data:image/jpeg;base64,", "data:image/png;base64,")):
                raise HTTPException(422, "Fotografie musí být JPEG nebo PNG do 1 MB.")
            try:
                raw = base64.b64decode(photo.split(",", 1)[1], validate=True)
                if not (raw.startswith(b"\xff\xd8\xff") or raw.startswith(b"\x89PNG\r\n\x1a\n")):
                    raise ValueError()
            except ValueError:
                raise HTTPException(422, "Neplatná fotografie.")


class Item(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    popis: str = Field(min_length=1, max_length=500)
    jednotka: str = Field(min_length=1, max_length=20)
    mnozstvi: FiniteFloat = Field(gt=0, le=1_000_000)
    cena: FiniteFloat = Field(ge=0, le=100_000_000)


class Plan(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prace: list[Item] = Field(min_length=1, max_length=100)
    material: list[Item] = Field(default_factory=list, max_length=100)
    doprava: list[Item] = Field(default_factory=list, max_length=20)
    poznamky: str = Field(default="", max_length=5000)


class Selection(BaseModel):
    index: int = Field(ge=0, le=2)


class Visual(BaseModel):
    mode: str = Field(pattern="^(edit|schema)$")


class Assistant(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


def create_router(db, get_user, create_job, job_model):
    router = APIRouter(prefix="/jarvis", tags=["jarvis-add-on"])

    async def access_for(user):
        record = await db.settings.find_one({"_id": "jarvis:access:" + user["id"]})
        now = datetime.now(timezone.utc).timestamp()
        subscription = await db.settings.find_one({"kind": "jarvis-subscription", "user_id": user["id"], "status": "active", "expires_at": {"$gt": now}})
        if subscription and (not record or subscription.get("expires_at", 0) > record.get("expires_at", 0) or record.get("status") != "active"):
            record = subscription
        full = bool(record and record.get("status") == "active" and record.get("expires_at", 0) > now)
        return {"mode": "full" if full else "limited", "full": full,
                "expires_at": record.get("expires_at") if record else None,
                "features": {"assistant": True, "workflow": full, "visuals": full},
                "activation_available": len(os.environ.get("JARVIS_LICENSE_SECRET", "")) >= 32}

    async def full_user(user=Depends(get_user)):
        if not (await access_for(user))["full"]:
            raise HTTPException(402, "Plný JARVIS vyžaduje aktivní placenou nadstavbu.")
        return user

    async def upstream(action, payload, user):
        base = os.environ.get("JARVIS_API_URL", "")
        secret = os.environ.get("JARVIS_GATEWAY_SECRET", "")
        url = urlparse(base)
        if len(secret) < 32 or url.scheme not in ("https", "http") or not url.hostname or url.username or url.password or url.path not in ("", "/") or url.query or url.fragment or (url.scheme == "http" and not url.hostname.endswith(".railway.internal") and url.hostname not in ("localhost", "127.0.0.1")):
            raise HTTPException(503, "Připojení JARVIS není nastaveno.")
        now = int(datetime.now(timezone.utc).timestamp())
        token = jwt.encode({"sub": user["id"], "companyId": user["id"], "role": "owner",
                            "iss": os.environ.get("JARVIS_GATEWAY_ISSUER", "jarvis-gateway-staging"),
                            "aud": os.environ.get("JARVIS_GATEWAY_AUDIENCE", "jarvis-api-staging"),
                            "iat": now, "exp": now + 120}, secret, algorithm="HS256")
        endpoint = "/api/v1/jarvis/assistant" if action == "assistant" else "/api/v1/jarvis/workflow"
        try:
            async with httpx.AsyncClient(timeout=90, follow_redirects=False) as client:
                response = await client.post(base.rstrip("/") + endpoint,
                    json=payload if action == "assistant" else {"action": action, **payload},
                    headers={"Authorization": "Bearer " + token})
            if response.status_code >= 300:
                try:
                    code = response.json().get("error", {}).get("code", "")
                except ValueError:
                    code = ""
                if code == "DIMENSIONS_REQUIRED":
                    raise HTTPException(422, "Doplňte potřebné naměřené rozměry v zadání a spusťte analýzu znovu.")
                raise HTTPException(response.status_code if response.status_code in (400, 402, 422, 429, 503) else 502,
                                    "JARVIS požadavek nedokončil. Zkontrolujte přístup a dostupnost AI.")
            return response.json()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(502, "JARVIS je dočasně nedostupný. Rozpracované zadání zůstává uložené.")

    async def draft_for(draft_id, user):
        doc = await db.settings.find_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Návrh nenalezen.")
        return doc

    def editable(doc):
        if doc.get("job_id"):
            raise HTTPException(409, "Návrh je již uložený jako zakázka.")

    @router.get("/access")
    async def access(user=Depends(get_user)):
        return await access_for(user)

    @router.post("/activate")
    async def activate(payload: Activation, user=Depends(get_user)):
        secret = os.environ.get("JARVIS_LICENSE_SECRET", "")
        if len(secret) < 32:
            raise HTTPException(503, "Aktivace placené nadstavby zatím není nastavena.")
        try:
            claims = jwt.decode(payload.token, secret, algorithms=["HS256"], issuer="remeslnik-billing",
                                audience="jarvis-addon", options={"require": ["exp", "iat", "sub", "jti", "plan"]})
            if claims["sub"] != user["id"] or claims["plan"] != "jarvis-full" or not isinstance(claims["exp"], (int, float)):
                raise jwt.InvalidTokenError()
        except jwt.PyJWTError:
            raise HTTPException(403, "Neplatná, cizí nebo prošlá aktivace.")
        # Keep the signed entitlement, never a client-controlled 'premium' flag.
        await db.settings.update_one({"_id": "jarvis:access:" + user["id"]},
            {"$set": {"user_id": user["id"], "status": "active", "expires_at": claims["exp"], "license_id": claims["jti"]}}, upsert=True)
        return await access_for(user)

    @router.post("/assistant")
    async def assistant(payload: Assistant, user=Depends(get_user)):
        return await upstream("assistant", payload.model_dump(), user)

    @router.get("/drafts")
    async def drafts(user=Depends(get_user)):
        cursor = db.settings.find({"kind": "jarvis-draft", "user_id": user["id"]},
            {"_id": 0, "id": 1, "title": 1, "client_name": 1, "updated_at": 1, "job_id": 1}).sort("updated_at", -1).limit(50)
        return [d async for d in cursor]

    @router.post("/drafts", status_code=201)
    async def save_draft(payload: Input, user=Depends(full_user)):
        payload.validate_photos()
        draft_id = str(uuid.uuid4())
        doc = {"_id": "jarvis:draft:" + draft_id, "id": draft_id, "kind": "jarvis-draft", "user_id": user["id"],
               **payload.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
        await db.settings.insert_one(doc.copy())
        return {k: v for k, v in doc.items() if k != "_id"}

    @router.get("/drafts/{draft_id}")
    async def get_draft(draft_id: str, user=Depends(get_user)):
        return await draft_for(draft_id, user)

    @router.put("/drafts/{draft_id}")
    async def update_draft(draft_id: str, payload: Input, user=Depends(full_user)):
        doc = await draft_for(draft_id, user)
        editable(doc)
        payload.validate_photos()
        await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]},
            {"$set": {**payload.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()},
             "$unset": {"analysis": "", "selected": "", "plan": "", "edit_visual": "", "schema_visual": ""}})
        return await draft_for(draft_id, user)

    @router.post("/drafts/{draft_id}/analyze")
    async def analyze(draft_id: str, user=Depends(full_user)):
        doc = await draft_for(draft_id, user)
        editable(doc)
        result = await upstream("analyze", {"input": Input(**{k: doc[k] for k in Input.model_fields}).model_dump()}, user)
        if not isinstance(result.get("varianty"), list) or not 2 <= len(result["varianty"]) <= 3:
            raise HTTPException(502, "AI nevrátila platné varianty.")
        await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]},
            {"$set": {"analysis": result, "updated_at": datetime.now(timezone.utc).isoformat()},
             "$unset": {"selected": "", "plan": "", "edit_visual": "", "schema_visual": ""}})
        return result

    @router.post("/drafts/{draft_id}/select")
    async def select(draft_id: str, payload: Selection, user=Depends(full_user)):
        doc = await draft_for(draft_id, user)
        editable(doc)
        variants = doc.get("analysis", {}).get("varianty", [])
        if payload.index >= len(variants):
            raise HTTPException(422, "Neplatná varianta.")
        await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]},
            {"$set": {"selected": payload.index}, "$unset": {"plan": "", "edit_visual": "", "schema_visual": ""}})
        return {"selected": payload.index}

    @router.post("/drafts/{draft_id}/plan")
    async def build_plan(draft_id: str, user=Depends(full_user)):
        doc = await draft_for(draft_id, user)
        editable(doc)
        if doc.get("selected") is None:
            raise HTTPException(422, "Nejprve vyberte řešení.")
        result = await upstream("plan", {"input": {k: doc[k] for k in Input.model_fields},
            "variant": doc["analysis"]["varianty"][doc["selected"]]}, user)
        try:
            plan = Plan.model_validate(result).model_dump()
        except ValueError:
            raise HTTPException(502, "AI nevrátila platný rozpočet.")
        await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]}, {"$set": {"plan": plan}})
        return plan

    @router.put("/drafts/{draft_id}/plan")
    async def save_plan(draft_id: str, payload: Plan, user=Depends(full_user)):
        doc = await draft_for(draft_id, user)
        editable(doc)
        await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]}, {"$set": {"plan": payload.model_dump()}})
        return payload

    @router.post("/drafts/{draft_id}/visual")
    async def visual(draft_id: str, payload: Visual, user=Depends(full_user)):
        doc = await draft_for(draft_id, user)
        editable(doc)
        if doc.get("selected") is None:
            raise HTTPException(422, "Nejprve vyberte řešení.")
        result = await upstream("visual", {"input": {k: doc[k] for k in Input.model_fields},
            "variant": doc["analysis"]["varianty"][doc["selected"]], "mode": payload.mode}, user)
        image = result.get("imageUrl", "")
        if not image.startswith(("data:image/png;base64,", "data:image/jpeg;base64,")) or len(image) > 8_000_000:
            raise HTTPException(502, "AI nevrátila platný obrázek.")
        await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]}, {"$set": {payload.mode + "_visual": image}})
        return result

    @router.post("/drafts/{draft_id}/commit")
    async def commit(draft_id: str, user=Depends(full_user)):
        doc = await draft_for(draft_id, user)
        if doc.get("job_id"):
            return {"job_id": doc["job_id"]}
        if not doc.get("plan"):
            raise HTTPException(422, "Nejprve sestavte a zkontrolujte rozpočet.")
        # Atomic reservation prevents duplicate jobs on retries or simultaneous taps.
        job_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "jarvis:" + user["id"] + ":" + draft_id))
        existing = await db.jobs.find_one({"id": job_id, "user_id": user["id"]})
        if not existing:
            lock = await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"], "$or": [{"committing": {"$ne": True}}, {"committing_at": {"$lt": datetime.now(timezone.utc).timestamp() - 120}}]}, {"$set": {"committing": True, "committing_at": datetime.now(timezone.utc).timestamp()}})
            if not lock.modified_count:
                raise HTTPException(409, "Uložení probíhá. Zkontrolujte seznam zakázek před opakováním.")
            try:
                # Job creation callback belongs to Pro; JARVIS never writes business data.
                await create_job(doc, user, job_id)
            except Exception:
                await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]}, {"$unset": {"committing": ""}})
                raise
        await db.settings.update_one({"_id": "jarvis:draft:" + draft_id, "user_id": user["id"]}, {"$set": {"job_id": job_id}, "$unset": {"committing": ""}})
        return {"job_id": job_id}

    # Used by the private AI service to verify access again with a delegated identity.
    router.access_for = access_for
    return router
