import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Numeric, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TipoPago(str, enum.Enum):
    venta = "venta"
    compra = "compra"


class MetodoPago(str, enum.Enum):
    efectivo = "efectivo"
    tarjeta = "tarjeta"
    transferencia = "transferencia"


class EstadoPago(str, enum.Enum):
    pendiente = "pendiente"
    completado = "completado"
    fallido = "fallido"


class EstadoCuenta(str, enum.Enum):
    pendiente = "pendiente"
    pagada = "pagada"


class Pago(Base):
    __tablename__ = "pagos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo: Mapped[TipoPago] = mapped_column(Enum(TipoPago, name="tipo_pago"), nullable=False)
    referencia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    metodo: Mapped[MetodoPago] = mapped_column(Enum(MetodoPago, name="metodo_pago"), nullable=False)
    estado: Mapped[EstadoPago] = mapped_column(
        Enum(EstadoPago, name="estado_pago"), nullable=False, default=EstadoPago.pendiente
    )
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CuentaPorPagar(Base):
    __tablename__ = "cuentas_por_pagar"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proveedor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    orden_compra_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    monto_pagado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    estado: Mapped[EstadoCuenta] = mapped_column(
        Enum(EstadoCuenta, name="estado_cuenta_pagar"), nullable=False, default=EstadoCuenta.pendiente
    )
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CuentaPorCobrar(Base):
    __tablename__ = "cuentas_por_cobrar"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    venta_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    monto_pagado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    estado: Mapped[EstadoCuenta] = mapped_column(
        Enum(EstadoCuenta, name="estado_cuenta_cobrar"), nullable=False, default=EstadoCuenta.pendiente
    )
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
