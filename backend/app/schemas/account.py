import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.account import AccountSize, AccountStatus
from app.schemas.common import UTCDateTime


class AccountCreate(BaseModel):
    name: str
    domain: str = ""
    industry: str = ""
    size: AccountSize = AccountSize.S
    status: AccountStatus = AccountStatus.PROSPECT
    cnpj: str = ""
    city: str = ""
    state: str = ""
    custom_fields: dict[str, Any] = {}


class AccountUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    industry: str | None = None
    size: AccountSize | None = None
    status: AccountStatus | None = None
    cnpj: str | None = None
    city: str | None = None
    state: str | None = None
    custom_fields: dict[str, Any] | None = None


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    domain: str
    industry: str
    size: AccountSize
    status: AccountStatus
    cnpj: str
    city: str
    state: str
    custom_fields: dict[str, Any]
    created_at: UTCDateTime
    updated_at: UTCDateTime


class MachineCreate(BaseModel):
    name: str
    serial_number: str = ""
    notes: str = ""


class MachineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID
    name: str
    serial_number: str
    notes: str
    created_at: UTCDateTime
