"""Seed de desenvolvimento: admin, estágios do pipeline e dados de demonstração
do domínio GrupoSB — locação de impressoras (A4/A3, mono/color) e outsourcing de TI.

Uso (a partir de backend/): python scripts/seed.py
Idempotente: não faz nada se já houver usuários.
"""

import random
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, select  # noqa: E402

from app.core.aio import run  # noqa: E402

from app.core.database import engine, session_factory  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import (  # noqa: E402
    Account,
    AccountSize,
    AccountStatus,
    Activity,
    ActivityType,
    Base,
    BillingType,
    Contact,
    Lead,
    LeadInterest,
    LeadStatus,
    Machine,
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

# Funil real GrupoSB: contato → especificação → proposta → contrato → início
STAGES = [
    ("Novo contato", 10, "#a1a1aa", False, False),
    ("Especificação", 30, "#fde047", False, False),
    ("Proposta enviada", 55, "#facc15", False, False),
    ("Contrato", 80, "#f59e0b", False, False),
    ("Contrato iniciado", 100, "#34d399", True, False),
    ("Perdido", 0, "#f87171", False, True),
]

# nome, domínio, setor, porte, status, cnpj, cidade, UF
ACCOUNTS = [
    ("Escritório Valente & Rocha Advogados", "valenterocha.adv.br", "Jurídico", AccountSize.M, AccountStatus.PROSPECT, "12.345.678/0001-90", "Campinas", "SP"),
    ("Colégio Horizonte Azul", "horizonteazul.edu.br", "Educação", AccountSize.L, AccountStatus.ACTIVE, "23.456.789/0001-01", "São Paulo", "SP"),
    ("Clínica Vida Plena", "vidaplena.med.br", "Saúde", AccountSize.M, AccountStatus.PROSPECT, "34.567.890/0001-12", "Jundiaí", "SP"),
    ("Gráfica PrintMax", "printmax.com.br", "Gráfica", AccountSize.S, AccountStatus.INACTIVE, "45.678.901/0001-23", "Sorocaba", "SP"),
]

# conta (índice), nome da máquina, número de série, observações
MACHINES = [
    (1, "Multifuncional A3 Color — Recepção", "GSB-A3C-88213", "Instalada em 09/07/2026"),
    (1, "Impressora A4 Mono — Secretaria", "GSB-A4M-11402", ""),
    (1, "Impressora A4 Mono — Coordenação", "GSB-A4M-11407", ""),
]

CONTACTS = [
    ("Mariana", "Costa", "mariana.costa@valenterocha.adv.br", "(19) 98765-4321", 0),
    ("Ricardo", "Almeida", "ricardo@horizonteazul.edu.br", "(11) 99876-1122", 1),
    ("Fernanda", "Souza", "fernanda@vidaplena.med.br", "(11) 97654-8899", 2),
    ("Paulo", "Mendes", "paulo.mendes@valenterocha.adv.br", "(19) 91234-5678", 0),
    ("Juliana", "Ribeiro", "juliana.ribeiro@gmail.com", "(21) 99887-7665", None),
]

# nome, email, empresa, cnpj, cidade, UF, origem, status, interesse, fornecedor atual,
# tipo de máquina, nº impressoras, franquia mono, franquia color,
# produto TI, qtd TI, especificações TI
LEADS = [
    ("Carlos Ferreira", "carlos@contabilferreira.com.br", "Contábil Ferreira",
     "56.789.012/0001-34", "Campinas", "SP", "site",
     LeadStatus.NEW, LeadInterest.PRINTER_RENTAL, "Simpress",
     "a4_mono", 6, 9000, 800, "", 0, ""),
    ("Ana Beatriz Lima", "ana.lima@constronorte.com.br", "Constrói Norte",
     "67.890.123/0001-45", "São Paulo", "SP", "indicação",
     LeadStatus.QUALIFIED, LeadInterest.BOTH, "Selbetti",
     "mixed", 14, 22000, 3500, "Notebooks Dell Latitude", 10, "i5, 16 GB RAM, SSD 512 GB"),
    ("Roberto Tanaka", "roberto@fastlog.com.br", "FastLog Transportes",
     "78.901.234/0001-56", "Barueri", "SP", "linkedin",
     LeadStatus.QUALIFIED, LeadInterest.IT_OUTSOURCING, "TI interna",
     "", 0, 0, 0, "Desktops + monitores", 25, "i3, 8 GB RAM, monitor 24\""),
    ("Patrícia Gomes", "patricia@bellamoda.com.br", "Bella Moda",
     "89.012.345/0001-67", "Campinas", "SP", "evento",
     LeadStatus.NEW, LeadInterest.PRINTER_RENTAL, "",
     "a4_color", 3, 2500, 1200, "", 0, ""),
    ("Eduardo Santos", "eduardo@agrovale.agr.br", "AgroVale",
     "90.123.456/0001-78", "Ribeirão Preto", "SP", "site",
     LeadStatus.LOST, LeadInterest.PRINTER_RENTAL, "Copimaq",
     "a3_mono", 8, 12000, 400, "", 0, ""),
    ("Luiza Martins", "luiza@imobiliariacentral.com.br", "Imobiliária Central",
     "01.234.567/0001-89", "Valinhos", "SP", "instagram",
     LeadStatus.NEW, LeadInterest.BOTH, "",
     "a4_color", 5, 6000, 2000, "Firewall + Wi-Fi corporativo", 1, "Cobertura p/ 2 andares"),
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
                status=account_status, cnpj=cnpj, city=city, state=state,
            )
            for name, domain, industry, size, account_status, cnpj, city, state in ACCOUNTS
        ]
        db.add_all(accounts)
        await db.flush()

        db.add_all(
            Machine(
                account_id=accounts[account_index].id,
                name=machine_name,
                serial_number=serial,
                notes=machine_notes,
            )
            for account_index, machine_name, serial, machine_notes in MACHINES
        )

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
        for (name, email, company, cnpj, city, state, source, lead_status, interest,
             provider, printer_type, printers, vol_mono, vol_color,
             it_product, it_quantity, it_specs) in LEADS:
            leads.append(
                Lead(
                    name=name,
                    email=email,
                    company=company,
                    cnpj=cnpj,
                    city=city,
                    state=state,
                    source=source,
                    status=lead_status,
                    interest=interest,
                    current_provider=provider,
                    printer_type=printer_type,
                    printer_count=printers,
                    monthly_volume_mono=vol_mono,
                    monthly_volume_color=vol_color,
                    it_product=it_product,
                    it_quantity=it_quantity,
                    it_specs=it_specs,
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
                            "body": "Origem: {source}. Interesse: {interest}. Empresa: {company}.",
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
    run(main())
