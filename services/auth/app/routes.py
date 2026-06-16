import logging
import uuid

import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Usuario
from app.schemas import LoginIn, TokenOut, UsuarioCreate, UsuarioOut
from app.security import create_access_token, require_rol, verify_jwt

logger = logging.getLogger("auth.routes")

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def _verify(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


@router.post("/register", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def registrar(payload: UsuarioCreate, db: AsyncSession = Depends(get_db)) -> Usuario:
    user = Usuario(
        username=payload.username,
        email=payload.email,
        password_hash=_hash(payload.password),
        rol=payload.rol,
    )
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El username o email ya existe",
        )
    logger.info("Usuario creado: %s (%s)", user.username, user.rol)
    return user


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    result = await db.execute(select(Usuario).where(Usuario.username == payload.username))
    user: Usuario | None = result.scalar_one_or_none()

    if user is None or not user.activo or not _verify(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(sub=str(user.id), rol=user.rol.value)
    return TokenOut(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        usuario=UsuarioOut.model_validate(user),
    )


@router.get("/me", response_model=UsuarioOut)
async def perfil(
    jwt_payload: dict = Depends(verify_jwt),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    user = await db.get(Usuario, uuid.UUID(jwt_payload["sub"]))
    if user is None or not user.activo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.get("/users", response_model=list[UsuarioOut])
async def listar_usuarios(
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> list[Usuario]:
    result = await db.execute(select(Usuario).order_by(Usuario.fecha_creacion))
    return list(result.scalars().all())


@router.patch("/users/{user_id}/desactivar", response_model=UsuarioOut)
async def desactivar_usuario(
    user_id: uuid.UUID,
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    user = await db.get(Usuario, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    user.activo = False
    await db.commit()
    await db.refresh(user)
    return user
