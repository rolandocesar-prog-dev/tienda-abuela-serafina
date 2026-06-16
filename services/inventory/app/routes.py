"""
Inventory Service — Equipo 2 del PDF.

Endpoints exigidos por el PDF:
- POST /inventory/loadExcel
- POST /inventory/input
- POST /inventory/output
- POST /inventory/transfer
- GET  /inventory/{product}
- GET  /inventory/balance

Endpoints adicionales mantenidos para compatibilidad y Kardex:
- GET  /inventory/stock         (low-level, filtrable)
- POST /inventory/movimientos   (low-level, usado por wrappers)
- GET  /inventory/movimientos   (Kardex)

NOTA sobre Agencia vs Sucursal:
Por decisión del equipo (sección 2.6 del HANDOFF) este servicio sigue usando
la columna `agencia_id` como ID de sucursal. Si la decisión cambia, hay que
renombrar la columna en models.py y actualizar el frontend.
"""
import io
import logging
import uuid
from datetime import datetime

import httpx
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

logger = logging.getLogger("inventory.routes")


async def _resolver_producto_id(codigo: str) -> uuid.UUID:
    """
    Resuelve el UUID de un producto por su código consultando Product Service.
    Si el servicio no responde o el producto no existe, retorna un UUIDv5
    determinista como fallback para no abortar la carga masiva.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                f"{settings.product_url}/products",
                params={"codigo": codigo},
            )
            if resp.status_code == 200:
                items = resp.json()
                if items:
                    return uuid.UUID(items[0]["id"])
    except Exception:  # noqa: BLE001
        logger.warning("Product Service no disponible al resolver código '%s', usando uuid5 fallback", codigo)
    return uuid.uuid5(uuid.NAMESPACE_URL, f"producto/{codigo}")
from app.events import (
    emit_inventory_loaded,
    emit_inventory_updated,
    emit_transfer_completed,
)
from app.models import Agencia, Movimiento, Stock, TipoMovimiento
from app.schemas import (
    BalancePorSucursalOut,
    InputIn,
    LoadExcelOut,
    MovimientoCreate,
    MovimientoOut,
    OutputIn,
    StockOut,
    StockProductoOut,
    TransferIn,
    TransferOut,
)
from app.security import verify_jwt

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(verify_jwt)])


class AgenciaOut(BaseModel):
    id: uuid.UUID
    sucursal_id: uuid.UUID
    nombre: str
    codigo: str

    model_config = {"from_attributes": True}


@router.get("/agencias", response_model=list[AgenciaOut])
async def listar_agencias(db: AsyncSession = Depends(get_db)) -> list[Agencia]:
    result = await db.execute(select(Agencia).order_by(Agencia.nombre))
    return list(result.scalars().all())


# =========================================================================
# Helpers internos
# =========================================================================
async def _aplicar_movimiento(
    db: AsyncSession,
    *,
    tipo: TipoMovimiento,
    agencia_id: uuid.UUID,
    producto_id: uuid.UUID,
    cantidad: int,
    referencia: str | None,
) -> Movimiento:
    """
    Aplica un movimiento usando lock pesimista sobre la fila de stock.
    NO hace commit — el caller decide cuándo (importante para /transfer).
    Retorna el Movimiento creado.

    Lanza 409 si no hay stock suficiente para una salida.
    """
    stmt = (
        select(Stock)
        .where(Stock.agencia_id == agencia_id)
        .where(Stock.producto_id == producto_id)
        .with_for_update()
    )
    stock = (await db.execute(stmt)).scalar_one_or_none()

    if tipo == TipoMovimiento.entrada:
        nueva_cantidad = (stock.cantidad if stock else 0) + cantidad
    elif tipo == TipoMovimiento.salida:
        actual = stock.cantidad if stock else 0
        if actual < cantidad:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Stock insuficiente: producto {producto_id} en agencia "
                    f"{agencia_id} tiene {actual}, se intentó sacar {cantidad}"
                ),
            )
        nueva_cantidad = actual - cantidad
    else:  # ajuste
        nueva_cantidad = cantidad

    if stock is None:
        stock = Stock(
            agencia_id=agencia_id,
            producto_id=producto_id,
            cantidad=nueva_cantidad,
        )
        db.add(stock)
    else:
        stock.cantidad = nueva_cantidad

    movimiento = Movimiento(
        tipo=tipo,
        agencia_id=agencia_id,
        producto_id=producto_id,
        cantidad=cantidad,
        referencia=referencia,
    )
    db.add(movimiento)
    await db.flush()  # asegura que movimiento.id esté disponible

    # Hook de evento (asíncrono, no bloqueante una vez haya broker)
    await emit_inventory_updated(
        tipo_movimiento=tipo.value,
        agencia_id=str(agencia_id),
        producto_id=str(producto_id),
        cantidad=cantidad,
        saldo_posterior=nueva_cantidad,
    )
    return movimiento


async def _validar_agencia(db: AsyncSession, agencia_id: uuid.UUID) -> None:
    if await db.get(Agencia, agencia_id) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Agencia/sucursal {agencia_id} no existe",
        )


# =========================================================================
# Endpoints semánticos del PDF
# =========================================================================
@router.post("/input", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED)
async def ingresar_mercaderia(payload: InputIn, db: AsyncSession = Depends(get_db)) -> Movimiento:
    await _validar_agencia(db, payload.agencia_id)
    movimiento = await _aplicar_movimiento(
        db,
        tipo=TipoMovimiento.entrada,
        agencia_id=payload.agencia_id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        referencia=payload.referencia,
    )
    await db.commit()
    await db.refresh(movimiento)
    return movimiento


@router.post("/output", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED)
async def egresar_mercaderia(payload: OutputIn, db: AsyncSession = Depends(get_db)) -> Movimiento:
    """
    Salida de mercadería: venta, baja por vencimiento, baja por pérdida, ajuste manual.
    El campo `motivo` se guarda como referencia para trazabilidad y Kardex.
    """
    await _validar_agencia(db, payload.agencia_id)
    referencia = payload.motivo or "output"
    movimiento = await _aplicar_movimiento(
        db,
        tipo=TipoMovimiento.salida,
        agencia_id=payload.agencia_id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        referencia=referencia,
    )
    await db.commit()
    await db.refresh(movimiento)
    return movimiento


@router.post("/transfer", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
async def transferir_entre_sucursales(
    payload: TransferIn,
    db: AsyncSession = Depends(get_db),
) -> TransferOut:
    """
    Transferencia atómica entre 2 sucursales (paso 9 del PDF):
    1. Salida en sucursal_origen
    2. Entrada en sucursal_destino
    Si la entrada falla, el rollback revierte también la salida.
    """
    if payload.sucursal_origen_id == payload.sucursal_destino_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La sucursal de origen y destino no pueden ser la misma",
        )
    await _validar_agencia(db, payload.sucursal_origen_id)
    await _validar_agencia(db, payload.sucursal_destino_id)

    referencia = f"transfer:{payload.sucursal_origen_id}->{payload.sucursal_destino_id}"

    mov_salida = await _aplicar_movimiento(
        db,
        tipo=TipoMovimiento.salida,
        agencia_id=payload.sucursal_origen_id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        referencia=referencia,
    )
    mov_entrada = await _aplicar_movimiento(
        db,
        tipo=TipoMovimiento.entrada,
        agencia_id=payload.sucursal_destino_id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        referencia=referencia,
    )
    await db.commit()
    await db.refresh(mov_salida)
    await db.refresh(mov_entrada)

    await emit_transfer_completed(
        sucursal_origen_id=str(payload.sucursal_origen_id),
        sucursal_destino_id=str(payload.sucursal_destino_id),
        producto_id=str(payload.producto_id),
        cantidad=payload.cantidad,
    )

    return TransferOut(
        movimiento_salida_id=mov_salida.id,
        movimiento_entrada_id=mov_entrada.id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        sucursal_origen_id=payload.sucursal_origen_id,
        sucursal_destino_id=payload.sucursal_destino_id,
    )


@router.get("/balance", response_model=list[BalancePorSucursalOut])
async def saldo_por_sucursal(
    sucursal_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[BalancePorSucursalOut]:
    """
    Saldo agregado por sucursal (paso 10 del PDF).
    Sin filtros → trae todas las sucursales.
    """
    stmt = (
        select(
            Agencia.id,
            Agencia.codigo,
            func.count(Stock.id).label("productos_distintos"),
            func.coalesce(func.sum(Stock.cantidad), 0).label("total_unidades"),
        )
        .join(Stock, Stock.agencia_id == Agencia.id, isouter=True)
        .group_by(Agencia.id, Agencia.codigo)
        .order_by(Agencia.codigo)
    )
    if sucursal_id is not None:
        stmt = stmt.where(Agencia.id == sucursal_id)

    rows = (await db.execute(stmt)).all()
    return [
        BalancePorSucursalOut(
            agencia_id=row[0],
            codigo_agencia=row[1],
            total_productos_distintos=int(row[2] or 0),
            total_unidades=int(row[3] or 0),
        )
        for row in rows
    ]


@router.post("/loadExcel", response_model=LoadExcelOut, status_code=status.HTTP_201_CREATED)
async def cargar_inventario_excel(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> LoadExcelOut:
    """
    Carga inventario desde un archivo Excel (paso 4 del PDF).

    Columnas esperadas (encabezado en la primera fila):
        Código | Producto | Sucursal | Cantidad | Costo | Precio

    - "Sucursal" debe ser el `codigo` de una agencia existente (ej: A001).
    - "Cantidad" se aplica como movimiento de tipo entrada.
    - "Costo" y "Precio" se guardan como referencia textual para trazabilidad
      (la decisión de mantener un master de precios queda en Product Service).
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser .xlsx, .xlsm o .xls",
        )

    contenido = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contenido), engine="openpyxl")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pudo parsear el Excel: {exc}",
        )

    columnas_requeridas = {"Código", "Producto", "Sucursal", "Cantidad", "Costo", "Precio"}
    faltantes = columnas_requeridas - set(df.columns)
    if faltantes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faltan columnas en el Excel: {sorted(faltantes)}",
        )

    # Cachear lookup de agencias por codigo → id, evita N consultas.
    agencias_por_codigo: dict[str, uuid.UUID] = {
        a.codigo: a.id for a in (await db.execute(select(Agencia))).scalars().all()
    }

    filas_ok = 0
    filas_error = 0
    errores: list[str] = []
    productos_no_encontrados: list[str] = []

    for idx, row in df.iterrows():
        try:
            codigo_producto = str(row["Código"]).strip()
            codigo_sucursal = str(row["Sucursal"]).strip()
            cantidad = int(row["Cantidad"])
            costo = float(row["Costo"])
            precio = float(row["Precio"])

            if cantidad <= 0:
                raise ValueError("cantidad debe ser positiva")

            agencia_id = agencias_por_codigo.get(codigo_sucursal)
            if agencia_id is None:
                raise ValueError(f"sucursal '{codigo_sucursal}' no existe")

            producto_id = await _resolver_producto_id(codigo_producto)

            referencia = (
                f"excel:{file.filename}:fila{idx + 2}"
                f"|costo={costo}|precio={precio}"
            )
            await _aplicar_movimiento(
                db,
                tipo=TipoMovimiento.entrada,
                agencia_id=agencia_id,
                producto_id=producto_id,
                cantidad=cantidad,
                referencia=referencia,
            )
            filas_ok += 1

        except Exception as exc:  # noqa: BLE001
            filas_error += 1
            mensaje = f"Fila {idx + 2}: {exc}"
            errores.append(mensaje)
            if "no existe" in str(exc):
                productos_no_encontrados.append(str(row.get("Código", "?")))

    await db.commit()
    await emit_inventory_loaded(archivo=file.filename or "?", filas=filas_ok)

    return LoadExcelOut(
        filas_procesadas=filas_ok,
        filas_con_error=filas_error,
        productos_no_encontrados=sorted(set(productos_no_encontrados)),
        errores=errores[:20],  # truncar para no devolver 1000 líneas si todo falla
    )


