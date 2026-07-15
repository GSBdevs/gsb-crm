import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TableBase


class LeadStatus(StrEnum):
    NEW = "new"
    QUALIFIED = "qualified"
    CONVERTED = "converted"
    LOST = "lost"


class LeadInterest(StrEnum):
    """Linha de negócio de interesse do lead."""

    PRINTER_RENTAL = "printer_rental"
    IT_OUTSOURCING = "it_outsourcing"
    BOTH = "both"


class Lead(TableBase):
    __tablename__ = "leads"

    name: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str] = mapped_column(String(255), default="", index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    company: Mapped[str] = mapped_column(String(255), default="")
    cnpj: Mapped[str] = mapped_column(String(20), default="")
    source: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus, native_enum=False, length=20), default=LeadStatus.NEW, index=True
    )
    score: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")

    # --- Dados básicos da empresa (etapa 1 do funil: coleta de informações) ---
    city: Mapped[str] = mapped_column(String(120), default="")
    state: Mapped[str] = mapped_column(String(2), default="")

    # --- Especificação do serviço (etapa 2 do funil) ---
    interest: Mapped[LeadInterest] = mapped_column(
        Enum(LeadInterest, native_enum=False, length=20), default=LeadInterest.PRINTER_RENTAL
    )
    current_provider: Mapped[str] = mapped_column(String(255), default="")
    # Depreciado no funil atual (mantido por compatibilidade de dados).
    contract_renewal: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    # Impressão: tipo de máquina (a4_mono | a4_color | a3_mono | a3_color | mixed)
    printer_type: Mapped[str] = mapped_column(String(20), default="")
    printer_count: Mapped[int] = mapped_column(Integer, default=0)
    # Franquia mensal de páginas inclusa no contrato (sem excedente)
    monthly_volume_mono: Mapped[int] = mapped_column(Integer, default=0)
    monthly_volume_color: Mapped[int] = mapped_column(Integer, default=0)
    # Outsourcing de TI: produto, quantidade e especificações
    it_product: Mapped[str] = mapped_column(String(255), default="")
    it_quantity: Mapped[int] = mapped_column(Integer, default=0)
    it_specs: Mapped[str] = mapped_column(Text, default="")

    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    converted_opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True
    )
