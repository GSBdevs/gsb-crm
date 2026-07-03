"""Seed de desenvolvimento: admin, estágios do pipeline e dados de demonstração
do domínio GrupoSB — locação de impressoras (A4/A3, mono/color) e outsourcing de TI.

Uso (a partir de backend/): python scripts/seed.py
Idempotente: não faz nada se já houver usuários.
"""

import asyncio
import random
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.core.database import engine, session_factory  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    Account,
    AccountSize,
    Activity,
    ActivityType,
    Base,
    BillingType,
    Contact,
    Lead,
    LeadInterest,
    LeadStatus,
    Notification,
    Opportunity,
    PipelineStage,
    ServiceType,
    User,
    UserRole,
    WorkflowRule,
    utcnow,
)

ADMIN_EMAIL = "admin@gruposb.com"
ADMIN_PASSWORD = "admin123"

STAGES = [
    ("Prospecção", 10, "#a1a1aa", False, False),
    ("Qualificação", 25, "#fde047", False, False),
    ("Proposta", 50, "#facc15", False, False),
    ("Negociação", 75, "#f59e0b", False, False),
    ("Fechado — Ganhou", 100, "#34d399", True, False),
    ("Fechado — Perdeu", 0, "#f87171", False, True),
]

# nome, domínio, setor, porte, cnpj, cidade, UF
ACCOUNTS = [
    ("Escritório Valente & Rocha Advogados", "valenterocha.adv.br", "Jurídico", AccountSize.M, "12.345.678/0001-90", "Campinas", "SP"),
    ("Colégio Horizonte Azul", "horizonteazul.edu.br", "Educação", AccountSize.L, "23.456.789/0001-01", "São Paulo", "SP"),
    ("Clínica Vida Plena", "vidaplena.med.br", "Saúde", AccountSize.M, "34.567.890/0001-12", "Jundiaí", "SP"),
]

CONTACTS = [
    ("Mariana", "Costa", "mariana.costa@valenterocha.adv.br", "(19) 98765-4321", 0),
    ("Ricardo", "Almeida", "ricardo@horizonteazul.edu.br", "(11) 99876-1122", 1),
    ("Fernanda", "Souza", "fernanda@vidaplena.med.br", "(11) 97654-8899", 2),
    ("Paulo", "Mendes", "paulo.mendes@valenterocha.adv.br", "(19) 91234-5678", 0),
    ("Juliana", "Ribeiro", "juliana.ribeiro@gmail.com", "(21) 99887-7665", None),
]

# nome, email, empresa, origem, status, score, interesse, fornecedor atual,
# renovação (dias a partir de hoje; None = desconhecida), nº impressoras, vol. mono, vol. color
LEADS = [
    ("Carlos Ferreira", "carlos@contabilferreira.com.br", "Contábil Ferreira", "site",
     LeadStatus.NEW, 35, LeadInterest.PRINTER_RENTAL, "Simpress", 75, 6, 9000, 800),
    ("Ana Beatriz Lima", "ana.lima@constronorte.com.br", "Constrói Norte", "indicação",
     LeadStatus.QUALIFIED, 78, LeadInterest.BOTH, "Selbetti", 40, 14, 22000, 3500),
    ("Roberto Tanaka", "roberto@fastlog.com.br", "FastLog Transportes", "linkedin",
     LeadStatus.QUALIFIED, 64, LeadInterest.IT_OUTSOURCING, "TI interna", None, 0, 0, 0),
    ("Patrícia Gomes", "patricia@bellamoda.com.br", "Bella Moda", "evento",
     LeadStatus.NEW, 28, LeadInterest.PRINTER_RENTAL, "", 160, 3, 2500, 1200),
    ("Eduardo Santos", "eduardo@agrovale.agr.br", "AgroVale", "site",
     LeadStatus.LOST, 15, LeadInterest.PRINTER_RENTAL, "Copimaq", None, 8, 12000, 400),
    ("Luiza Martins", "luiza@imobiliariacentral.com.br", "Imobiliária Central", "instagram",
     LeadStatus.NEW, 45, LeadInterest.BOTH, "", 85, 5, 6000, 2000),
]


