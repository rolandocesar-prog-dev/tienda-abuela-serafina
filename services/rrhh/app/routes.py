import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import CambioAgencia, EmpleadoCreate, EmpleadoOut, EmpleadoUpdate

router = APIRouter(prefix="/empleados", tags=["rrhh"])


# TODO(owner-rrhh):
# - DELETE = soft delete (activo=False), no borra la fila.
# - GET admite filtros: agencia_id, sucursal_id (resolver vía tabla Agencia), activo.


@router.post("", response_model=EmpleadoOut, status_code=status.HTTP_201_CREATED)
async def crear_empleado(payload: EmpleadoCreate, db: AsyncSession = Depends(get_db)) -> EmpleadoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("", response_model=list[EmpleadoOut])
async def listar_empleados(
    agencia_id: uuid.UUID | None = None,
    sucursal_id: uuid.UUID | None = None,
    activo: bool | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[EmpleadoOut]:
    raise HTTPException(status_code=501, detail="No implementado")


@router.get("/{empleado_id}", response_model=EmpleadoOut)
async def obtener_empleado(empleado_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> EmpleadoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.put("/{empleado_id}", response_model=EmpleadoOut)
async def actualizar_empleado(
    empleado_id: uuid.UUID,
    payload: EmpleadoUpdate,
    db: AsyncSession = Depends(get_db),
) -> EmpleadoOut:
    raise HTTPException(status_code=501, detail="No implementado")


@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_empleado(empleado_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    raise HTTPException(status_code=501, detail="No implementado")


@router.post("/{empleado_id}/asignar-agencia", response_model=EmpleadoOut)
async def asignar_agencia(
    empleado_id: uuid.UUID,
    payload: CambioAgencia,
    db: AsyncSession = Depends(get_db),
) -> EmpleadoOut:
    raise HTTPException(status_code=501, detail="No implementado")
