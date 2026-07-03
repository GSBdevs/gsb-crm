"""Execução de corrotinas com o event loop correto por plataforma.

psycopg async exige SelectorEventLoop; o default do Windows é o Proactor.
Usamos loop_factory explícito (Python 3.12+) em vez da API de policy,
que está deprecada desde o Python 3.14.
"""

import asyncio
import sys
from collections.abc import Coroutine
from typing import Any, TypeVar

T = TypeVar("T")

LOOP_FACTORY = asyncio.SelectorEventLoop if sys.platform == "win32" else None


def run(coro: Coroutine[Any, Any, T]) -> T:
    return asyncio.run(coro, loop_factory=LOOP_FACTORY)
