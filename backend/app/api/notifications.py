import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DbSession
from app.models import Notification, NotificationRead
from app.schemas.notification import NotificationOut, UnreadCountOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _visible_to(user_id: uuid.UUID):
    # user_id nulo = broadcast para a equipe toda; leitura é individual (NotificationRead)
    return or_(Notification.user_id == user_id, Notification.user_id.is_(None))


async def _read_ids(db: AsyncSession, user_id: uuid.UUID) -> set[uuid.UUID]:
    rows = await db.scalars(
        select(NotificationRead.notification_id).where(NotificationRead.user_id == user_id)
    )
    return set(rows.all())


def _is_read(notification: Notification, read_ids: set[uuid.UUID]) -> bool:
    if notification.user_id is not None:
        return notification.is_read
    return notification.id in read_ids


def _to_out(notification: Notification, read_ids: set[uuid.UUID]) -> NotificationOut:
    out = NotificationOut.model_validate(notification)
    out.is_read = _is_read(notification, read_ids)
    return out


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    db: DbSession, user: CurrentUser, unread_only: bool = False, limit: int = 30
):
    read_ids = await _read_ids(db, user.id)
    stmt = (
        select(Notification)
        .where(_visible_to(user.id))
        .order_by(Notification.created_at.desc())
        .limit(min(limit, 100))
    )
    items = [_to_out(n, read_ids) for n in (await db.scalars(stmt)).all()]
    if unread_only:
        items = [n for n in items if not n.is_read]
    return items


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(db: DbSession, user: CurrentUser):
    read_ids = await _read_ids(db, user.id)
    personal_unread = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
    )
    broadcast_ids = (
        await db.scalars(select(Notification.id).where(Notification.user_id.is_(None)))
    ).all()
    broadcast_unread = sum(1 for nid in broadcast_ids if nid not in read_ids)
    return {"count": (personal_unread or 0) + broadcast_unread}


async def _mark_read(db: AsyncSession, notification: Notification, user_id: uuid.UUID) -> None:
    if notification.user_id is not None:
        notification.is_read = True
    else:
        exists = await db.scalar(
            select(NotificationRead).where(
                NotificationRead.notification_id == notification.id,
                NotificationRead.user_id == user_id,
            )
        )
        if exists is None:
            db.add(NotificationRead(notification_id=notification.id, user_id=user_id))


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(notification_id: uuid.UUID, db: DbSession, user: CurrentUser):
    notification = await db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notificação não encontrada")
    await _mark_read(db, notification, user.id)
    await db.commit()
    await db.refresh(notification)
    return _to_out(notification, await _read_ids(db, user.id))


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(db: DbSession, user: CurrentUser):
    notifications = (
        await db.scalars(select(Notification).where(_visible_to(user.id)))
    ).all()
    read_ids = await _read_ids(db, user.id)
    for notification in notifications:
        if not _is_read(notification, read_ids):
            await _mark_read(db, notification, user.id)
    await db.commit()
