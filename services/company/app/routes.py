"""
Company Service — CRUD de empresas y sucursales.

Endpoints:
- POST   /companies
- GET    /companies
- GET    /companies/{id}
- PUT    /companies/{id}
- DELETE /companies/{id}
- POST   /companies/{id}/branches
- GET    /companies/{id}/branches
- PUT    /companies/{id}/branches/{branch_id}
- DELETE /companies/{id}/branches/{branch_id}
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Branch, Company
from app.schemas import BranchCreate, BranchOut, BranchUpdate, CompanyCreate, CompanyOut, CompanyUpdate
from app.security import verify_jwt

router = APIRouter(prefix="/companies", tags=["companies"], dependencies=[Depends(verify_jwt)])


# ── Companies ─────────────────────────────────────────────────────────────────

@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def crear_company(payload: CompanyCreate, db: AsyncSession = Depends(get_db)) -> Company:
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
async def eliminar_company(company_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> None:
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
    db: AsyncSession = Depends(get_db),
) -> Branch:
    if await db.get(Company, company_id) is None:
        raise HTTPException(status_code=404, detail=f"Empresa {company_id} no encontrada")
    branch = Branch(company_id=company_id, **payload.model_dump())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
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
    db: AsyncSession = Depends(get_db),
) -> None:
    branch = await db.get(Branch, branch_id)
    if branch is None or branch.company_id != company_id:
        raise HTTPException(status_code=404, detail=f"Sucursal {branch_id} no encontrada")
    await db.delete(branch)
    await db.commit()
