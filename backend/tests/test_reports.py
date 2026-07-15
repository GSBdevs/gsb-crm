from httpx import AsyncClient

from tests.conftest import create_default_stages


async def test_reports_reflect_data(client: AsyncClient, auth_headers):
    stages = await create_default_stages(client, auth_headers)

    await client.post(
        "/leads", json={"name": "Lead Aberto", "source": "site"}, headers=auth_headers
    )
    resp = await client.post(
        "/leads", json={"name": "Lead Convertido", "company": "ACME"}, headers=auth_headers
    )
    await client.post(
        f"/leads/{resp.json()['id']}/convert",
        json={"create_opportunity": True, "value": 10000},
        headers=auth_headers,
    )

    resp = await client.get("/reports/summary", headers=auth_headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["open_leads"] == 1
    assert summary["open_opportunities"] == 1
    assert summary["open_value"] == 10000.0
    assert summary["mrr_open"] == 10000.0  # billing default é mensal
    assert summary["active_accounts"] == 0  # conta criada na conversão nasce prospect
    assert summary["machines_total"] == 0
    assert summary["contacts_total"] == 1

    resp = await client.get("/reports/pipeline-by-stage", headers=auth_headers)
    by_stage = {row["stage"]: row for row in resp.json()}
    assert by_stage[stages[0]["name"]]["count"] == 1
    assert by_stage[stages[0]["name"]]["value"] == 10000.0

    resp = await client.get("/reports/leads-timeline", headers=auth_headers)
    points = resp.json()
    assert sum(p["created"] for p in points) == 2
    assert sum(p["converted"] for p in points) == 1

    resp = await client.get("/reports/forecast", headers=auth_headers)
    assert resp.status_code == 200
