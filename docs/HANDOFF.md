# Handoff — Trabajar en `integration` rumbo a la entrega del jueves

**Deadline:** jueves 2026-06-18.
**Rama base:** `integration` (la unificada — ya no usen `main`, `rolando-dev`, `dani-mollinedo`, ni `feature/mejoras-interfaz`).
**Documento evaluable:** `Práctica 3.pdf` (título interno: "Práctica 7"). El audio del docente es contexto narrativo, no contrato.

> ⚠️ El audio original mencionaba 7 servicios (catalog, almacen, ventas, compras, pagos, facturacion, rrhh).
> El PDF formal pide **5 + 2 compartidos** y deja fuera compras, pagos, facturacion, rrhh.
> Vamos por **pivote total**: renombrar 3, crear 4 nuevos, archivar 4.

---

## 0. Antes de arrancar (todos)

```bash
git fetch --all --prune
git checkout integration
git pull
cp .env.example .env     # si no lo tenían
docker compose up --build -d
```

Verificá:
- `curl http://localhost:8000/health` → `{"status":"ok"}`.
- Abrir <http://localhost:3000> → UI carga con tabs.

Si algo falla acá, **avisar en el grupo antes de tocar código** — probablemente sea un puerto ocupado.

### Tags de respaldo (no borrar)

Si alguna vez necesitan recuperar trabajo previo, está todo:

| Tag | Qué contiene |
|---|---|
| `archive/main` | Esqueleto inicial. |
| `archive/rolando-dev` | Implementación de Rolando (paths en inglés, Stripe, primera versión completa). |
| `archive/dani-mollinedo` | Implementación de Dani (paths en español). |
| `archive/feature-mejoras-interfaz` | UI rica original (es la base del frontend actual). |

---

## 1. Asignación de servicios (alineada al PDF)

El PDF pide exactamente esto. Cada persona dueña de **un** servicio.

| Equipo PDF | Nombre nuevo | Hoy es | Estado | Owner |
|---|---|---|---|---|
| Equipo 1 | **Product Service** | `services/catalog` | Renombrar + agregar Categorías, Marcas, Código de barras, Estado, evento `ProductCreated/Updated/Deleted`. | _por asignar_ |
| Equipo 2 | **Inventory Service** | `services/almacen` | Renombrar endpoints a `/inventory/...`. Agregar `loadExcel`, `transfer`, `balance`, `{product}`, Kardex. Eventos `InventoryLoaded`, `InventoryUpdated`, `TransferCompleted`, `StockLow`. | _por asignar_ |
| Equipo 3 | **Sales Service** | `services/ventas` | Renombrar a `/sales`. Quitar acoplamiento con facturacion/pagos viejos. Eventos `SaleCreated/Cancelled/Completed`. | _por asignar_ |
| Equipo 4 | **Customer Service** | **(crear desde cero)** | Clientes, programa de fidelización, puntos, historial, descuentos. Eventos `CustomerCreated`, `PointsAssigned`, `CustomerUpdated`. | _por asignar_ |
| Equipo 5 | **Notification Service** | **(crear desde cero)** | Consumir eventos del broker. Registrar (fecha, cliente, tipo, contenido). No envía nada real. | _por asignar_ |
| Compartido | **Authentication Service** | **(crear desde cero)** | JWT, usuarios, roles: Administrador, Cajero, Supervisor, Gerente. | _por asignar_ |
| Compartido | **Company Service** | **(crear desde cero o pedir al docente)** | Compañías, sucursales, ciudades. **Antes de implementar, preguntar al docente si lo provee.** | _por asignar_ |

Servicios que **se archivan** (no se borran — quedan en tag `archive/rolando-dev` por si alguien pregunta):
- `services/compras`, `services/pagos`, `services/facturacion`, `services/rrhh`.

---

## 2. Cómo trabajar sin pisarse

### Flujo de trabajo por persona

```bash
git checkout integration
git pull
git checkout -b feature/<tu-servicio>      # ej: feature/inventory-service
# trabajar...
git push -u origin feature/<tu-servicio>
# abrir PR contra integration
```

**Reglas:**
1. **Una persona, una rama, un servicio.** No mezclen cambios de dos servicios en un PR.
2. **No tocar `services/<otro>/`** — si necesitan algo del servicio de otra persona, abren issue/mensaje.
3. **No tocar `gateway/nginx.conf` ni `docker-compose.yml`** sin avisar — esos rompen a todos.
4. **PRs chicos y diarios.** Un PR de 50 archivos el miércoles a la noche es ingobernable.
5. **Antes de mergear a `integration`:** debe pasar `curl http://localhost:8000/<tu-servicio>/health` en tu máquina y en la de un compañero.

### Endpoints y eventos por servicio (resumen — ver PDF para detalle)

**Product Service** (`/products`)
- Endpoints: `POST/GET/PUT/DELETE /products`, `GET /products/{id}`, `GET /categories`.
- Eventos publicados: `ProductCreated`, `ProductUpdated`, `ProductDeleted`.

**Inventory Service** (`/inventory`)
- Endpoints: `POST /inventory/loadExcel`, `POST /inventory/input`, `POST /inventory/output`, `POST /inventory/transfer`, `GET /inventory/{product}`, `GET /inventory/balance`.
- Eventos publicados: `InventoryLoaded`, `InventoryUpdated`, `TransferCompleted`, `StockLow`.

