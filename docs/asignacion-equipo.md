# Asignación de equipo

> **Estado actual (rama `rolando-dev`)**: Rolando avanzó implementando los 7
> servicios + frontend + Stripe como referencia funcional end-to-end. Esta
> rama es la **fuente de verdad funcional**. La rama `main` mantiene el
> esqueleto original para análisis. Lo que viene abajo es la asignación
> actualizada con lo que queda libre para tomar.

## Estado de implementación

| Servicio        | Esqueleto (main) | Implementación (rolando-dev) | Quién lo toma |
| --------------- | ---------------- | ----------------------------- | ------------- |
| catalog         | ✅                | ✅ Rolando                     | revisar/tests |
| almacen         | ✅                | ✅ Rolando                     | revisar/tests |
| ventas          | ✅                | ✅ Rolando (orquestador E2E)   | revisar/tests |
| compras         | ✅                | ✅ Rolando (con recepción)     | revisar/tests |
| pagos + Stripe  | ✅                | ✅ Rolando (PaymentIntent + webhook) | revisar/tests |
| facturacion     | ✅                | ✅ Rolando (numeración A001-...)| revisar/tests |
| rrhh            | ✅                | ✅ Rolando                     | revisar/tests |
| frontend        | ✅                | ✅ Rolando (5 tabs vanilla JS) | mejoras visuales |
| gateway + nginx | ✅                | ✅ Rolando                     | —             |
| documentación   | ✅                | ✅                             | —             |

Las cuentas por pagar/cobrar, el flujo E2E de ventas con compensación, y la
integración con Stripe (PaymentIntent + validación de firma de webhooks)
**están funcionando y verificados con `stripe listen`**.

## Qué pueden hacer los compañeros ahora

La implementación de referencia está lista, pero quedan cosas grandes y
chicas que suman trabajo individual evaluable. Cada persona puede tomar
una o varias de estas áreas:

### Trabajo de calidad (tests + robustez)
1. **Tests automatizados por servicio** — no hay tests escritos. Usar
   `pytest` + `httpx.AsyncClient` para testear cada `routes.py`. Una persona
   por servicio (o pareja). Esto es trabajo independiente y evaluable.
2. **Validaciones extra** — ej. teléfono/CI con regex, fechas de ingreso no
   futuras en RRHH, montos máximos por venta, etc.
3. **Logging estructurado** — actualmente es básico. Agregar `structlog`
   o un logger más amigable para debugging.

### Trabajo de UX / Frontend
4. **Frontend pulido** — el actual es funcional pero minimalista. Mejorar:
   - Stripe Elements en el navegador (tarjeta 4242 sin pasar por CLI).
   - Vista de detalle de venta con factura en PDF.
   - Filtros y búsqueda en cada tab.
   - Dashboard con KPIs por agencia.
5. **PWA / Mobile** — hacer el frontend instalable y responsive.

### Trabajo de infra
6. **Healthchecks robustos** — el actual solo verifica que el servicio
   contesta, no que la BD esté OK.
7. **Migraciones reales con Alembic** — reemplazar `create_all` por
   migraciones versionadas (sobre todo si el docente lo pide).
8. **Tests de integración** — un script que levanta todo, ejecuta el
   flujo E2E de venta, y reporta. Tipo "smoke test".

### Trabajo de documentación
9. **Diagramas de secuencia** — uno por flujo principal (venta, compra,
   recepción). Mermaid funciona bien.
10. **Manual de usuario** — guía visual del frontend con screenshots.

## Cómo trabajar a partir de aquí

1. Hacer `git fetch && git checkout rolando-dev` para arrancar de la
   implementación funcional.
2. Crear tu propia rama: `git checkout -b nombre-dev` desde `rolando-dev`.
3. Trabajar en tu área. Si tocás un contrato (`schemas.py`), avisa al
   grupo y actualiza [api-contracts.md](api-contracts.md).
4. Levantar localmente con `docker compose up --build` y verificar antes
   de pushear.
5. PRs pequeños y frecuentes contra `rolando-dev`. Cuando todos los PRs
   se hayan mergeado, mergeamos a `main` para la entrega.

## Reglas de comunicación

- **Daily corto** (5 min): qué hice ayer, qué hago hoy, qué me bloquea.
- **Si algo se cae**, primero `docker compose logs <servicio>` antes de
  tocar código del otro.
- **PRs pequeños y frecuentes**, no PRs de 800 líneas al final.
- Antes de modificar un `schemas.py`, avisar en el grupo + actualizar
  `docs/api-contracts.md`.
