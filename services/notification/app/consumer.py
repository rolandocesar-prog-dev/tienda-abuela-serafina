"""
Consumidor de eventos del Notification Service.

Suscripto al exchange topic `events` con routing_key `#` (TODO).
Por cada mensaje, decide qué tipo de notificación generar (email/sms/whatsapp/push
— simulado, no envía nada real) y la persiste en la tabla `notifications`.

Idempotencia por `event_id` (UNIQUE en la BD). Si el mismo evento llega dos
veces, el INSERT del segundo falla con IntegrityError y se ignora.
"""
import asyncio
import json
import logging
import uuid

import aio_pika
from aio_pika.abc import AbstractIncomingMessage, AbstractRobustConnection
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import Notification

logger = logging.getLogger("notification.consumer")

EXCHANGE_NAME = "events"
QUEUE_NAME = "q.notification.all"
ROUTING_KEY = "#"  # todo

# Mapeo del event_type al canal (tipo) que se "envía" en simulación.
# El PDF dice que puede simular email/sms/whatsapp/push — decidimos por evento.
_TIPO_POR_EVENTO = {
    "SaleCompleted":     "email",
    "TransferCompleted": "push",
    "PointsAssigned":    "whatsapp",
    "StockLow":          "email",
    "InventoryLoaded":   "email",
    "InventoryUpdated":  "push",
    "ProductCreated":    "email",
    "PromotionCreated":  "sms",
    "CustomerCreated":   "email",
}

_consumer_task: asyncio.Task | None = None
_connection: AbstractRobustConnection | None = None


def _render_contenido(event_type: str, data: dict) -> tuple[str | None, str]:
    """
    Decide (cliente, contenido) según el tipo de evento.
    Para esta entrega es texto plano simulado — el PDF no exige formato real.
    """
    if event_type == "SaleCompleted":
        cliente = data.get("cliente_id") or data.get("cliente_nombre")
        return (
            str(cliente) if cliente else None,
            f"Venta completada por Bs {data.get('total', '?')}",
        )
    if event_type == "TransferCompleted":
        return (
            None,
            f"Transferencia: {data.get('cantidad')} u. producto {data.get('producto_id')} "
            f"de {data.get('sucursal_origen_id')} a {data.get('sucursal_destino_id')}",
        )
    if event_type == "PointsAssigned":
        return (
            str(data.get("customer_id")),
            f"Se asignaron {data.get('puntos')} puntos (saldo {data.get('saldo_posterior')})",
        )
    if event_type == "StockLow":
        return (
            None,
            f"Stock bajo: producto {data.get('producto_id')} en sucursal "
            f"{data.get('agencia_id')} tiene {data.get('saldo_actual')} unidades",
        )
    # Default: serializar data sin procesar.
    return None, json.dumps(data, default=str)[:900]


async def _handle_message(msg: AbstractIncomingMessage) -> None:
    async with msg.process(ignore_processed=True):
        try:
            envelope = json.loads(msg.body)
        except json.JSONDecodeError:
            logger.warning("Mensaje no es JSON, descarto: %s", msg.body[:200])
            return

        event_type = envelope.get("event_type", "Unknown")
        event_id_raw = envelope.get("event_id")
        try:
            event_id = uuid.UUID(str(event_id_raw))
        except (TypeError, ValueError):
            event_id = uuid.uuid4()
            logger.warning("event_id inválido en %s, genero uno nuevo", event_type)

        source = envelope.get("source", "unknown")
        data = envelope.get("data", {}) or {}
        cliente, contenido = _render_contenido(event_type, data)
        tipo_notif = _TIPO_POR_EVENTO.get(event_type, "push")

        async with AsyncSessionLocal() as db:
            try:
                db.add(Notification(
                    event_id=event_id,
                    event_type=event_type,
                    source=source,
                    cliente=cliente,
                    tipo=tipo_notif,
                    contenido=contenido,
                    payload=envelope,
                ))
                await db.commit()
                logger.info("Notificación creada [%s] event_id=%s", event_type, event_id)
            except IntegrityError:
                await db.rollback()
                logger.info("Evento %s ya procesado (idempotencia), ignoro", event_id)


async def _consume_forever(connection: AbstractRobustConnection) -> None:
    channel = await connection.channel()
    await channel.set_qos(prefetch_count=16)
    exchange = await channel.declare_exchange(
        EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
    )
    queue = await channel.declare_queue(QUEUE_NAME, durable=True)
    await queue.bind(exchange, routing_key=ROUTING_KEY)

    logger.info("Consumidor escuchando %s con routing=%s", QUEUE_NAME, ROUTING_KEY)
    async with queue.iterator() as it:
        async for message in it:
            await _handle_message(message)


async def start_consumer() -> None:
    """Llamado desde el lifespan de main.py."""
    global _connection, _consumer_task
    _connection = await aio_pika.connect_robust(settings.rabbitmq_url)
    _consumer_task = asyncio.create_task(_consume_forever(_connection))
    logger.info("Consumer task creado")


async def stop_consumer() -> None:
    global _connection, _consumer_task
    if _consumer_task is not None:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
    if _connection is not None:
        await _connection.close()
    _consumer_task = None
    _connection = None
