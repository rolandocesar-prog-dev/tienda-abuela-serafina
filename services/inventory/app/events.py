"""
Publisher de eventos del Inventory Service.

Hoy es un stub que loguea por consola. Cuando el owner de Notification publique
el contrato del broker en docs/events.md, reemplazar esta función por la real
(aio-pika o lo que se haya decidido).

Eventos que este servicio debe publicar:
- InventoryLoaded    — tras procesar un /loadExcel
- InventoryUpdated   — tras cada /input, /output, /transfer (uno por movimiento)
- TransferCompleted  — al final de un /transfer exitoso
- StockLow           — cuando el saldo de un (sucursal, producto) cae bajo UMBRAL
"""
import logging
from typing import Any

logger = logging.getLogger("inventory.events")

UMBRAL_STOCK_BAJO = 10


async def publish_event(event_type: str, data: dict[str, Any]) -> None:
    """Stub: por ahora solo loguea. Cuando el broker esté, reemplazar."""
    logger.info("EVENT %s: %s", event_type, data)


async def emit_inventory_updated(
    *,
    tipo_movimiento: str,
    agencia_id: str,
    producto_id: str,
    cantidad: int,
    saldo_posterior: int,
) -> None:
    await publish_event("InventoryUpdated", {
        "tipo": tipo_movimiento,
        "agencia_id": agencia_id,
        "producto_id": producto_id,
        "cantidad": cantidad,
        "saldo_posterior": saldo_posterior,
    })
    if saldo_posterior < UMBRAL_STOCK_BAJO:
        await publish_event("StockLow", {
            "agencia_id": agencia_id,
            "producto_id": producto_id,
            "saldo_actual": saldo_posterior,
            "umbral": UMBRAL_STOCK_BAJO,
        })


async def emit_transfer_completed(
    *,
    sucursal_origen_id: str,
    sucursal_destino_id: str,
    producto_id: str,
    cantidad: int,
) -> None:
    await publish_event("TransferCompleted", {
        "sucursal_origen_id": sucursal_origen_id,
        "sucursal_destino_id": sucursal_destino_id,
        "producto_id": producto_id,
        "cantidad": cantidad,
    })


async def emit_inventory_loaded(*, archivo: str, filas: int) -> None:
    await publish_event("InventoryLoaded", {
        "archivo": archivo,
        "filas_procesadas": filas,
    })
