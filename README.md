# Tienda Abuela Serafina — Microservicios

Sistema de gestión retail multi-sucursal / multi-agencia.
Práctica 3 — Arquitectura de Software, UAB.

## Stack

Python 3.12 · FastAPI · SQLAlchemy 2.0 async · asyncpg · Pydantic v2 · PostgreSQL 16 · Docker Compose · Nginx · Stripe (test).

## Arquitectura

Siete microservicios independientes (BD propia cada uno), un gateway Nginx que rutea por prefijo, y un frontend HTML+JS vanilla.

| Servicio    | Puerto host | Prefijo en gateway |
| ----------- | ----------- | ------------------ |
| catalog     | 8001        | /catalog/          |
| almacen     | 8002        | /almacen/          |
| ventas      | 8003        | /ventas/           |
| compras     | 8004        | /compras/          |
| pagos       | 8005        | /pagos/            |
| facturacion | 8006        | /facturacion/      |
| rrhh        | 8007        | /rrhh/             |
| gateway     | 8000        | —                  |
| frontend    | 3000        | —                  |

## Quick start (estado esqueleto)

> ⚠️ **El proyecto está en estado ESQUELETO.** Todo levanta, pero la lógica
> de los endpoints todavía no está implementada — devuelven `501 No implementado`.
> Ese es el punto de partida desde donde cada uno implementa SU servicio.

### 1. Pre-requisitos

- Docker Desktop instalado y corriendo (Windows/Mac) o Docker Engine + Compose v2 (Linux).
- Git.
- Puertos libres en localhost: `3000`, `8000`, `8001`–`8007`, `54321`–`54327`.

### 2. Clonar y levantar

```bash
git clone <url-del-repo>
cd tienda-abuela
cp .env.example .env
docker compose up --build
```

La primera vez tarda ~3 minutos (descarga imágenes + compila los 7 servicios).
Cuando todo está listo verás algo como `Application startup complete` por cada servicio.

Para correr en segundo plano: `docker compose up --build -d`
Para ver el estado: `docker compose ps` (todos deberían estar `running (healthy)`)
Para apagar: `docker compose down` (agregar `-v` para borrar también las BDs).

### 3. Qué deberías ver funcionando en este estado esqueleto

✅ **Sí funciona ahora mismo:**

| Comprobación                                                       | Esperado                                            |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `curl http://localhost:8000/health`                                | `{"status":"ok","service":"gateway"}`               |
| `curl http://localhost:8000/catalog/health`                        | `{"status":"ok","service":"catalog"}`               |
| `curl http://localhost:8000/almacen/health`                        | `{"status":"ok","service":"almacen"}`               |
| `curl http://localhost:8000/ventas/health`                         | `{"status":"ok","service":"ventas"}`                |
| `curl http://localhost:8000/compras/health`                        | `{"status":"ok","service":"compras"}`               |
| `curl http://localhost:8000/pagos/health`                          | `{"status":"ok","service":"pagos"}`                 |
| `curl http://localhost:8000/facturacion/health`                    | `{"status":"ok","service":"facturacion"}`           |
| `curl http://localhost:8000/rrhh/health`                           | `{"status":"ok","service":"rrhh"}`                  |
| Abrir <http://localhost:3000>                                      | Frontend con header, 5 tabs y dropdown de agencias  |
| Abrir <http://localhost:8001/docs> (idem 8002..8007)               | Swagger con todos los endpoints listados            |
| En cualquier servicio con agencias (almacen, ventas, compras, facturacion, rrhh), ver los logs: | "Servicio X listo" tras crear 6 agencias en seed   |

❌ **NO funciona aún** (lo va a implementar cada owner):

- `POST /catalog/products`, `GET /catalog/products`, etc. → devuelven `501 No implementado`.
- `POST /ventas/ventas`, `POST /compras/ordenes-compra`, etc. → `501`.
- Los tabs del frontend muestran un mensaje `TODO(owner-frontend)`.
- Stripe no funciona (las llaves en `.env.example` son placeholders).

Esto es **esperado** — significa que el esqueleto está bien.

### 4. Próximo paso

Cada persona toma su servicio según [docs/asignacion-equipo.md](docs/asignacion-equipo.md)
y empieza a implementar la lógica en su `routes.py`. Los contratos en `schemas.py`
y los endpoints en `routes.py` ya están — solo hay que rellenar el cuerpo.

Ver [docs/quick-start.md](docs/quick-start.md) para tips de cómo iterar rápido
en un solo servicio sin levantar todo.

## Estado actual

