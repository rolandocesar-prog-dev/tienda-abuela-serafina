"""
Company Service — CRUD de empresas y sucursales.

Al crear una sucursal notifica automáticamente a inventory-service para que
registre el stock inicial. Al eliminarla, lo desregistra.
"""
import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Branch, Company
from app.schemas import BranchCreate, BranchOut, BranchUpdate, CompanyCreate, CompanyOut, CompanyUpdate
from app.security import require_rol, verify_jwt

logger = logging.getLogger("company.routes")

router = APIRouter(prefix="/companies", tags=["companies"], dependencies=[Depends(verify_jwt)])


async def _registrar_sucursal_en_inventory(branch_id: str, nombre: str, auth_header: str | None) -> None:
    headers = {"Authorization": auth_header} if auth_header else {}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.inventory_url}/inventory/sucursales",
                json={"id": branch_id, "nombre": nombre},
                headers=headers,
            )
            if resp.status_code not in (200, 201):
                logger.warning("Inventory no pudo registrar sucursal %s: %s", branch_id, resp.text)
    except Exception as exc:
        logger.warning("No se pudo notificar a inventory al crear sucursal: %s", exc)


async def _eliminar_sucursal_en_inventory(branch_id: str, auth_header: str | None) -> None:
    headers = {"Authorization": auth_header} if auth_header else {}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.delete(
                f"{settings.inventory_url}/inventory/sucursales/{branch_id}",
                headers=headers,
            )
    except Exception as exc:
        logger.warning("No se pudo notificar a inventory al eliminar sucursal: %s", exc)


# ── Companies ─────────────────────────────────────────────────────────────────

@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def crear_company(
    payload: CompanyCreate,
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> Company:
    company = Company(**payload.model_dump())
    db.add(company)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una empresa con NIT '{payload.nit}'",
        )
    await db.refresh(company)
    return company


@router.get("", response_model=list[CompanyOut])
async def listar_companies(
    activo: bool | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[Company]:
    stmt = select(Company).order_by(Company.nombre)
    if activo is not None:
        stmt = stmt.where(Company.activo == activo)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{company_id}", response_model=CompanyOut)
async def obtener_company(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Company:
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"Empresa {company_id} no encontrada")
    return company


@router.put("/{company_id}", response_model=CompanyOut)
async def actualizar_company(
    company_id: uuid.UUID,
    payload: CompanyUpdate,
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> Company:
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"Empresa {company_id} no encontrada")
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(company, campo, valor)
    await db.commit()
    await db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_company(
    company_id: uuid.UUID,
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> None:
    company = await db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail=f"Empresa {company_id} no encontrada")
    await db.delete(company)
    await db.commit()


# ── Branches ──────────────────────────────────────────────────────────────────

@router.post("/{company_id}/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
async def crear_branch(
    company_id: uuid.UUID,
    payload: BranchCreate,
    request: Request,
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> Branch:
    if await db.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail=f"Empresa {company_id} no encontrada")
    branch = Branch(company_id=company_id, **payload.model_dump())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)

    auth_header = request.headers.get("Authorization")
    await _registrar_sucursal_en_inventory(str(branch.id), branch.nombre, auth_header)

    return branch


@router.get("/{company_id}/branches", response_model=list[BranchOut])
async def listar_branches(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[Branch]:
    if await db.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail=f"Empresa {company_id} no encontrada")
    stmt = select(Branch).where(Branch.company_id == company_id).order_by(Branch.nombre)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.put("/{company_id}/branches/{branch_id}", response_model=BranchOut)
async def actualizar_branch(
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    payload: BranchUpdate,
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> Branch:
    branch = await db.get(Branch, branch_id)
    if branch is None or branch.company_id != company_id:
        raise HTTPException(status_code=404, detail=f"Sucursal {branch_id} no encontrada")
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(branch, campo, valor)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.delete("/{company_id}/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_branch(
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    request: Request,
    _: dict = Depends(require_rol("Administrador")),
    db: AsyncSession = Depends(get_db),
) -> None:
    branch = await db.get(Branch, branch_id)
    if branch is None or branch.company_id != company_id:
        raise HTTPException(status_code=404, detail=f"Sucursal {branch_id} no encontrada")
    await db.delete(branch)
    await db.commit()

    auth_header = request.headers.get("Authorization")
    await _eliminar_sucursal_en_inventory(str(branch_id), auth_header)
