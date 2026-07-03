# GrupoSB CRM — memória do projeto

CRM próprio do Grupo SB para **locação de impressoras (A4/A3, mono/color) e outsourcing de TI**.
Dono: Arthur (gruposb.dev@gmail.com). Repo: https://github.com/GSBdevs/gsb-crm. Idioma do produto e das respostas: pt-BR. Commits: **inglês, conventional commits** (`feat:`, `fix:`, `docs:`…).

## Stack e arquitetura

- **Backend** `backend/`: Python 3.14 local (imagem 3.13), FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2, PyJWT (access 15min + refresh 7d com rotação/revogação em `refresh_tokens`), pwdlib/Argon2, Celery+Redis p/ workflows.
- **Frontend** `frontend/`: React 19, TS estrito, Vite 6, Tailwind 4 (tokens em `src/index.css`), componentes shadcn-style escritos à mão em `components/ui/`, TanStack Query 5, react-router 7, Kanban com @hello-pangea/dnd, gráficos Recharts.
- **Banco**: Postgres 16 via compose (host **5433** — máquina tem PG nativo em 5432) ou SQLite fallback (sem `.env`). `backend/.env` local aponta p/ Postgres + `WORKFLOWS_INLINE=false`.
- **Tema**: escuro único, preto/cinza neutros + primário amarelo `oklch(0.83 0.16 90)`; verde/vermelho apenas semânticos (ganhou/perdeu).

## Domínio (não genérico!)

- Lead: `interest` (printer_rental|it_outsourcing|both), `current_provider`, `contract_renewal` (gatilho de prospecção), `printer_count`, `monthly_volume_mono/color`, `cnpj`.
- Opportunity: `service_type`, `billing_type` (monthly=MRR|one_time), `contract_months`; `value` = mensal se recorrente; `total_value` = property calculada.
- Conversão de lead mapeia interest→service_type e cria Contact+Account+Opportunity (`services/lead_service.py`).
- Reports: `mrr_open` e `renewals_next_90d` no summary.

## Convenções e armadilhas

- Modelos herdam `TableBase` (UUID pk + created/updated). Enums: StrEnum + `native_enum=False` (armazenam o NAME, ex. 'PRINTER_RENTAL').
- Eventos de domínio: `services/events.py` → `dispatch()` (inline ou Celery). Triggers/campos p/ o builder da UI em `TRIGGERS`/`ACTION_TYPES` de `services/workflow_engine.py`.
- **Windows**: psycopg async exige SelectorEventLoop → `app/core/aio.run()` e `python run.py` (não `uvicorn app.main:app` com Postgres). Celery: `--pool=solo`. Hot-reload só no modo SQLite.
- Migrações autogeradas contra SQLite scratch (`DATABASE_URL=sqlite+aiosqlite:///<tmp> alembic revision --autogenerate`); adicionar `server_default` manualmente em colunas NOT NULL novas.
- Notificações: broadcast tem `user_id` nulo; leitura por usuário via `notification_reads`.
- Testes (`backend/tests/`, 13): sqlite in-memory, `conftest.py` monkeypatcha `database.session_factory` p/ o dispatch inline. Rodar: `.venv\Scripts\python -m pytest`.
- Frontend: paginação `Page<T>`; client `lib/api.ts` faz refresh single-flight e redirect p/ /login em 401.

## Comandos

```
docker compose up -d db redis                 # infra
backend: python run.py                        # API dev (Windows+Postgres)
backend: python -m celery -A app.workers.celery_app.celery worker --pool=solo --loglevel=INFO
backend: python scripts/seed.py               # admin@gruposb.com / admin123
frontend: npm run dev | npm run build
```

## Receita p/ novo módulo

model → schemas → router (padrão `accounts.py`) → `api/router.py` → migração → teste → `types.ts` → página → rota em `App.tsx` → `NAV` no `app-shell.tsx`. Automação: evento em `TRIGGERS` + `events.dispatch(...)`.

## Estado (2026-07-03)

MVP completo dos 7 passos do PDF de decisão + tema amarelo + domínio de impressoras/TI + fila Celery validada e2e. Pendências: hot-reload Windows+Postgres, SMTP simples, sem multi-tenancy. Arthur vai otimizar o visual com outras ferramentas — manter tokens/estrutura do tema estáveis.
