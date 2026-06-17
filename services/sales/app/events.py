"""
Publisher de eventos del Sales Service.
Publica SaleCompleted al exchange topic `events`.
Ver docs/events.md para el contrato.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import aio_pika
from aio_pika.abc import AbstractRobustConnection, AbstractExchange

from app.config import settings

logger = logging.getLogger("sales.events")

SOURCE = "sales"
EXCHANGE_NAME = "events"

_connection: AbstractRobustConnection | None = None
_exchange: AbstractExchange | None = None


async def connect() -> None:
    global _connection, _exchange
    _connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    channel = await _connection.channel()
    _exchange = await channel.declare_exchange(
        EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
    )
    logger.info("Conectado a broker en %s, exchange=%s", settings.rabbitmq_url, EXCHANGE_NAME)


async def disconnect() -> None:
    global _connection, _exchange
    if _connection is not None:
        await _connection.close()
    _connection = None
    _exchange = None


async def publish_event(event_type: str, data: dict[str, Any]) -> None:
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


async def emit_sale_completed(
    *,
    venta_id: str,
    agencia_id: str,
    cliente_nombre: str | None,
    cliente_documento: str | None,
    subtotal: Decimal,
    total: Decimal,
    items: list[dict],
) -> None:
    await publish_event("SaleCompleted", {
        "venta_id": venta_id,
        "agencia_id": agencia_id,
        "cliente_nombre": cliente_nombre,
        "cliente_documento": cliente_documento,
        "subtotal": str(subtotal),
        "total": str(total),
        "items": items,
    })
