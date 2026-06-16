"""
Notification Service.

Sin endpoints REST de creación — las notificaciones se generan al consumir
eventos del broker. Solo expone consultas de auditoría.

Eventos consumidos (cuando el broker esté listo):
- SaleCompleted
- TransferCompleted
- PointsAssigned
- PromotionCreated
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])


# TODO(owner-notification): implementar.


@router.get("")
async def listar_notificaciones(db: AsyncSession = Depends(get_db)) -> list[dict]:
    raise HTTPException(status_code=501, detail="No implementado")