# =========================================================================
# Consultas
# =========================================================================
@router.get("/stock", response_model=list[StockOut])
async def consultar_stock(
    agencia_id: uuid.UUID | None = None,
    producto_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Stock]:
    """Stock low-level filtrable (back-compat con frontend)."""
    stmt = select(Stock)
    if agencia_id is not None:
        stmt = stmt.where(Stock.agencia_id == agencia_id)
    if producto_id is not None:
        stmt = stmt.where(Stock.producto_id == producto_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/movimientos", response_model=list[MovimientoOut])
async def kardex(
    agencia_id: uuid.UUID | None = None,
    producto_id: uuid.UUID | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    limit: int | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Movimiento]:
    """Kardex — historial filtrable de movimientos."""
    stmt = select(Movimiento).order_by(Movimiento.fecha.desc())
    if agencia_id is not None:
        stmt = stmt.where(Movimiento.agencia_id == agencia_id)
    if producto_id is not None:
        stmt = stmt.where(Movimiento.producto_id == producto_id)
    if desde is not None:
        stmt = stmt.where(Movimiento.fecha >= desde)
    if hasta is not None:
        stmt = stmt.where(Movimiento.fecha <= hasta)
    if limit is not None and limit > 0:
        stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/movimientos", response_model=MovimientoOut, status_code=status.HTTP_201_CREATED)
async def registrar_movimiento(
    payload: MovimientoCreate,
    db: AsyncSession = Depends(get_db),
) -> Movimiento:
    """
    Endpoint low-level (back-compat).
    Para uso semántico preferí /input, /output, /transfer.
    """
    await _validar_agencia(db, payload.agencia_id)
    movimiento = await _aplicar_movimiento(
        db,
        tipo=payload.tipo,
        agencia_id=payload.agencia_id,
        producto_id=payload.producto_id,
        cantidad=payload.cantidad,
        referencia=payload.referencia,
    )
    await db.commit()
    await db.refresh(movimiento)
    return movimiento


# --- Catch-all GET /inventory/{product} debe ir AL FINAL ---
# Si va antes, capturaría /balance, /stock, /movimientos, /loadExcel.
@router.get("/{product_id}", response_model=StockProductoOut)
async def consultar_stock_de_producto(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> StockProductoOut:
    """Stock de UN producto en todas las sucursales (GET /inventory/{product})."""
    stmt = select(Stock).where(Stock.producto_id == product_id)
    detalle = list((await db.execute(stmt)).scalars().all())
    total = sum(s.cantidad for s in detalle)
    return StockProductoOut(producto_id=product_id, detalle=detalle, total=total)
