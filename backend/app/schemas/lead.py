import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.lead import LeadStatus
from app.schemas.contact import ContactOut
from app.schemas.pipeline import OpportunityOut


class LeadCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    company: str = ""
    source: str = ""
    score: int = 0
    notes: str = ""


class LeadUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    source: str | None = None
    status: LeadStatus | None = None
    score: int | None = None
    notes: str | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    phone: str
    company: str
    source: str
    status: LeadStatus
    score: int
    notes: str
    converted_at: datetime | None
    converted_contact_id: uuid.UUID | None
    converted_opportunity_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class LeadConvertIn(BaseModel):
    create_opportunity: bool = True
    opportunity_title: str | None = None
    value: float | None = None
    stage_id: uuid.UUID | None = None
    account_name: str | None = None


class LeadConvertOut(BaseModel):
    lead: LeadOut
    contact: ContactOut
    opportunity: OpportunityOut | None = None
