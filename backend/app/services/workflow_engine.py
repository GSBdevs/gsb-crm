"""Motor de workflows: trigger (evento) -> conditions -> actions.

Executado inline (dev) ou via Celery (produção). Cada execução de regra é
registrada em WorkflowExecution para auditoria e depuração pela UI.
"""

import logging
import smtplib
import uuid
from datetime import timedelta
from email.message import EmailMessage
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import (
    Activity,
    ActivityType,
    Notification,
    User,
    WorkflowExecution,
    WorkflowRule,
    utcnow,
)

logger = logging.getLogger(__name__)

# Eventos disponíveis e campos expostos ao builder de condições do frontend.
TRIGGERS: dict[str, list[str]] = {
    "lead.created": ["name", "email", "company", "source", "score", "status"],
    "lead.status_changed": ["name", "email", "source", "score", "old_status", "new_status"],
    "lead.converted": ["name", "email", "company", "source", "score"],
    "opportunity.created": ["title", "value", "probability", "stage"],
    "opportunity.stage_changed": ["title", "value", "probability", "old_stage", "new_stage"],
    "opportunity.won": ["title", "value", "stage"],
    "opportunity.lost": ["title", "value", "stage"],
}

ACTION_TYPES: dict[str, dict[str, str]] = {
    "create_activity": {
        "activity_type": "call | email | meeting | task",
        "title": "título (aceita {campo} do evento)",
        "due_in_days": "prazo em dias a partir de agora",
    },
    "notify": {
        "title": "título (aceita {campo})",
        "body": "mensagem (aceita {campo})",
        "user_email": "destinatário; vazio = broadcast",
    },
    "send_email": {
        "to": "email de destino",
        "subject": "assunto (aceita {campo})",
        "body": "corpo (aceita {campo})",
    },
    "webhook": {"url": "URL que recebe POST com o payload do evento"},
}


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return f"{{{key}}}"


def render(template: str, payload: dict[str, Any]) -> str:
    """Substitui {campo} pelos valores do payload; campos desconhecidos ficam literais."""
    try:
        return str(template).format_map(_SafeDict(payload))
    except Exception:
        return str(template)


def _matches(condition: dict[str, Any], payload: dict[str, Any]) -> bool:
    field = condition.get("field", "")
    op = condition.get("op", "eq")
    expected = condition.get("value")
    actual = payload.get(field)

    def _num(v: Any) -> float | None:
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    if op == "eq":
        return str(actual) == str(expected) or actual == expected
    if op == "neq":
        return not (str(actual) == str(expected) or actual == expected)
    if op in ("gt", "gte", "lt", "lte"):
        a, b = _num(actual), _num(expected)
        if a is None or b is None:
            return False
        return {"gt": a > b, "gte": a >= b, "lt": a < b, "lte": a <= b}[op]
    if op == "contains":
        return str(expected).lower() in str(actual or "").lower()
    if op == "not_contains":
        return str(expected).lower() not in str(actual or "").lower()
    if op == "is_empty":
        return actual in (None, "", [], {})
    if op == "not_empty":
        return actual not in (None, "", [], {})
    return False


async def _act_create_activity(
    session: AsyncSession, entity_type: str, entity_id: str | None, payload: dict, params: dict
) -> str:
    due_days = params.get("due_in_days")
    activity = Activity(
        type=ActivityType(params.get("activity_type", "task")),
        title=render(params.get("title", "Follow-up automático"), payload),
        notes=render(params.get("notes", ""), payload),
        entity_type=entity_type or None,
        entity_id=uuid.UUID(entity_id) if entity_id else None,
        due_at=utcnow() + timedelta(days=float(due_days)) if due_days is not None else None,
    )
    session.add(activity)
    return "atividade criada"


async def _act_notify(
    session: AsyncSession, entity_type: str, entity_id: str | None, payload: dict, params: dict
) -> str:
    user_id = None
    if email := params.get("user_email"):
        user = await session.scalar(select(User).where(User.email == email))
        if user:
            user_id = user.id
    session.add(
        Notification(
            user_id=user_id,
            title=render(params.get("title", "Automação executada"), payload),
            body=render(params.get("body", ""), payload),
        )
    )
    return "notificação criada"


async def _act_send_email(
    session: AsyncSession, entity_type: str, entity_id: str | None, payload: dict, params: dict
) -> str:
    to = params.get("to", "")
    subject = render(params.get("subject", "Notificação do CRM"), payload)
    body = render(params.get("body", ""), payload)
    if not settings.smtp_host:
        logger.info("[email simulado] para=%s assunto=%s corpo=%s", to, subject, body)
        return f"email simulado para {to} (SMTP não configurado)"

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)
    return f"email enviado para {to}"


async def _act_webhook(
    session: AsyncSession, entity_type: str, entity_id: str | None, payload: dict, params: dict
) -> str:
    url = params.get("url", "")
    if not url:
        raise ValueError("webhook sem URL configurada")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            url, json={"entity_type": entity_type, "entity_id": entity_id, "payload": payload}
        )
        resp.raise_for_status()
    return f"webhook {url} -> {resp.status_code}"


_EXECUTORS = {
    "create_activity": _act_create_activity,
    "notify": _act_notify,
    "send_email": _act_send_email,
    "webhook": _act_webhook,
}


async def process_event(
    session: AsyncSession,
    event: str,
    entity_type: str,
    entity_id: str | None,
    payload: dict[str, Any],
) -> None:
    """Avalia todas as regras ativas do evento e executa as ações das que casarem."""
    rules = (
        await session.scalars(
            select(WorkflowRule).where(
                WorkflowRule.trigger_event == event, WorkflowRule.is_active.is_(True)
            )
        )
    ).all()

    for rule in rules:
        if not all(_matches(c, payload) for c in (rule.conditions or [])):
            continue

        results: list[str] = []
        status = "success"
        for action in rule.actions or []:
            action_type = action.get("type", "")
            executor = _EXECUTORS.get(action_type)
            if executor is None:
                results.append(f"{action_type}: tipo desconhecido")
                status = "error"
                continue
            try:
                outcome = await executor(
                    session, entity_type, entity_id, payload, action.get("params", {})
                )
                results.append(f"{action_type}: {outcome}")
            except Exception as exc:  # ação não pode derrubar as demais
                logger.exception("Ação %s da regra %s falhou", action_type, rule.name)
                results.append(f"{action_type}: erro — {exc}")
                status = "error"

        session.add(
            WorkflowExecution(
                rule_id=rule.id,
                event=event,
                entity_type=entity_type,
                entity_id=uuid.UUID(entity_id) if entity_id else None,
                status=status,
                detail="; ".join(results) or "sem ações",
            )
        )
