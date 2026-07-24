# Handoff de sessão — GrupoSB CRM

> Documento para retomar o desenvolvimento em outra máquina (via `git clone`).
> Leia também `CLAUDE.md` (memória canônica do projeto) e `README.md` (setup completo).
> Última atualização: 2026-07-15.

## TL;DR para o Claude Code na máquina nova

O CRM está funcional e **testado (16 testes verdes, build limpo)**. Nesta sessão o funil
foi realinhado ao processo comercial real do GrupoSB, contas ganharam ciclo de vida
(possível cliente → ativo → inativo) + máquinas registradas, leads ganharam especificação
de serviço (impressão e/ou TI), e leads/contatos/contas ganharam telas de detalhe somente
leitura. Não há tarefa em andamento pela metade — o próximo passo é escolha do Arthur
(ver "Próximos passos").

Para começar: siga "Setup na máquina nova" abaixo, rode os testes para confirmar que está
tudo verde, e então pegue um item de "Próximos passos".

## O que instalar na máquina nova

| Ferramenta | Versão | Para quê |
|---|---|---|
| Git | recente | clonar o repo |
| Python | 3.12+ (testado no 3.14) | backend (FastAPI) |
| Node.js + npm | 20+ (testado no 24) | frontend (Vite/React) |
| Docker Desktop | atual | Postgres 16 (porta host **5433**) + Redis, via compose |
| VS Code | opcional | extensões recomendadas em `.vscode/extensions.json` |

Sem Docker dá para rodar em modo mínimo (SQLite + workflows inline) — ver README, seção
"Modo mínimo sem Docker".

## Setup na máquina nova (passo a passo)

```powershell
git clone https://github.com/GSBdevs/gsb-crm.git
cd gsb-crm

# 1. Infra (Postgres + Redis)
docker compose up -d db redis

# 2. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
copy .env.example .env      # ajuste conforme abaixo
python -m alembic upgrade head      # cria o schema COMPLETO (inclui migração desta sessão)
python scripts/seed.py              # admin@gruposb.com / admin123 + dados demo do funil novo

# 3. API (Windows: use run.py — event loop compatível com psycopg)
python run.py                        # http://localhost:8000  (docs em /api/v1/docs)

# 4. Worker Celery (outro terminal; --pool=solo obrigatório no Windows)
.venv\Scripts\python -m celery -A app.workers.celery_app.celery worker --loglevel=INFO --pool=solo

# 5. Frontend (outro terminal)
cd ..\frontend
npm install
npm run dev                          # http://localhost:5173
```

Ajustes no `backend/.env` (a partir do `.env.example`):
- `DATABASE_URL=postgresql+psycopg://crm:crm@localhost:5433/crm` (porta **5433**, não 5432)
- `WORKFLOWS_INLINE=false` **se** for rodar o worker Celery (passo 4).
  Se **não** quiser rodar o worker, use `WORKFLOWS_INLINE=true` — os workflows executam
  no processo da API (sem Redis/Celery).
- `SECRET_KEY` — gere uma para valer: `python -c "import secrets; print(secrets.token_urlsafe(48))"`

### Confirmar que está tudo ok
```powershell
cd backend
.venv\Scripts\python -m pytest       # deve dar 16 passed
cd ..\frontend
npm run build                        # tsc -b + vite build, sem erros
```

## Estado atual (o que já foi feito)

Stack: FastAPI + SQLAlchemy 2 async + Alembic + Celery/Redis · React 19 + TS + Vite 6 +
Tailwind 4 · Postgres 16 (compose) ou SQLite fallback. Tema escuro preto/cinza + amarelo.

Entregue e testado nesta sessão e na anterior:

- **Funil realinhado ao processo real**: Novo contato → Especificação → Proposta enviada →
  Contrato → Contrato iniciado (won) | Perdido (lost). Estágios no `scripts/seed.py`.
- **Contas com ciclo de vida** (`AccountStatus`: prospect | active | inactive), com abas de
  filtro na UI. Ganhar uma oportunidade **ativa a conta automaticamente**
  (`api/opportunities.py`, na rota `/move`).
