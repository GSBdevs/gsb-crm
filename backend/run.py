"""Entrypoint de desenvolvimento no Windows.

O psycopg async exige SelectorEventLoop, mas o uvicorn cria um Proactor
(default do Windows) antes de importar o app — por isso `uvicorn app.main:app`
falha no Windows com Postgres. Aqui o servidor roda dentro de um loop Selector.

Uso: python run.py
Nota: sem --reload. Para hot-reload use o modo SQLite (sem .env) ou docker compose.
"""

import uvicorn

from app.core.aio import run
from app.core.config import settings


async def _serve() -> None:
    # Bind configurável: API_HOST=0.0.0.0 + API_PORT no .env expõem na rede local.
    config = uvicorn.Config("app.main:app", host=settings.api_host, port=settings.api_port)
    await uvicorn.Server(config).serve()


if __name__ == "__main__":
    run(_serve())
