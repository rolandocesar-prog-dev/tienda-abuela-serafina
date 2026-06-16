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

## 1. Asignación del equipo (7 personas)

| # | Persona | Responsabilidad | Carpeta única que toca | Carga | Cuándo arranca | Nombre del compañero |
|---|---|---|---|---|---|---|
| 1 | **Product Service** | CRUD + Categorías + Marcas + Códigos de barras + eventos `ProductCreated/Updated/Deleted` | `services/product/` | Liviana–Media | Inmediato | _llenar_ |
| 2 | **Inventory Service** | Stock + Excel import + Kardex + transfers + eventos `InventoryLoaded`/`Updated`/`TransferCompleted`/`StockLow` | `services/inventory/` | **Pesada** | Inmediato — empezar primero | _llenar_ |
| 3 | **Sales Service** | Reimplementar POST + orquestar Product/Inventory/Customer + eventos `Sale*` | `services/sales/` | Media | Inmediato con mocks, integra el miércoles | _llenar_ |
| 4 | **Customer Service** | CRUD + puntos + historial + descuentos + eventos `Customer*`/`PointsAssigned` | `services/customer/` | Media | Inmediato | _llenar_ |
| 5 | **Notification + Broker** | Service + setup de RabbitMQ + publicar contrato de eventos en `docs/events.md` | `services/notification/` + bloque `rabbitmq` en `docker-compose.yml` + `docs/events.md` | Liviana + infra crítica | Empieza por el broker (martes AM) | _llenar_ |
| 6 | **Auth + middleware JWT** | JWT + roles (Administrador, Cajero, Supervisor, Gerente) + snippet del middleware para los demás | `services/auth/` + `docs/jwt-middleware.md` | Media | Inmediato (en paralelo con broker) | _llenar_ |
| 7 | **Frontend + Company** | **Frontend prioridad (40 pts del rúbric)**; Company es CRUD chico en ratos libres. **Preguntar primero al docente si provee Company.** | `frontend/` + `services/company/` | Pesada + Liviana | Frontend inmediato; Company después | _llenar_ |

### Por qué esta división

- **Inventory tiene su propia persona y empieza primero** — es el servicio con más trabajo (Excel, Kardex, transfers, 4 eventos) y aparece en 4 de los 10 pasos de la demo final.
- **Notification carga el broker** porque es el principal consumidor de eventos — si lo hace otro, hay un punto de coordinación más.
- **Auth tiene persona dedicada** porque su middleware bloquea a los otros 6 al final. No puede repartirse.
- **Frontend tiene persona dedicada** porque vale 40 puntos — más que cualquier otro rubro. Combinarlo con un servicio pesado lo perjudica.
- **Company se combina con Frontend** porque es el CRUD más chico y la persona del frontend puede hacerlo "entre commits" del UI. Y antes hay que confirmar con el docente.

### Si alguien termina temprano, ayuda con…

| Si termina antes el dueño de... | Que ayude a... |
|---|---|
| Product | Frontend (tab de Customer, tab de Notification) |
| Customer | Notification (consumidores) o Frontend |
| Auth | Frontend (integrar Bearer JWT en `frontend/modules/api/api.js`) |
| Cualquiera | Ensayar el flujo de demo del PDF (sección 7) |

### Regla de oro — qué toca cada uno

| Persona | Toca solo | NO toca |
|---|---|---|
| Product owner | `services/product/` | resto |
| Inventory owner | `services/inventory/` | resto |
| Sales owner | `services/sales/` | resto |
| Customer owner | `services/customer/` | resto |
| Notification owner | `services/notification/` + bloque rabbitmq en `docker-compose.yml` + `docs/events.md` | resto |
| Auth owner | `services/auth/` + `docs/jwt-middleware.md` | resto |
| Frontend+Company owner | `frontend/` + `services/company/` | resto |

`gateway/nginx.conf` y el resto del `docker-compose.yml` los toca **el coordinador** si hace falta. Cualquier necesidad de cambio se avisa primero al grupo.

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

## 2.5 Cuidados específicos por servicio (leer **antes** de tocar código)

### Inventory + Sales — herencia de `Agencia` (el esquema anterior)
Ambos servicios heredan una tabla `Agencia` con seed de 6 agencias en 3 sucursales (ver `services/inventory/app/models.py` y `services/sales/app/models.py`). El PDF habla solo de **sucursales** (responsabilidad de Company Service).

**Decisión a tomar el martes** (Inventory + Sales + Company owners):
- **A)** Dejar la tabla `Agencia` como sinónimo de "sucursal" — rápido, queda inconsistencia semántica.
- **B)** Borrar y consumir `/companies/{id}/branches` por REST — limpio, depende de que Company esté funcional.

**No tocar esos modelos** hasta que se tome la decisión, o se va a perder trabajo cuando se elija lo otro.

### Sales — POST depende de 3 servicios upstream
`POST /sales` necesita llamar a Product, Inventory y Customer. Mientras esos endpoints no estén implementados, el owner de Sales puede:
1. Implementar `GET /sales` y `GET /sales/{id}` — ya funcionan.
2. Stubear `POST /sales` con mocks locales (respuestas hardcodeadas en lugar de las llamadas HTTP).
3. Conectar las llamadas reales el miércoles cuando los upstream respondan.

**No esperar a los demás para empezar** — desarrollar con mocks.

### Auth — middleware compartido
El owner de Auth **publica primero un snippet** del middleware `verify_jwt` en `docs/jwt-middleware.md` con la firma exacta. Los otros 6 servicios lo importan. **Los demás owners no implementan JWT por su cuenta** — esperan el snippet oficial.

Mientras Auth no esté listo, los demás trabajan sin JWT. Se enchufa al final.

### Notification — el orden importa
El owner de Notification debe ejecutar **en este orden**:
1. Descomentar el bloque `rabbitmq:` en `docker-compose.yml`.
2. `docker compose up rabbitmq -d` y verificar `docker compose logs rabbitmq` que arranca.
3. Publicar el contrato de evento en `docs/events.md` (formato JSON + nombre exacto de cada exchange/queue).
4. Recién entonces implementar el consumidor.

Mientras esos 4 pasos no estén, **los otros owners no publican eventos** — los dejan como TODO. Publicar sin broker confirmado obliga a refactorizar.

### Company — preguntar al docente primero
El PDF dice que Company Service "puede ser proporcionado por el docente". **Antes de gastar tiempo en implementarlo, preguntarle.** Si lo provee, se borra `services/company/` y se actualiza el compose.

---

## 2.6 Puntos de sincronización del equipo (tres decisiones que destraban a todos)

| Decisión | Quién propone | Quién valida | Cuándo | Si no se decide, bloquea a |
|---|---|---|---|---|
| Topología del broker (exchange/queue) + estructura del payload de evento | Notification owner | Product, Inventory, Sales, Customer owners | **Martes AM** | Todos los publishers y consumers de eventos |
| Header + claims + algoritmo + secret del JWT | Auth owner | Todos | **Martes tarde** | Todos al final (no bloquea desarrollo) |
| Mantener `Agencia` o migrar a Company.branches | Inventory + Sales owners | Company owner | **Martes** | Sales POST orchestration, queries por sucursal |

Cuando alguna se decida, **se documenta** en `docs/events.md`, `docs/jwt-middleware.md` o este HANDOFF respectivamente. No conversaciones de Slack/WhatsApp como única fuente de verdad.

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
