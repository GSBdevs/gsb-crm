import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.core.deps import CurrentUser, DbSession, get_current_user
from app.core.pagination import paginate
from app.models import Activity, Contact, Lead, Opportunity, utcnow
from app.schemas.activity import ActivityCreate, ActivityOut, ActivityUpdate
from app.schemas.common import Page

router = APIRouter(
    prefix="/activities", tags=["activities"], dependencies=[Depends(get_current_user)]
)

_ENTITY_MODELS = {"lead": Lead, "contact": Contact, "opportunity": Opportunity}


async def _entity_labels(db: DbSession, activities: list[Activity]) -> dict[uuid.UUID, str]:
    """Resolve nomes das entidades ligadas (em lote, por tipo)."""
    labels: dict[uuid.UUID, str] = {}
    for entity_type, model in _ENTITY_MODELS.items():
        ids = {a.entity_id for a in activities if a.entity_type == entity_type and a.entity_id}
        if not ids:
            continue
        rows = (await db.scalars(select(model).where(model.id.in_(ids)))).all()
        for row in rows:
            name = getattr(row, "full_name", None) or getattr(row, "name", None) or getattr(
                row, "title", ""
            )
            labels[row.id] = name
    return labels


def _to_out(activity: Activity, labels: dict[uuid.UUID, str]) -> ActivityOut:
    out = ActivityOut.model_validate(activity)
    if activity.entity_id:
        out.entity_label = labels.get(activity.entity_id)
    return out


@router.get("", response_model=Page[ActivityOut])
async def list_activities(
    db: DbSession,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    state: Literal["open", "done", "overdue", "all"] = "all",
    page: int = 1,
    size: int = 50,
):
    stmt = select(Activity).order_by(
        Activity.done_at.is_not(None), Activity.due_at.asc().nulls_last(), Activity.created_at
    )
    if entity_type:
        stmt = stmt.where(Activity.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(Activity.entity_id == entity_id)
    if state == "open":
        stmt = stmt.where(Activity.done_at.is_(None))
    elif state == "done":
        stmt = stmt.where(Activity.done_at.is_not(None))
    elif state == "overdue":
        stmt = stmt.where(Activity.done_at.is_(None), Activity.due_at < utcnow())

    result = await paginate(db, stmt, page, size)
    labels = await _entity_labels(db, result["items"])
    result["items"] = [_to_out(a, labels) for a in result["items"]]
    return result


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
async def create_activity(data: ActivityCreate, db: DbSession, user: CurrentUser):
    if data.entity_type and data.entity_type not in _ENTITY_MODELS:
        raise HTTPException(
            422, f"entity_type deve ser um de: {', '.join(_ENTITY_MODELS)}"
        )
    activity = Activity(**data.model_dump(), user_id=user.id)
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    labels = await _entity_labels(db, [activity])
    return _to_out(activity, labels)


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(activity_id: uuid.UUID, data: ActivityUpdate, db: DbSession):
    activity = await db.get(Activity, activity_id)
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atividade não encontrada")
    updates = data.model_dump(exclude_unset=True)
    done = updates.pop("done", None)
    if done is not None:
        activity.done_at = utcnow() if done else None
    for field, value in updates.items():
        setattr(activity, field, value)
    await db.commit()
    await db.refresh(activity)
    labels = await _entity_labels(db, [activity])
    return _to_out(activity, labels)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(activity_id: uuid.UUID, db: DbSession):
    activity = await db.get(Activity, activity_id)
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Atividade não encontrada")
    await db.delete(activity)
    await db.commit()
