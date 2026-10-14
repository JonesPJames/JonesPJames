"""Source-level smoke checks for the isolated SOP contract."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=(ROOT/'jarvis_sop.py').read_text(encoding='utf-8')
SERVER=(ROOT/'server.py').read_text(encoding='utf-8')

def test_owner_scoped_queries():
    assert '"companyId": user["id"]' in SOURCE
    assert '"companyId": owner_id' in SOURCE
    assert '"state.version": payload.expectedVersion' in SOURCE

def test_separate_sop_collection():
    assert 'db.jarvis_sop_projects' in SOURCE
    assert 'db.jobs' not in SOURCE

def test_api_is_mounted():
    assert 'create_jarvis_sop_router(db, get_current_user)' in SERVER
