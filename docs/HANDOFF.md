# Handoff — Trabajar en `integration` rumbo a la entrega del jueves

**Deadline:** jueves 2026-06-18.
**Rama base:** `integration`.
**Documento evaluable:** `Práctica 3.pdf` (título interno: "Práctica 7").

> El audio original (Practica3) mencionaba 7 servicios distintos. El PDF formal
> pide **5 obligatorios + 2 compartidos** y deja fuera Compras/Pagos/Facturación/RRHH.
> Vamos por **pivote total** — y la Fase 1-lite ya está aplicada:
> - Renombrados: `catalog` → `product`, `almacen` → `inventory`, `ventas` → `sales`.
> - Creados (esqueleto): `customer`, `notification`, `auth`, `company`.
> - Archivados (eliminados del compose, guardados en tag `archive/rolando-dev`): compras, pagos, facturacion, rrhh.

---

## 0. Antes de arrancar (todos)

```bash
git fetch --all --prune
git checkout integration
git pull
cp .env.example .env
docker compose up --build -d
```

Verificar (debería ver `Up X seconds (healthy)` en los 16 contenedores):
```bash
docker compose ps
curl http://localhost:8000/health           # gateway
curl http://localhost:8000/products         # 200, lista vacía
curl http://localhost:8000/inventory/stock  # 200, lista vacía
curl http://localhost:8001/docs             # Swagger directo de product
```

Abrir <http://localhost:3000> → UI con 3 tabs (Productos, Inventario, Ventas).

Si algo no arranca, **antes de tocar código** revisar `docker compose logs <servicio>`.

### Tags de respaldo (no borrar)

| Tag | Qué contiene |
|---|---|
| `archive/main` | Esqueleto inicial. |
| `archive/rolando-dev` | Implementación completa de los 7 servicios viejos (catalog/almacen/ventas/compras/pagos/facturacion/rrhh) con Stripe. |
| `archive/dani-mollinedo` | Implementación de Dani (paths en español). |
| `archive/feature-mejoras-interfaz` | UI rica original. |

Para mirar el código viejo de Compras/Pagos/Facturación/RRHH:
```bash
git show archive/rolando-dev:services/compras/app/routes.py
```

---

## 1. Estado actual y asignación de servicios

| Equipo PDF | Servicio (carpeta) | Puerto host | Prefijo gateway | Estado | Owner |
|---|---|---|---|---|---|
| Equipo 1 | **product** `services/product/` | 8001 | `/products`, `/categories` | ✅ CRUD funcional. Ampliar: Categorías, Marcas, Código de barras, Estado. Publicar eventos. | _por asignar_ |
| Equipo 2 | **inventory** `services/inventory/` | 8002 | `/inventory/*` | ⚙️ Stock+movimientos funcionando. Falta: `/inventory/loadExcel`, refactor endpoints según PDF, Kardex, eventos. | _por asignar_ |
| Equipo 3 | **sales** `services/sales/` | 8003 | `/sales/*` | ⚙️ GET funciona. POST devuelve 501 — reimplementar orquestación (Product + Inventory + Customer). | _por asignar_ |
| Equipo 4 | **customer** `services/customer/` | 8004 | `/customers/*` | 🆕 Esqueleto. Implementar CRUD + puntos + historial + descuentos + eventos. | _por asignar_ |
| Equipo 5 | **notification** `services/notification/` | 8005 | `/notifications/*` | 🆕 Esqueleto. Implementar consumidor del broker + endpoint de auditoría. **También arma RabbitMQ en compose.** | _por asignar_ |
| Compartido | **auth** `services/auth/` | 8006 | `/auth/*` | 🆕 Esqueleto. Implementar JWT + roles (Administrador, Cajero, Supervisor, Gerente) + **middleware compartido para los otros 6**. | _por asignar_ |
| Compartido | **company** `services/company/` | 8007 | `/companies/*` | 🆕 Esqueleto. CRUD compañías + sucursales + ciudades. **Antes de empezar: consultar al docente si lo provee.** | _por asignar_ |

Frontend (vale 40 pts en la rúbrica) lo lleva una persona dedicada — ver sección 3.

---

## 2. Cómo trabajar sin pisarse

### Flujo por persona

