import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductoBase(BaseModel):
    codigo: str = Field(..., max_length=50)
    nombre: str = Field(..., max_length=200)
    descripcion: str | None = Field(None, max_length=500)
    categoria: str = Field(..., max_length=100)
    unidad_medida: str = Field(..., max_length=20)
    precio_base: Decimal = Field(..., ge=0)


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    categoria: str | None = None
    unidad_medida: str | None = None
    precio_base: Decimal | None = Field(None, ge=0)


class ProductoOut(ProductoBase):
    id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)
