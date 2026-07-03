# GrupoSB CRM

CRM próprio do Grupo SB, implementado a partir do documento *"CRM Próprio — Documento de Decisão Técnica"* (jun/2026).

**Stack:** FastAPI + SQLAlchemy async (Python) · React 19 + TypeScript + Vite + Tailwind 4 (frontend) · PostgreSQL 16 · Redis + Celery (workflows) · Docker Compose.

## O que ter instalado

| Ferramenta | Versão mínima | Para quê | Status |
|---|---|---|---|
| Python | 3.12+ (testado no 3.14) | backend | obrigatório |
| Node.js + npm | 20+ (testado no 24) | frontend | obrigatório |
| Git | qualquer recente | versionamento | obrigatório |
| Docker Desktop | atual | Postgres + Redis + worker Celery | **recomendado** — sem ele o dev roda em SQLite com workflows inline |
| VS Code | — | extensões recomendadas em `.vscode/extensions.json` (Python, Ruff, ESLint, Prettier, Tailwind, Docker) | opcional |

## Rodando em dev — sem Docker (modo atual)

Sem `.env`, o backend usa **SQLite local** (`backend/crm_dev.db`) e executa workflows **no próprio processo** (`WORKFLOWS_INLINE=true`). Zero infraestrutura.

```powershell
# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
python scripts/seed.py        # cria admin@gruposb.com / admin123 + dados demo
uvicorn app.main:app --reload # http://localhost:8000 (docs: /api/v1/docs)

# Frontend (outro terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxy /api -> 8000)
```

## Rodando com Docker (Postgres + Redis + Celery)

```powershell
docker compose up --build
# api:      http://localhost:8000
# frontend: http://localhost:5173
# Seed no Postgres:
docker compose exec api python scripts/seed.py
```

O compose usa Postgres 16, Redis 7, aplica migrações Alembic no boot da API e sobe o worker Celery (`WORKFLOWS_INLINE=false` → ações de workflow vão para a fila).

## Testes

```powershell
cd backend
.venv\Scripts\python -m pytest    # 12 testes: auth, leads+conversão, kanban, workflows, relatórios
```

## Estrutura

```
gruposb-crm/
  backend/
    app/
      api/        # routers FastAPI (um arquivo por módulo)
      core/       # config, banco, segurança (JWT/Argon2), paginação
      models/     # SQLAlchemy (UUID PK + created_at/updated_at em tudo)
      schemas/    # Pydantic request/response
      services/   # regra de negócio: conversão de lead, motor de workflows, relatórios
      workers/    # Celery (fila Redis)
    alembic/      # migrações (initial schema gerada)
    scripts/seed.py
    tests/
  frontend/
    src/
      components/ui/      # componentes estilo shadcn (tema escuro)
      components/layout/  # shell: sidebar, topbar, notificações
      pages/              # dashboard, leads, pipeline (kanban), contatos, contas, atividades, workflows
      lib/api.ts          # fetch client com refresh automático de token
      context/auth.tsx
  docker-compose.yml
```

## Módulos (conforme documento, seção 4)

- **Leads** — CRUD + conversão (`POST /leads/{id}/convert` cria Contact + Account + Opportunity e dispara eventos).
- **Contatos & Contas** — tags, score e `custom_fields` JSON.
- **Pipeline** — estágios configuráveis (cor, probabilidade, flags ganho/perda); Kanban drag-and-drop; mover para estágio fechado seta `closed_at` e dispara `opportunity.won/lost`.
- **Atividades** — polimórficas (lead/contato/oportunidade), tipos ligação/email/reunião/tarefa.
- **Workflows** — trigger → condições (JSON) → ações (criar atividade, notificação in-app, email, webhook), com templates `{campo}`, log de execuções e builder visual.
- **Relatórios** — resumo, pipeline por estágio, leads criados×convertidos, atividades por dia, forecast ponderado. Dashboard com Recharts.

## Como adicionar um novo módulo (receita)

1. `backend/app/models/<modulo>.py` — modelo herdando `TableBase`; importe em `models/__init__.py`.
2. `backend/app/schemas/<modulo>.py` — `XCreate`, `XUpdate`, `XOut`.
3. `backend/app/api/<modulo>.py` — router copiando o padrão de `accounts.py`; registre em `api/router.py`.
4. `alembic revision --autogenerate -m "add <modulo>"` + `alembic upgrade head`.
5. Teste em `backend/tests/`.
6. Frontend: tipo em `src/types.ts`, página em `src/pages/`, rota em `App.tsx`, item no `NAV` de `app-shell.tsx`.
7. Precisa de automação? Adicione o evento em `TRIGGERS` (`services/workflow_engine.py`) e chame `events.dispatch(...)` no router — o builder de workflows passa a oferecê-lo automaticamente.

## Decisões que divergem do documento (e por quê)

| Documento | Implementado | Motivo |
|---|---|---|
| python-jose | **PyJWT** | python-jose está semi-abandonado e teve CVEs (2024); PyJWT é o padrão mantido |
| (hash não especificado) | **pwdlib + Argon2id** | recomendação OWASP atual; passlib está sem manutenção |
| React 18 | **React 19 + Tailwind 4 + Vite 6** | versões estáveis atuais, suportadas pelo ecossistema shadcn |
| driver Postgres implícito (asyncpg) | **psycopg3** | funciona sync+async com um único pacote (Alembic + FastAPI), wheels melhores p/ Python 3.14 |
| Poetry ou pip-tools | **pyproject.toml PEP 621 puro** | funciona com pip e uv, sem ferramenta extra |
| Contact↔Account M:N (`account_contacts`) | **FK simples (`account_id`)** | o ERD da seção 6 usa FK; M:N pode ser adicionado depois sem quebrar a API |
| Somente Postgres | **fallback SQLite p/ dev** | Docker não estava instalado na máquina; o projeto roda hoje e migra para Postgres sem mudança de código |

## Pendências conhecidas

- Refresh tokens não são revogáveis (sem blacklist/jti persistido) — aceitável para equipe pequena; revisar antes de expor à internet.
- Leitura de notificação broadcast é global (não por usuário).
- Bundle do frontend > 500 kB (Recharts); code-splitting com `manualChunks` quando incomodar.
- Caminho Celery/Redis escrito e configurado, mas só exercitado com Docker instalado.
