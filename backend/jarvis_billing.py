"""Hosted subscription checkout and authenticated payment webhooks for the add-on."""
import hashlib
import hmac
import json
import os
import re
import time
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request


def verify_signature(raw: bytes, header: str, secret: str):
    try:
        fields = [part.split('=', 1) for part in header.split(',')]
        timestamp = next(value for key, value in fields if key == 't')
        if abs(time.time() - int(timestamp)) > 300:
            raise ValueError()
        expected = hmac.new(secret.encode(), timestamp.encode() + b'.' + raw, hashlib.sha256).hexdigest()
        if not any(key == 'v1' and hmac.compare_digest(expected, value) for key, value in fields):
            raise ValueError()
    except (ValueError, StopIteration):
        raise HTTPException(400, 'Neplatný podpis platby.')


def billing_ready():
    return all(os.environ.get(k) for k in ('STRIPE_SECRET_KEY', 'STRIPE_JARVIS_PRICE_ID', 'STRIPE_WEBHOOK_SECRET', 'JARVIS_BILLING_RETURN_URL'))


def create_router(db, get_user):
    router = APIRouter(prefix='/jarvis/billing', tags=['jarvis-billing'])

    async def stripe(method, path, data=None, idempotency=None):
        key = os.environ.get('STRIPE_SECRET_KEY', '')
        if not key:
            raise HTTPException(503, 'Prodej nadstavby zatím není nastaven.')
        headers = {'Authorization': 'Bearer ' + key, 'Stripe-Version': '2024-06-20'}
        if idempotency:
            headers['Idempotency-Key'] = idempotency
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
                result = await client.request(method, 'https://api.stripe.com/v1/' + path, data=data, headers=headers)
            if result.status_code >= 300:
                raise HTTPException(502, 'Platební služba požadavek nedokončila.')
            return result.json()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(502, 'Platební služba není dostupná.')

    @router.get('/status')
    async def status(user=Depends(get_user)):
        return {'checkout_available': billing_ready()}

    @router.post('/checkout')
    async def checkout(user=Depends(get_user)):
        if not billing_ready():
            raise HTTPException(503, 'Prodej nadstavby zatím není nastaven.')
        if await db.settings.find_one({'kind': 'jarvis-subscription', 'user_id': user['id'], 'status': 'active', 'expires_at': {'$gt': time.time()}}):
            raise HTTPException(409, 'Předplatné již máte aktivní. Použijte správu předplatného.')
        return_url = os.environ['JARVIS_BILLING_RETURN_URL']
        url = urlparse(return_url)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise HTTPException(503, 'Návrat z platební brány není nastaven.')
        # Price, account identity and return URL all come from the server.
        data = {'mode': 'subscription', 'line_items[0][price]': os.environ['STRIPE_JARVIS_PRICE_ID'],
                'line_items[0][quantity]': '1', 'client_reference_id': user['id'],
                'subscription_data[metadata][pro_user_id]': user['id'],
                'subscription_data[metadata][product]': 'jarvis-full',
                'success_url': return_url + '?checkout=success', 'cancel_url': return_url + '?checkout=cancel',
                'customer_email': user.get('email', ''), 'locale': 'cs'}
        # A double tap within ten minutes reuses the same session.
        key = hashlib.sha256(('jarvis:' + user['id'] + ':' + str(int(time.time()) // 600)).encode()).hexdigest()
        session = await stripe('POST', 'checkout/sessions', data, key)
        target = session.get('url', '')
        if urlparse(target).scheme != 'https' or urlparse(target).hostname != 'checkout.stripe.com':
            raise HTTPException(502, 'Neplatná adresa platební brány.')
        return {'url': target}

    @router.post('/webhook')
    async def webhook(request: Request, stripe_signature: str = Header(default='')):
        secret = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
        price = os.environ.get('STRIPE_JARVIS_PRICE_ID', '')
        if not secret or not price:
            raise HTTPException(503, 'Platby nejsou nastavené.')
        raw = b''
        async for chunk in request.stream():
            raw += chunk
            if len(raw) > 262144:
                raise HTTPException(413, 'PAYLOAD_TOO_LARGE')
        verify_signature(raw, stripe_signature, secret)
        try:
            event = json.loads(raw)
            obj = event['data']['object']
            event_type = event['type']
        except (ValueError, KeyError, TypeError):
            raise HTTPException(400, 'Neplatná platební událost.')
        if event_type.startswith('customer.subscription.'):
            subscription_id = obj.get('id', '')
        elif event_type.startswith('checkout.session.') or event_type.startswith('invoice.'):
            subscription_id = obj.get('subscription', '')
        else:
            return {'received': True}
        if not subscription_id:
            return {'received': True}
        if not isinstance(subscription_id, str) or not re.fullmatch(r'sub_[A-Za-z0-9]+', subscription_id):
            raise HTTPException(400, 'Neplatné předplatné.')
        # Retrieve current authoritative state even for repeated or out-of-order events.
        subscription = await stripe('GET', 'subscriptions/' + subscription_id)
        metadata = subscription.get('metadata', {})
        user_id = metadata.get('pro_user_id')
        if metadata.get('product') != 'jarvis-full' or not user_id:
            return {'received': True}
        if not await db.users.find_one({'id': user_id}):
            raise HTTPException(422, 'Účet předplatného nenalezen.')
        rows = subscription.get('items', {}).get('data', [])
        matching = [row for row in rows if row.get('price', {}).get('id') == price]
        valid_until = max([row.get('current_period_end', subscription.get('current_period_end', 0)) for row in matching] or [0])
        active = bool(matching and subscription.get('status') == 'active' and valid_until > time.time())
        await db.settings.update_one({'_id': 'jarvis:subscription:' + subscription_id},
            {'$set': {'kind': 'jarvis-subscription', 'user_id': user_id, 'status': 'active' if active else 'inactive',
                       'expires_at': valid_until, 'subscription_id': subscription_id}}, upsert=True)
        return {'received': True}

    @router.post('/portal')
    async def portal(user=Depends(get_user)):
        record = await db.settings.find_one({'kind': 'jarvis-subscription', 'user_id': user['id'], 'status': 'active'})
        if not record:
            record = await db.settings.find_one({'kind': 'jarvis-subscription', 'user_id': user['id']}, sort=[('expires_at', -1)])
        if not record:
            raise HTTPException(404, 'Předplatné nenalezeno.')
        subscription = await stripe('GET', 'subscriptions/' + record['subscription_id'])
        session = await stripe('POST', 'billing_portal/sessions', {'customer': subscription['customer'], 'return_url': os.environ.get('JARVIS_BILLING_RETURN_URL', '')})
        target = session.get('url', '')
        if urlparse(target).scheme != 'https' or urlparse(target).hostname != 'billing.stripe.com':
            raise HTTPException(502, 'Neplatná adresa správy předplatného.')
        return {'url': target}

    return router
