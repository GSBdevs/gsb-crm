from httpx import AsyncClient


async def test_bootstrap_login_refresh_me(client: AsyncClient):
    # bootstrap cria o primeiro admin
    resp = await client.post(
        "/auth/bootstrap",
        json={"email": "arthur@gruposb.com", "password": "secret123", "full_name": "Arthur"},
    )
    assert resp.status_code == 201
    # segundo bootstrap é bloqueado
    resp = await client.post(
        "/auth/bootstrap", json={"email": "x@x.com", "password": "secret123"}
    )
    assert resp.status_code == 409

    # login
    resp = await client.post(
        "/auth/login", json={"email": "arthur@gruposb.com", "password": "secret123"}
    )
    assert resp.status_code == 200
    tokens = resp.json()
    assert tokens["token_type"] == "bearer"

    # senha errada
    resp = await client.post(
        "/auth/login", json={"email": "arthur@gruposb.com", "password": "errada00"}
    )
    assert resp.status_code == 401

    # me
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    resp = await client.get("/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "arthur@gruposb.com"
    assert resp.json()["role"] == "admin"

    # refresh gera novo par
    resp = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 200
    assert resp.json()["access_token"]

    # access token não vale como refresh
    resp = await client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert resp.status_code == 401


async def test_protected_routes_require_token(client: AsyncClient):
    resp = await client.get("/leads")
    assert resp.status_code == 401


async def test_admin_can_manage_users(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/users",
        json={"email": "rep@gruposb.com", "password": "secret123", "role": "rep"},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    # rep não pode criar usuários
    resp = await client.post(
        "/auth/login", json={"email": "rep@gruposb.com", "password": "secret123"}
    )
    rep_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    resp = await client.post(
        "/users",
        json={"email": "outro@gruposb.com", "password": "secret123"},
        headers=rep_headers,
    )
    assert resp.status_code == 403
