import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Empleado, Agencia
# Asegúrate de importar AgenciaOut
from app.schemas import CambioAgencia, EmpleadoCreate, EmpleadoOut, EmpleadoUpdate, AgenciaOut

router = APIRouter(prefix="", tags=["rrhh"])

# 1. Rutas específicas primero
# AHORA usamos response_model=list[AgenciaOut]
@router.get("/agencias", response_model=list[AgenciaOut]) 
async def listar_agencias(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agencia))
    return result.scalars().all()

@router.post("/empleados", response_model=EmpleadoOut, status_code=status.HTTP_201_CREATED)
async def crear_empleado(payload: EmpleadoCreate, db: AsyncSession = Depends(get_db)) -> EmpleadoOut:
    nuevo_empleado = Empleado(**payload.model_dump())
    db.add(nuevo_empleado)
    await db.commit()
    await db.refresh(nuevo_empleado)
    return nuevo_empleado

@router.get("/empleados", response_model=list[EmpleadoOut])
async def listar_empleados(
    agencia_id: uuid.UUID | None = None,
    activo: bool | None = True,
    db: AsyncSession = Depends(get_db),
) -> list[EmpleadoOut]:
    query = select(Empleado)
    if agencia_id: query = query.where(Empleado.agencia_id == agencia_id)
    if activo is not None: query = query.where(Empleado.activo == activo)
    
    result = await db.execute(query)
    return list(result.scalars().all())

# 2. Rutas dinámicas al final
@router.get("/{empleado_id}", response_model=EmpleadoOut)
async def obtener_empleado(empleado_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> EmpleadoOut:
    result = await db.execute(select(Empleado).where(Empleado.id == empleado_id))
    empleado = result.scalar_one_or_none()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return empleado

@router.put("/{empleado_id}", response_model=EmpleadoOut)
async def actualizar_empleado(empleado_id: uuid.UUID, payload: EmpleadoUpdate, db: AsyncSession = Depends(get_db)) -> EmpleadoOut:
    update_data = payload.model_dump(exclude_unset=True)
    if not update_data: raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    await db.execute(update(Empleado).where(Empleado.id == empleado_id).values(**update_data))
    await db.commit()
    return await obtener_empleado(empleado_id, db)

@router.delete("/{empleado_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_empleado(empleado_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    await db.execute(update(Empleado).where(Empleado.id == empleado_id).values(activo=False))
    await db.commit()

@router.post("/{empleado_id}/asignar-agencia", response_model=EmpleadoOut)
async def asignar_agencia(empleado_id: uuid.UUID, payload: CambioAgencia, db: AsyncSession = Depends(get_db)) -> EmpleadoOut:
    await db.execute(update(Empleado).where(Empleado.id == empleado_id).values(agencia_id=payload.agencia_id))
    await db.commit()
    return await obtener_empleado(empleado_id, db)