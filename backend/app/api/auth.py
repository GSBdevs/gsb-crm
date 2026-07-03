import uuid

import jwt
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession
from app.core.security import create_token_pair, decode_token, hash_password, verify_password
from app.models import User, UserRole
from app.schemas.auth import BootstrapIn, LoginIn, RefreshIn, TokenPair, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
async def login(data: LoginIn, db: DbSession):
    user = await db.scalar(select(User).where(User.email == data.email))
    if user is None or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou senha incorretos")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário desativado")
    return create_token_pair(str(user.id))


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshIn, db: DbSession):
    try:
        payload = decode_token(data.refresh_token, "refresh")
        user_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Refresh token inválido ou expirado"
        ) from None
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário inválido")
    return create_token_pair(str(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user


@router.post("/bootstrap", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def bootstrap(data: BootstrapIn, db: DbSession):
    """Cria o primeiro usuário (admin). Disponível apenas com a base vazia."""
    count = await db.scalar(select(func.count()).select_from(User))
    if count:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existem usuários cadastrados")
    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=hash_password(data.password),
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.commit()
    return create_token_pair(str(user.id))
