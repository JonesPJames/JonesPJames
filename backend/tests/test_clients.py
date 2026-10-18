import ast
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "server.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"))

def route(name):
    for node in TREE.body:
        if isinstance(node, ast.AsyncFunctionDef) and node.name == name:
            return node
    raise AssertionError(f"Missing endpoint: {name}")

def test_client_endpoints_exist():
    assert route("create_client")
    assert route("list_clients")

def test_client_create_requires_auth_and_scopes_user():
    node = route("create_client")
    source = ast.get_source_segment(SOURCE.read_text(encoding="utf-8"), node)
    assert "Depends(get_current_user)" in source
    assert '"user_id": user["id"]' in source
    assert "db.clients.insert_one" in source
    assert "HTTPException(status_code=409" in source

def test_client_list_scopes_user():
    node = route("list_clients")
    source = ast.get_source_segment(SOURCE.read_text(encoding="utf-8"), node)
    assert 'db.clients.find({"user_id": user["id"]}' in source
