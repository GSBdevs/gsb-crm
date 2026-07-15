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
.venv\Scripts\python -m pytest        # 16 testes: auth (rotação/revogação/rate-limit), leads+conversão,
                                      # contas+máquinas, kanban, workflows, notificações, relatórios
cd ..\frontend
npm run build                         # type-check (tsc -b) + build Vite
```

Teste manual da fila: com API + worker rodando, crie um lead na UI — o workflow "Novo lead → tarefa de follow-up" deve gerar atividade e notificação via Redis/Celery (veja o log do worker). Leads com `printer_count >= 10` também disparam "Lead prioritário".

## Rodando na rede local (teste real com a equipe)

O modo **origem única** faz a própria API servir o frontend buildado — um único
host:porta para expor, sem CORS:

```powershell
.\serve-lan.ps1     # builda o frontend e sobe tudo em http://<ip-da-maquina>:8000
```

Uma vez, em PowerShell **como administrador**, libere a porta apenas no perfil privado:

```powershell
New-NetFirewallRule -DisplayName "GrupoSB CRM" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```

O que já protege esse modo: JWT com expiração curta + rotação de refresh, Argon2id,
rate-limit de login por IP, rotas 100% autenticadas, sem cadastro aberto
(admin cria usuários via `POST /api/v1/users`). Checklist antes de expor:

1. `SECRET_KEY` forte no `backend/.env` (`python -c "import secrets; print(secrets.token_urlsafe(48))"`)
   e `ENV=staging` — com chave de dev e `ENV != dev` a API se recusa a subir.
2. Troque a senha do seed (`admin123`) e crie um usuário por pessoa.
3. Prefira Postgres (compose) a SQLite quando houver mais de um usuário simultâneo.

**Limitação:** é HTTP puro — adequado a rede interna confiável. Para HTTPS/acesso
de fora do escritório sem custo, use um túnel com autenticação na borda:

- **Cloudflare Tunnel + Access** (plano Zero Trust gratuito até 50 usuários): `cloudflared`
  roda na máquina do CRM, ninguém abre porta no roteador, e o time faz login
  (código por email) antes de a requisição chegar ao app. Melhor opção para a empresa.
- **Tailscale** (gratuito até 6 usuários): VPN mesh; o CRM fica acessível pelo IP
  do tailnet só para quem está na rede. Ótimo para um piloto pequeno.

## Deploy gratuito na nuvem (cenário jul/2026)

| Peça | Serviço | Free tier | Observações |
|---|---|---|---|
| API + frontend | **Render** (web service) | 512 MB RAM | Dorme após 15 min ocioso (cold start de ~30–60 s); use o modo origem única (`FRONTEND_DIST`) num serviço só |
| Postgres | **Neon** | 0,5 GB, scale-to-zero | Sem pausa por inatividade (Supabase pausa após 1 semana) |
| Redis/fila | **Upstash** | 500K comandos/mês | Para poucos workflows serve; mais simples: `WORKFLOWS_INLINE=true` e dispensar worker/Redis |
| Frontend isolado (opcional) | Cloudflare Pages / Vercel / Netlify | Generoso | Só faz sentido se separar do backend; exige CORS configurado |

Stack recomendada para começar de graça: **Render (API servindo a SPA) + Neon +
`WORKFLOWS_INLINE=true`** — um serviço, um banco, zero worker. Alternativas que
saíram do jogo: Fly.io e Koyeb encerraram os planos gratuitos.

> Importante: o free tier do Render hiberna — para uso interno diário a melhor
> relação custo/benefício continua sendo a máquina local + Cloudflare Tunnel.

## Domínio: locação de impressoras & outsourcing de TI

O funil segue o processo comercial real do GrupoSB:

1. **Novo contato** — o cliente procura; coleta de dados básicos (razão social, CNPJ, localização, pessoa de contato).
2. **Especificação** — levantamento do serviço: impressão (tipo de máquina A4/A3 mono/color, nº de impressoras, franquia mensal de páginas sem excedente) e/ou outsourcing de TI (produto, quantidade, especificações).
3. **Proposta enviada** — aguardando resposta do cliente.
4. **Contrato** — elaboração/assinatura.
5. **Contrato iniciado** (ganho) · **Perdido**.

Modelagem:

- **Lead**: dados básicos + interesse (`printer_rental` | `it_outsourcing` | `both`) + especificação por linha de serviço (tipo de máquina, franquias P&B/color, produto/quantidade/specs de TI).
- **Opportunity**: tipo de serviço, cobrança (`monthly` = recorrente/MRR ou `one_time`), prazo em meses; `value` é o **valor mensal** quando recorrente e `total_value` = mensal × prazo.
- **Account**: status do ciclo de vida (**possível cliente → cliente ativo → cliente inativo**), CNPJ, cidade, UF. Ganhar uma oportunidade ativa a conta automaticamente. Contas ativas registram **máquinas instaladas** (nome + nº de série) e mostram contratos e contatos vinculados na tela de detalhe.
- **Dashboard**: KPIs de MRR em pipeline, clientes ativos e máquinas em campo.
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
- Rate-limit de login é em memória (por processo) — suficiente p/ 1 instância; com múltiplas réplicas, mover para Redis.
- Sem UI de administração de usuários (criação via `POST /api/v1/users` com token de admin, ou `/api/v1/docs`).
- HTTPS não é terminado pela API — em rede local use Cloudflare Tunnel/Tailscale (seção acima) ou um proxy (Caddy).

## Resolvido recentemente (jul/2026)

- Select dentro de dialog fechava o modal junto ao clicar fora do dropdown (guard no `DialogContent`).
- Funil realinhado ao processo comercial real; contas com status de ciclo de vida e máquinas registradas.
- Leads/contatos/contas com tela de detalhe somente leitura (clique na linha); Renovação/Score removidos da UI.
- Datas puras exibidas com 1 dia a menos no fuso do Brasil (parse UTC no frontend).
- Timestamps serializados sem offset UTC no modo SQLite (3 h de erro na exibição).
- Dialogs reabertos herdavam estado do uso anterior (converter lead, nova oportunidade/atividade/regra).
- Botões Salvar/Cancelar fora da dobra em formulários altos (rodapé agora é fixo).
- Notificação individual agora pode ser marcada como lida (clique no item do sino).
- Eixos/legendas dos gráficos ilegíveis no tema escuro.
- Login sem rate-limit e SECRET_KEY de dev aceita fora de dev.
