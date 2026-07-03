"""Dispatch de eventos de domínio para o motor de workflows.

WORKFLOWS_INLINE=true  -> processa no próprio processo da API (dev sem Redis).
WORKFLOWS_INLINE=false -> enfileira no Celery (worker consome via Redis).
"""

import logging
from typing import Any

from app.core.config import settings
from app.models import Lead, Opportunity

logger = logging.getLogger(__name__)


async def dispatch(event: str, entity_type: str, entity_id: Any, payload: dict[str, Any]) -> None:
    entity_id_str = str(entity_id) if entity_id else None
    if settings.workflows_inline:
        # Sessão própria, independente da sessão da request (que já commitou).
        from app.core import database
        from app.services.workflow_engine import process_event

        try:
            async with database.session_factory() as session:
                await process_event(session, event, entity_type, entity_id_str, payload)
                await session.commit()
        except Exception:
            logger.exception("Falha ao processar workflows do evento %s", event)
    else:
        from app.workers.tasks import run_workflow_event

        run_workflow_event.delay(event, entity_type, entity_id_str, payload)


def lead_payload(lead: Lead, **extra: Any) -> dict[str, Any]:
    return {
        "name": lead.name,
        "email": lead.email,
        "phone": lead.phone,
        "company": lead.company,
        "source": lead.source,
        "score": lead.score,
        "status": str(lead.status),
        **extra,
    }


def opportunity_payload(opp: Opportunity, stage_name: str = "", **extra: Any) -> dict[str, Any]:
    return {
        "title": opp.title,
        "value": float(opp.value or 0),
        "probability": opp.probability,
        "stage": stage_name,
        **extra,
    }
