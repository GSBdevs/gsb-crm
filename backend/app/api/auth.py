import uuid

import jwt
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession
from app.core.security import create_token_pair, decode_token, hash_password, verify_password
from app.models import RefreshToken, User, UserRole, utcnow
from app.schemas.auth import BootstrapIn, LoginIn, RefreshIn, TokenPair, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


async def _issue_tokens(db: DbSession, user: User) -> dict:
    """Gera o par de tokens e persiste o jti do refresh para rotação/revogação."""
    pair = create_token_pair(str(user.id))
    db.add(
        RefreshToken(
            user_id=user.id, jti=pair["refresh_jti"], expires_at=pair["refresh_expires_at"]
        )
    )
    await db.commit()
    return pair


@router.post("/login", response_model=TokenPair)
async def login(data: LoginIn, db: DbSession):
    user = await db.scalar(select(User).where(User.email == data.email))
    if user is None or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou senha incorretos")
    if not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário desativado")
    return await _issue_tokens(db, user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(data: RefreshIn, db: DbSession):
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token inválido ou expirado")
    try:
        payload = decode_token(data.refresh_token, "refresh")
        user_id = uuid.UUID(payload["sub"])
        jti = payload["jti"]
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise unauthorized from None

    token_row = await db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))
    if token_row is None or token_row.revoked_at is not None:
        raise unauthorized

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized

    # Rotação: o refresh usado é revogado e um novo par é emitido.
    token_row.revoked_at = utcnow()
    return await _issue_tokens(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(data: RefreshIn, db: DbSession):
    """Revoga o refresh token da sessão. Idempotente — token inválido não gera erro."""
    try:
        payload = decode_token(data.refresh_token, "refresh")
        jti = payload["jti"]
    except (jwt.InvalidTokenError, KeyError):
        return
    token_row = await db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))
    if token_row is not None and token_row.revoked_at is None:
        token_row.revoked_at = utcnow()
        await db.commit()


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
    return await _issue_tokens(db, user)
