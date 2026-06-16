import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Producto
from app.schemas import ProductoCreate, ProductoOut, ProductoUpdate

router = APIRouter(prefix="/products", tags=["productos"])


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
async def crear_producto(payload: ProductoCreate, db: AsyncSession = Depends(get_db)) -> Producto:
    producto = Producto(**payload.model_dump())
    db.add(producto)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un producto con código '{payload.codigo}'",
        )
    await db.refresh(producto)
    return producto


@router.get("", response_model=list[ProductoOut])
async def listar_productos(
    categoria: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Producto]:
    stmt = select(Producto).order_by(Producto.nombre)
    if categoria is not None:
        stmt = stmt.where(Producto.categoria == categoria)
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
    return producto


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_producto(producto_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    producto = await db.get(Producto, producto_id)
    if producto is None:
        raise HTTPException(status_code=404, detail=f"Producto {producto_id} no encontrado")
    await db.delete(producto)
    await db.commit()
