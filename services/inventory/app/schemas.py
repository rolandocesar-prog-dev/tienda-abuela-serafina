import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import TipoMovimiento


# ---------- Stock / Balance ----------
class StockOut(BaseModel):
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int

    model_config = ConfigDict(from_attributes=True)


class BalancePorSucursalOut(BaseModel):
    """Saldo total por sucursal (paso 10 de la demo del PDF)."""
    agencia_id: uuid.UUID
    codigo_agencia: str
    total_productos_distintos: int
    total_unidades: int


class StockProductoOut(BaseModel):
    """Saldo de UN producto en todas las sucursales (GET /inventory/{product})."""
    producto_id: uuid.UUID
    detalle: list[StockOut]
    total: int


# ---------- Movimientos genéricos (kardex) ----------
class MovimientoCreate(BaseModel):
    tipo: TipoMovimiento
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)
    referencia: str | None = None


class MovimientoOut(BaseModel):
    id: uuid.UUID
    tipo: TipoMovimiento
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    referencia: str | None
    fecha: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Endpoints semánticos del PDF ----------
class InputIn(BaseModel):
    """POST /inventory/input — ingreso de mercaderia (paso de demo)."""
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)
    referencia: str | None = Field(None, description="opcional: ej 'orden:UUID' o 'recepcion:NN'")


class OutputIn(BaseModel):
    """POST /inventory/output — salida (venta, baja por perdida o vencimiento)."""
    agencia_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)
    motivo: str | None = Field(None, description="ej: 'venta', 'baja:vencimiento', 'baja:perdida'")


class TransferIn(BaseModel):
    """POST /inventory/transfer — movimiento entre sucursales (paso 9 del PDF)."""
    sucursal_origen_id: uuid.UUID
    sucursal_destino_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int = Field(..., gt=0)


class TransferOut(BaseModel):
    movimiento_salida_id: uuid.UUID
    movimiento_entrada_id: uuid.UUID
    producto_id: uuid.UUID
    cantidad: int
    sucursal_origen_id: uuid.UUID
    sucursal_destino_id: uuid.UUID


# ---------- Excel import ----------
class LoadExcelOut(BaseModel):
    filas_procesadas: int
    filas_con_error: int
    productos_no_encontrados: list[str] = []
    errores: list[str] = []