- **Máquinas registradas por conta** (`Machine`: name + serial_number) — endpoints
  `/accounts/{id}/machines` (GET/POST/DELETE); UI na tela de detalhe da conta. É o
  cadastro pós-fechamento de contrato.
- **Especificação de serviço no lead**: dados básicos (city, state) + impressão
  (`printer_type` a4/a3 mono/color, `printer_count`, franquias `monthly_volume_mono/color`)
  e TI (`it_product`, `it_quantity`, `it_specs`). Seções condicionais por interesse no form.
- **Telas de detalhe somente leitura** em leads/contatos/contas (clique na linha abre;
  edição continua nos ícones/menus). Componentes em `components/ui/detail.tsx`.
- **Renovação e Score removidos da UI** de leads e contatos (colunas `score` e
  `contract_renewal` seguem no banco, **depreciadas** — drop em migração futura).
- **Dashboard**: KPI "Clientes ativos" + máquinas em campo (substituiu "renovações 90d").
- Correções: datas UTC serializadas com offset (`schemas/common.py` → `UTCDateTime`);
  parse de datas puras em fuso local no front (`lib/utils.ts` → `parseDate`); dialogs
  remontados por `key`; rodapé de dialog fixo; **fix do Radix Select fechando o Dialog**
  ao dispensar o dropdown (`components/ui/dialog.tsx`, guard `popperOpenOnPointerDown`).
- Infra: modo **origem única** para LAN (`FRONTEND_DIST` faz a API servir o build do front,
  sem CORS) + `serve-lan.ps1`; rate-limit de login por IP; trava de `SECRET_KEY` de dev
  fora de `ENV=dev`.

Migração desta sessão: `alembic/versions/d12b7d529a25_*` (account status, machines, lead specs).

## Armadilhas conhecidas (que já morderam)

- **Migração vs Postgres do compose**: `AUTO_CREATE_TABLES=true` cria tabelas *novas* no
  startup mas **não** adiciona colunas a tabelas existentes. Numa base Postgres que já rodou
  a API antes, isso criou a tabela `machines` vazia e fez `alembic upgrade head` colidir
  ("relation machines already exists"). Numa base limpa (clone novo), `alembic upgrade head`
  antes do primeiro `run.py` resolve. Em base já existente, aplique as migrações antes de
  subir a API, ou recrie o volume (`docker compose down -v`).
- **O banco de dev NÃO viaja no git** (`*.db` ignorado; volume do Postgres é local). Na
  máquina nova, o schema vem das migrações e os dados do `seed.py`.
- **Windows + psycopg async** exige SelectorEventLoop → usar `python run.py`, não
  `uvicorn app.main:app`. Celery precisa de `--pool=solo`. Hot-reload só no modo SQLite.
- **Worker Celery**: com `WORKFLOWS_INLINE=false` e sem o worker rodando, as automações de
  lead novo ficam enfileiradas sem executar. Suba o worker ou use `WORKFLOWS_INLINE=true`.
- **Radix Select dentro de Dialog**: o guard em `ui/dialog.tsx` impede que dispensar um
  select feche o modal — não remover.

## Próximos passos (candidatos, decisão do Arthur)

- Migração para **dropar as colunas depreciadas** `score` e `contract_renewal` de `leads`.
- **UI de administração de usuários** (hoje só via `POST /api/v1/users` com token de admin).
- **Deploy real**: Cloudflare Tunnel + Access (grátis, acesso da equipe com login na borda)
  ou nuvem gratuita (Render servindo a SPA + Neon Postgres). Ver README, seções
  "Rodando na rede local" e "Deploy gratuito na nuvem".
- SMTP com fila de retry própria (hoje `send_email` é SMTP simples, best-effort).
- Rate-limit de login hoje é em memória (por processo) — mover para Redis se houver réplicas.

## Notas sobre este handoff

- A **memória de projeto do Claude** (`~/.claude/.../memory/`) e a persona são **locais
  desta máquina** — não vêm no clone. O que viaja é este arquivo + `CLAUDE.md` +
  `README.md` no repo. Na máquina nova, o Claude Code lê o `CLAUDE.md` do repo
  automaticamente; aponte-o para este `HANDOFF.md` no primeiro prompt.
- Convenção de commits: **inglês**, conventional commits. Idioma do produto e das
  conversas: **pt-BR**.
