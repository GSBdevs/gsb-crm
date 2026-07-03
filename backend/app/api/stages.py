import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import DbSession, get_current_user, require_roles
from app.models import Opportunity, PipelineStage, UserRole
from app.schemas.pipeline import StageCreate, StageOut, StageReorderIn, StageUpdate

router = APIRouter(prefix="/stages", tags=["pipeline"], dependencies=[Depends(get_current_user)])

_manage = require_roles(UserRole.ADMIN, UserRole.MANAGER)


@router.get("", response_model=list[StageOut])
async def list_stages(db: DbSession):
    return (await db.scalars(select(PipelineStage).order_by(PipelineStage.position))).all()


@router.post(
    "", response_model=StageOut, status_code=status.HTTP_201_CREATED, dependencies=[_manage]
)
async def create_stage(data: StageCreate, db: DbSession):
    stage = PipelineStage(**data.model_dump())
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage


@router.patch("/{stage_id}", response_model=StageOut, dependencies=[_manage])
async def update_stage(stage_id: uuid.UUID, data: StageUpdate, db: DbSession):
    stage = await db.get(PipelineStage, stage_id)
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estágio não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(stage, field, value)
    await db.commit()
    await db.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[_manage])
async def delete_stage(stage_id: uuid.UUID, db: DbSession):
    stage = await db.get(PipelineStage, stage_id)
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Estágio não encontrado")
    in_use = await db.scalar(
        select(func.count()).select_from(Opportunity).where(Opportunity.stage_id == stage_id)
    )
    if in_use:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Estágio possui {in_use} oportunidade(s); mova-as antes de excluir",
        )
    await db.delete(stage)
    await db.commit()


@router.post("/reorder", response_model=list[StageOut], dependencies=[_manage])
async def reorder_stages(data: StageReorderIn, db: DbSession):
    stages = (await db.scalars(select(PipelineStage))).all()
    by_id = {s.id: s for s in stages}
    for position, stage_id in enumerate(data.stage_ids):
        if stage_id in by_id:
            by_id[stage_id].position = position
    await db.commit()
    return (await db.scalars(select(PipelineStage).order_by(PipelineStage.position))).all()
