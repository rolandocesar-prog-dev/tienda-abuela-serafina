"""
JWT utilities + FastAPI dependency `verify_jwt`.

Otros servicios que quieran validar tokens solo necesitan:
  1. Copiar verify_jwt (ver docs/jwt-middleware.md)
  2. Agregar python-jose[cryptography] a su requirements.txt
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

_bearer = HTTPBearer(auto_error=False)


def create_access_token(sub: str, rol: str, sucursal_id: str | None = None) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": sub,
        "rol": rol,
        "sucursal_id": sucursal_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o expirado: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def verify_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    """
    Dependency reutilizable.  Retorna el payload JWT si el token es válido.
    Payload incluye: sub (user_id), rol, exp, iat, jti.

    Uso en cualquier router:
        router = APIRouter(dependencies=[Depends(verify_jwt)])
    O en un endpoint individual:
        async def mi_endpoint(payload = Depends(verify_jwt)):
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación (Bearer token)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode(credentials.credentials)


def require_rol(*roles: str):
    """
    Dependency factory que exige uno o más roles específicos.

    Uso:
        @router.delete("/{id}", dependencies=[Depends(require_rol("Administrador"))])
    """
    async def _check(payload: dict = Depends(verify_jwt)) -> dict:
        if payload.get("rol") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere rol: {', '.join(roles)}",
            )
        return payload
    return _check
