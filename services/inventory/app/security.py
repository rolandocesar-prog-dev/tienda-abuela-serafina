"""
JWT verification dependency — copiado desde auth service.
Solo valida tokens; la emisión queda en auth service.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

_bearer = HTTPBearer(auto_error=False)


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
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación (Bearer token)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode(credentials.credentials)


def require_rol(*roles: str):
    async def _check(payload: dict = Depends(verify_jwt)) -> dict:
        if payload.get("rol") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere rol: {', '.join(roles)}",
            )
        return payload
    return _check