async def main() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        if await db.scalar(select(func.count()).select_from(User)):
            print("Base já possui usuários — seed ignorado.")
            return

        admin = User(
            email=ADMIN_EMAIL,
            full_name="Administrador GSB",
            hashed_password=hash_password(ADMIN_PASSWORD),
            role=UserRole.ADMIN,
        )
        db.add(admin)

        stages = [
            PipelineStage(
                name=name, position=i, probability=prob, color=color, is_won=won, is_lost=lost
            )
            for i, (name, prob, color, won, lost) in enumerate(STAGES)
        ]
        db.add_all(stages)

        accounts = [
            Account(
                name=name, domain=domain, industry=industry, size=size,
                cnpj=cnpj, city=city, state=state,
            )
            for name, domain, industry, size, cnpj, city, state in ACCOUNTS
        ]
        db.add_all(accounts)
        await db.flush()

        contacts = []
        for first, last, email, phone, account_index in CONTACTS:
            contacts.append(
                Contact(
                    first_name=first,
                    last_name=last,
                    email=email,
                    phone=phone,
                    score=random.randint(20, 90),
                    tags=random.sample(["decisor", "financeiro", "ti", "compras"], k=2),
                    account_id=accounts[account_index].id if account_index is not None else None,
                )
            )
        db.add_all(contacts)

        now = utcnow()
        leads = []
        for (name, email, company, source, lead_status, score, interest, provider,
             renewal_days, printers, vol_mono, vol_color) in LEADS:
            leads.append(
                Lead(
                    name=name,
                    email=email,
                    company=company,
                    source=source,
                    status=lead_status,
                    score=score,
                    interest=interest,
                    current_provider=provider,
                    contract_renewal=(
                        (now + timedelta(days=renewal_days)).date() if renewal_days else None
                    ),
                    printer_count=printers,
                    monthly_volume_mono=vol_mono,
                    monthly_volume_color=vol_color,
                    created_at=now - timedelta(days=random.randint(3, 150)),
                )
            )
        db.add_all(leads)
        await db.flush()

        open_stages = stages[:4]
        opportunities = [
            Opportunity(
                title="Locação 8× A4 mono + 2× A3 color — Valente & Rocha",
                value=2400,  # mensal
                probability=open_stages[2].probability,
                stage_id=open_stages[2].id,
                contact_id=contacts[0].id,
                account_id=accounts[0].id,
                expected_close=(now + timedelta(days=25)).date(),
                service_type=ServiceType.PRINTER_RENTAL,
                billing_type=BillingType.MONTHLY,
                contract_months=36,
                position=0,
            ),
            Opportunity(
                title="Outsourcing de impressão + helpdesk — Colégio Horizonte Azul",
                value=8900,
                probability=open_stages[3].probability,
                stage_id=open_stages[3].id,
                contact_id=contacts[1].id,
                account_id=accounts[1].id,
                expected_close=(now + timedelta(days=45)).date(),
                service_type=ServiceType.MIXED,
                billing_type=BillingType.MONTHLY,
                contract_months=48,
                position=0,
            ),
            Opportunity(
                title="Outsourcing de TI — Clínica Vida Plena",
                value=5200,
                probability=open_stages[1].probability,
                stage_id=open_stages[1].id,
                contact_id=contacts[2].id,
                account_id=accounts[2].id,
                expected_close=(now + timedelta(days=70)).date(),
                service_type=ServiceType.IT_OUTSOURCING,
                billing_type=BillingType.MONTHLY,
                contract_months=24,
                position=0,
            ),
            Opportunity(
                title="Piloto 3× A4 mono — Valente & Rocha filial",
                value=780,
                probability=open_stages[0].probability,
                stage_id=open_stages[0].id,
                contact_id=contacts[3].id,
                account_id=accounts[0].id,
                expected_close=(now + timedelta(days=90)).date(),
                service_type=ServiceType.PRINTER_RENTAL,
                billing_type=BillingType.MONTHLY,
                contract_months=12,
                position=1,
            ),
            Opportunity(
                title="Venda de scanners de mesa — Horizonte Azul",
                value=14500,
                probability=100,
                stage_id=stages[4].id,
                contact_id=contacts[1].id,
                account_id=accounts[1].id,
                closed_at=now - timedelta(days=6),
                service_type=ServiceType.PRINTER_RENTAL,
                billing_type=BillingType.ONE_TIME,
                contract_months=1,
                position=0,
            ),
        ]
        db.add_all(opportunities)
        await db.flush()

        activities = [
            Activity(
                type=ActivityType.CALL,
                title="Ligar para Mariana — follow-up da proposta de locação",
                entity_type="contact",
                entity_id=contacts[0].id,
                due_at=now + timedelta(hours=4),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.MEETING,
                title="Reunião de negociação — Colégio Horizonte Azul",
                entity_type="opportunity",
                entity_id=opportunities[1].id,
                due_at=now + timedelta(days=2),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.EMAIL,
                title="Enviar comparativo de custo por página",
                entity_type="lead",
                entity_id=leads[1].id,
                due_at=now - timedelta(days=1),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.TASK,
                title="Dimensionar proposta de outsourcing — Vida Plena",
                entity_type="opportunity",
                entity_id=opportunities[2].id,
                due_at=now + timedelta(days=5),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.CALL,
                title="Qualificar lead FastLog (outsourcing de TI)",
                entity_type="lead",
                entity_id=leads[2].id,
                done_at=now - timedelta(days=2),
                user_id=admin.id,
            ),
        ]
        db.add_all(activities)

        db.add(
            WorkflowRule(
                name="Novo lead → tarefa de follow-up",
                trigger_event="lead.created",
                conditions=[],
                actions=[
                    {
                        "type": "create_activity",
                        "params": {
                            "activity_type": "task",
                            "title": "Follow-up do lead {name}",
                            "due_in_days": 2,
                        },
                    },
                    {
                        "type": "notify",
                        "params": {
                            "title": "Novo lead: {name}",
                            "body": "Origem: {source}. Interesse: {interest}. Score: {score}.",
                        },
                    },
                ],
            )
        )
        db.add(
            WorkflowRule(
                name="Lead com parque grande → priorizar",
                trigger_event="lead.created",
                conditions=[{"field": "printer_count", "op": "gte", "value": 10}],
                actions=[
                    {
                        "type": "notify",
                        "params": {
                            "title": "Lead prioritário: {name}",
                            "body": "{printer_count} impressoras, volume {monthly_volume_mono} pb + {monthly_volume_color} color/mês. Fornecedor atual: {current_provider}.",
                        },
                    }
                ],
            )
        )
        db.add(
            WorkflowRule(
                name="Oportunidade ganha → avisar equipe",
                trigger_event="opportunity.won",
                conditions=[],
                actions=[
                    {
                        "type": "notify",
                        "params": {
                            "title": "Negócio fechado: {title}",
                            "body": "Contrato de R$ {total_value} ({contract_months} meses). Parabéns à equipe!",
                        },
                    }
                ],
            )
        )

        db.add(
            Notification(
                title="Bem-vindo ao GrupoSB CRM",
                body="Base demo de locação de impressoras e outsourcing de TI criada.",
            )
        )

        await db.commit()
        print("Seed concluído.")
        print(f"  Login: {ADMIN_EMAIL}")
        print(f"  Senha: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
