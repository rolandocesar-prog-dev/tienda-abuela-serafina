import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import ProductoCreate, ProductoOut, ProductoUpdate

router = APIRouter(prefix="/products", tags=["productos"])


# TODO(owner-catalog): implementar lógica de cada endpoint usando `db`.
# Los schemas y el contrato HTTP están fijos — no cambiarlos sin avisar al equipo.


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
async def crear_producto(payload: ProductoCreate, db: AsyncSession = Depends(get_db)) -> ProductoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("", response_model=list[ProductoOut])
async def listar_productos(
    categoria: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[ProductoOut]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{producto_id}", response_model=ProductoOut)
async def obtener_producto(producto_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ProductoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.put("/{producto_id}", response_model=ProductoOut)
async def actualizar_producto(
    producto_id: uuid.UUID,
    payload: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
) -> ProductoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_producto(producto_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    raise HTTPException(status_code=501, detail="No implementado")