> ⚠️ **Dos ramas con propósitos distintos:**
> - **`main`** → mantiene el **esqueleto original** para análisis del equipo.
>   Los `routes.py` devuelven 501 hasta que se implementen.
> - **`rolando-dev`** → **implementación funcional completa**. Los 7 servicios
>   responden CRUD real, la venta orquesta E2E, Stripe funciona, frontend con
>   5 tabs. **Esto es lo que se demuestra y se evalúa**.

### Lo que está **funcionando** en `rolando-dev`

Backend:
- ✅ **Catalog** — CRUD productos con 409 si código duplicado.
- ✅ **Almacen** — stock + movimientos atómicos con `SELECT FOR UPDATE`. Rechaza salidas que dejarían stock negativo.
- ✅ **Pagos** — efectivo/transferencia (estado=completado directo) + **Stripe PaymentIntents reales** (estado=pendiente → completado vía webhook).
- ✅ **Facturación** — numeración correlativa por agencia (`A001-00000001`, ...) atómica, IVA 13% server-side.
- ✅ **RRHH** — CRUD empleados, soft delete, filtros por agencia y sucursal.
- ✅ **Compras** — CRUD proveedores/órdenes + **recepción orquestada** (Almacen + Pagos) con compensación si algo falla.
- ✅ **Ventas** — **flujo E2E completo**: Catalog → Almacen → Pagos → Facturación. Si Pagos o Facturación fallan, compensa stock y marca venta cancelada.

Frontend (5 tabs en vanilla JS):
- ✅ Productos: grid con crear/eliminar.
- ✅ Nueva venta: carrito, datos de cliente, método de pago, resultado con número de factura.
- ✅ Nueva compra: alta de proveedor inline, carrito, crear orden, recepcionar pendientes.
- ✅ Empleados: tabla con filtro por agencia, alta/baja.
- ✅ Reportes: stock + ventas recientes de la agencia activa.

Stripe:
- ✅ Creación real de PaymentIntents (visibles en `dashboard.stripe.com/test/payments`).
- ✅ Webhook con validación de firma (`stripe.Webhook.construct_event`).
- ✅ Estados: pendiente → completado/fallido vía evento real de Stripe.
- ✅ IVA consistente entre Ventas, Pagos y Facturación (los 3 montos coinciden).

Ver [docs/demo-guide.md](docs/demo-guide.md) para el playbook completo paso a paso.

### Lo que falta / es libre para tomar

- Tests automatizados (pytest + httpx).
- Frontend con Stripe Elements (confirmar tarjeta sin usar Stripe CLI).
- Migraciones con Alembic.
- Logging estructurado y dashboard de KPIs.

Ver [docs/asignacion-equipo.md](docs/asignacion-equipo.md) para distribución sugerida.

## Documentación

- [docs/quick-start.md](docs/quick-start.md) — cómo trabajar en un servicio.
- [docs/api-contracts.md](docs/api-contracts.md) — contratos HTTP inter-servicio.
- [docs/architecture.md](docs/architecture.md) — diagrama y decisiones.
- [docs/asignacion-equipo.md](docs/asignacion-equipo.md) — quién hace qué.

## Configurar Stripe (modo test)

Los pagos en efectivo y transferencia funcionan sin ninguna configuración.
Para habilitar pagos con tarjeta:

1. Crea una cuenta en https://dashboard.stripe.com (gratis, modo test).
2. En **Developers → API keys** copia tu *Secret key* (empieza con `sk_test_`).
3. En **Developers → Webhooks** crea un endpoint apuntando a
   `http://<host-publico>/pagos/pagos/stripe/webhook` con los eventos
   `payment_intent.succeeded` y `payment_intent.payment_failed`. Copia
   el *Signing secret* (empieza con `whsec_`).
4. Edita `.env` y reemplaza:
   ```
   STRIPE_SECRET_KEY=sk_test_TU_LLAVE_REAL
   STRIPE_WEBHOOK_SECRET=whsec_TU_WEBHOOK_SECRET
   ```
5. Reinicia el servicio: `docker compose up -d --force-recreate pagos`.

Sin llaves configuradas, los pagos con tarjeta devuelven **503** y el flujo
de venta se compensa correctamente. Para probar en local sin webhook público,
usa la [Stripe CLI](https://stripe.com/docs/stripe-cli):
`stripe listen --forward-to http://localhost:8005/pagos/stripe/webhook`.

Tarjeta de prueba: `4242 4242 4242 4242`, cualquier CVV, fecha futura.

## Restricciones del proyecto (no negociables)

- Sin autenticación, sin login, sin roles.
- Una sola compañía. Multi-sucursal y multi-agencia sí.
- Cada microservicio debe poder levantarse y funcionar independientemente.
- Comunicación inter-servicio **solo** por HTTP REST.
- No compartir esquemas de BD entre servicios.
