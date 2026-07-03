"""Conversão de lead: Lead -> Contact (+ Account opcional) + Opportunity."""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, Contact, Lead, LeadStatus, Opportunity, PipelineStage, utcnow
from app.models.lead import LeadInterest
from app.models.pipeline import ServiceType
from app.schemas.lead import LeadConvertIn
from app.services import events


def _split_name(full: str) -> tuple[str, str]:
    parts = full.strip().split(maxsplit=1)
    return (parts[0], parts[1] if len(parts) > 1 else "") if parts else ("(sem nome)", "")


async def convert_lead(
    db: AsyncSession, lead: Lead, data: LeadConvertIn
) -> tuple[Contact, Opportunity | None]:
    if lead.status == LeadStatus.CONVERTED:
        raise HTTPException(status.HTTP_409_CONFLICT, "Lead já foi convertido")

    account: Account | None = None
    account_name = (data.account_name or lead.company or "").strip()
    if account_name:
        account = await db.scalar(select(Account).where(Account.name == account_name))
        if account is None:
            account = Account(name=account_name)
            db.add(account)
            await db.flush()

    first, last = _split_name(lead.name)
    existing_email = None
    if lead.email:
        existing_email = await db.scalar(select(Contact).where(Contact.email == lead.email))
    if existing_email is not None:
        contact = existing_email  # evita violar unicidade de email; reaproveita o contato
    else:
        contact = Contact(
            first_name=first,
            last_name=last,
            email=lead.email or None,
            phone=lead.phone,
            score=lead.score,
            account_id=account.id if account else None,
        )
        db.add(contact)
        await db.flush()

    opportunity: Opportunity | None = None
    stage: PipelineStage | None = None
    if data.create_opportunity:
        if data.stage_id:
            stage = await db.get(PipelineStage, data.stage_id)
        if stage is None:
            stage = await db.scalar(
                select(PipelineStage)
                .where(PipelineStage.is_won.is_(False), PipelineStage.is_lost.is_(False))
                .order_by(PipelineStage.position)
                .limit(1)
            )
        if stage is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Nenhum estágio de pipeline cadastrado — crie os estágios antes de converter",
            )
        # O interesse do lead define a linha de serviço da oportunidade.
        service_type = {
            LeadInterest.PRINTER_RENTAL: ServiceType.PRINTER_RENTAL,
            LeadInterest.IT_OUTSOURCING: ServiceType.IT_OUTSOURCING,
            LeadInterest.BOTH: ServiceType.MIXED,
        }[lead.interest]
        opportunity = Opportunity(
            title=data.opportunity_title or f"Oportunidade — {lead.name}",
            value=data.value or 0,
            probability=stage.probability,
            stage_id=stage.id,
            contact_id=contact.id,
            account_id=account.id if account else None,
            service_type=service_type,
            contract_months=data.contract_months,
        )
        db.add(opportunity)
        await db.flush()

    lead.status = LeadStatus.CONVERTED
    lead.converted_at = utcnow()
    lead.converted_contact_id = contact.id
    lead.converted_opportunity_id = opportunity.id if opportunity else None

    await db.commit()
    await db.refresh(contact)
    if opportunity:
        await db.refresh(opportunity)
    await db.refresh(lead)

    await events.dispatch("lead.converted", "lead", lead.id, events.lead_payload(lead))
    if opportunity and stage:
        await events.dispatch(
            "opportunity.created",
            "opportunity",
            opportunity.id,
            events.opportunity_payload(opportunity, stage.name),
        )
    return contact, opportunity
