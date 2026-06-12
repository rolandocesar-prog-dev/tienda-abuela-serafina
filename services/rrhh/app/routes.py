import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Agencia, Empleado
from app.schemas import CambioAgencia, EmpleadoCreate, EmpleadoOut, EmpleadoUpdate

router = APIRouter(prefix="/empleados", tags=["rrhh"])


async def _validar_agencia(db: AsyncSession, agencia_id: uuid.UUID) -> None:
    if await db.get(Agencia, agencia_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Agencia {agencia_id} no existe",
        )


@router.post("", response_model=EmpleadoOut, status_code=status.HTTP_201_CREATED)
async def crear_empleado(payload: EmpleadoCreate, db: AsyncSession = Depends(get_db)) -> Empleado:
    await _validar_agencia(db, payload.agencia_id)

    empleado = Empleado(**payload.model_dump())
    db.add(empleado)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un empleado con CI '{payload.ci}'",
        )
    await db.refresh(empleado)
    return empleado


@router.get("", response_model=list[EmpleadoOut])
async def listar_empleados(
    agencia_id: uuid.UUID | None = None,
    sucursal_id: uuid.UUID | None = None,
    activo: bool | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Empleado]:
    stmt = select(Empleado).order_by(Empleado.apellido, Empleado.nombre)
    if agencia_id is not None:
        stmt = stmt.where(Empleado.agencia_id == agencia_id)
    if sucursal_id is not None:
        # Resolver sucursal_id → agencias mediante la tabla local Agencia.
        agencias_ids = (
            await db.execute(select(Agencia.id).where(Agencia.sucursal_id == sucursal_id))
        ).scalars().all()
        stmt = stmt.where(Empleado.agencia_id.in_(agencias_ids))
    if activo is not None:
        stmt = stmt.where(Empleado.activo == activo)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{empleado_id}", response_model=EmpleadoOut)
async def obtener_empleado(empleado_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Empleado:
    empleado = await db.get(Empleado, empleado_id)
    if empleado is None:
        raise HTTPException(status_code=404, detail=f"Empleado {empleado_id} no encontrado")
    return empleado


@router.put("/{empleado_id}", response_model=EmpleadoOut)
async def actualizar_empleado(
    empleado_id: uuid.UUID,
    payload: EmpleadoUpdate,
    db: AsyncSession = Depends(get_db),
) -> Empleado:
    empleado = await db.get(Empleado, empleado_id)
    if empleado is None:
        raise HTTPException(status_code=404, detail=f"Empleado {empleado_id} no encontrado")

    cambios = payload.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(empleado, campo, valor)
    await db.commit()
    await db.refresh(empleado)
    return empleado


@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_empleado(empleado_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    """Soft delete: marca activo=False, no borra la fila."""
    empleado = await db.get(Empleado, empleado_id)
    if empleado is None:
        raise HTTPException(status_code=404, detail=f"Empleado {empleado_id} no encontrado")
    empleado.activo = False
    await db.commit()


@router.post("/{empleado_id}/asignar-agencia", response_model=EmpleadoOut)
async def asignar_agencia(
    empleado_id: uuid.UUID,
    payload: CambioAgencia,
    db: AsyncSession = Depends(get_db),
) -> Empleado:
    empleado = await db.get(Empleado, empleado_id)
    if empleado is None:
        raise HTTPException(status_code=404, detail=f"Empleado {empleado_id} no encontrado")
    await _validar_agencia(db, payload.agencia_id)
    empleado.agencia_id = payload.agencia_id
    await db.commit()
    await db.refresh(empleado)
    return empleado