```bash
git checkout integration
git pull
git checkout -b feature/<tu-servicio>      # ej: feature/customer-service
# trabajar dentro de services/<tu-servicio>/ ...
git push -u origin feature/<tu-servicio>
# abrir PR contra integration
```

### Reglas

1. **Una persona, un servicio, una rama.** No mezclar cambios entre servicios.
2. **No tocar `services/<otro>/`.** Si necesitan algo del servicio de otra persona, mensaje al grupo.
3. **No tocar `gateway/nginx.conf` ni `docker-compose.yml`.** Esos los toca solo el coordinador o el owner de la nueva infra (broker).
4. **PRs chicos y frecuentes.** Un PR de 800 líneas el miércoles a la noche es ingobernable.
5. **Antes de mergear a `integration`:** `curl http://localhost:8000/<tu-servicio>/health` debe responder 200 en tu máquina **y** en la de un compañero.

### Endpoints exigidos por el PDF (resumen)

**Product Service** (`/products`)
- `POST /products`, `GET /products`, `GET /products/{id}`, `PUT /products/{id}`, `DELETE /products/{id}`, `GET /categories`.
- Eventos: `ProductCreated`, `ProductUpdated`, `ProductDeleted`.

**Inventory Service** (`/inventory`)
- `POST /inventory/loadExcel`, `POST /inventory/input`, `POST /inventory/output`, `POST /inventory/transfer`, `GET /inventory/{product}`, `GET /inventory/balance`.
- Eventos: `InventoryLoaded`, `InventoryUpdated`, `TransferCompleted`, `StockLow`.

**Sales Service** (`/sales`)
- `POST /sales`, `GET /sales`, `GET /sales/{id}`.
- Eventos: `SaleCreated`, `SaleCancelled`, `SaleCompleted`.
- Llama por REST: Product, Inventory, Customer.

**Customer Service** (`/customers`)
- `POST /customers`, `GET /customers`, `GET /customers/{id}`, `GET /customers/{id}/history`, `POST /customers/{id}/points`.
- Eventos: `CustomerCreated`, `PointsAssigned`, `CustomerUpdated`.

**Notification Service**
- Sin endpoints de creación (las notificaciones nacen de eventos).
- Opcional: `GET /notifications` para auditoría.
- Consume del broker: `SaleCompleted`, `TransferCompleted`, `PointsAssigned`, `PromotionCreated`.

**Authentication Service** (`/auth`)
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- Roles: Administrador, Cajero, Supervisor, Gerente.

**Company Service** (`/companies`)
- `POST /companies`, `GET /companies`, `POST /companies/{id}/branches`, `GET /companies/{id}/branches`.

---

## 3. Frontend (40 pts del rúbric — owner dedicado)

Estado actual:
- 3 tabs visibles funcionando: Productos, Inventario, Ventas.
- Hay carpetas viejas en `frontend/modules/` (compras, pagos, facturacion, rrhh) que ya no se cargan — el owner las puede borrar.
- Falta: tabs nuevos para Customer y Notification.
- Falta: renombrar `frontend/modules/{catalog,almacen,ventas}/` a `{product,inventory,sales}/` para consistencia con backend.
- Falta: integrar JWT (Bearer) en `frontend/modules/api/api.js` cuando Auth esté listo.

El owner del frontend trabaja a partir de los endpoints reales conforme van llegando.

---

## 4. Capa técnica común

### JWT
**Owner: Auth Service.**

Mientras Auth no esté listo, los otros servicios **no** ponen JWT. Lo enchufamos al final (miércoles tarde o jueves mañana).

El owner de Auth debe publicar un snippet de Python en `docs/` con un `Depends(verify_jwt)` reutilizable. Cada servicio agrega 2 líneas:
```python
from app.auth_dep import verify_jwt
router = APIRouter(prefix="...", dependencies=[Depends(verify_jwt)])
```

**Plan B si no llega:** dejar un middleware mock que acepte un token hardcodeado. Cumple el rúbric mínimo de "valida JWT".

### Broker — RabbitMQ
**Owner: Notification Service (porque es el principal consumidor).**

Pasos:
1. Descomentar el bloque `rabbitmq:` en `docker-compose.yml` (ya está preparado).
2. Decidir topología: 1 exchange `topic` por servicio (`product.*`, `inventory.*`, `sales.*`, `customer.*`) o un exchange global `events`. **Decidir martes AM.**
3. Definir estructura del payload del evento. Sugerido:
   ```json
   {
     "event_type": "SaleCompleted",
     "event_id": "uuid",
     "timestamp": "2026-06-18T10:30:00Z",
     "data": { ... }
   }
   ```
