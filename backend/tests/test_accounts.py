from httpx import AsyncClient

from tests.conftest import create_default_stages


async def test_account_status_filter_and_machines(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/accounts", json={"name": "Cliente Ativo", "status": "active"}, headers=auth_headers
    )
    assert resp.status_code == 201
    active = resp.json()
    resp = await client.post("/accounts", json={"name": "Possível Cliente"}, headers=auth_headers)
    prospect = resp.json()
    assert prospect["status"] == "prospect"  # default

    resp = await client.get(
        "/accounts", params={"account_status": "active"}, headers=auth_headers
    )
    assert [a["id"] for a in resp.json()["items"]] == [active["id"]]

    # máquinas registradas na conta
    resp = await client.post(
        f"/accounts/{active['id']}/machines",
        json={"name": "Multifuncional A3 Color", "serial_number": "GSB-001", "notes": "matriz"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    machine = resp.json()

    resp = await client.get(f"/accounts/{active['id']}/machines", headers=auth_headers)
    assert [m["serial_number"] for m in resp.json()] == ["GSB-001"]

    resp = await client.delete(
        f"/accounts/{active['id']}/machines/{machine['id']}", headers=auth_headers
    )
    assert resp.status_code == 204
    resp = await client.get(f"/accounts/{active['id']}/machines", headers=auth_headers)
    assert resp.json() == []


async def test_winning_opportunity_activates_account(client: AsyncClient, auth_headers):
    stages = await create_default_stages(client, auth_headers)
    resp = await client.post("/accounts", json={"name": "Empresa X"}, headers=auth_headers)
    account = resp.json()
    assert account["status"] == "prospect"

    resp = await client.post(
        "/opportunities",
        json={
            "title": "Locação 5× A4 mono — Empresa X",
            "value": 1200,
            "stage_id": stages[0]["id"],
            "account_id": account["id"],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    opp = resp.json()

    # mover para o estágio ganho ativa o cliente
    resp = await client.patch(
        f"/opportunities/{opp['id']}/move",
        json={"stage_id": stages[2]["id"], "position": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 200

    resp = await client.get(f"/accounts/{account['id']}", headers=auth_headers)
    assert resp.json()["status"] == "active"
