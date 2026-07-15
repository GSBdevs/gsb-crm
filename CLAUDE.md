# GrupoSB CRM — memória do projeto

CRM próprio do Grupo SB para **locação de impressoras (A4/A3, mono/color) e outsourcing de TI**.
Dono: Arthur (gruposb.dev@gmail.com). Repo: https://github.com/GSBdevs/gsb-crm. Idioma do produto e das respostas: pt-BR. Commits: **inglês, conventional commits** (`feat:`, `fix:`, `docs:`…).

## Stack e arquitetura

- **Backend** `backend/`: Python 3.14 local (imagem 3.13), FastAPI, SQLAlchemy 2 async, Alembic, Pydantic v2, PyJWT (access 15min + refresh 7d com rotação/revogação em `refresh_tokens`), pwdlib/Argon2, Celery+Redis p/ workflows.
- **Frontend** `frontend/`: React 19, TS estrito, Vite 6, Tailwind 4 (tokens em `src/index.css`), componentes shadcn-style escritos à mão em `components/ui/`, TanStack Query 5, react-router 7, Kanban com @hello-pangea/dnd, gráficos Recharts.
- **Banco**: Postgres 16 via compose (host **5433** — máquina tem PG nativo em 5432) ou SQLite fallback (sem `.env`). `backend/.env` local aponta p/ Postgres + `WORKFLOWS_INLINE=false`.
- **Tema**: escuro único, preto/cinza neutros + primário amarelo `oklch(0.83 0.16 90)`; verde/vermelho apenas semânticos (ganhou/perdeu).

## Domínio (não genérico!)

- Funil (estágios do seed): Novo contato → Especificação → Proposta enviada → Contrato → Contrato iniciado (won) | Perdido (lost).
- Lead: dados básicos (cnpj, city, state) + `interest` (printer_rental|it_outsourcing|both) + specs: `printer_type` (a4_mono|a4_color|a3_mono|a3_color|mixed|""), `printer_count`, `monthly_volume_mono/color` (franquia), `it_product`, `it_quantity`, `it_specs`. `score` e `contract_renewal` existem no banco mas foram REMOVIDOS da UI (depreciados).
- Account: `status` (prospect|active|inactive) — ganhar oportunidade seta active (api/opportunities.py move). `Machine` (name, serial_number) via `/accounts/{id}/machines`.
- Opportunity: `service_type`, `billing_type` (monthly=MRR|one_time), `contract_months`; `value` = mensal se recorrente; `total_value` = property calculada.
- Conversão de lead mapeia interest→service_type e cria Contact+Account+Opportunity (`services/lead_service.py`).
- Reports: `mrr_open`, `active_accounts`, `machines_total` no summary.
- UI: leads/contatos/contas abrem detalhe read-only no clique da linha (componentes em `components/ui/detail.tsx`); edição segue nos ícones/menus.

## Convenções e armadilhas

- Modelos herdam `TableBase` (UUID pk + created/updated). Enums: StrEnum + `native_enum=False` (armazenam o NAME, ex. 'PRINTER_RENTAL').
- Eventos de domínio: `services/events.py` → `dispatch()` (inline ou Celery). Triggers/campos p/ o builder da UI em `TRIGGERS`/`ACTION_TYPES` de `services/workflow_engine.py`.
- **Windows**: psycopg async exige SelectorEventLoop → `app/core/aio.run()` e `python run.py` (não `uvicorn app.main:app` com Postgres). Celery: `--pool=solo`. Hot-reload só no modo SQLite.
- Migrações autogeradas contra SQLite scratch (`DATABASE_URL=sqlite+aiosqlite:///<tmp> alembic revision --autogenerate`); adicionar `server_default` manualmente em colunas NOT NULL novas.
- Notificações: broadcast tem `user_id` nulo; leitura por usuário via `notification_reads`.
- Testes (`backend/tests/`, 16): sqlite in-memory, `conftest.py` monkeypatcha `database.session_factory` p/ o dispatch inline. Rodar: `.venv\Scripts\python -m pytest`.
- **Radix Select em Dialog**: o guard de `onPointerDownOutside` em `ui/dialog.tsx` (flag `popperOpenOnPointerDown`) impede que dispensar um select feche o modal — não remover.
- Frontend: paginação `Page<T>`; client `lib/api.ts` faz refresh single-flight e redirect p/ /login em 401.
- **Datas**: schemas Out usam `UTCDateTime` (`schemas/common.py`) — SQLite devolve naive e sem isso o JSON sai sem offset (3h de erro no browser). No front, datas puras (`YYYY-MM-DD`) passam por `parseDate` de `lib/utils.ts` (parse local, evita off-by-one).
- **Dialogs de formulário**: remontar com `key` ao abrir (padrão usado em leads/pipeline/atividades/workflows) — sem isso o estado da abertura anterior vaza.
- Login tem rate-limit por IP em memória (`LOGIN_MAX_FAILURES`/`LOGIN_WINDOW_SECONDS`); só falhas contam. Com `ENV != dev` e SECRET_KEY de dev a API recusa subir.
- **Origem única**: `FRONTEND_DIST=frontend/dist` faz a API servir a SPA (sem CORS). `API_HOST=0.0.0.0` expõe na rede; `serve-lan.ps1` na raiz builda e sobe tudo.

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

## Estado (2026-07-15)

Funil realinhado ao processo comercial real (estágios novos no seed), contas com ciclo de vida (prospect/active/inactive + ativação automática no won), máquinas registradas por conta, specs de serviço no lead (impressão + TI), telas de detalhe read-only em leads/contatos/contas, Renovação/Score fora da UI, KPI de clientes ativos/máquinas. Fix do Radix Select+Dialog. Rodada anterior: datas UTC, LAN origem única (`serve-lan.ps1`), rate-limit login, layout fluido. Pendências: hot-reload Windows+Postgres, SMTP simples, sem multi-tenancy, sem UI de admin de usuários, rate-limit por processo, colunas depreciadas (score/contract_renewal) a dropar em migração futura. Tokens do tema (preto/cinza/amarelo) continuam a base visual.
