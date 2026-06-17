"""
Publisher de eventos del Customer Service.
Publica CustomerCreated y PointsAssigned al exchange topic `events`.
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import aio_pika
from aio_pika.abc import AbstractRobustConnection, AbstractExchange

from app.config import settings

logger = logging.getLogger("customer.events")

SOURCE = "customer"
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


async def emit_customer_created(*, customer_id: str, nombre: str, ci_nit: str) -> None:
    await publish_event("CustomerCreated", {
        "customer_id": customer_id,
        "nombre": nombre,
        "ci_nit": ci_nit,
    })


async def emit_points_assigned(
    *, customer_id: str, puntos: int, motivo: str, saldo_posterior: int
) -> None:
    await publish_event("PointsAssigned", {
        "customer_id": customer_id,
        "puntos": puntos,
        "motivo": motivo,
        "saldo_posterior": saldo_posterior,
    })
