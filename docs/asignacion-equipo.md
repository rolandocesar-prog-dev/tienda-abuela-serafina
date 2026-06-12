# Asignación de equipo (sugerida)

Son 7 personas y hay 7 servicios + 1 frontend. Sugerencia para minimizar bloqueos:

| Persona  | Responsable de                | Notas                                                                 |
| -------- | ----------------------------- | --------------------------------------------------------------------- |
| Persona 1 | **catalog**                  | Standalone. Sin dependencias. Empieza aquí — los demás te van a llamar. |
| Persona 2 | **almacen**                  | Standalone. Crítico — varios servicios dependen de `/movimientos`.    |
| Persona 3 | **pagos** + Stripe           | Tiene la integración externa más compleja. Empezar temprano.          |
| Persona 4 | **facturacion**              | Standalone. La numeración correlativa requiere cuidado con concurrencia. |
| Persona 5 | **rrhh**                     | Standalone. El más simple. Quien lo tome puede ayudar con el frontend después. |
| Persona 6 | **ventas** (+ integración)   | Tomar al último — depende de Catalog, Almacen, Pagos, Facturacion. Coordinador de la integración E2E. |
| Persona 7 | **compras** (+ integración)  | Depende de Almacen y Pagos. Coordinador del frontend.                 |

## Plan de paralelización

### Día 1–2 (en paralelo, sin bloqueos)
Todos arrancan sus servicios standalone. CRUD básico, sin llamadas HTTP a otros aún.
La base ya tiene los `schemas.py` listos — solo implementan la lógica en `routes.py`.

### Día 3 (integración)
- Persona 3 termina la parte de Stripe.
- Persona 6 (ventas) cablea las llamadas a Catalog, Almacen, Pagos, Facturacion.
- Persona 7 (compras) cablea las llamadas a Almacen y Pagos.

### Día 4 (frontend + pulido)
- Persona 5 y/o Persona 7 implementan el frontend usando los endpoints ya funcionando.
- Pruebas E2E desde el navegador.

### Día 5 (margen)
- Documentación, demo, fix de bugs.

## Contratos congelados

Los `schemas.py` y los endpoints en `routes.py` son contratos. **NO** los cambien sin avisar al equipo.

Si necesitas modificar uno:
1. Avisar en el grupo.
2. Actualizar [api-contracts.md](api-contracts.md).
3. Asegurar que quien lo consume sigue funcionando.

## Reglas de comunicación

- **Daily corto** (5 min): qué hice ayer, qué hago hoy, qué me bloquea.
- **Si algo se cae**, primero `docker compose logs <servicio>` antes de tocar código del otro.
- **PRs pequeños y frecuentes**, no PRs de 800 líneas al final.
