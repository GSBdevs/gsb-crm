from httpx import AsyncClient

from tests.conftest import create_default_stages


async def test_kanban_move_and_close(client: AsyncClient, auth_headers):
    stages = await create_default_stages(client, auth_headers)
    prospect, proposal, won, _lost = stages

    resp = await client.post(
        "/opportunities",
        json={"title": "Contrato Anual", "value": 12000, "stage_id": prospect["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    opp = resp.json()
    assert opp["probability"] == prospect["probability"]  # herda a probabilidade do estágio

    # mover para Proposta
    resp = await client.patch(
        f"/opportunities/{opp['id']}/move",
        json={"stage_id": proposal["id"], "position": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    moved = resp.json()
    assert moved["stage_id"] == proposal["id"]
    assert moved["probability"] == proposal["probability"]
    assert moved["closed_at"] is None

    # mover para Ganhou fecha a oportunidade
    resp = await client.patch(
        f"/opportunities/{opp['id']}/move",
        json={"stage_id": won["id"], "position": 0},
        headers=auth_headers,
    )
    assert resp.json()["closed_at"] is not None

    # estágio com oportunidade não pode ser excluído
    resp = await client.delete(f"/stages/{won['id']}", headers=auth_headers)
    assert resp.status_code == 409


async def test_positions_are_normalized(client: AsyncClient, auth_headers):
    stages = await create_default_stages(client, auth_headers)
    stage_id = stages[0]["id"]
    ids = []
    for i in range(3):
        resp = await client.post(
            "/opportunities",
            json={"title": f"Opp {i}", "stage_id": stage_id},
            headers=auth_headers,
        )
        ids.append(resp.json()["id"])

    # move o último para o topo
    await client.patch(
        f"/opportunities/{ids[2]}/move",
        json={"stage_id": stage_id, "position": 0},
        headers=auth_headers,
    )
    resp = await client.get(
        "/opportunities", params={"stage_id": stage_id}, headers=auth_headers
    )
    ordered = [o["id"] for o in resp.json()]
    assert ordered[0] == ids[2]
