"""
Customer Service — endpoints exigidos por el PDF (Equipo 4).

Endpoints:
- POST   /customers
- GET    /customers
- GET    /customers/{id}
- PUT    /customers/{id}
- DELETE /customers/{id}
- GET    /customers/{id}/history
- POST   /customers/{id}/points
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.events import emit_customer_created, emit_points_assigned
from app.models import Customer, PuntosHistorial
from app.schemas import CustomerCreate, CustomerOut, CustomerUpdate, PuntosCreate, PuntosHistorialOut
from app.security import verify_jwt

router = APIRouter(prefix="/customers", tags=["customers"], dependencies=[Depends(verify_jwt)])


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def crear_cliente(payload: CustomerCreate, db: AsyncSession = Depends(get_db)) -> Customer:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un cliente con CI/NIT '{payload.ci_nit}'",
        )
    await db.refresh(customer)
    await emit_customer_created(
        customer_id=str(customer.id),
        nombre=customer.nombre,
        ci_nit=customer.ci_nit,
    )
    return customer


@router.get("", response_model=list[CustomerOut])
async def listar_clientes(
    activo: bool | None = None,
    ci_nit: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Customer]:
    stmt = select(Customer).order_by(Customer.nombre)
    if activo is not None:
        stmt = stmt.where(Customer.activo == activo)
    if ci_nit is not None:
        stmt = stmt.where(Customer.ci_nit == ci_nit)
    if q is not None and q.strip():
        stmt = stmt.where(Customer.nombre.ilike(f"%{q.strip()}%"))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{customer_id}", response_model=CustomerOut)
async def obtener_cliente(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Customer:
    customer = await db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail=f"Cliente {customer_id} no encontrado")
    return customer


@router.put("/{customer_id}", response_model=CustomerOut)
async def actualizar_cliente(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
) -> Customer:
    customer = await db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail=f"Cliente {customer_id} no encontrado")
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(customer, campo, valor)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_cliente(customer_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
    customer = await db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail=f"Cliente {customer_id} no encontrado")
    await db.delete(customer)
    await db.commit()


@router.get("/{customer_id}/history", response_model=list[PuntosHistorialOut])
async def historial_cliente(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[PuntosHistorial]:
    if await db.get(Customer, customer_id) is None:
        raise HTTPException(status_code=404, detail=f"Cliente {customer_id} no encontrado")
    stmt = (
        select(PuntosHistorial)
        .where(PuntosHistorial.customer_id == customer_id)
        .order_by(PuntosHistorial.fecha.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/{customer_id}/points", response_model=CustomerOut)
async def asignar_puntos(
    customer_id: uuid.UUID,
    payload: PuntosCreate,
    db: AsyncSession = Depends(get_db),
) -> Customer:
    customer = await db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail=f"Cliente {customer_id} no encontrado")

    nuevo_saldo = customer.puntos_acumulados + payload.puntos
    if nuevo_saldo < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Puntos insuficientes: saldo actual {customer.puntos_acumulados}, intento canjear {abs(payload.puntos)}",
        )

    customer.puntos_acumulados = nuevo_saldo
    db.add(PuntosHistorial(
        customer_id=customer_id,
        motivo=payload.motivo,
        puntos=payload.puntos,
        saldo_posterior=nuevo_saldo,
    ))
    await db.commit()
    await db.refresh(customer)

    await emit_points_assigned(
        customer_id=str(customer_id),
        puntos=payload.puntos,
        motivo=payload.motivo,
        saldo_posterior=nuevo_saldo,
    )
    return customer
