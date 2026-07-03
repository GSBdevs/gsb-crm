import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class StageCreate(BaseModel):
    name: str
    position: int = 0
    color: str = "#facc15"
    probability: int = Field(default=10, ge=0, le=100)
    is_won: bool = False
    is_lost: bool = False


class StageUpdate(BaseModel):
    name: str | None = None
    position: int | None = None
    color: str | None = None
    probability: int | None = Field(default=None, ge=0, le=100)
    is_won: bool | None = None
    is_lost: bool | None = None


class StageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int
    color: str
    probability: int
    is_won: bool
    is_lost: bool


class StageReorderIn(BaseModel):
    stage_ids: list[uuid.UUID]


class OpportunityCreate(BaseModel):
    title: str
    value: float = 0
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close: date | None = None
    stage_id: uuid.UUID
    contact_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None


class OpportunityUpdate(BaseModel):
    title: str | None = None
    value: float | None = None
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close: date | None = None
    contact_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None


class OpportunityMoveIn(BaseModel):
    stage_id: uuid.UUID
    position: int = 0


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    value: float
    probability: int
    expected_close: date | None
    position: int
    closed_at: datetime | None
    stage_id: uuid.UUID
    contact_id: uuid.UUID | None
    account_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class OpportunityBoardItem(OpportunityOut):
    contact_name: str | None = None
    account_name: str | None = None
