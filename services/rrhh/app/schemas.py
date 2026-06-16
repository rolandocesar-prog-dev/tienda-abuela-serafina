import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class EmpleadoBase(BaseModel):
    nombre: str
    apellido: str
    ci: str
    cargo: str
    fecha_ingreso: date
    salario: Decimal = Field(..., ge=0)
    agencia_id: uuid.UUID


class EmpleadoCreate(EmpleadoBase):
    pass


class EmpleadoUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    cargo: str | None = None
    salario: Decimal | None = Field(None, ge=0)
    activo: bool | None = None


class EmpleadoOut(EmpleadoBase):
    id: uuid.UUID
    activo: bool
    model_config = ConfigDict(from_attributes=True)


class CambioAgencia(BaseModel):
    agencia_id: uuid.UUID


class AgenciaOut(BaseModel):
    id: uuid.UUID
    sucursal_id: uuid.UUID
    nombre: str
    codigo: str
    model_config = ConfigDict(from_attributes=True)
