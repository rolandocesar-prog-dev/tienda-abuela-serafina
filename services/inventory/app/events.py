"""
Publisher de eventos del Inventory Service.

Conecta a RabbitMQ al arrancar (via lifespan en main.py) y publica al exchange
topic `events` con routing_key = event_type. Ver docs/events.md para el contrato.

Si el broker no está disponible cuando se intenta publicar, loguea y sigue —
la transacción de negocio NO se revierte. Para garantizar entrega usar
outbox pattern (fuera de alcance para esta entrega).
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import aio_pika
from aio_pika.abc import AbstractRobustConnection, AbstractExchange

from app.config import settings

logger = logging.getLogger("inventory.events")

UMBRAL_STOCK_BAJO = 10
SOURCE = "inventory"
EXCHANGE_NAME = "events"

# Estado del cliente del broker — set en lifespan, limpiado al apagar.
_connection: AbstractRobustConnection | None = None
_exchange: AbstractExchange | None = None


async def connect() -> None:
    """Llamado desde el lifespan de FastAPI al iniciar."""
    global _connection, _exchange
    _connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    channel = await _connection.channel()
    _exchange = await channel.declare_exchange(
        EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
    )
    logger.info("Conectado a broker en %s, exchange=%s", settings.rabbitmq_url, EXCHANGE_NAME)


async def disconnect() -> None:
    """Llamado desde el lifespan de FastAPI al cerrar."""
    global _connection, _exchange
    if _connection is not None:
        await _connection.close()
    _connection = None
    _exchange = None


async def publish_event(event_type: str, data: dict[str, Any]) -> None:
    """
    Publica un evento al exchange `events` con routing_key=event_type.
    Si el broker no está conectado, loguea y sigue (no falla la operación de negocio).
    """
    envelope = {
        "event_type": event_type,
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": SOURCE,
        "data": data,
    }
    body = json.dumps(envelope, default=str).encode("utf-8")

    if _exchange is None:
        logger.warning("Broker no conectado, no se publica %s: %s", event_type, envelope)
        return

    try:
        await _exchange.publish(
            aio_pika.Message(
                body=body,
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key=event_type,
        )
        logger.info("Publicado %s id=%s", event_type, envelope["event_id"])
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falló publicación de %s: %s", event_type, exc)


# ---------- Helpers semánticos ----------
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
