"""Tenant-scoped JARVIS integration for Remeslnik Pro."""
import os
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

class ClientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    city: str = Field(default="", max_length=200)

class LineItem(BaseModel):
    popis: str = Field(min_length=1)
    mnozstvi: float = Field(gt=0)
    jednotka: str = "ks"
    cena: float = Field(ge=0)

    @field_validator("mnozstvi", "cena", mode="before")
    @classmethod
    def comma_decimal(cls, value):
        if isinstance(value, str):
            return value.strip().replace(",", ".")
        return value

class JobCreate(BaseModel):
    client_name: str = Field(min_length=1)
    title: str = Field(min_length=1)
    address: str = ""
    material: list[LineItem] = Field(default_factory=list)


def create_router(db, get_current_user):
    router = APIRouter(prefix="/integrations/jarvis", tags=["jarvis-integration"])

    async def owner(authorization: str = Header(default="")):
        secret = os.environ.get("JARVIS_INTEGRATION_SECRET", "")
        if len(secret) < 32:
            raise HTTPException(503, "JARVIS_INTEGRATION_NOT_CONFIGURED")
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "MISSING_DELEGATION")
        try:
            claims = jwt.decode(
                authorization[7:], secret, algorithms=["HS256"],
                issuer="jarvis-api", audience="remeslnik-pro",
                options={"require": ["exp", "iat", "sub", "companyId", "role"]})
        except jwt.PyJWTError:
            raise HTTPException(401, "INVALID_DELEGATION")
        if claims.get("role") != "owner" or claims.get("companyId") != claims.get("sub"):
            raise HTTPException(403, "INVALID_OWNER_MAPPING")
        user = await db.users.find_one({"id": claims["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(403, "UNKNOWN_OWNER")
        return user

    @router.post("/token")
    async def gateway_token(user=__import__("fastapi").Depends(get_current_user)):
        secret = os.environ.get("JARVIS_GATEWAY_SECRET", "")
        if len(secret) < 32:
            raise HTTPException(503, "GATEWAY_NOT_CONFIGURED")
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {"sub": user["id"], "companyId": user["id"], "role": "owner",
             "iss": "jarvis-gateway-staging", "aud": "jarvis-api-staging",
             "iat": now, "exp": now + timedelta(minutes=15)},
            secret, algorithm="HS256")
        return {"access_token": token, "token_type": "bearer", "expires_in": 900}

    @router.post("/clients", status_code=201)
    async def create_client(payload: ClientCreate, authorization: str = Header(default="")):
        user = await owner(authorization)
        from uuid import uuid4
        first, last, city = (payload.first_name.strip(), payload.last_name.strip(), payload.city.strip())
        if not first or not last:
            raise HTTPException(422, "INVALID_CLIENT_NAME")
        keys = {"user_id": user["id"], "first_name_key": first.casefold(),
                "last_name_key": last.casefold(), "city_key": city.casefold()}
        if await db.clients.find_one(keys):
            raise HTTPException(409, "CLIENT_EXISTS")
        doc = {"id": str(uuid4()), **keys, "first_name": first, "last_name": last,
               "city": city, "created_at": datetime.now(timezone.utc)}
        await db.clients.insert_one(doc)
        return {"id": doc["id"], "first_name": first, "last_name": last, "city": city}

    @router.get("/clients")
    async def list_clients(authorization: str = Header(default="")):
        user = await owner(authorization)
        cursor = db.clients.find({"user_id": user["id"]},
                                 {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "city": 1})
        return {"clients": [item async for item in cursor]}

    @router.post("/jobs", status_code=201)
    async def create_job(payload: JobCreate, authorization: str = Header(default="")):
        user = await owner(authorization)
        from uuid import uuid4
        now = datetime.now(timezone.utc)
        job = {"id": str(uuid4()), "user_id": user["id"],
               "job_number": str(uuid4())[:8], "client_name": payload.client_name,
               "title": payload.title, "address": payload.address,
               "material": [dict(id=str(uuid4()), **m.model_dump()) for m in payload.material],
               "prace": [], "doprava": [], "material_navic": [],
               "vicepracovne": [], "diary_entries": [],
               "status": "rozpracovano", "finalized": False,
               "created_at": now, "updated_at": now}
        await db.jobs.insert_one(job.copy())
        return {key: value for key, value in job.items() if key != "_id"}

    @router.post("/jobs/{job_id}/materials", status_code=201)
    async def add_material(job_id: str, payload: LineItem, authorization: str = Header(default="")):
        user = await owner(authorization)
        from uuid import uuid4
        item = {"id": str(uuid4()), **payload.model_dump()}
        result = await db.jobs.update_one(
            {"id": job_id, "user_id": user["id"], "finalized": False},
            {"$push": {"material": item}, "$set": {"updated_at": datetime.now(timezone.utc)}})
        if result.matched_count != 1:
            raise HTTPException(404, "EDITABLE_JOB_NOT_FOUND")
        return item

    @router.get("/jobs")
    async def list_jobs(authorization: str = Header(default="")):
        user = await owner(authorization)
        cursor = db.jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
        allowed = ("id", "job_number", "title", "client_name", "address", "status")
        jobs = [{key: job[key] for key in allowed if key in job} async for job in cursor]
        return {"jobs": jobs, "count": len(jobs), "limit": 100}

    @router.get("/jobs/{job_id}")
    async def job_detail(job_id: str, authorization: str = Header(default="")):
        user = await owner(authorization)
        job = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
        if not job:
            raise HTTPException(404, "JOB_NOT_FOUND")
        allowed = ("id", "job_number", "title", "client_name", "address", "status")
        return {key: job[key] for key in allowed if key in job}

    return router
