import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import jwt
from pwdlib import PasswordHash

from app.core.config import settings

ALGORITHM = "HS256"

_password_hash = PasswordHash.recommended()  # Argon2id


def hash_password(plain: str) -> str:
    return _password_hash.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _password_hash.verify(plain, hashed)


TokenType = Literal["access", "refresh"]


def _create_token(
    subject: str, token_type: TokenType, expires_delta: timedelta, jti: str | None = None
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": jti or uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_token_pair(user_id: str) -> dict[str, Any]:
    """Gera o par access+refresh. O jti do refresh é exposto para persistência
    (revogação/rotação); campos extras são filtrados pelo response_model."""
    refresh_jti = uuid.uuid4().hex
    refresh_expires = timedelta(days=settings.refresh_token_expire_days)
    access = _create_token(
        user_id, "access", timedelta(minutes=settings.access_token_expire_minutes)
    )
    refresh = _create_token(user_id, "refresh", refresh_expires, jti=refresh_jti)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "refresh_jti": refresh_jti,
        "refresh_expires_at": datetime.now(timezone.utc) + refresh_expires,
    }


def decode_token(token: str, expected_type: TokenType) -> dict[str, Any]:
    """Decodifica e valida o token. Levanta jwt.InvalidTokenError se inválido/expirado."""
    payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"esperado token '{expected_type}'")
    return payload
