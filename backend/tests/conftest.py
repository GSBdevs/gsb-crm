import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("AUTO_CREATE_TABLES", "false")
os.environ.setdefault("WORKFLOWS_INLINE", "true")
os.environ.setdefault("SECRET_KEY", "test-secret-com-tamanho-suficiente-para-hs256")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core import database  # noqa: E402
from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest.fixture
async def db_engine(monkeypatch):
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    # O dispatch inline de workflows abre sessão própria via database.session_factory;
    # aponta para o banco de teste.
    monkeypatch.setattr(database, "session_factory", factory)

    yield engine, factory
    await engine.dispose()


@pytest.fixture
async def client(db_engine):
    _engine, factory = db_engine

    async def _get_test_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = _get_test_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api/v1") as http:
        yield http
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    resp = await client.post(
        "/auth/bootstrap",
        json={"email": "admin@test.com", "password": "secret123", "full_name": "Admin"},
    )
    assert resp.status_code == 201, resp.text
    tokens = resp.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def create_default_stages(client: AsyncClient, headers: dict[str, str]) -> list[dict]:
    stages = []
    specs = [
        ("Prospecção", 10, False, False),
        ("Proposta", 50, False, False),
        ("Ganhou", 100, True, False),
        ("Perdeu", 0, False, True),
    ]
    for position, (name, prob, won, lost) in enumerate(specs):
        resp = await client.post(
            "/stages",
            json={
                "name": name,
                "position": position,
                "probability": prob,
                "is_won": won,
                "is_lost": lost,
            },
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        stages.append(resp.json())
    return stages
