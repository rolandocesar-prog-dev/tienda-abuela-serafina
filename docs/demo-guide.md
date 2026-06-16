# Guía de demo y verificación

Cómo levantar el sistema, probarlo y demostrar cada parte. Pensado tanto
para compañeros del equipo como para mostrar al docente.

> Esta guía asume que estás en la rama **`rolando-dev`** (la que tiene
> la implementación funcional). Si estás en `main`, los endpoints
> devuelven 501 porque es solo el esqueleto.

---

## 1. Pre-requisitos

- Docker Desktop (Windows/Mac) o Docker Engine + Compose v2 (Linux).
- Git.
- Puertos libres: `3000`, `8000`, `8001`–`8007`, `54321`–`54327`.
- **Para Stripe** (opcional pero recomendado para la demo):
  - Cuenta gratuita en https://dashboard.stripe.com (test mode).
  - Stripe CLI: https://github.com/stripe/stripe-cli/releases/latest

---

## 2. Levantar el sistema

```bash
git checkout rolando-dev
cp .env.example .env
docker compose up --build
```

Primera vez: ~3 minutos compilando imágenes.

Verificá que estén `(healthy)`:
```bash
docker compose ps
```

---

## 3. Verificación rápida (sin frontend, solo curl)

Los 7 microservicios responden por el gateway en `:8000`:

```bash
for s in catalog almacen ventas compras pagos facturacion rrhh; do
  curl -s http://localhost:8000/$s/health
  echo ""
done
```

Esperás 7 líneas `{"status":"ok","service":"..."}`.

Cada servicio tiene su Swagger:
- catalog → http://localhost:8001/docs
- almacen → http://localhost:8002/docs
- ventas → http://localhost:8003/docs
- compras → http://localhost:8004/docs
- pagos → http://localhost:8005/docs
- facturacion → http://localhost:8006/docs
- rrhh → http://localhost:8007/docs

---

## 4. Demo desde el frontend (lo más visual)

Abrí **http://localhost:3000** y seguí este guion:

### 4.1 Cargar catálogo
1. Tab **Productos** → **+ Nuevo producto**
2. Crear "Pan integral 500g" — categoría `panaderia` — precio `12.50`.
3. Crear "Leche entera 1L" — categoría `lacteos` — precio `8.00`.

### 4.2 Cargar stock vía compra (orquestación 1)
1. Tab **Nueva compra**.
2. Click **+ Nuevo proveedor** → "Distribuidora Andina", NIT `1234567890`.
3. Agregá 20 panes a `10.00` y 15 leches a `6.00`.
4. **Crear orden**.
5. En la columna derecha, click **Recepcionar** en la orden recién creada.
6. Verificá en tab **Reportes** que el stock incrementó.

> Internamente: Compras → POST a Almacen `/movimientos` (entrada por item)
> + POST a Pagos `/cuentas-por-pagar`. Si Pagos falla, las entradas se compensan.

### 4.3 Vender (orquestación 2 — el hito grande)
1. Tab **Nueva venta**.
2. Agregá 2 panes y 1 leche.
3. Cliente: "Ana López", documento `1234567`.
4. Método: **Efectivo** (para ver el flujo más simple primero).
5. **Procesar venta**.
6. Verás el resultado con: `venta_id`, total con IVA, `pago_id`, número
   de factura (formato `A001-00000001`).
7. Verificá en tab **Reportes** que el stock disminuyó.

> Internamente: Ventas →
> 1. Catalog GET `/products/{id}` por cada item (precio + nombre)
> 2. Almacen POST `/movimientos` (salida) por cada item
> 3. Crea Venta local pendiente
> 4. Pagos POST `/pagos` → pago_id
> 5. Facturacion POST `/facturas` → factura_id con correlativo
> 6. Marca Venta como pagada
>
> Si cualquier paso falla, compensa stock y marca cancelada.

### 4.4 Empleados
1. Tab **Empleados** → **+ Nuevo empleado**.
2. Llenar datos y asignar a una agencia.
3. Cambiar el filtro de arriba para ver empleados por agencia.
4. **Baja** hace soft delete (activo=false), no borra.

---

## 5. Demo con Stripe (PAGOS REALES EN MODO TEST)

Esto cubre el acceptance criterion *"Una venta con pago en tarjeta llega
a Stripe en modo test y aparece en el dashboard de Stripe"*.

