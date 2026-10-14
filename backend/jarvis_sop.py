"""Versioned, owner-scoped SOP project state API for JARVIS.
Separate from operational jobs. Mount only behind existing FastAPI auth.
"""
import os
import jwt
from fastapi import Header
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

router = APIRouter(prefix="/jarvis/sop", tags=["jarvis-sop"])
PHASES = {"START", "A", "B", "S", "C", "D", "E", "F", "G", "H"}
TRANSITIONS = {"START": {"A"}, "A": {"B"}, "B": {"S", "C"}, "S": {"C"}, "C": {"D"}, "D": {"E"}, "E": {"F"}, "F": {"G"}, "G": {"H"}, "H": set()}

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)

class StateCommand(BaseModel):
    type: str
    target: str | None = None
    expectedVersion: int = Field(ge=0)
    idempotencyKey: str = Field(min_length=1, max_length=160)

def create_router(db, get_current_user):
    async def delegated_owner(authorization: str = Header(default="")):
        secret = os.environ.get("JARVIS_INTEGRATION_SECRET", "")
        if len(secret) < 32:
            raise HTTPException(503, "JARVIS_INTEGRATION_NOT_CONFIGURED")
        if not authorization.startswith("Bearer "):
            raise HTTPException(401, "MISSING_DELEGATION")
        try:
            claims = jwt.decode(authorization[7:], secret, algorithms=["HS256"],
                                issuer="jarvis-api", audience="remeslnik-pro-sop",
                                options={"require": ["exp", "iat", "sub", "companyId", "role"]})
        except jwt.PyJWTError:
            raise HTTPException(401, "INVALID_DELEGATION")
        if claims.get("role") not in ("owner", "admin") or claims.get("companyId") != claims.get("sub"):
            raise HTTPException(403, "INVALID_OWNER_MAPPING")
        user = await db.users.find_one({"id": claims["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(403, "UNKNOWN_OWNER")
        return user

    async def create_project(payload: ProjectCreate, user=Depends(delegated_owner)):
        now = datetime.now(timezone.utc).isoformat()
        project = {"id": str(uuid4()), "companyId": user["id"], "name": payload.name, "state": {"phase": "START", "mode": "NORMAL", "version": 0}, "createdAt": now, "updatedAt": now}
        await db.jarvis_sop_projects.insert_one(dict(project))
        return project

    async def get_project(project_id: str, user=Depends(delegated_owner)):
        project = await db.jarvis_sop_projects.find_one({"id": project_id, "companyId": user["id"]}, {"_id": 0})
        if not project:
            raise HTTPException(404, "PROJECT_NOT_FOUND")
        return project

    async def command(project_id: str, payload: StateCommand, user=Depends(delegated_owner)):
        owner_id = user["id"]
        current = await db.jarvis_sop_projects.find_one({"id": project_id, "companyId": owner_id}, {"_id": 0})
        if not current:
            raise HTTPException(404, "PROJECT_NOT_FOUND")
        state = current["state"]
        existing = await db.jarvis_sop_commands.find_one({"projectId": project_id, "companyId": owner_id, "key": payload.idempotencyKey}, {"_id": 0})
        if existing:
            return existing["project"]
        if state["version"] != payload.expectedVersion:
            raise HTTPException(409, "VERSION_CONFLICT")
        new_state = dict(state)
        if payload.type == "state.transition":
            if state["mode"] != "NORMAL" or payload.target not in TRANSITIONS.get(state["phase"], set()):
                raise HTTPException(422, "INVALID_TRANSITION")
            new_state["phase"] = payload.target
        elif payload.type == "sop.restart":
            if state["mode"] != "NORMAL":
                raise HTTPException(422, "ALREADY_RESTARTED")
            new_state["mode"] = "RESTART"
            new_state["resumeStateId"] = state["phase"]
        elif payload.type == "sop.resume":
            if state["mode"] != "RESTART":
                raise HTTPException(422, "NOT_RESTARTED")
            new_state["mode"] = "NORMAL"
            new_state["phase"] = state.get("resumeStateId", state["phase"])
            new_state.pop("resumeStateId", None)
        else:
            raise HTTPException(422, "UNKNOWN_COMMAND")
        new_state["version"] += 1
        now = datetime.now(timezone.utc).isoformat()
        updated = await db.jarvis_sop_projects.find_one_and_update(
            {"id": project_id, "companyId": owner_id, "state.version": payload.expectedVersion},
            {"$set": {"state": new_state, "updatedAt": now}},
            return_document=ReturnDocument.AFTER, projection={"_id": 0})
        if updated is None:
            raise HTTPException(409, "VERSION_CONFLICT")
        await db.jarvis_sop_commands.update_one(
            {"projectId": project_id, "companyId": owner_id, "key": payload.idempotencyKey},
            {"$setOnInsert": {"projectId": project_id, "companyId": owner_id, "key": payload.idempotencyKey, "project": updated}},
            upsert=True)
        return updated

    router.add_api_route("/projects", create_project, methods=["POST"])
    router.add_api_route("/projects/{project_id}", get_project, methods=["GET"])
    router.add_api_route("/projects/{project_id}/commands", command, methods=["POST"])
    return router
