"""Entrypoint de desenvolvimento no Windows.

O psycopg async exige SelectorEventLoop, mas o uvicorn cria um Proactor
(default do Windows) antes de importar o app — por isso `uvicorn app.main:app`
falha no Windows com Postgres. Aqui o servidor roda dentro de um loop Selector.

Uso: python run.py
Nota: sem --reload. Para hot-reload use o modo SQLite (sem .env) ou docker compose.
"""

import uvicorn

from app.core.aio import run


async def _serve() -> None:
    config = uvicorn.Config("app.main:app", host="127.0.0.1", port=8000)
    await uvicorn.Server(config).serve()


if __name__ == "__main__":
    run(_serve())
