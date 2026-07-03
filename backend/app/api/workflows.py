import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, get_current_user
from app.models import WorkflowExecution, WorkflowRule
from app.schemas.workflow import (
    WorkflowExecutionOut,
    WorkflowRuleCreate,
    WorkflowRuleOut,
    WorkflowRuleUpdate,
)
from app.services.workflow_engine import ACTION_TYPES, TRIGGERS

router = APIRouter(
    prefix="/workflows", tags=["workflows"], dependencies=[Depends(get_current_user)]
)


@router.get("/meta")
async def workflow_meta():
    """Triggers disponíveis (com campos para condições) e tipos de ação (com parâmetros)."""
    return {"triggers": TRIGGERS, "actions": ACTION_TYPES}


@router.get("", response_model=list[WorkflowRuleOut])
async def list_rules(db: DbSession):
    return (await db.scalars(select(WorkflowRule).order_by(WorkflowRule.created_at))).all()


@router.post("", response_model=WorkflowRuleOut, status_code=status.HTTP_201_CREATED)
async def create_rule(data: WorkflowRuleCreate, db: DbSession):
    if data.trigger_event not in TRIGGERS:
        raise HTTPException(422, f"trigger_event deve ser um de: {', '.join(TRIGGERS)}")
    rule = WorkflowRule(
        name=data.name,
        trigger_event=data.trigger_event,
        conditions=[c.model_dump() for c in data.conditions],
        actions=[a.model_dump() for a in data.actions],
        is_active=data.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/{rule_id}", response_model=WorkflowRuleOut)
async def get_rule(rule_id: uuid.UUID, db: DbSession):
    rule = await db.get(WorkflowRule, rule_id)
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Regra não encontrada")
    return rule


@router.patch("/{rule_id}", response_model=WorkflowRuleOut)
async def update_rule(rule_id: uuid.UUID, data: WorkflowRuleUpdate, db: DbSession):
    rule = await db.get(WorkflowRule, rule_id)
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Regra não encontrada")
    updates = data.model_dump(exclude_unset=True)
    if "trigger_event" in updates and updates["trigger_event"] not in TRIGGERS:
        raise HTTPException(422, "trigger_event inválido")
    for field, value in updates.items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: uuid.UUID, db: DbSession):
    rule = await db.get(WorkflowRule, rule_id)
    if rule is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Regra não encontrada")
    await db.delete(rule)
    await db.commit()


@router.get("/{rule_id}/executions", response_model=list[WorkflowExecutionOut])
async def list_executions(rule_id: uuid.UUID, db: DbSession, limit: int = 50):
    return (
        await db.scalars(
            select(WorkflowExecution)
            .where(WorkflowExecution.rule_id == rule_id)
            .order_by(WorkflowExecution.executed_at.desc())
            .limit(min(limit, 200))
        )
    ).all()
