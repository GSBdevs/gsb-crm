import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.common import UTCDateTime


class ContactCreate(BaseModel):
    first_name: str
    last_name: str = ""
    email: EmailStr | None = None
    phone: str = ""
    tags: list[str] = []
    score: int = 0
    custom_fields: dict[str, Any] = {}
    account_id: uuid.UUID | None = None


class ContactUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    tags: list[str] | None = None
    score: int | None = None
    custom_fields: dict[str, Any] | None = None
    account_id: uuid.UUID | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    full_name: str
    email: EmailStr | None
    phone: str
    tags: list[str]
    score: int
    custom_fields: dict[str, Any]
    account_id: uuid.UUID | None
    created_at: UTCDateTime
    updated_at: UTCDateTime