4. Publicar el contrato en `docs/events.md` (lo crea el owner del broker).

**Plan B si no llega:** dejar al menos UN evento implementado (`SaleCompleted` → consumido por Notification). Es lo mínimo para defender "comunicación asíncrona".

### Excel import (Inventory)
El PDF lo exige (`POST /inventory/loadExcel`). Usar `pandas` + `openpyxl` o `python-multipart` + `openpyxl`.

**Plan B:** soportar también JSON inicial — pero el Excel es lo evaluable.

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Auth no llega listo | Mock JWT (token hardcodeado válido). |
| Broker no llega listo | UN evento real (`SaleCompleted` → Notification), el resto stub. |
| Excel import no llega | Soporte JSON como fallback, pero implementar Excel. |
| Conflictos en compose/gateway | Solo 1 persona los toca (broker owner). |
| Frontend queda crudo | Persona dedicada desde día 1, prioridad por encima del Company Service. |

---

## 6. Cronograma sugerido (Lun–Jue)

| Día | Quién | Qué |
|---|---|---|
| **Lunes (hoy)** | Todos | Clonar `integration`, levantar stack, verificar 16 containers `healthy`. Owner asignado a su servicio. |
| **Martes AM** | Notification + Auth | Decisión de broker (topología + payload). Descomentar rabbitmq en compose. Esqueleto del middleware JWT. |
| **Martes PM** | Owners | Endpoints REST mínimos del PDF para cada servicio. Frontend owner ajusta tabs. |
| **Miércoles AM** | Auth + Broker | Auth funcional, primer evento end-to-end (Sales → SaleCompleted → Notification). |
| **Miércoles PM** | Todos | Wire-up: JWT en todos + eventos faltantes. Frontend conectado. |
| **Jueves AM** | Todos | **Ensayo del flujo de demostración del PDF (10 pasos).** Bugfixes. |
| **Jueves PM** | Defensa | 🎯 |

---

## 7. Flujo de demostración (memorizar — el docente lo evalúa)

Del PDF, sección "Flujo de Demostración Final":

1. Crear compañía "SuperMarket Bolivia" (Company Service).
2. Crear 2 sucursales: Central y Zona Norte (Company Service).
3. Registrar productos: Arroz, Leche, Aceite, Azúcar (Product Service).
4. **Importar inventario desde Excel** (Inventory Service — Código, Producto, Sucursal, Cantidad, Costo, Precio).
5. Consultar existencias (Inventory Service).
6. Registrar un cliente (Customer Service).
7. Realizar una venta (Sales Service) — debe verificarse: existencia, stock, actualización de inventario, comprobante, asignación de puntos, **envío de notificación**.
8. Registrar una baja por pérdida o vencimiento (Inventory Service).
9. Transferir inventario entre sucursales (Inventory Service).
10. Consultar saldo final por sucursal (Inventory Service).

Si uno de estos 10 pasos falla en la defensa, se nota inmediatamente.

---

## 8. Cómo responder si el docente pregunta por los servicios viejos

> "¿Por qué no tienen Compras/Pagos/Facturación/RRHH?"

> "Estaban modelados a partir del relato del audio original. Decidimos archivarlos porque el PDF formal no los evalúa. Quedan disponibles en el tag `git show archive/rolando-dev:services/compras/...` por si se requieren mostrar."

---

## 9. Glosario de cambios respecto al audio

| Audio original | PDF (lo que vale) | Acción |
|---|---|---|
| catalog | Product Service | renombrado a `services/product/` |
| almacen | Inventory Service | renombrado a `services/inventory/` |
| ventas | Sales Service | renombrado a `services/sales/` |
| compras | — | archivado (tag) |
| pagos | — | archivado (tag) |
| facturacion | — | archivado (tag) |
| rrhh | — | archivado (tag) |
| — | Customer Service | creado |
| — | Notification Service | creado |
| — | Authentication Service | creado |
| — | Company Service | creado |
| multi-agencia | solo sucursales | simplificación pendiente en los modelos de Inventory/Sales |
