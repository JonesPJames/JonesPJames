"""Static security contract for standalone JARVIS integration."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "jarvis_integration.py").read_text(encoding="utf-8")
SERVER = (ROOT / "server.py").read_text(encoding="utf-8")

def test_independent_integration():
    assert 'prefix="/integrations/jarvis"' in SOURCE
    assert "jarvis_sop" not in SOURCE.lower()
    assert 'create_jarvis_integration_router(db, get_current_user)' in SERVER

def test_owner_isolation():
    assert '"user_id": user["id"]' in SOURCE
    assert 'claims.get("companyId") != claims.get("sub")' in SOURCE
    assert 'audience="remeslnik-pro"' in SOURCE

def test_scoped_reads_and_controlled_writes():
    assert "db.jobs.find(" in SOURCE
    assert "db.jobs.find_one(" in SOURCE
    assert '{"id": job_id, "user_id": user["id"], "finalized": False}' in SOURCE
    assert '{"$push": {"material": item}' in SOURCE
    assert 'if result.matched_count != 1:' in SOURCE
    assert "db.jobs.delete_" not in SOURCE

def test_token_exchange():
    assert 'prefix="/integrations/jarvis"' in SOURCE
    assert 'router.post("/token")' in SOURCE
    assert 'Depends(get_current_user)' in SOURCE