**Sales Service** (`/sales`)
- Endpoints: `POST /sales`, `GET /sales`, `GET /sales/{id}`.
- Eventos publicados: `SaleCreated`, `SaleCancelled`, `SaleCompleted`.
- Consume REST: Product (consulta producto), Inventory (consulta y descuenta stock), Customer (consulta cliente).

**Customer Service** (`/customers`)
- Endpoints: `POST/GET /customers`, `GET /customers/{id}`, `GET /customers/{id}/history`, `POST /customers/{id}/points`.
- Eventos publicados: `CustomerCreated`, `PointsAssigned`, `CustomerUpdated`.

**Notification Service**
- Sin endpoints REST públicos (o solo `GET /notifications` para auditar).
- Eventos consumidos: `SaleCompleted`, `TransferCompleted`, `PointsAssigned`, `PromotionCreated`.

**Authentication Service** (`/auth`)
- Endpoints: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- Cada servicio debe validar el JWT antes de responder.

**Company Service** (`/companies`)
- Endpoints: `POST/GET /companies`, `POST/GET /companies/{id}/branches`.

---

## 3. Capa técnica común (no la haga cada uno por separado)

### JWT
Cada servicio debe validar el token en sus endpoints. La intención: un **middleware compartido** (no lo copien ad-hoc en cada servicio). El owner de Auth Service publica el `SECRET_KEY` por variable de entorno + un snippet de Python que los demás importan.

**Mientras Auth no esté listo:** trabajen sin JWT, lo enchufamos al final. No empiecen a "preparar el terreno" — sin el contrato del token no aporta.

### Broker de mensajería
Recomendación: **RabbitMQ** (curva de aprendizaje más baja que Kafka, imagen oficial, librería `aio-pika` para FastAPI async).

**A definir entre owners de Product/Inventory/Sales antes del martes en la noche:**
- Topología: 1 exchange tipo `topic` por servicio (`product.*`, `inventory.*`, `sales.*`)?
- Estructura de payload del evento.
- Bootstrap: agregar `rabbitmq:3-management` al docker-compose.

### Frontend
**Owner único.** Trabaja en `frontend/modules/<seccion>/`. No es por persona-servicio — es una sola persona.

Tabs que se mantienen en la UI:
- Productos
- Inventario
- Ventas
- Clientes
- Notificaciones (log/auditoría)

Tabs que se quitan: Compras, Pagos, Facturación, RRHH (esos servicios se archivan).

---

## 4. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Auth Service no llega listo el jueves | Plan B: dejar JWT mock (token hardcodeado válido) — al menos cumple el "valida JWT" del rúbric. |
| Broker no llega listo | Plan B: dejar al menos **un** evento implementado (`SaleCompleted` → consumido por Notification). Es lo mínimo para defender "comunicación asíncrona". |
| Excel import en Inventory no llega | Plan B: hacer una "carga inicial" con un archivo `.json` que se lea al startup. **Pero el PDF lo pide explícitamente, no es prescindible.** |
| Conflictos en `docker-compose.yml` | Solo el owner de "infra" (decidir) toca ese archivo. Los demás mandan PRs con un comentario diciendo "agregar mi servicio acá". |

---

## 5. Cronograma sugerido (Lun–Jue)

| Día | Quién | Qué |
|---|---|---|
| **Lunes (hoy)** | Todos | Clonar `integration`, levantar stack, verificar que funciona. Owner asignado a su servicio. |
| **Martes** | Owners de servicios | Implementar endpoints REST mínimos del PDF. Frontend owner adapta tabs. |
| **Miércoles AM** | Auth + Broker | Auth Service listo, RabbitMQ corriendo, primer evento end-to-end (`SaleCompleted` → Notification). |
| **Miércoles PM** | Todos | Wire-up: JWT en todos los servicios + eventos faltantes. UI conectada. |
| **Jueves AM** | Todos | Ensayo del flujo de demostración del PDF (10 pasos). Bugfixes. |
| **Jueves PM** | Defensa | 🎯 |

---

## 6. Flujo de demostración (memorizar — el docente lo evalúa)

Del PDF, sección "Flujo de Demostración Final":

1. Crear compañía "SuperMarket Bolivia".
2. Crear 2 sucursales: Central y Zona Norte.
3. Registrar productos: Arroz, Leche, Aceite, Azúcar.
4. **Importar inventario desde Excel** (Código, Producto, Sucursal, Cantidad, Costo, Precio).
5. Consultar existencias.
6. Registrar un cliente.
7. Realizar una venta — debe verificarse: existencia, stock, actualización de inventario, comprobante, asignación de puntos, **envío de notificación**.
8. Registrar una baja por pérdida o vencimiento.
9. Transferir inventario entre sucursales.
10. Consultar saldo final por sucursal.

**Si alguno de estos 10 pasos no funciona en la defensa, se nota inmediatamente.**

---

## 7. Cómo defender los servicios "extras" si el docente pregunta

> "¿Y para qué tienen compras/pagos/facturación/rrhh?"

Respuesta: "Estaban modelados a partir del relato narrativo original del docente (audio Practica3). Decidimos archivarlos en el tag `archive/rolando-dev` porque el PDF formal no los evalúa, pero quedan disponibles como demostración de que el dominio inicial fue analizado en profundidad."

---

## 8. Contacto / decisiones rápidas

Lo que **NO** está en este doc, se decide en el grupo. Apenas se tome una decisión, se documenta acá en el mismo PR. **No conversaciones de Slack/WhatsApp como única fuente de verdad.**
