"""Add-on access, tenant isolation and save/retry contract without live services."""
import asyncio
import base64
import io
import os
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock

import jwt
import pytest
from PIL import Image
from fastapi import FastAPI, Header
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import jarvis_addon

SECRET = 'test-license-key-with-at-least-32-characters'


def license_for(user='a', **extra):
    now = int(time.time())
    return jwt.encode({'sub': user, 'iat': now, 'exp': now + 3600, 'jti': 'purchase-1',
                       'plan': 'jarvis-full', 'iss': 'remeslnik-billing', 'aud': 'jarvis-addon', **extra}, SECRET, algorithm='HS256')


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv('JARVIS_LICENSE_SECRET', SECRET)
    db = AsyncMongoMockClient().test
    async def user(x_user: str = Header(default='a')):
        return {'id': x_user}
    async def create(draft, user, job_id):
        await db.jobs.insert_one({'id': job_id, 'user_id': user['id'], 'plan': draft['plan']})
    callback = AsyncMock(side_effect=create)
    router = jarvis_addon.create_router(db, user, callback, None)
    app = FastAPI()
    app.include_router(router, prefix='/api')
    image = io.BytesIO()
    Image.new('RGB', (2, 2)).save(image, 'JPEG')
    photo = 'data:image/jpeg;base64,' + base64.b64encode(image.getvalue()).decode()
    payload = {'title': 'Obklady', 'client_name': 'Novák', 'description': 'Vyměnit obklady v koupelně',
               'photos': [photo] * 3, 'dimensions': '12 m2', 'address': 'Praha'}
    plan = {'prace': [{'popis': 'Montáž', 'jednotka': 'm2', 'mnozstvi': 12, 'cena': 500}],
            'material': [], 'doprava': [], 'poznamky': 'Kontrola rozměrů'}
    return TestClient(app), db, payload, plan, callback


def activate(client):
    assert client.post('/api/jarvis/activate', json={'token': license_for()}).status_code == 200


def test_limited_account_cannot_generate_or_self_upgrade(setup):
    client, db, payload, plan, callback = setup
    assert client.get('/api/jarvis/access').json()['mode'] == 'limited'
    assert client.post('/api/jarvis/drafts', json=payload).status_code == 402
    assert client.post('/api/jarvis/activate', json={'token': license_for('another-user')}).status_code == 403
    assert client.post('/api/jarvis/activate', json={'token': license_for(exp=1)}).status_code == 403
    callback.assert_not_awaited()


def test_active_paid_access_saves_restores_and_commits_once(setup):
    client, db, payload, plan, callback = setup
    activate(client)
    saved = client.post('/api/jarvis/drafts', json=payload)
    assert saved.status_code == 201, saved.text
    draft_id = saved.json()['id']
    assert len(client.get('/api/jarvis/drafts/' + draft_id).json()['photos']) == 3
    assert client.get('/api/jarvis/drafts/' + draft_id, headers={'x-user': 'b'}).status_code == 404
    assert client.put('/api/jarvis/drafts/' + draft_id + '/plan', json=plan).status_code == 200
    first = client.post('/api/jarvis/drafts/' + draft_id + '/commit')
    second = client.post('/api/jarvis/drafts/' + draft_id + '/commit')
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert callback.await_count == 1
    assert client.put('/api/jarvis/drafts/' + draft_id, json=payload).status_code == 409


def test_expiry_keeps_drafts_readable_but_blocks_paid_actions(setup):
    client, db, payload, plan, callback = setup
    activate(client)
    draft_id = client.post('/api/jarvis/drafts', json=payload).json()['id']
    asyncio.run(db.settings.update_one({'_id': 'jarvis:access:a'}, {'$set': {'expires_at': 1}}))
    assert client.get('/api/jarvis/drafts/' + draft_id).status_code == 200
    assert client.post('/api/jarvis/drafts/' + draft_id + '/analyze').status_code == 402
    assert client.put('/api/jarvis/drafts/' + draft_id + '/plan', json=plan).status_code == 402


def test_requires_three_real_photos_and_valid_prices(setup):
    client, db, payload, plan, callback = setup
    activate(client)
    assert client.post('/api/jarvis/drafts', json={**payload, 'photos': payload['photos'][:2]}).status_code == 422
    assert client.post('/api/jarvis/drafts', json={**payload, 'photos': ['data:image/jpeg;base64,AAAA'] * 3}).status_code == 422
    draft_id = client.post('/api/jarvis/drafts', json=payload).json()['id']
    plan['prace'][0]['cena'] = -1
    assert client.put('/api/jarvis/drafts/' + draft_id + '/plan', json=plan).status_code == 422


def test_input_change_invalidates_previous_results(setup):
    client, db, payload, plan, callback = setup
    activate(client)
    draft_id = client.post('/api/jarvis/drafts', json=payload).json()['id']
    client.put('/api/jarvis/drafts/' + draft_id + '/plan', json=plan)
    changed = client.put('/api/jarvis/drafts/' + draft_id, json={**payload, 'dimensions': '20 m2'})
    assert changed.status_code == 200
    assert 'plan' not in changed.json()
    assert client.post('/api/jarvis/drafts/' + draft_id + '/commit').status_code == 422
