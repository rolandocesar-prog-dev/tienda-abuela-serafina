import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import Producto
from app.schemas import ProductoCreate, ProductoOut, ProductoUpdate

router = APIRouter(prefix="", tags=["productos"])

@router.post("/products", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
async def crear_producto(payload: ProductoCreate, db: AsyncSession = Depends(get_db)) -> ProductoOut:
    try:
        nuevo_producto = Producto(**payload.model_dump())
        db.add(nuevo_producto)
        await db.commit()
        await db.refresh(nuevo_producto)
        return nuevo_producto
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un producto con este código.")

@router.get("/products", response_model=list[ProductoOut])
async def listar_productos(categoria: str | None = None, db: AsyncSession = Depends(get_db)) -> list[ProductoOut]:
    stmt = select(Producto)
    if categoria:
        stmt = stmt.where(Producto.categoria == categoria)
    resultado = await db.execute(stmt)
    return list(resultado.scalars().all())

@router.get("/products/{producto_id}", response_model=ProductoOut)
async def obtener_producto(producto_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ProductoOut:
    producto = await db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto

@router.put("/products/{producto_id}", response_model=ProductoOut)
async def actualizar_producto(producto_id: uuid.UUID, payload: ProductoUpdate, db: AsyncSession = Depends(get_db)) -> ProductoOut:
    producto = await db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    try:
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(producto, key, value)
        await db.commit()
        await db.refresh(producto)
        return producto
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error de integridad en los datos.")

@router.delete("/products/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_producto(producto_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    producto = await db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
        
    await db.delete(producto)
    await db.commit()