# Contratos HTTP inter-servicio

Este documento congela las firmas que cada servicio expone y que otros consumen.
**Antes de cambiar uno, avisar al equipo y actualizar este archivo.**

Todas las llamadas inter-servicio pasan por la red interna de Docker
(`http://<servicio>:8000`). Los clientes están en `app/clients.py` de
`ventas` y `compras`.

---

## Catalog (`catalog:8000`)

### `GET /products/{producto_id}`

Usado por: **ventas** (al crear venta para obtener nombre y precio).

Respuesta 200:
```json
{
  "id": "uuid",
  "codigo": "PROD-001",
  "nombre": "Pan integral",
  "descripcion": "...",
  "categoria": "panadería",
  "unidad_medida": "unidad",
  "precio_base": "12.50"
}
```

Respuesta 404 si no existe → ventas lo traduce a 422.

---

## Almacen (`almacen:8000`)

### `POST /movimientos`

Usado por: **ventas** (salida), **compras** (entrada).

Request:
```json
{
  "tipo": "salida",                                  // entrada | salida | ajuste
  "agencia_id": "660e8400-e29b-41d4-a716-446655440001",
  "producto_id": "uuid",
  "cantidad": 3,
  "referencia": "venta:<uuid>"                       // opcional, para trazabilidad
}
```

Respuesta 201:
```json
{
  "id": "uuid",
  "tipo": "salida",
  "agencia_id": "uuid",
  "producto_id": "uuid",
  "cantidad": 3,
  "referencia": "venta:<uuid>",
  "fecha": "2026-06-15T10:30:00Z"
}
```

Respuesta 409 si stock insuficiente en "salida" → ventas debe revertir y devolver 409.

---

## Pagos (`pagos:8000`)

### `POST /pagos`

Usado por: **ventas** (registrar el pago de la venta).

Request:
```json
{
  "tipo": "venta",                                   // venta | compra
  "referencia_id": "<id de venta o compra>",
  "monto": "62.50",
  "metodo": "tarjeta"                                // efectivo | tarjeta | transferencia
}
```

Respuesta 201:
```json
{
  "id": "uuid",
  "tipo": "venta",
  "referencia_id": "uuid",
  "monto": "62.50",
  "metodo": "tarjeta",
  "estado": "pendiente",                             // o "completado" si no es tarjeta
  "stripe_payment_intent_id": "pi_xxx",              // solo si tarjeta
  "client_secret": "pi_xxx_secret_yyy",              // solo si tarjeta (para frontend)
  "fecha": "2026-06-15T10:30:00Z"
}
```

Respuesta 503 si Stripe no está configurado y `metodo == "tarjeta"`.

### `POST /cuentas-por-pagar`

Usado por: **compras** (al recepcionar una orden).

Request:
```json
{
  "proveedor_id": "uuid",
  "orden_compra_id": "uuid",
  "monto_total": "1250.00"
}
```

Respuesta 201:
```json
{
  "id": "uuid",
  "proveedor_id": "uuid",
  "orden_compra_id": "uuid",
  "monto_total": "1250.00",
  "monto_pagado": "0.00",
  "estado": "pendiente",
  "fecha_creacion": "2026-06-15T10:30:00Z"
}
```

---

## Facturación (`facturacion:8000`)

### `POST /facturas`

Usado por: **ventas** (al cerrar la venta).

Request:
```json
{
  "venta_id": "uuid",
  "agencia_id": "uuid",
  "cliente_nombre": "Ana López",
  "cliente_documento": "1234567",
  "items": [
    {
      "producto_id": "uuid",
      "producto_nombre": "Pan integral",
      "cantidad": 3,
      "precio_unitario": "12.50",
      "subtotal": "37.50"
    }
  ],
  "subtotal": "37.50",
  "total": "42.38"
}
```

Respuesta 201:
```json
{
  "id": "uuid",
  "numero": "A001-00000001",                         // generado por agencia
  "agencia_id": "uuid",
  "venta_id": "uuid",
  "cliente_nombre": "Ana López",
  "cliente_documento": "1234567",
  "subtotal": "37.50",
  "iva": "4.88",
  "total": "42.38",
  "fecha_emision": "2026-06-15T10:30:00Z",
  "items_json": [...]
}
```

---

## Flujo de Ventas (orquestación E2E)

`POST /ventas/ventas` ejecuta este flujo internamente:

```
1. Catalog.get_product(producto_id) por cada item
2. Almacen.crear_movimiento(salida) por cada item
   → si 409, revertir con entradas compensatorias y devolver 409
3. Crear Venta local (estado=pendiente)
4. Pagos.crear_pago(tipo=venta) → guardar pago_id
5. Facturacion.emitir_factura(...) → guardar factura_id
6. Marcar Venta como pagada
7. Devolver VentaOut completa
```

## Flujo de Recepción de compra

`POST /compras/ordenes-compra/{id}/recepcion`:

```
1. Almacen.crear_movimiento(entrada, agencia_destino_id) por cada item
2. Pagos.crear_cuenta_por_pagar(proveedor_id, orden_id, total)
3. Actualizar OrdenCompra a estado=recibida con cuenta_por_pagar_id
```

---

## UUIDs compartidos de agencias

Estos IDs están hardcodeados en el seed de cada servicio. **No cambiar**:

| Código | UUID                                   | Sucursal      | Nombre               |
| ------ | -------------------------------------- | ------------- | -------------------- |
| A001   | 660e8400-e29b-41d4-a716-446655440001   | La Paz        | Centro La Paz        |
| A002   | 660e8400-e29b-41d4-a716-446655440002   | La Paz        | Sopocachi            |
| A003   | 660e8400-e29b-41d4-a716-446655440003   | Santa Cruz    | Equipetrol           |
| A004   | 660e8400-e29b-41d4-a716-446655440004   | Santa Cruz    | Norte                |
| A005   | 660e8400-e29b-41d4-a716-446655440005   | Cochabamba    | Centro Cocha         |
| A006   | 660e8400-e29b-41d4-a716-446655440006   | Cochabamba    | Sur                  |
