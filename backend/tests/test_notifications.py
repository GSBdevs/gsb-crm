from httpx import AsyncClient


async def test_broadcast_read_state_is_per_user(client: AsyncClient, auth_headers):
    # segundo usuário
    resp = await client.post(
        "/users",
        json={"email": "rep@gruposb.com", "password": "secret123", "role": "rep"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    resp = await client.post(
        "/auth/login", json={"email": "rep@gruposb.com", "password": "secret123"}
    )
    rep_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

    # workflow gera notificação broadcast
    await client.post(
        "/workflows",
        json={
            "name": "Aviso de lead",
            "trigger_event": "lead.created",
            "actions": [{"type": "notify", "params": {"title": "Broadcast: {name}"}}],
        },
        headers=auth_headers,
    )
    await client.post("/leads", json={"name": "Cliente Teste"}, headers=auth_headers)

    # ambos veem 1 não lida
    for headers in (auth_headers, rep_headers):
        resp = await client.get("/notifications/unread-count", headers=headers)
        assert resp.json()["count"] == 1

    # admin lê; estado do rep não muda
    resp = await client.get("/notifications", headers=auth_headers)
    notification_id = resp.json()[0]["id"]
    resp = await client.post(f"/notifications/{notification_id}/read", headers=auth_headers)
    assert resp.json()["is_read"] is True

    resp = await client.get("/notifications/unread-count", headers=auth_headers)
    assert resp.json()["count"] == 0
    resp = await client.get("/notifications/unread-count", headers=rep_headers)
    assert resp.json()["count"] == 1

    # read-all do rep zera para ele
    resp = await client.post("/notifications/read-all", headers=rep_headers)
    assert resp.status_code == 204
    resp = await client.get("/notifications/unread-count", headers=rep_headers)
    assert resp.json()["count"] == 0
