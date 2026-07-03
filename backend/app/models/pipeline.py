import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TableBase


class PipelineStage(TableBase):
    __tablename__ = "pipeline_stages"

    name: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(20), default="#facc15")
    # Probabilidade default aplicada às oportunidades que entram no estágio.
    probability: Mapped[int] = mapped_column(Integer, default=10)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False)
    is_lost: Mapped[bool] = mapped_column(Boolean, default=False)

    opportunities = relationship("Opportunity", back_populates="stage")


class Opportunity(TableBase):
    __tablename__ = "opportunities"

    title: Mapped[str] = mapped_column(String(255), index=True)
    value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    probability: Mapped[int] = mapped_column(Integer, default=10)
    expected_close: Mapped[date | None] = mapped_column(Date, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    stage_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("pipeline_stages.id", ondelete="RESTRICT"), index=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )

    stage = relationship("PipelineStage", back_populates="opportunities")
    contact = relationship("Contact")
    account = relationship("Account")
