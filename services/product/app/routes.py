import re
import unicodedata
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.events import emit_product_created, emit_product_deleted, emit_product_updated
from app.models import Producto
from app.schemas import ProductoCreate, ProductoOut, ProductoUpdate
from app.security import verify_jwt

router = APIRouter(prefix="/products", tags=["productos"], dependencies=[Depends(verify_jwt)])

# Prefijos canónicos por categoría — alineados con los seeds existentes (LAC, CAR, etc.)
PREFIJOS_CATEGORIA = {
    "lacteos": "LAC",
    "carnes y embutidos": "CAR",
    "carnes": "CAR",
    "abarrotes": "ABA",
    "bebidas": "BEB",
    "limpieza": "LIM",
    "higiene": "HIG",
    "panaderia": "PAN",
    "panaderia y reposteria": "PAN",
}


def _prefijo_categoria(categoria: str) -> str:
    """3 letras canónicas para una categoría. Sin acentos, mayúsculas."""
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFD", categoria.lower())
        if unicodedata.category(c) != "Mn"
    )
    if sin_acentos in PREFIJOS_CATEGORIA:
        return PREFIJOS_CATEGORIA[sin_acentos]
    # Fallback: 3 primeras letras alfabéticas
    letras = re.sub(r"[^a-z]", "", sin_acentos)[:3].upper()
    return letras.ljust(3, "X") if letras else "GEN"


async def _siguiente_codigo(db: AsyncSession, categoria: str) -> str:
    """Genera el siguiente código correlativo para la categoría: PREFIJO + 3 dígitos."""
    prefijo = _prefijo_categoria(categoria)
    stmt = select(Producto.codigo).where(Producto.codigo.like(f"{prefijo}%"))
    codigos = [c for (c,) in (await db.execute(stmt)).all()]
    max_num = 0
    for codigo in codigos:
        m = re.match(rf"^{prefijo}(\d+)$", codigo)
        if m:
            max_num = max(max_num, int(m.group(1)))
    return f"{prefijo}{max_num + 1:03d}"


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
async def crear_producto(payload: ProductoCreate, db: AsyncSession = Depends(get_db)) -> Producto:
    datos = payload.model_dump()
    if not datos.get("codigo"):
        datos["codigo"] = await _siguiente_codigo(db, datos["categoria"])
    producto = Producto(**datos)
    db.add(producto)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un producto con código '{datos['codigo']}'",
        )
    await db.refresh(producto)
    await emit_product_created(
        producto_id=str(producto.id),
        codigo=producto.codigo,
        nombre=producto.nombre,
        categoria=producto.categoria,
    )
    return producto


@router.get("", response_model=list[ProductoOut])
async def listar_productos(
    categoria: str | None = None,
    codigo: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Producto]:
    stmt = select(Producto).order_by(Producto.nombre)
    if categoria is not None:
        stmt = stmt.where(Producto.categoria == categoria)
    if codigo is not None:
        stmt = stmt.where(Producto.codigo == codigo)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{producto_id}", response_model=ProductoOut)
async def obtener_producto(producto_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Producto:
    producto = await db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    return producto


@router.put("/{producto_id}", response_model=ProductoOut)
async def actualizar_producto(
    producto_id: uuid.UUID,
    payload: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
) -> Producto:
    producto = await db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")

    cambios = payload.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(producto, campo, valor)

    await db.commit()
    await db.refresh(producto)
    await emit_product_updated(
        producto_id=str(producto_id),
        cambios=payload.model_dump(exclude_unset=True),
    )
    return producto


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_producto(producto_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    producto = await db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    producto_id_str = str(producto.id)
    codigo = producto.codigo
    await db.delete(producto)
    await db.commit()
    await emit_product_deleted(producto_id=producto_id_str, codigo=codigo)
