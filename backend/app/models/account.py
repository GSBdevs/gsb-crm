from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TableBase


class AccountSize(StrEnum):
    S = "S"
    M = "M"
    L = "L"
    XL = "XL"


class Account(TableBase):
    __tablename__ = "accounts"

    name: Mapped[str] = mapped_column(String(255), index=True)
    domain: Mapped[str] = mapped_column(String(255), default="")
    industry: Mapped[str] = mapped_column(String(120), default="")
    size: Mapped[AccountSize] = mapped_column(
        Enum(AccountSize, native_enum=False, length=4), default=AccountSize.S
    )
    cnpj: Mapped[str] = mapped_column(String(20), default="")
    city: Mapped[str] = mapped_column(String(120), default="")
    state: Mapped[str] = mapped_column(String(2), default="")
    custom_fields: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    contacts = relationship("Contact", back_populates="account")