### 5.1 Configurar Stripe (una sola vez)

1. Registrate en https://dashboard.stripe.com (cualquier email).
2. **NO actives la cuenta**. Quedate en *Test mode* (toggle arriba).
3. Si tu país (ej. Bolivia) no está en el dropdown de registro, podés elegir
   Chile, Brasil, México o cualquier otro soportado — para test no importa.
4. Ir a https://dashboard.stripe.com/test/apikeys → copiar la **Clave secreta**
   (`sk_test_...`).
5. Editar `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_TU_LLAVE_REAL
   ```
6. Reiniciar pagos: `docker compose up -d --force-recreate pagos`

### 5.2 Hacer una venta con tarjeta

1. En el frontend, tab **Nueva venta** → método **Tarjeta (Stripe)** → procesar.
2. La respuesta tiene `pago_id` con estado `pendiente`.
3. Abrí https://dashboard.stripe.com/test/payments — **ahí está tu PaymentIntent**
   con el monto correcto y los metadatos (`tipo`, `referencia_id`).

### 5.3 Cerrar el loop con Stripe CLI (opcional, impresiona)

Esto demuestra que el webhook funciona end-to-end.

**Terminal 1** — arrancar el listener:
```bash
stripe login
stripe listen --forward-to http://localhost:8005/pagos/stripe/webhook
```
Te imprime `Your webhook signing secret is whsec_...`. Copialo a `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_LO_QUE_IMPRIMIO
```
Y reiniciá pagos: `docker compose up -d --force-recreate pagos`.

**Terminal 2** — confirmar el pago:

Primero, sacá el `pi_...` de tu BD:
```bash
curl http://localhost:8005/pagos/<pago_id_de_tu_venta>
# busca "stripe_payment_intent_id": "pi_..."
```

Después, confirmá con la tarjeta de prueba Visa:
```bash
stripe payment_intents confirm pi_TU_INTENT --payment-method=pm_card_visa
```

En Terminal 1 vas a ver llegar `payment_intent.succeeded` con `[200]`.

Consultá el pago de nuevo:
```bash
curl http://localhost:8005/pagos/<pago_id>
```
El `estado` ahora es **`completado`** — actualizado solo por el webhook,
sin tocar nada manualmente.

---

## 6. Demo de independencia entre servicios

Esto demuestra que cada microservicio es desplegable independiente.

```bash
# Bajar solo ventas
docker compose stop ventas

# Los otros 6 siguen funcionando:
curl http://localhost:8000/catalog/health
curl http://localhost:8000/almacen/health
# ... etc.

# Pero las ventas devuelven 502 (servicio no responde):
curl -i http://localhost:8000/ventas/health

# Volverlo a levantar:
docker compose start ventas
```

---

## 7. Limpiar y empezar de cero

```bash
docker compose down -v
```

`-v` borra también los volúmenes de Postgres. Útil si dejaste datos
basura de pruebas y querés empezar limpio.

---

## 8. Troubleshooting

| Síntoma | Solución |
| --- | --- |
| `docker compose up` rebota un servicio en loop | `docker compose logs <servicio>` para ver el error real |
| `Stripe rechazó el cobro` | Verificá que tu `STRIPE_SECRET_KEY` en `.env` no sea el placeholder y haga reset: `docker compose up -d --force-recreate pagos` |
| Stock insuficiente al vender | Cargá stock primero vía una compra recepcionada, o cambiá a una agencia que tenga stock |
| El frontend no carga datos | Verificá CORS en consola del navegador (F12). El gateway nginx ya envía los headers correctos |
| `failed to set up container networking: network not found` | `docker compose down` + `docker compose up -d` recrea la red |

---

## 9. Checklist de acceptance criteria del docente

| Criterio | Cómo demostrarlo |
| --- | --- |
| `docker compose up --build` levanta todo | Sección 2 |
| Los 7 `/health` responden 200 vía gateway | Sección 3 |
| Frontend lista productos del catálogo | Sección 4.1 |
| Venta E2E (stock + pago + factura) | Sección 4.3 |
| Compra recepcionada (stock + CxP) | Sección 4.2 |
| Empleado por agencia | Sección 4.4 |
| Venta con tarjeta llega a Stripe test | Sección 5.2 (y 5.3 para el loop completo) |
| Independencia de servicios | Sección 6 |
| Documentación en `docs/` completa | Este archivo + los demás en `docs/` |
