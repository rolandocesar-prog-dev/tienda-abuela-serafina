import uuid
from decimal import Decimal

from sqlalchemy import String, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    categoria: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    unidad_medida: Mapped[str] = mapped_column(String(20), nullable=False)
    precio_base: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
