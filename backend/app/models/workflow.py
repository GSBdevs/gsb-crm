import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TableBase, utcnow


class WorkflowRule(TableBase):
    """Regra de automação: trigger (evento) -> conditions (JSON) -> actions (JSON)."""

    __tablename__ = "workflow_rules"

    name: Mapped[str] = mapped_column(String(255))
    trigger_event: Mapped[str] = mapped_column(String(60), index=True)
    conditions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    actions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    executions = relationship(
        "WorkflowExecution", back_populates="rule", cascade="all, delete-orphan"
    )


class WorkflowExecution(TableBase):
    __tablename__ = "workflow_executions"

    rule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workflow_rules.id", ondelete="CASCADE"), index=True
    )
    event: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(20), default="")
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    status: Mapped[str] = mapped_column(String(10), default="success")  # success | error
    detail: Mapped[str] = mapped_column(Text, default="")
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    rule = relationship("WorkflowRule", back_populates="executions")
