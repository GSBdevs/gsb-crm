import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select

from app.core.deps import DbSession, get_current_user
from app.core.pagination import paginate
from app.models import Account
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate
from app.schemas.common import Page

router = APIRouter(
    prefix="/accounts", tags=["accounts"], dependencies=[Depends(get_current_user)]
)


@router.get("", response_model=Page[AccountOut])
async def list_accounts(db: DbSession, q: str = "", page: int = 1, size: int = 20):
    stmt = select(Account).order_by(Account.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Account.name.ilike(like), Account.domain.ilike(like)))
    return await paginate(db, stmt, page, size)


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(data: AccountCreate, db: DbSession):
    account = Account(**data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(account_id: uuid.UUID, db: DbSession):
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta não encontrada")
    return account


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(account_id: uuid.UUID, data: AccountUpdate, db: DbSession):
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta não encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: uuid.UUID, db: DbSession):
    account = await db.get(Account, account_id)
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conta não encontrada")
    await db.delete(account)
    await db.commit()
