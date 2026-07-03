"""Seed de desenvolvimento: admin, estágios do pipeline e dados de demonstração.

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
    Contact,
    Lead,
    LeadStatus,
    Notification,
    Opportunity,
    PipelineStage,
    User,
    UserRole,
    WorkflowRule,
    utcnow,
)

ADMIN_EMAIL = "admin@gruposb.com"
ADMIN_PASSWORD = "admin123"

STAGES = [
    ("Prospecção", 10, "#818cf8", False, False),
    ("Qualificação", 25, "#38bdf8", False, False),
    ("Proposta", 50, "#fbbf24", False, False),
    ("Negociação", 75, "#fb923c", False, False),
    ("Fechado — Ganhou", 100, "#34d399", True, False),
    ("Fechado — Perdeu", 0, "#f87171", False, True),
]

ACCOUNTS = [
    ("Metalúrgica Aurora", "aurora.ind.br", "Indústria", AccountSize.M),
    ("Supermercados Vale Verde", "valeverde.com.br", "Varejo", AccountSize.L),
    ("TechNova Sistemas", "technova.com.br", "Tecnologia", AccountSize.S),
]

CONTACTS = [
    ("Mariana", "Costa", "mariana.costa@aurora.ind.br", "(11) 98765-4321", 0),
    ("Ricardo", "Almeida", "ricardo@valeverde.com.br", "(19) 99876-1122", 1),
    ("Fernanda", "Souza", "fernanda@technova.com.br", "(11) 97654-8899", 2),
    ("Paulo", "Mendes", "paulo.mendes@aurora.ind.br", "(11) 91234-5678", 0),
    ("Juliana", "Ribeiro", "juliana.ribeiro@gmail.com", "(21) 99887-7665", None),
]

LEADS = [
    ("Carlos Ferreira", "carlos@distribuidorasol.com.br", "Distribuidora Sol", "site", LeadStatus.NEW, 35),
    ("Ana Beatriz Lima", "ana.lima@constronorte.com.br", "Constrói Norte", "indicação", LeadStatus.QUALIFIED, 72),
    ("Roberto Tanaka", "roberto@fastlog.com.br", "FastLog Transportes", "linkedin", LeadStatus.QUALIFIED, 64),
    ("Patrícia Gomes", "patricia@bellamoda.com.br", "Bella Moda", "evento", LeadStatus.NEW, 28),
    ("Eduardo Santos", "eduardo@agrovale.agr.br", "AgroVale", "site", LeadStatus.LOST, 15),
    ("Luiza Martins", "luiza@cafedaserra.com.br", "Café da Serra", "instagram", LeadStatus.NEW, 45),
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
            Account(name=name, domain=domain, industry=industry, size=size)
            for name, domain, industry, size in ACCOUNTS
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
                    tags=random.sample(["vip", "newsletter", "evento-2026", "decisor"], k=2),
                    account_id=accounts[account_index].id if account_index is not None else None,
                )
            )
        db.add_all(contacts)

        now = utcnow()
        leads = []
        for i, (name, email, company, source, lead_status, score) in enumerate(LEADS):
            lead = Lead(
                name=name,
                email=email,
                company=company,
                source=source,
                status=lead_status,
                score=score,
                created_at=now - timedelta(days=random.randint(3, 150)),
            )
            leads.append(lead)
        db.add_all(leads)
        await db.flush()

        open_stages = stages[:4]
        opportunities = [
            Opportunity(
                title="Contrato anual de manutenção — Aurora",
                value=48000,
                probability=open_stages[2].probability,
                stage_id=open_stages[2].id,
                contact_id=contacts[0].id,
                account_id=accounts[0].id,
                expected_close=(now + timedelta(days=25)).date(),
                position=0,
            ),
            Opportunity(
                title="Expansão de lojas — Vale Verde",
                value=125000,
                probability=open_stages[3].probability,
                stage_id=open_stages[3].id,
                contact_id=contacts[1].id,
                account_id=accounts[1].id,
                expected_close=(now + timedelta(days=45)).date(),
                position=0,
            ),
            Opportunity(
                title="Licenciamento de software — TechNova",
                value=36000,
                probability=open_stages[1].probability,
                stage_id=open_stages[1].id,
                contact_id=contacts[2].id,
                account_id=accounts[2].id,
                expected_close=(now + timedelta(days=70)).date(),
                position=0,
            ),
            Opportunity(
                title="Projeto piloto — Aurora unidade 2",
                value=18500,
                probability=open_stages[0].probability,
                stage_id=open_stages[0].id,
                contact_id=contacts[3].id,
                account_id=accounts[0].id,
                expected_close=(now + timedelta(days=90)).date(),
                position=1,
            ),
            Opportunity(
                title="Renovação de contrato — Vale Verde",
                value=62000,
                probability=100,
                stage_id=stages[4].id,
                contact_id=contacts[1].id,
                account_id=accounts[1].id,
                closed_at=now - timedelta(days=6),
                position=0,
            ),
        ]
        db.add_all(opportunities)
        await db.flush()

        activities = [
            Activity(
                type=ActivityType.CALL,
                title="Ligar para Mariana — follow-up da proposta",
                entity_type="contact",
                entity_id=contacts[0].id,
                due_at=now + timedelta(hours=4),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.MEETING,
                title="Reunião de negociação — Vale Verde",
                entity_type="opportunity",
                entity_id=opportunities[1].id,
                due_at=now + timedelta(days=2),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.EMAIL,
                title="Enviar apresentação institucional",
                entity_type="lead",
                entity_id=leads[1].id,
                due_at=now - timedelta(days=1),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.TASK,
                title="Preparar proposta comercial TechNova",
                entity_type="opportunity",
                entity_id=opportunities[2].id,
                due_at=now + timedelta(days=5),
                user_id=admin.id,
            ),
            Activity(
                type=ActivityType.CALL,
                title="Qualificar lead FastLog",
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
                            "body": "Origem: {source}. Score inicial: {score}.",
                        },
                    },
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
                            "body": "Valor: R$ {value}. Parabéns à equipe!",
                        },
                    }
                ],
            )
        )

        db.add(
            Notification(
                title="Bem-vindo ao GrupoSB CRM",
                body="Base de demonstração criada. Explore o pipeline e os workflows.",
            )
        )

        await db.commit()
        print("Seed concluído.")
        print(f"  Login: {ADMIN_EMAIL}")
        print(f"  Senha: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
