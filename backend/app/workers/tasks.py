from typing import Any

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core import aio
from app.core.config import settings
from app.services.workflow_engine import process_event
from app.workers.celery_app import celery


async def _run(event: str, entity_type: str, entity_id: str | None, payload: dict[str, Any]):
    # Engine própria por task: cada execução cria um event loop novo,
    # então não podemos reaproveitar o pool global da API.
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            await process_event(session, event, entity_type, entity_id, payload)
            await session.commit()
    finally:
        await engine.dispose()


@celery.task(name="crm.run_workflow_event", max_retries=3, default_retry_delay=10)
def run_workflow_event(
    event: str, entity_type: str, entity_id: str | None, payload: dict[str, Any]
) -> None:
    aio.run(_run(event, entity_type, entity_id, payload))
