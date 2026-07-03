import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select

from app.core.deps import DbSession, get_current_user
from app.core.pagination import paginate
from app.models import Lead, LeadStatus
from app.schemas.common import Page
from app.schemas.lead import LeadConvertIn, LeadConvertOut, LeadCreate, LeadOut, LeadUpdate
from app.services import events
from app.services.lead_service import convert_lead

router = APIRouter(prefix="/leads", tags=["leads"], dependencies=[Depends(get_current_user)])


async def _get_or_404(db: DbSession, lead_id: uuid.UUID) -> Lead:
    lead = await db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead não encontrado")
    return lead


@router.get("", response_model=Page[LeadOut])
async def list_leads(
    db: DbSession,
    q: str = "",
    lead_status: LeadStatus | None = None,
    page: int = 1,
    size: int = 20,
):
    stmt = select(Lead).order_by(Lead.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(Lead.name.ilike(like), Lead.email.ilike(like), Lead.company.ilike(like))
        )
    if lead_status:
        stmt = stmt.where(Lead.status == lead_status)
    return await paginate(db, stmt, page, size)


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
async def create_lead(data: LeadCreate, db: DbSession):
    lead = Lead(**data.model_dump())
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    await events.dispatch("lead.created", "lead", lead.id, events.lead_payload(lead))
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
async def get_lead(lead_id: uuid.UUID, db: DbSession):
    return await _get_or_404(db, lead_id)


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: uuid.UUID, data: LeadUpdate, db: DbSession):
    lead = await _get_or_404(db, lead_id)
    old_status = lead.status
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    await db.commit()
    await db.refresh(lead)
    if lead.status != old_status:
        await events.dispatch(
            "lead.status_changed",
            "lead",
            lead.id,
            events.lead_payload(
                lead, old_status=str(old_status), new_status=str(lead.status)
            ),
        )
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: uuid.UUID, db: DbSession):
    lead = await _get_or_404(db, lead_id)
    await db.delete(lead)
    await db.commit()


@router.post("/{lead_id}/convert", response_model=LeadConvertOut)
async def convert(lead_id: uuid.UUID, data: LeadConvertIn, db: DbSession):
    """Converte o lead: cria Contact (+ Account pela empresa) e opcionalmente Opportunity."""
    lead = await _get_or_404(db, lead_id)
    contact, opportunity = await convert_lead(db, lead, data)
    return {"lead": lead, "contact": contact, "opportunity": opportunity}
