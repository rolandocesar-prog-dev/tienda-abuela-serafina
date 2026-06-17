"""
Notification Service.

No expone endpoints REST de creación: las notificaciones se generan al
consumir eventos del broker. Expone solo consultas de auditoría:
- GET /notifications
- GET /notifications/{id}

Ver consumer.py para la implementación del consumer.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Notification
from app.schemas import NotificationOut
from app.security import verify_jwt

router = APIRouter(prefix="/notifications", tags=["notifications"], dependencies=[Depends(verify_jwt)])


@router.get("", response_model=list[NotificationOut])
async def listar_notificaciones(
    event_type: str | None = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> list[Notification]:
    stmt = select(Notification).order_by(Notification.fecha.desc()).limit(limit)
    if event_type is not None:
        stmt = stmt.where(Notification.event_type == event_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{notification_id}", response_model=NotificationOut)
async def obtener_notificacion(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Notification:
    n = await db.get(Notification, notification_id)
    if n is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada")
    return n
