import ast
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

SOURCE = Path(__file__).resolve().parents[1] / "server.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"))


class FakeCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *_):
        return self

    def __aiter__(self):
        async def stream():
            for item in self.items:
                yield item
        return stream()


class FakeCollection:
    def __init__(self):
        self.items = []

    async def find_one(self, query, projection=None):
        return next((item.copy() for item in self.items if all(item.get(k) == v for k, v in query.items())), None)

    async def insert_one(self, item):
        self.items.append(item.copy())

    def find(self, query, projection=None):
        matches = [item for item in self.items if all(item.get(k) == v for k, v in query.items())]
        if projection:
            matches = [{k: v for k, v in item.items() if projection.get(k) == 1} for item in matches]
        return FakeCursor(matches)


class HTTPError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        self.detail = detail


def load_endpoint(name, scope):
    node = next(n for n in TREE.body if isinstance(n, ast.AsyncFunctionDef) and n.name == name)
    # Compile actual endpoint body without importing production server or connecting to Mongo.
    node = ast.AsyncFunctionDef(name=node.name, args=node.args, body=node.body,
                                decorator_list=[], returns=node.returns, type_comment=None)
    module = ast.fix_missing_locations(ast.Module(body=[ast.ImportFrom(module="__future__", names=[ast.alias(name="annotations")], level=0), node], type_ignores=[]))
    exec(compile(module, str(SOURCE), "exec"), scope)
    return scope[name]


def test_client_create_list_duplicate_and_tenant_isolation():
    collection = FakeCollection()
    scope = {
        "db": SimpleNamespace(clients=collection),
        "HTTPException": HTTPError,
        "uuid": SimpleNamespace(uuid4=uuid4),
        "now_utc": lambda: datetime.now(timezone.utc),
        "Depends": lambda x: None,
        "get_current_user": lambda: None,
    }
    create = load_endpoint("create_client", scope)
    listing = load_endpoint("list_clients", scope)
    payload = SimpleNamespace(first_name="Jiří", last_name="Boček", city="Praha 9")
    result = asyncio.run(create(payload, {"id": "tenant-a"}))
    assert result["first_name"] == "Jiří"
    assert len(asyncio.run(listing({"id": "tenant-a"}))) == 1
    assert asyncio.run(listing({"id": "tenant-b"})) == []
    try:
        asyncio.run(create(payload, {"id": "tenant-a"}))
        assert False, "Duplicate must be rejected"
    except HTTPError as exc:
        assert exc.status_code == 409
    assert len(collection.items) == 1


def test_job_create_list_and_tenant_isolation():
    collection = FakeCollection()
    scope = {
        "db": SimpleNamespace(jobs=collection),
        "uuid": SimpleNamespace(uuid4=uuid4),
        "now_utc": lambda: datetime.now(timezone.utc),
        "Depends": lambda x: None,
        "get_current_user": lambda: None,
        "next_job_number": lambda user_id: asyncio.sleep(0, result="2026-001"),
        "serialize_job": lambda item: {k: v for k, v in item.items() if k != "_id"},
    }
    create = load_endpoint("create_job", scope)
    listing = load_endpoint("list_jobs", scope)
    payload = SimpleNamespace(
        client_name="Jiří Boček", title="Rekonstrukce koupelny", address="Praha 9",
        prace=[], material=[], doprava=[],
    )
    result = asyncio.run(create(payload, {"id": "tenant-a"}))
    assert result["client_name"] == "Jiří Boček"
    assert result["status"] == "rozpracovano"
    assert len(asyncio.run(listing({"id": "tenant-a"}))) == 1
    assert asyncio.run(listing({"id": "tenant-b"})) == []
    assert collection.items[0]["user_id"] == "tenant-a"


def test_job_create_preserves_material_quantities():
    collection = FakeCollection()
    scope = {
        "db": SimpleNamespace(jobs=collection),
        "uuid": SimpleNamespace(uuid4=uuid4),
        "now_utc": lambda: datetime.now(timezone.utc),
        "Depends": lambda x: None,
        "get_current_user": lambda: None,
        "next_job_number": lambda user_id: asyncio.sleep(0, result="2026-002"),
        "serialize_job": lambda item: item,
    }
    create = load_endpoint("create_job", scope)
    material = SimpleNamespace(model_dump=lambda: {
        "nazev": "Sádrokarton", "mnozstvi": 12.5, "jednotka": "m2", "cena": 0,
    })
    payload = SimpleNamespace(
        client_name="Jiří Boček", title="Koupelna", address="Praha 9",
        prace=[], material=[material], doprava=[],
    )
    result = asyncio.run(create(payload, {"id": "tenant-a"}))
    assert result["material"][0]["mnozstvi"] == 12.5
    assert collection.items[0]["material"][0]["nazev"] == "Sádrokarton"
