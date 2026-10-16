"""Tenant-scoped JARVIS integration for Remeslnik Pro."""
import os
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

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

    class ClientCreate(BaseModel):
        name: str = Field(min_length=1, max_length=200)
        phone: str = ""
        email: str = ""

    @router.post("/clients", status_code=201)
    async def create_client(payload: ClientCreate, authorization: str = Header(default="")):
        user = await owner(authorization)
        from uuid import uuid4
        doc = {"id": str(uuid4()), "user_id": user["id"], **payload.model_dump()}
        await db.clients.insert_one(doc)
        return {key: value for key, value in doc.items() if key != "_id"}

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
