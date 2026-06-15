import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, ForeignKey, UniqueConstraint, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TipoMovimiento(str, enum.Enum):
    entrada = "entrada"                    # + Stock (compras)
    salida = "salida"                      # - Stock (ventas)
    ajuste = "ajuste"                      # Ajuste manual
    devolucion_cliente = "devolucion_cliente"    # + Stock (cliente devuelve)
    devolucion_proveedor = "devolucion_proveedor"  # - Stock (devuelve a proveedor)
    transferencia = "transferencia"        # - Origen, + Destino


class Agencia(Base):
    __tablename__ = "agencias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    sucursal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)


class Stock(Base):
    __tablename__ = "stocks"
    __table_args__ = (UniqueConstraint("agencia_id", "producto_id", name="uq_stock_agencia_producto"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agencia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Movimiento(Base):
    __tablename__ = "movimientos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo: Mapped[TipoMovimiento] = mapped_column(Enum(TipoMovimiento, name="tipo_movimiento"), nullable=False)
    agencia_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    producto_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    cantidad_antes: Mapped[int] = mapped_column(Integer, nullable=True, default=0)  # Cambiado
    cantidad_despues: Mapped[int] = mapped_column(Integer, nullable=True, default=0)  # Cambiado
    referencia_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    referencia_tipo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    motivo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())