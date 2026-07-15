import uuid
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Enum, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TableBase


class AccountSize(StrEnum):
    S = "S"
    M = "M"
    L = "L"
    XL = "XL"


class AccountStatus(StrEnum):
    """Ciclo de vida do cliente: possível cliente → ativo (contrato) → inativo."""

    PROSPECT = "prospect"
    ACTIVE = "active"
    INACTIVE = "inactive"


class Account(TableBase):
    __tablename__ = "accounts"

    name: Mapped[str] = mapped_column(String(255), index=True)
    domain: Mapped[str] = mapped_column(String(255), default="")
    industry: Mapped[str] = mapped_column(String(120), default="")
    size: Mapped[AccountSize] = mapped_column(
        Enum(AccountSize, native_enum=False, length=4), default=AccountSize.S
    )
    status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus, native_enum=False, length=10),
        default=AccountStatus.PROSPECT,
        index=True,
    )
    cnpj: Mapped[str] = mapped_column(String(20), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    state: Mapped[str] = mapped_column(String(2), default="")
    custom_fields: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    contacts = relationship("Contact", back_populates="account")
    machines = relationship(
        "Machine", back_populates="account", cascade="all, delete-orphan"
    )


class Machine(TableBase):
    """Equipamento instalado no cliente (registro pós-fechamento do contrato)."""

    __tablename__ = "machines"

    account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    serial_number: Mapped[str] = mapped_column(String(120), index=True)
    notes: Mapped[str] = mapped_column(String(500), default="")

    account = relationship("Account", back_populates="machines")
