from pathlib import Path

SOURCE = Path(__file__).resolve().parents[2] / "frontend" / "app" / "jarvis.tsx"


def test_open_uses_real_job_endpoint():
    text = SOURCE.read_text(encoding="utf-8")
    assert 'api.get("/jobs")' in text
    assert 'router.push(("/zakazka/" + found[0].id)' in text


def test_ambiguous_matches_do_not_open_record():
    text = SOURCE.read_text(encoding="utf-8")
    assert 'found.length === 1' in text
    assert 'found.length > 1' in text


def test_client_creation_requires_confirmation():
    text = SOURCE.read_text(encoding="utf-8")
    assert 'Alert.alert("Založit klienta?"' in text
    assert 'api.post("/clients", client)' in text


def test_followup_has_selected_job_context():
    text = SOURCE.read_text(encoding="utf-8")
    assert 'const [lastJob, setLastJob]' in text
    assert 'lastJob.id' in text
