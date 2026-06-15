import uuid
from decimal import Decimal
from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    CuentaPorPagar, 
    CuentaPorCobrar, 
    EstadoCuenta,
    Pago,
    TipoPago,
    MetodoPago,
    EstadoPago
)


async def seed_data() -> None:
    """Poblar la base de datos con datos de prueba para pagos."""
    
    async with AsyncSessionLocal() as db:
        # Verificar si ya hay datos para no duplicar usando SQLAlchemy ORM
        result = await db.execute(select(func.count()).select_from(CuentaPorPagar))
        count = result.scalar() or 0
        
        if count > 0:
            print("📊 Seed de pagos: Los datos ya existen, omitiendo...")
            return
        
        print("🌱 Seed de pagos: Creando datos de prueba...")
        
        # IDs fijos para que sean consistentes entre reinicios
        proveedor_ids = [
            uuid.UUID("11111111-1111-1111-1111-111111111111"),
            uuid.UUID("22222222-2222-2222-2222-222222222222"),
            uuid.UUID("33333333-3333-3333-3333-333333333333"),
        ]
        
        orden_compra_ids = [
            uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            uuid.UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
        ]
        
        venta_ids = [
            uuid.UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            uuid.UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
        ]
        
        # ========== CUENTAS POR PAGAR (PROVEEDORES) ==========
        cuentas_pagar = [
            CuentaPorPagar(
                id=uuid.uuid4(),
                proveedor_id=proveedor_ids[0],
                orden_compra_id=orden_compra_ids[0],
                monto_total=Decimal("1500.00"),
                monto_pagado=Decimal("500.00"),
                estado=EstadoCuenta.pendiente,
                fecha_creacion=datetime.now()
            ),
            CuentaPorPagar(
                id=uuid.uuid4(),
                proveedor_id=proveedor_ids[1],
                orden_compra_id=orden_compra_ids[1],
                monto_total=Decimal("2300.00"),
                monto_pagado=Decimal("0.00"),
                estado=EstadoCuenta.pendiente,
                fecha_creacion=datetime.now()
            ),
            CuentaPorPagar(
                id=uuid.uuid4(),
                proveedor_id=proveedor_ids[2],
                orden_compra_id=orden_compra_ids[2],
                monto_total=Decimal("875.50"),
                monto_pagado=Decimal("875.50"),
                estado=EstadoCuenta.pagada,
                fecha_creacion=datetime.now()
            ),
            CuentaPorPagar(
                id=uuid.uuid4(),
                proveedor_id=proveedor_ids[0],
                orden_compra_id=uuid.uuid4(),
                monto_total=Decimal("3200.00"),
                monto_pagado=Decimal("1200.00"),
                estado=EstadoCuenta.pendiente,
                fecha_creacion=datetime.now()
            ),
        ]
        
        for cuenta in cuentas_pagar:
            db.add(cuenta)
        
        # ========== CUENTAS POR COBRAR (CLIENTES) ==========
        cuentas_cobrar = [
            CuentaPorCobrar(
                id=uuid.uuid4(),
                cliente_nombre="Juan Pérez",
                venta_id=venta_ids[0],
                monto_total=Decimal("850.00"),
                monto_pagado=Decimal("300.00"),
                estado=EstadoCuenta.pendiente,
                fecha_creacion=datetime.now()
            ),
            CuentaPorCobrar(
                id=uuid.uuid4(),
                cliente_nombre="María González",
                venta_id=venta_ids[1],
                monto_total=Decimal("1200.00"),
                monto_pagado=Decimal("0.00"),
                estado=EstadoCuenta.pendiente,
                fecha_creacion=datetime.now()
            ),
            CuentaPorCobrar(
                id=uuid.uuid4(),
                cliente_nombre="Carlos López",
                venta_id=uuid.uuid4(),
                monto_total=Decimal("450.00"),
                monto_pagado=Decimal("450.00"),
                estado=EstadoCuenta.pagada,
                fecha_creacion=datetime.now()
            ),
            CuentaPorCobrar(
                id=uuid.uuid4(),
                cliente_nombre="Ana Martínez",
                venta_id=uuid.uuid4(),
                monto_total=Decimal("2100.00"),
                monto_pagado=Decimal("1000.00"),
                estado=EstadoCuenta.pendiente,
                fecha_creacion=datetime.now()
            ),
            CuentaPorCobrar(
                id=uuid.uuid4(),
                cliente_nombre="Roberto Fernández",
                venta_id=uuid.uuid4(),
                monto_total=Decimal("680.00"),
                monto_pagado=Decimal("680.00"),
                estado=EstadoCuenta.pagada,
                fecha_creacion=datetime.now()
            ),
        ]
        
        for cuenta in cuentas_cobrar:
            db.add(cuenta)
        
        # ========== PAGOS REGISTRADOS (HISTORIAL) ==========
        pagos = [
            Pago(
                id=uuid.uuid4(),
                tipo=TipoPago.compra,
                referencia_id=orden_compra_ids[2],
                monto=Decimal("875.50"),
                metodo=MetodoPago.transferencia,
                estado=EstadoPago.completado,
                fecha=datetime.now()
            ),
            Pago(
                id=uuid.uuid4(),
                tipo=TipoPago.venta,
                referencia_id=venta_ids[0],
                monto=Decimal("300.00"),
                metodo=MetodoPago.efectivo,
                estado=EstadoPago.completado,
                fecha=datetime.now()
            ),
            Pago(
                id=uuid.uuid4(),
                tipo=TipoPago.venta,
                referencia_id=uuid.uuid4(),
                monto=Decimal("450.00"),
                metodo=MetodoPago.transferencia,
                estado=EstadoPago.completado,
                fecha=datetime.now()
            ),
        ]
        
        for pago in pagos:
            db.add(pago)
        
        await db.commit()
        
        print(f"✅ Seed de pagos completado:")
        print(f"   - {len(cuentas_pagar)} cuentas por pagar")
        print(f"   - {len(cuentas_cobrar)} cuentas por cobrar")
        print(f"   - {len(pagos)} pagos registrados")