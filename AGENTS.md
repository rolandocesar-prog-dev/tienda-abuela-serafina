# AGENTS.md — Contexto para agentes de IA y nuevos contribuyentes

> Este archivo existe para que cualquier agente de IA (Claude Code, Cursor, Copilot)
> o persona nueva pueda entender el proyecto sin tener que reconstruirlo desde cero.
> Si vas a modificar el código, lee esto primero.

---

## Qué es este proyecto

**Tienda Abuela Serafina** — sistema de gestión retail para una cadena con varias
sucursales y agencias (una sola compañía). Práctica académica de Arquitectura de
Software (UAB). Equipo de 7 personas. Entrega: **18 de junio de 2026**.

El criterio principal de evaluación es **funcionalidad end-to-end**, no perfección
por servicio. Mejor algo conectado y funcional que cada pieza pulida en aislamiento.

---

## Stack (decidido, no cambiar)

- **Python 3.12** · FastAPI · SQLAlchemy 2.0 **async** · asyncpg · Pydantic v2 · pydantic-settings · httpx async
- **PostgreSQL 16** (una BD por servicio)
- **Docker + Docker Compose** para todo
- **Nginx** como API gateway
- **Stripe** (modo test) para pagos con tarjeta
- **Frontend**: HTML + JavaScript vanilla (sin framework)

**NO usar:** Django · Flask · SQLAlchemy sync · Alembic (en MVP usar `create_all`) ·
Kubernetes · autenticación · login · roles · brokers de mensajes (Kafka, Rabbit, etc).

---

## Restricciones arquitectónicas (no negociables)

1. **Cada microservicio es independientemente desplegable.**
   - BD propia (no compartir esquemas).
   - Dockerfile propio.
   - **Sin imports cruzados entre carpetas de servicios** (`from services.catalog...` está prohibido en otro servicio).
   - Comunicación inter-servicio **solo por HTTP REST**.
2. **NO implementar auth / login / roles.** Excluido por el docente.
3. **Multi-sucursal y multi-agencia: SÍ. Multi-compañía: NO.**
4. **Integración real con Stripe** en modo test.

---

## Estructura del repo

```
tienda-abuela/
├── README.md                # Quick start + estado del proyecto
├── AGENTS.md                # (este archivo)
├── docker-compose.yml       # 7 servicios + 7 Postgres + gateway + frontend
├── .env.example             # Variables de entorno
├── docs/
│   ├── api-contracts.md     # Contratos HTTP inter-servicio (FUENTE DE VERDAD)
│   ├── architecture.md      # Diagrama Mermaid + decisiones
│   ├── asignacion-equipo.md # Quién toma qué servicio
│   └── quick-start.md       # Cómo iterar en un servicio
├── gateway/
│   └── nginx.conf           # Routing por prefijo /servicio/
├── services/                # 7 servicios — TODOS con la misma estructura
│   └── <servicio>/
│       ├── Dockerfile
│       ├── requirements.txt
│       └── app/
│           ├── main.py      # FastAPI app + lifespan + /health
│           ├── config.py    # pydantic-settings
│           ├── database.py  # async engine + get_db + init_db
│           ├── models.py    # SQLAlchemy 2.0 declarativo
│           ├── schemas.py   # Pydantic v2 — CONTRATOS, no cambiar sin avisar
│           ├── routes.py    # APIRouter con endpoints
│           ├── seed.py      # Datos semilla (agencias)
│           └── clients.py   # Solo en ventas y compras (orquestadores)
└── frontend/
    ├── index.html · styles.css · app.js
```

---

## Mapa de servicios y dependencias

| Servicio    | Puerto | Depende de (HTTP)                            | Prefijo gateway   |
| ----------- | ------ | -------------------------------------------- | ----------------- |
| catalog     | 8001   | —                                            | `/catalog/`       |
| almacen     | 8002   | —                                            | `/almacen/`       |
| ventas      | 8003   | catalog, almacen, pagos, facturacion         | `/ventas/`        |
| compras     | 8004   | almacen, pagos                               | `/compras/`       |
| pagos       | 8005   | Stripe (externo)                             | `/pagos/`         |
| facturacion | 8006   | —                                            | `/facturacion/`   |
| rrhh        | 8007   | —                                            | `/rrhh/`          |
| gateway     | 8000   | —                                            | —                 |
| frontend    | 3000   | gateway                                      | —                 |

**Orden de implementación recomendado:** catalog → almacen → pagos → facturacion → rrhh → compras → ventas → frontend.

---

## Convenciones de código

### Reglas duras

- **Async en TODO.** Endpoints async, sesiones SQLAlchemy async, httpx async. Nunca mezclar.
- **Type hints obligatorios** en firmas. FastAPI y Pydantic los necesitan.
- **Schemas Pydantic separados de modelos SQLAlchemy.** Nunca devolver un modelo directamente desde un endpoint — siempre pasar por un `*Out` schema con `model_config = ConfigDict(from_attributes=True)`.
- **Variables de entorno para toda configuración.** Nada hardcodeado (URLs, llaves, puertos).
- **Nombres en español** para entidades de negocio y endpoints (`productos`, `ventas`, `empleados`). Nombres técnicos en inglés (`schemas`, `routes`, `models`).
- **UUIDs como PKs** (`uuid.uuid4` default), no auto-increment.
- **Decimal** para dinero, nunca `float`.

