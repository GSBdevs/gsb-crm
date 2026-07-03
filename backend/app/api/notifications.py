import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select, update

from app.core.deps import CurrentUser, DbSession
from app.models import Notification
from app.schemas.notification import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _visible_to(user_id: uuid.UUID):
    # user_id nulo = broadcast para a equipe toda (leitura é global nesta escala)
    return or_(Notification.user_id == user_id, Notification.user_id.is_(None))


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    db: DbSession, user: CurrentUser, unread_only: bool = False, limit: int = 30
):
    stmt = (
        select(Notification)
        .where(_visible_to(user.id))
        .order_by(Notification.created_at.desc())
        .limit(min(limit, 100))
    )
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return (await db.scalars(stmt)).all()


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(db: DbSession, user: CurrentUser):
    count = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(_visible_to(user.id), Notification.is_read.is_(False))
    )
    return {"count": count or 0}


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(notification_id: uuid.UUID, db: DbSession, user: CurrentUser):
    notification = await db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notificação não encontrada")
    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return notification


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(db: DbSession, user: CurrentUser):
    await db.execute(
        update(Notification).where(_visible_to(user.id)).values(is_read=True)
    )
    await db.commit()
