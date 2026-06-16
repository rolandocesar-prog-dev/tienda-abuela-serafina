import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CustomerCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    ci_nit: str = Field(..., min_length=1, max_length=50)
    email: str | None = None
    telefono: str | None = None


class CustomerUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=200)
    email: str | None = None
    telefono: str | None = None
    activo: bool | None = None


class CustomerOut(BaseModel):
    id: uuid.UUID
    nombre: str
    ci_nit: str
    email: str | None
    telefono: str | None
    fecha_registro: datetime
    puntos_acumulados: int
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class PuntosCreate(BaseModel):
    puntos: int = Field(..., description="Positivo para acumular, negativo para canjear")
    motivo: str = Field(..., min_length=1, max_length=300)


class PuntosHistorialOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    fecha: datetime
    motivo: str
    puntos: int
    saldo_posterior: int

    model_config = ConfigDict(from_attributes=True)
