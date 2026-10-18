"""Regressions for payment QR PDFs and unreliable AI responses; no live DB or AI."""
import asyncio
import io
import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from PIL import Image

os.environ.setdefault('MONGO_URL', 'mongodb://localhost:27017')
os.environ.setdefault('DB_NAME', 'quote_regression_tests')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


def png_bytes():
    output = io.BytesIO()
    Image.new('RGB', (200, 200), 'black').save(output, format='PNG')
    return output.getvalue()


@pytest.mark.parametrize('builder', [server._build_pdf_quote, server._build_pdf_billing])
@pytest.mark.parametrize('bank_account', ['', '210255427/2010'])
def test_pdf_with_and_without_payment_qr(monkeypatch, builder, bank_account):
    response = io.BytesIO(png_bytes())
    monkeypatch.setattr(server.urllib.request, 'urlopen', lambda *a, **k: response)
    job = {'id': 'test-qr-job', 'job_number': '2026-001', 'title': 'Oprava přípojky',
           'client_name': 'Jiří Novák', 'prace': [{'popis': 'Montáž', 'mnozstvi': 2, 'cena': 1500, 'jednotka': 'hod'}],
           'totals': {'zaloha': 900}}
    data = builder(job, {'name': 'Řemeslník Peťas', 'bank_account': bank_account})
    assert data.startswith(b'%PDF-')
    assert b'/Subtype /Image' in data if bank_account else b'/Subtype /Image' not in data


@pytest.mark.parametrize('output,expected', [
    ('Žádná JSON odpověď', 'fallback'), ('[{"nazev": "Jen jedna"}]', 'fallback'),
    ('[{}, {}, 3]', 'fallback'), ('[{"included": "chyba"}, {}, {}]', 'fallback'),
    ('[{"rozsah": null}, {}, {}]', 'fallback'), (None, 'fallback'),
    ('```json\n' + json.dumps([{'nazev': 'A'}, {'nazev': 'B'}, {'nazev': 'C'}]) + '\n```', 'ai'),
    (server.HTTPException(502, 'provider unavailable'), 'fallback'),
    (asyncio.TimeoutError(), 'fallback'),
])
def test_generate_variants_recovers_and_exports_pdf(monkeypatch, output, expected):
    monkeypatch.setenv('AI_PROVIDER', 'openrouter')
    llm = AsyncMock(side_effect=output) if isinstance(output, Exception) else AsyncMock(return_value=output)
    monkeypatch.setattr(server, '_llm_call', llm)
    insert = AsyncMock()
    monkeypatch.setattr(server, 'db', SimpleNamespace(quote_variants=SimpleNamespace(insert_one=insert)))
    payload = server.GenerateVariantsIn(title='Technická prohlídka', description='Kontrola domu', cena_prace=10000)
    result = asyncio.run(server.ai_generate_variants(payload, {'id': 'test-user'}))
    assert result['generation_mode'] == expected
    assert len(result['variants']) == 3
    assert [v['cena_kc'] for v in result['variants']] == [10400, 11400, 13100]
    assert insert.await_count == 1
    if expected == 'fallback':
        assert all('bez AI' in v['popis'] for v in result['variants'])
        assert all(v['rozsah'] == payload.description for v in result['variants'])
    pdf = server._build_pdf_variants(result['variants'], payload.model_dump(), {'name': 'Řemeslník Peťas'})
    assert pdf.startswith(b'%PDF-')



@pytest.mark.parametrize('vat,expected,advance', [(False, 1000, 300), (True, 1210, 363)])
def test_jarvis_vat_is_consistent_in_totals_and_quote(vat, expected, advance):
    job = {'id': 'vat-test', 'job_number': '2026-900', 'title': 'Montáž', 'client_name': 'Test',
           'platce_dph': vat, 'prace': [{'popis': 'Montáž', 'mnozstvi': 2, 'cena': 500, 'jednotka': 'hod'}]}
    totals = server.compute_totals(job)
    assert totals['celkem'] == expected
    assert totals['zaloha'] == advance
    assert totals['dph_21'] == (210 if vat else 0)
    assert server._build_pdf_quote({**job, 'totals': totals}, {'name': 'Dodavatel'}).startswith(b'%PDF-')
    assert server._build_pdf_billing({**job, 'totals': totals}, {'name': 'Dodavatel'}).startswith(b'%PDF-')


def test_jarvis_visual_is_included_in_pdf_quote():
    import base64
    visual = 'data:image/png;base64,' + base64.b64encode(png_bytes()).decode()
    job = {'id': 'visual-test', 'job_number': '2026-901', 'title': 'Oprava', 'jarvis_visual': visual,
           'jarvis_description': 'Oprava < a > bez vloženého značení.', 'jarvis_notes': 'Rozsah dle dohody.'}
    pdf = server._build_pdf_quote(job, {'name': 'Dodavatel'})
    assert b'/Subtype /Image' in pdf


def test_pdf_currency_preserves_vat_precision():
    assert server._czech_currency(9873.6) == '9 873,60 Kč'
    assert server._czech_currency(4232.58) == '4 232,58 Kč'
    assert server._czech_currency(1000) == '1 000 Kč'
