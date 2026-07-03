import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select

from app.core.deps import DbSession, get_current_user
from app.core.pagination import paginate
from app.models import Contact
from app.schemas.common import Page
from app.schemas.contact import ContactCreate, ContactOut, ContactUpdate

router = APIRouter(
    prefix="/contacts", tags=["contacts"], dependencies=[Depends(get_current_user)]
)


async def _ensure_unique_email(db: DbSession, email: str | None, ignore_id: uuid.UUID | None):
    if not email:
        return
    stmt = select(Contact).where(Contact.email == email)
    if ignore_id:
        stmt = stmt.where(Contact.id != ignore_id)
    if await db.scalar(stmt):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um contato com este email")


@router.get("", response_model=Page[ContactOut])
async def list_contacts(
    db: DbSession,
    q: str = "",
    account_id: uuid.UUID | None = None,
    page: int = 1,
    size: int = 20,
):
    stmt = select(Contact).order_by(Contact.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Contact.first_name.ilike(like),
                Contact.last_name.ilike(like),
                Contact.email.ilike(like),
            )
        )
    if account_id:
        stmt = stmt.where(Contact.account_id == account_id)
    return await paginate(db, stmt, page, size)


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact(data: ContactCreate, db: DbSession):
    await _ensure_unique_email(db, data.email, None)
    contact = Contact(**data.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(contact_id: uuid.UUID, db: DbSession):
    contact = await db.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contato não encontrado")
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(contact_id: uuid.UUID, data: ContactUpdate, db: DbSession):
    contact = await db.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contato não encontrado")
    updates = data.model_dump(exclude_unset=True)
    if "email" in updates:
        await _ensure_unique_email(db, updates["email"], contact_id)
    for field, value in updates.items():
        setattr(contact, field, value)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: uuid.UUID, db: DbSession):
    contact = await db.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contato não encontrado")
    await db.delete(contact)
    await db.commit()
