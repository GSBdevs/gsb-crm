from enum import StrEnum

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TableBase


class UserRole(StrEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    REP = "rep"


class User(TableBase):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False, length=20), default=UserRole.REP
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
