import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.common import UTCDateTime


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    title: str
    body: str
    is_read: bool
    created_at: UTCDateTime


class UnreadCountOut(BaseModel):
    count: int
