import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, get_current_user
from app.models import Opportunity, PipelineStage, utcnow
from app.schemas.pipeline import (
    OpportunityBoardItem,
    OpportunityCreate,
    OpportunityMoveIn,
    OpportunityOut,
    OpportunityUpdate,
)
from app.services import events

router = APIRouter(
    prefix="/opportunities", tags=["pipeline"], dependencies=[Depends(get_current_user)]
)


async def _get_or_404(db: DbSession, opportunity_id: uuid.UUID) -> Opportunity:
    opp = await db.get(Opportunity, opportunity_id)
    if opp is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Oportunidade não encontrada")
    return opp


@router.get("", response_model=list[OpportunityBoardItem])
async def list_opportunities(
    db: DbSession,
    stage_id: uuid.UUID | None = None,
    q: str = "",
    open_only: bool = False,
):
    stmt = (
        select(Opportunity)
        .options(selectinload(Opportunity.contact), selectinload(Opportunity.account))
        .order_by(Opportunity.position, Opportunity.created_at)
    )
    if stage_id:
        stmt = stmt.where(Opportunity.stage_id == stage_id)
    if q:
        stmt = stmt.where(Opportunity.title.ilike(f"%{q}%"))
    if open_only:
        stmt = stmt.join(PipelineStage, Opportunity.stage_id == PipelineStage.id).where(
            PipelineStage.is_won.is_(False), PipelineStage.is_lost.is_(False)
        )
    opps = (await db.scalars(stmt)).all()
    return [
        OpportunityBoardItem(
            **OpportunityOut.model_validate(o).model_dump(),
            contact_name=o.contact.full_name if o.contact else None,
            account_name=o.account.name if o.account else None,
        )
        for o in opps
    ]


@router.post("", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
async def create_opportunity(data: OpportunityCreate, db: DbSession):
    stage = await db.get(PipelineStage, data.stage_id)
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estágio não encontrado")
    payload = data.model_dump()
    if payload.get("probability") is None:
        payload["probability"] = stage.probability
    opp = Opportunity(**payload)
    db.add(opp)
    await db.commit()
    await db.refresh(opp)
    await events.dispatch(
        "opportunity.created",
        "opportunity",
        opp.id,
        events.opportunity_payload(opp, stage.name),
    )
    return opp


@router.get("/{opportunity_id}", response_model=OpportunityOut)
async def get_opportunity(opportunity_id: uuid.UUID, db: DbSession):
    return await _get_or_404(db, opportunity_id)


@router.patch("/{opportunity_id}", response_model=OpportunityOut)
async def update_opportunity(opportunity_id: uuid.UUID, data: OpportunityUpdate, db: DbSession):
    opp = await _get_or_404(db, opportunity_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(opp, field, value)
    await db.commit()
    await db.refresh(opp)
    return opp


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_opportunity(opportunity_id: uuid.UUID, db: DbSession):
    opp = await _get_or_404(db, opportunity_id)
    await db.delete(opp)
    await db.commit()


@router.patch("/{opportunity_id}/move", response_model=OpportunityOut)
async def move_opportunity(opportunity_id: uuid.UUID, data: OpportunityMoveIn, db: DbSession):
    """Move a oportunidade entre estágios (Kanban) e reordena a coluna de destino."""
    opp = await _get_or_404(db, opportunity_id)
    new_stage = await db.get(PipelineStage, data.stage_id)
    if new_stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estágio de destino não encontrado")
    old_stage = await db.get(PipelineStage, opp.stage_id)
    stage_changed = opp.stage_id != new_stage.id

    opp.stage_id = new_stage.id
    if stage_changed:
        opp.probability = new_stage.probability
    opp.closed_at = utcnow() if (new_stage.is_won or new_stage.is_lost) else None

    siblings = list(
        (
            await db.scalars(
                select(Opportunity)
                .where(Opportunity.stage_id == new_stage.id, Opportunity.id != opp.id)
                .order_by(Opportunity.position, Opportunity.created_at)
            )
        ).all()
    )
    position = max(0, min(data.position, len(siblings)))
    siblings.insert(position, opp)
    for index, sibling in enumerate(siblings):
        sibling.position = index

    await db.commit()
    await db.refresh(opp)

    if stage_changed:
        payload = events.opportunity_payload(
            opp,
            new_stage.name,
            old_stage=old_stage.name if old_stage else "",
            new_stage=new_stage.name,
        )
        await events.dispatch("opportunity.stage_changed", "opportunity", opp.id, payload)
        if new_stage.is_won:
            await events.dispatch("opportunity.won", "opportunity", opp.id, payload)
        if new_stage.is_lost:
            await events.dispatch("opportunity.lost", "opportunity", opp.id, payload)
    return opp
