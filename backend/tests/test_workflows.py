from httpx import AsyncClient


async def test_workflow_executes_on_lead_created(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/workflows",
        json={
            "name": "Follow-up automático",
            "trigger_event": "lead.created",
            "conditions": [{"field": "source", "op": "eq", "value": "site"}],
            "actions": [
                {
                    "type": "create_activity",
                    "params": {
                        "activity_type": "task",
                        "title": "Follow-up do lead {name}",
                        "due_in_days": 2,
                    },
                },
                {"type": "notify", "params": {"title": "Novo lead: {name}", "body": "{source}"}},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    rule = resp.json()

    # lead que NÃO casa com a condição (source diferente)
    await client.post(
        "/leads", json={"name": "Fora da Regra", "source": "evento"}, headers=auth_headers
    )
    # lead que casa
    resp = await client.post(
        "/leads", json={"name": "Bruno Dias", "source": "site"}, headers=auth_headers
    )
    lead = resp.json()

    # atividade criada com template renderizado e vinculada ao lead
    resp = await client.get(
        "/activities",
        params={"entity_type": "lead", "entity_id": lead["id"]},
        headers=auth_headers,
    )
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "Follow-up do lead Bruno Dias"
    assert items[0]["due_at"] is not None
    assert items[0]["entity_label"] == "Bruno Dias"

    # notificação broadcast criada
    resp = await client.get("/notifications", headers=auth_headers)
    titles = [n["title"] for n in resp.json()]
    assert "Novo lead: Bruno Dias" in titles

    # execução registrada apenas para o lead que casou
    resp = await client.get(f"/workflows/{rule['id']}/executions", headers=auth_headers)
    executions = resp.json()
    assert len(executions) == 1
    assert executions[0]["status"] == "success"


async def test_inactive_rule_does_not_run(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/workflows",
        json={
            "name": "Desativada",
            "trigger_event": "lead.created",
            "actions": [{"type": "notify", "params": {"title": "não deveria"}}],
            "is_active": False,
        },
        headers=auth_headers,
    )
    rule = resp.json()
    await client.post("/leads", json={"name": "Qualquer"}, headers=auth_headers)
    resp = await client.get(f"/workflows/{rule['id']}/executions", headers=auth_headers)
    assert resp.json() == []


async def test_invalid_trigger_rejected(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/workflows",
        json={"name": "X", "trigger_event": "evento.inexistente", "actions": []},
        headers=auth_headers,
    )
    assert resp.status_code == 422
