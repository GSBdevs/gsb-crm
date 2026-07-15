import uuid

from pydantic import BaseModel, ConfigDict

from app.models.activity import ActivityType
from app.schemas.common import UTCDateTime


class ActivityCreate(BaseModel):
    type: ActivityType = ActivityType.TASK
    title: str
    notes: str = ""
    entity_type: str | None = None  # lead | contact | opportunity
    entity_id: uuid.UUID | None = None
    due_at: UTCDateTime | None = None


class ActivityUpdate(BaseModel):
    type: ActivityType | None = None
    title: str | None = None
    notes: str | None = None
    due_at: UTCDateTime | None = None
    done: bool | None = None  # true seta done_at=agora; false limpa


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: ActivityType
    title: str
    notes: str
    entity_type: str | None
    entity_id: uuid.UUID | None
    entity_label: str | None = None
    due_at: UTCDateTime | None
    done_at: UTCDateTime | None
    user_id: uuid.UUID | None
    created_at: UTCDateTime
