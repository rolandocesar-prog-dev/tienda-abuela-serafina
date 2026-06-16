import uuid
import httpx

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models import OrdenCompra, OrdenCompraItem, Proveedor, EstadoOrden
from app.schemas import (
    OrdenCompraCreate,
    OrdenCompraOut,
    ProveedorCreate,
    ProveedorOut,
)

# Prefijo vacío para Nginx Gateway
router = APIRouter(prefix="", tags=["compras"])

ALMACEN_URL = "http://almacen:8000"
PAGOS_URL = "http://pagos:8000"


# ---------- Proveedores ----------
@router.post("/proveedores", response_model=ProveedorOut, status_code=status.HTTP_201_CREATED)
async def crear_proveedor(payload: ProveedorCreate, db: AsyncSession = Depends(get_db)) -> ProveedorOut:
    nuevo_proveedor = Proveedor(**payload.model_dump())
    db.add(nuevo_proveedor)
    try:
        await db.commit()
        await db.refresh(nuevo_proveedor)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Error: Posible NIT duplicado")
    return nuevo_proveedor


@router.get("/proveedores", response_model=list[ProveedorOut])
async def listar_proveedores(db: AsyncSession = Depends(get_db)) -> list[ProveedorOut]:
    result = await db.execute(select(Proveedor))
    return list(result.scalars().all())


@router.get("/proveedores/{proveedor_id}", response_model=ProveedorOut)
async def obtener_proveedor(proveedor_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ProveedorOut:
    proveedor = await db.get(Proveedor, proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return proveedor


# ---------- Órdenes de compra ----------
@router.post("/ordenes-compra", response_model=OrdenCompraOut, status_code=status.HTTP_201_CREATED)
async def crear_orden(payload: OrdenCompraCreate, db: AsyncSession = Depends(get_db)) -> OrdenCompraOut:
    # 1. Validar que el proveedor existe
    proveedor = await db.get(Proveedor, payload.proveedor_id)
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    # 2. Construir items y calcular total
    total_orden = 0
    items_db = []
    for item in payload.items:
        subtotal = item.precio_unitario * item.cantidad
        total_orden += subtotal
        items_db.append(OrdenCompraItem(
            producto_id=item.producto_id,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            subtotal=subtotal
        ))

    # 3. Guardar en estado Pendiente
    nueva_orden = OrdenCompra(
        proveedor_id=payload.proveedor_id,
        agencia_origen_id=payload.agencia_origen_id,  # 🔥 NUEVO
        agencia_destino_id=payload.agencia_destino_id,
        total=total_orden,
        items=items_db
    )
    db.add(nueva_orden)
    await db.commit()
    await db.refresh(nueva_orden)
    return nueva_orden


@router.get("/ordenes-compra/{orden_id}", response_model=OrdenCompraOut)
async def obtener_orden(orden_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> OrdenCompraOut:
    orden = await db.get(OrdenCompra, orden_id)
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return orden


@router.get("/ordenes-compra", response_model=list[OrdenCompraOut])
async def listar_ordenes(estado: EstadoOrden | None = None, db: AsyncSession = Depends(get_db)) -> list[OrdenCompraOut]:
    stmt = select(OrdenCompra)
    if estado:
        stmt = stmt.where(OrdenCompra.estado == estado)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


# ---------- Orquestación de Recepción ----------
@router.post("/ordenes-compra/{orden_id}/recepcion", response_model=OrdenCompraOut)
async def recepcionar_orden(orden_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> OrdenCompraOut:
    orden = await db.get(OrdenCompra, orden_id)
    
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if orden.estado != EstadoOrden.pendiente:
        raise HTTPException(status_code=400, detail=f"La orden no puede recepcionarse porque está {orden.estado.value}")

    async with httpx.AsyncClient() as client:
        # 🔥 PRIMERO: Validar stock en agencia origen para TODOS los items
        for item in orden.items:
            if orden.agencia_origen_id:
                stock_response = await client.get(
                    f"{ALMACEN_URL}/stock",
                    params={
                        "agencia_id": str(orden.agencia_origen_id),
                        "producto_id": str(item.producto_id)
                    }
                )
                if stock_response.status_code == 200:
                    stock_data = stock_response.json()
                    stock_actual = stock_data[0].get("cantidad", 0) if stock_data else 0
                    if stock_actual < item.cantidad:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Stock insuficiente. Producto: {item.producto_id}, "
                                   f"Stock actual: {stock_actual}, Requerido: {item.cantidad}"
                        )
        
        # 🔥 SEGUNDO: Ahora sí, procesar los movimientos
        for item in orden.items:
            # 1. Descontar stock de la agencia ORIGEN
            if orden.agencia_origen_id:
                mov_salida_payload = {
                    "agencia_id": str(orden.agencia_origen_id),
                    "producto_id": str(item.producto_id),
                    "cantidad": item.cantidad,
                    "tipo": "salida",
                    "motivo": f"Transferencia por orden de compra a agencia {orden.agencia_destino_id}"
                }
                res_salida = await client.post(f"{ALMACEN_URL}/movimientos", json=mov_salida_payload)
                if res_salida.status_code != 201:
                    raise HTTPException(status_code=500, detail=f"Fallo al descontar stock: {res_salida.text}")
            
            # 2. Sumar stock a la agencia DESTINO
            mov_entrada_payload = {
                "agencia_id": str(orden.agencia_destino_id),
                "producto_id": str(item.producto_id),
                "cantidad": item.cantidad,
                "tipo": "entrada",
                "motivo": f"Recepción de orden de compra {orden.id}"
            }
            res_entrada = await client.post(f"{ALMACEN_URL}/movimientos", json=mov_entrada_payload)
            if res_entrada.status_code != 201:
                raise HTTPException(status_code=500, detail=f"Fallo al ingresar stock: {res_entrada.text}")

        # 3. Crear cuenta por pagar en Pagos
        pago_payload = {
            "proveedor_id": str(orden.proveedor_id),
            "orden_compra_id": str(orden.id),
            "monto_total": float(orden.total)
        }
        res_pagos = await client.post(f"{PAGOS_URL}/cuentas-por-pagar", json=pago_payload)
        if res_pagos.status_code != 201:
            raise HTTPException(status_code=500, detail=f"Fallo al registrar deuda: {res_pagos.text}")
        
        cuenta_pagar_data = res_pagos.json()

    # 4. Finalizar la orden
    orden.estado = EstadoOrden.recibida
    orden.cuenta_por_pagar_id = uuid.UUID(cuenta_pagar_data["id"])
    
    await db.commit()
    await db.refresh(orden)
    
    return orden