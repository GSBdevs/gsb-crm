import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.models.lead import LeadInterest, LeadStatus
from app.schemas.common import UTCDateTime
from app.schemas.contact import ContactOut
from app.schemas.pipeline import OpportunityOut


class LeadCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    company: str = ""
    cnpj: str = ""
    source: str = ""
    score: int = 0
    notes: str = ""
    interest: LeadInterest = LeadInterest.PRINTER_RENTAL
    current_provider: str = ""
    contract_renewal: date | None = None
    printer_count: int = Field(default=0, ge=0)
    monthly_volume_mono: int = Field(default=0, ge=0)
    monthly_volume_color: int = Field(default=0, ge=0)


class LeadUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    cnpj: str | None = None
    source: str | None = None
    status: LeadStatus | None = None
    score: int | None = None
    notes: str | None = None
    interest: LeadInterest | None = None
    current_provider: str | None = None
    contract_renewal: date | None = None
    printer_count: int | None = Field(default=None, ge=0)
    monthly_volume_mono: int | None = Field(default=None, ge=0)
    monthly_volume_color: int | None = Field(default=None, ge=0)


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    phone: str
    company: str
    cnpj: str
    source: str
    status: LeadStatus
    score: int
    notes: str
    interest: LeadInterest
    current_provider: str
    contract_renewal: date | None
    printer_count: int
    monthly_volume_mono: int
    monthly_volume_color: int
    converted_at: UTCDateTime | None
    converted_contact_id: uuid.UUID | None
    converted_opportunity_id: uuid.UUID | None
    created_at: UTCDateTime
    updated_at: UTCDateTime


class LeadConvertIn(BaseModel):
    create_opportunity: bool = True
    opportunity_title: str | None = None
    value: float | None = None
    stage_id: uuid.UUID | None = None
    account_name: str | None = None
    contract_months: int = Field(default=12, ge=1, le=120)


class LeadConvertOut(BaseModel):
    lead: LeadOut
    contact: ContactOut
    opportunity: OpportunityOut | None = None
