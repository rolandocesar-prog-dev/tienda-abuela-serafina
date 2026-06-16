import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import Rol


class UsuarioCreate(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    email: EmailStr
    password: str = Field(min_length=6)
    rol: Rol = Rol.cajero


class UsuarioOut(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    rol: Rol
    activo: bool
    fecha_creacion: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # segundos
    usuario: UsuarioOut
