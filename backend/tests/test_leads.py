from httpx import AsyncClient

from tests.conftest import create_default_stages


async def test_lead_crud(client: AsyncClient, auth_headers):
    resp = await client.post(
        "/leads",
        json={"name": "Carlos Silva", "email": "carlos@empresa.com", "source": "site"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    lead = resp.json()
    assert lead["status"] == "new"

    resp = await client.get("/leads", params={"q": "carlos"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 1

    resp = await client.patch(
        f"/leads/{lead['id']}", json={"status": "qualified", "score": 80}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "qualified"

    resp = await client.delete(f"/leads/{lead['id']}", headers=auth_headers)
    assert resp.status_code == 204


async def test_lead_conversion_creates_contact_account_opportunity(
    client: AsyncClient, auth_headers
):
    stages = await create_default_stages(client, auth_headers)

    resp = await client.post(
        "/leads",
        json={
            "name": "Ana Beatriz Lima",
            "email": "ana@constroinorte.com.br",
            "company": "Constrói Norte",
            "source": "indicação",
            "score": 70,
        },
        headers=auth_headers,
    )
    lead = resp.json()

    resp = await client.post(
        f"/leads/{lead['id']}/convert",
        json={"create_opportunity": True, "value": 50000},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["lead"]["status"] == "converted"
    assert data["lead"]["converted_at"] is not None
    assert data["contact"]["first_name"] == "Ana"
    assert data["contact"]["last_name"] == "Beatriz Lima"
    assert data["contact"]["email"] == "ana@constroinorte.com.br"
    assert data["opportunity"]["value"] == 50000
    # entra no primeiro estágio aberto do pipeline
    assert data["opportunity"]["stage_id"] == stages[0]["id"]
    # interesse do lead (default printer_rental) define a linha de serviço da oportunidade
    assert data["opportunity"]["service_type"] == "printer_rental"
    assert data["opportunity"]["billing_type"] == "monthly"
    assert data["opportunity"]["contract_months"] == 12
    assert data["opportunity"]["total_value"] == 50000 * 12

    # conta criada a partir da empresa do lead
    resp = await client.get("/accounts", params={"q": "Constrói"}, headers=auth_headers)
    assert resp.json()["total"] == 1

    # converter de novo -> 409
    resp = await client.post(
        f"/leads/{lead['id']}/convert", json={}, headers=auth_headers
    )
    assert resp.status_code == 409


async def test_conversion_without_stages_fails_cleanly(client: AsyncClient, auth_headers):
    resp = await client.post("/leads", json={"name": "Sem Pipeline"}, headers=auth_headers)
    lead = resp.json()
    resp = await client.post(
        f"/leads/{lead['id']}/convert", json={"create_opportunity": True}, headers=auth_headers
    )
    assert resp.status_code == 409
    assert "estágio" in resp.json()["detail"].lower()
