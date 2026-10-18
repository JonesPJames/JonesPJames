import asyncio
import hashlib
import hmac
import json
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import jarvis_billing


def signature(raw, timestamp=None):
    ts = str(int(time.time()) if timestamp is None else timestamp)
    digest = hmac.new(b'webhook-test-key', ts.encode() + b'.' + raw, hashlib.sha256).hexdigest()
    return 't=' + ts + ',v1=' + digest


@pytest.fixture
def billing(monkeypatch):
    for k, v in {'STRIPE_SECRET_KEY': 'sk_test_key', 'STRIPE_JARVIS_PRICE_ID': 'price_jarvis',
                 'STRIPE_WEBHOOK_SECRET': 'webhook-test-key', 'JARVIS_BILLING_RETURN_URL': 'https://pro.example.test/jarvis'}.items():
        monkeypatch.setenv(k, v)
    db = AsyncMongoMockClient().test
    asyncio.run(db.users.insert_one({'id': 'owner'}))
    app = FastAPI()
    async def user():
        return {'id': 'owner', 'email': 'owner@example.test'}
    app.include_router(jarvis_billing.create_router(db, user), prefix='/api')
    sub = {'id': 'sub_test', 'customer': 'cus_test', 'metadata': {'pro_user_id': 'owner', 'product': 'jarvis-full'},
           'status': 'active', 'current_period_end': int(time.time()) + 3600,
           'items': {'data': [{'price': {'id': 'price_jarvis'}}]}}
    request = AsyncMock(return_value=SimpleNamespace(status_code=200, json=lambda: sub))
    fake = SimpleNamespace(request=request)
    factory = AsyncMock()
    factory.__aenter__.return_value = fake
    monkeypatch.setattr(jarvis_billing.httpx, 'AsyncClient', lambda **kwargs: factory)
    return TestClient(app), db, sub, request


def test_signature_rejects_tampering_and_replays():
    raw = b'{"x":1}'
    jarvis_billing.verify_signature(raw, signature(raw), 'webhook-test-key')
    with pytest.raises(Exception):
        jarvis_billing.verify_signature(raw + b' ', signature(raw), 'webhook-test-key')
    with pytest.raises(Exception):
        jarvis_billing.verify_signature(raw, signature(raw, 1), 'webhook-test-key')


def test_verified_subscription_activates_and_cancellation_revokes(billing):
    client, db, sub, request = billing
    raw = json.dumps({'type': 'customer.subscription.updated', 'data': {'object': {'id': 'sub_test'}}}).encode()
    endpoint = '/api/jarvis/billing/webhook'
    assert client.post(endpoint, content=raw, headers={'stripe-signature': 'bad'}).status_code == 400
    assert client.post(endpoint, content=raw, headers={'stripe-signature': signature(raw)}).status_code == 200
    record = asyncio.run(db.settings.find_one({'_id': 'jarvis:subscription:sub_test'}))
    assert record['status'] == 'active' and record['user_id'] == 'owner'
    sub['status'] = 'canceled'
    assert client.post(endpoint, content=raw, headers={'stripe-signature': signature(raw)}).status_code == 200
    assert asyncio.run(db.settings.find_one({'_id': record['_id']}))['status'] == 'inactive'


def test_different_product_never_unlocks_jarvis(billing):
    client, db, sub, request = billing
    sub['items']['data'][0]['price']['id'] = 'price_other'
    raw = json.dumps({'type': 'customer.subscription.updated', 'data': {'object': {'id': 'sub_test'}}}).encode()
    assert client.post('/api/jarvis/billing/webhook', content=raw, headers={'stripe-signature': signature(raw)}).status_code == 200
    assert asyncio.run(db.settings.find_one({'_id': 'jarvis:subscription:sub_test'}))['status'] == 'inactive'
