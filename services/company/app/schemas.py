import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BranchCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    ciudad: str = Field(..., min_length=1, max_length=100)
    direccion: str | None = Field(None, max_length=300)


class BranchUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=200)
    ciudad: str | None = Field(None, min_length=1, max_length=100)
    direccion: str | None = None
    activo: bool | None = None


class BranchOut(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    nombre: str
    ciudad: str
    direccion: str | None
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class CompanyCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    nit: str = Field(..., min_length=1, max_length=50)


class CompanyUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=200)
    activo: bool | None = None


class CompanyOut(BaseModel):
    id: uuid.UUID
    nombre: str
    nit: str
    fecha_creacion: datetime
    activo: bool
    branches: list[BranchOut] = []

    model_config = ConfigDict(from_attributes=True)