### Estructura de un módulo `app/` típico

- `main.py`: `lifespan` async → `init_db()` + `seed_data()`. Expone `/health`. Incluye el router.
- `config.py`: una clase `Settings(BaseSettings)` con `model_config = SettingsConfigDict(env_file=".env", extra="ignore")`. Singleton `settings = Settings()`.
- `database.py`: `Base` declarativa, `engine`, `AsyncSessionLocal`, `get_db()` async, `init_db()` que importa modelos y crea tablas.
- `models.py`: SQLAlchemy 2.0 con `Mapped[]` y `mapped_column()`. Enums via `enum.Enum` + `sqlalchemy.Enum`.
- `schemas.py`: Pydantic v2. Patrón `<Entidad>Create`, `<Entidad>Update`, `<Entidad>Out`.
- `routes.py`: un `APIRouter` con `prefix=` y `tags=`. Cada endpoint declara `response_model`.
- `seed.py`: función `async def seed_data() -> None`. Idempotente. Llamada desde `lifespan`.

### Códigos HTTP de error (consistencia entre servicios)

| Código | Cuándo                                              |
| ------ | --------------------------------------------------- |
| 404    | Recurso pedido en ESTE servicio no existe           |
| 409    | Conflicto de estado (stock insuficiente, etc.)      |
| 422    | Input inválido (Pydantic lo maneja solo) **o** un recurso referenciado en otro servicio no existe |
| 502    | Dependencia respondió mal (5xx)                     |
| 503    | Dependencia no respondió (timeout, conexión)        |

Body de error siempre: `{"detail": "mensaje legible en español"}`.

### Inter-service calls

Solo en `services/ventas/app/clients.py` y `services/compras/app/clients.py`.
Usar `httpx.AsyncClient` con timeout (`settings.http_timeout = 5.0`). Mapear errores
HTTP a los códigos de arriba — nunca dejar pasar excepciones crudas.

---

## Cómo levantar todo

```bash
cp .env.example .env
docker compose up --build
```

Verificar (ver checklist completa en README):

```bash
curl http://localhost:8000/<servicio>/health   # → {"status":"ok","service":"..."}
```

Swagger por servicio: `http://localhost:800N/docs` (N = 1..7).

Para iterar rápido en un solo servicio sin levantar todo, ver `docs/quick-start.md`.

---

## Datos semilla compartidos

**Las agencias tienen UUIDs FIJOS** copiados idénticos en el `seed.py` de cada servicio
que maneja `agencia_id`. Si cambias un UUID, hay que cambiarlo en TODOS. Tabla completa
en `docs/api-contracts.md`.

Servicios que poblan agencias en el lifespan: `almacen`, `ventas`, `compras`, `facturacion`, `rrhh`.

---

## Cosas que un agente debe HACER

- Antes de cambiar un `schemas.py`, leer `docs/api-contracts.md` — ese archivo es la
  fuente de verdad de los contratos. Si cambias un schema, actualiza también ese doc.
- Usar `await` en cada llamada a la BD y a httpx.
- Devolver Pydantic schemas (`*Out`) desde endpoints, no modelos SQLAlchemy.
- Validar input con Pydantic en los `*Create` / `*Update` schemas, no en el cuerpo del endpoint.
- En operaciones que orquestan otros servicios (Ventas, Compras), si un paso falla a la mitad,
  **compensar** (revertir movimientos previos) antes de devolver el error.
- Seguir Conventional Commits: `feat(servicio):`, `fix(servicio):`, `docs:`, `chore:`, `refactor:`.

## Cosas que un agente NO debe hacer

- Importar de otro servicio (`from services.catalog.app...` está prohibido en otra carpeta).
- Compartir una BD entre servicios.
- Agregar autenticación / login / JWT / roles.
- Usar SQLAlchemy síncrono o mezclar sync + async.
- Devolver modelos SQLAlchemy crudos desde endpoints.
- Hardcodear URLs de otros servicios — siempre desde `settings.<servicio>_url`.
- Hardcodear llaves de Stripe — siempre desde env vars.
- Agregar features que no estén en los `routes.py` actuales ni en el prompt original.
- Modificar el `docker-compose.yml` para añadir servicios que no estén en la lista de 7.

---

## Workflow para esta rama (rolando-dev)

Esta rama es mi rama de trabajo. La rama `main` queda intacta como esqueleto para
que el equipo la analice. Aquí voy implementando los entregables en este orden:

1. ✅ Esqueleto (en `main`)
2. ⬜ Catalog — CRUD productos
3. ⬜ Almacen — stock + movimientos
4. ⬜ Pagos — registro + Stripe
5. ⬜ Facturación — numeración correlativa
6. ⬜ RRHH — CRUD empleados
7. ⬜ Compras — CRUD + recepción
8. ⬜ Ventas — orquestación E2E
9. ⬜ Frontend mínimo

Después de cada servicio: `/code-review` para detectar bugs y `/simplify` para limpiar.

---

## Referencia rápida

- `README.md` — quick start y estado para compañeros.
- `docs/api-contracts.md` — contratos HTTP (FUENTE DE VERDAD).
- `docs/architecture.md` — diagrama y decisiones.
- `docs/asignacion-equipo.md` — quién hace qué.
- `docs/quick-start.md` — cómo iterar en un servicio.
