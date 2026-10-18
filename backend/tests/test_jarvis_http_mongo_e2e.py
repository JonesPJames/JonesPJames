"""HTTP integration against disposable MongoDB, enabled with TEST_MONGO_URL."""
import os
import uuid
import pytest
import jwt
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient
from jarvis_integration import create_router

@pytest.mark.asyncio
async def test_jarvis_http_mongo_crud(monkeypatch):
    url = os.getenv("TEST_MONGO_URL")
    if not url:
        pytest.skip("Disposable MongoDB not configured")
    secret = "test-only-integration-secret-at-least-32-bytes"
    monkeypatch.setenv("JARVIS_INTEGRATION_SECRET", secret)
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
    database = client["jarvis_test_" + uuid.uuid4().hex]
    async def current_user():
        return {"id": "tenant_a"}
    app = FastAPI()
    app.include_router(create_router(database, current_user))
    def token(tenant):
        return {"Authorization": "Bearer " + jwt.encode({
            "sub": tenant, "companyId": tenant, "role": "owner",
            "iss": "jarvis-api", "aud": "remeslnik-pro",
            "iat": 1700000000, "exp": 4102444800}, secret, algorithm="HS256")}
    try:
        await database.users.insert_many([{"id": "tenant_a"}, {"id": "tenant_b"}])
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http:
            a, b = token("tenant_a"), token("tenant_b")
            created = await http.post("/integrations/jarvis/clients", headers=a,
                json={"first_name": "Jan", "last_name": "Novák", "city": "Praha"})
            assert created.status_code == 201, created.text
            assert (await http.post("/integrations/jarvis/clients", headers=a,
                json={"first_name": "Jan", "last_name": "Novák", "city": "Praha"})).status_code == 409
            assert len((await http.get("/integrations/jarvis/clients", headers=b)).json()["clients"]) == 0
            job = await http.post("/integrations/jarvis/jobs", headers=a,
                json={"client_name": "Jan Novák", "title": "Oprava", "material": []})
            assert job.status_code == 201, job.text
            job_id = job.json()["id"]
            assert (await http.get("/integrations/jarvis/jobs/" + job_id, headers=b)).status_code == 404
            material = await http.post("/integrations/jarvis/jobs/" + job_id + "/materials",
                headers=a, json={"popis": "Barva", "mnozstvi": "1,5", "jednotka": "l", "cena": "25,50"})
            assert material.status_code == 201, material.text
            assert material.json()["mnozstvi"] == 1.5
            spaced = await http.post("/integrations/jarvis/jobs/" + job_id + "/materials",
                headers=a, json={"popis": "Písek", "mnozstvi": " 2,5 ", "cena": " 10,25 "})
            assert spaced.status_code == 201, spaced.text
            assert spaced.json()["mnozstvi"] == 2.5
            assert spaced.json()["cena"] == 10.25
            assert material.json()["cena"] == 25.5
            stored = await database.jobs.find_one({"id": job_id, "user_id": "tenant_a"})
            assert stored["material"][0]["mnozstvi"] == 1.5
            assert (await http.post("/integrations/jarvis/jobs/" + job_id + "/materials",
                headers=b, json={"popis": "Zakázáno", "mnozstvi": 1, "cena": 1})).status_code == 404
            assert (await http.get("/integrations/jarvis/jobs", headers=b)).json()["count"] == 0
            assert (await http.post("/integrations/jarvis/jobs/" + job_id + "/materials",
                headers=a, json={"popis": "Neplatné", "mnozstvi": 0, "cena": 1})).status_code == 422
            assert (await http.post("/integrations/jarvis/jobs/" + job_id + "/materials",
                json={"popis": "Bez tokenu", "mnozstvi": 1, "cena": 1})).status_code == 401
            await database.jobs.update_one({"id": job_id, "user_id": "tenant_a"},
                {"$set": {"finalized": True}})
            assert (await http.post("/integrations/jarvis/jobs/" + job_id + "/materials",
                headers=a, json={"popis": "Uzamčeno", "mnozstvi": 1, "cena": 1})).status_code == 404
            unchanged = await database.jobs.find_one({"id": job_id, "user_id": "tenant_a"})
            assert len(unchanged["material"]) == 2

    finally:
        await client.drop_database(database.name)
        client.close()
