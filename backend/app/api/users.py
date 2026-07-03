import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DbSession, require_roles
from app.core.security import hash_password
from app.models import User, UserRole
from app.schemas.auth import UserCreate, UserOut, UserUpdate

router = APIRouter(
    prefix="/users", tags=["users"], dependencies=[require_roles(UserRole.ADMIN)]
)


@router.get("", response_model=list[UserOut])
async def list_users(db: DbSession):
    return (await db.scalars(select(User).order_by(User.created_at))).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(data: UserCreate, db: DbSession):
    if await db.scalar(select(User).where(User.email == data.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email já cadastrado")
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(user_id: uuid.UUID, data: UserUpdate, db: DbSession):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")
    updates = data.model_dump(exclude_unset=True)
    if password := updates.pop("password", None):
        user.hashed_password = hash_password(password)
    for field, value in updates.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user
