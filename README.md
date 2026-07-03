# GrupoSB CRM

CRM próprio do Grupo SB para **locação de impressoras (A4/A3, mono/color) e outsourcing de TI**, implementado a partir do documento *"CRM Próprio — Documento de Decisão Técnica"* (jun/2026).

**Stack:** FastAPI + SQLAlchemy async (Python) · React 19 + TypeScript + Vite + Tailwind 4 (frontend) · PostgreSQL 16 · Redis + Celery (workflows) · Docker Compose.

**Repositório:** https://github.com/GSBdevs/gsb-crm

## Instalação — o que ter na máquina

| Ferramenta | Versão mínima | Para quê |
|---|---|---|
| Python | 3.12+ (testado no 3.14) | backend |
| Node.js + npm | 20+ (testado no 24) | frontend |
| Git | recente | versionamento |
| Docker Desktop | atual | Postgres + Redis (containers `db` e `redis`) |
| VS Code | — | extensões recomendadas em `.vscode/extensions.json` |

> A máquina de dev tem PostgreSQL nativo na porta 5432; por isso o Postgres do compose é exposto em **5433**.

## Uso — dev local (modo atual: Postgres + Redis + fila Celery)

```powershell
# 1. Infra (uma vez por sessão)
docker compose up -d db redis

# 2. Backend — primeira vez
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
copy .env.example .env   # ajuste DATABASE_URL p/ localhost:5433 e WORKFLOWS_INLINE=false
python -m alembic upgrade head
python scripts/seed.py   # admin@gruposb.com / admin123 + dados demo do setor

# 3. API (Windows: use run.py — garante o event loop compatível com psycopg)
python run.py            # http://localhost:8000 (docs: /api/v1/docs)

# 4. Worker Celery (outro terminal; --pool=solo é necessário no Windows)
.venv\Scripts\python -m celery -A app.workers.celery_app.celery worker --loglevel=INFO --pool=solo

# 5. Frontend (outro terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

**Modo mínimo sem Docker:** apague `backend/.env` — o backend cai para SQLite local com workflows inline (sem Redis/worker). Nesse modo `uvicorn app.main:app --reload` funciona normalmente.

**Tudo em containers:** `docker compose up --build` (api + worker + frontend + db + redis) e `docker compose exec api python scripts/seed.py`.

## Testes

```powershell
cd backend
.venv\Scripts\python -m pytest        # 13 testes: auth (rotação/revogação), leads+conversão,
                                      # kanban, workflows, notificações por usuário, relatórios
cd ..\frontend
npm run build                         # type-check (tsc -b) + build Vite
```

Teste manual da fila: com API + worker rodando, crie um lead na UI — o workflow "Novo lead → tarefa de follow-up" deve gerar atividade e notificação via Redis/Celery (veja o log do worker). Leads com `printer_count >= 10` também disparam "Lead prioritário".

## Domínio: locação de impressoras & outsourcing de TI

Campos de qualificação baseados em como o setor (MPS/outsourcing de impressão) prospecta:

- **Lead**: interesse (`printer_rental` | `it_outsourcing` | `both`), fornecedor atual, **data de renovação do contrato concorrente** (principal gatilho de timing), nº de impressoras, volume mensal P&B/color, CNPJ.
- **Opportunity**: tipo de serviço, cobrança (`monthly` = recorrente/MRR ou `one_time`), prazo em meses; `value` é o **valor mensal** quando recorrente e `total_value` = mensal × prazo.
- **Account**: CNPJ, cidade, UF.
- **Dashboard**: KPIs de MRR em pipeline e renovações concorrentes nos próximos 90 dias.
- **Workflows**: condições podem usar os campos acima (ex.: `printer_count >= 10` → notificar).

## Estrutura

```
gruposb-crm/
  backend/
    app/
      api/        # routers FastAPI (um por módulo)
      core/       # config, banco, segurança (JWT/Argon2), aio (loop Windows), paginação
      models/     # SQLAlchemy — UUID PK + auditoria em tudo
      schemas/    # Pydantic request/response
      services/   # conversão de lead, motor de workflows, relatórios
      workers/    # Celery (fila Redis)
    alembic/      # migrações (3 revisões)
    scripts/seed.py
    run.py        # entrypoint dev p/ Windows + Postgres
    tests/
  frontend/
    src/
      components/ui/       # componentes estilo shadcn (tema escuro preto/cinza/amarelo)
      components/layout/   # shell, sidebar (com drawer mobile), notificações
      pages/               # dashboard, leads, pipeline, contatos, contas, atividades, workflows
      lib/api.ts           # fetch client com refresh automático
  docker-compose.yml       # db(5433) + redis + api + worker + frontend
```

## Como adicionar um novo módulo (receita)

1. `backend/app/models/<modulo>.py` herdado de `TableBase`; exporte em `models/__init__.py`.
2. `backend/app/schemas/<modulo>.py` — `XCreate`, `XUpdate`, `XOut`.
3. `backend/app/api/<modulo>.py` no padrão de `accounts.py`; registre em `api/router.py`.
4. `python -m alembic revision --autogenerate -m "add <modulo>"` → revise `server_default` p/ colunas NOT NULL → `upgrade head`.
5. Teste em `backend/tests/`.
6. Frontend: tipo em `src/types.ts`, página em `src/pages/`, rota em `App.tsx`, item no `NAV` do `app-shell.tsx`.
7. Automação? Adicione o evento em `TRIGGERS` (`services/workflow_engine.py`) e chame `events.dispatch(...)` — o builder da UI o oferece automaticamente.

## Decisões técnicas (divergências do documento original)

| Documento | Implementado | Motivo |
|---|---|---|
| python-jose | PyJWT | python-jose semi-abandonado, CVEs em 2024 |
| — | pwdlib + Argon2id | recomendação OWASP atual |
| React 18 | React 19 + Tailwind 4 + Vite 6 | versões estáveis atuais |
| asyncpg (implícito) | psycopg3 | sync+async num pacote; wheels p/ Python 3.14 |
| Poetry/pip-tools | pyproject PEP 621 | funciona com pip e uv |
| Contact↔Account M:N | FK `account_id` | segue o ERD; M:N pode vir depois |

Notas do Windows: psycopg async exige SelectorEventLoop (ver `app/core/aio.py` e `run.py`); Celery precisa de `--pool=solo`.

## Pendências conhecidas

- Hot-reload do uvicorn no Windows apenas no modo SQLite (o reloader perde o loop Selector).
- Ação `send_email` usa SMTP simples (configure `SMTP_*` no `.env`); sem fila de retry própria.
- Sem multi-tenancy/escopo por usuário nos dados (adequado ao time atual).
