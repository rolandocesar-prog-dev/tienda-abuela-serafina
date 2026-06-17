# Guía de demo

Script de demostración para la presentación al docente.

---

## 1. Pre-requisitos

- Docker Desktop (Windows/Mac) o Docker Engine + Compose v2 (Linux)
- Git
- Puertos libres: `3000`, `8000`, `8001`–`8007`

---

## 2. Levantar el sistema

```bash
git checkout integration
cp .env.example .env
docker compose up --build -d
```

Primera vez: ~3 minutos compilando imágenes. Verificar que todos los servicios estén `(healthy)`:

```bash
docker compose ps
```

Frontend disponible en **http://localhost:3000**

---

## 3. Verificación rápida por terminal

```bash
for s in auth products inventory sales customers notifications companies; do
  curl -s http://localhost:8000/$s/health
  echo ""
done
```

Esperás 7 líneas `{"status":"ok","service":"..."}`.

Swagger de cada servicio:
- auth → http://localhost:8006/docs
- product → http://localhost:8001/docs
- inventory → http://localhost:8002/docs
- sales → http://localhost:8003/docs
- customer → http://localhost:8004/docs
- notification → http://localhost:8005/docs
- company → http://localhost:8007/docs

---

## 4. Demo desde el frontend

### 4.1 Login como Administrador

1. Abrir **http://localhost:3000** — aparece la pantalla de login completa.
2. Usuario: `admin` / Contraseña: `admin123` → **Iniciar Sesión**.
3. El menú muestra: **Productos · Inventario · Empresa · Reportes** (sin Ventas — el admin no opera la caja).

### 4.2 Tab Productos

- Catálogo pre-cargado: 25 productos en 5 categorías (Lácteos, Bebidas, Limpieza, Abarrotes, Carnes).
- Cada categoría tiene un color distintivo en las cards (azul para lácteos, teal para bebidas, café para abarrotes, rojo para carnes, verde para limpieza).
- Demostrar: **Nuevo Producto** → el campo SKU está bloqueado con "Se generará automáticamente". Elegí categoría "Lácteos", guardá → ves que el código `LAC006` se asigna solo (correlativo por categoría).
- Editar precio, eliminar.

### 4.3 Tab Inventario

1. Selector de sucursal → elegir **La Canasta Centro**.
2. Ver el stock inicial de los 25 productos.
3. Click **Transferir entre Sucursales**:
   - Supermercado: `Supermercados La Canasta`
   - Origen: `La Canasta Centro`, Destino: `La Canasta Norte`
   - Producto: `Leche Entera PIL 1L`, Cantidad: `10`
   - **Confirmar transferencia**
4. Recargar inventario: el stock bajó en Centro y subió en Norte.

> Internamente: `POST /inventory/transfer` ejecuta salida + entrada atómicamente y publica `TransferCompleted` al bus.

### 4.4 Tab Empresa

Tiene 3 sub-secciones: **Supermercados**, **Sucursales**, **Usuarios**.

- **Supermercados**: lista de los 3 + posibilidad de crear uno nuevo (ej. "OXXO Bolivia").
- **Sucursales**: campo Ciudad es un dropdown con las 9 capitales bolivianas + El Alto (no texto libre — garantiza integridad de la data).
- **Usuarios**: 1 admin + 9 vendedores seedeados. Cada vendedor activo tiene un botón rojo ❌ para desactivar; los desactivados muestran un botón verde ✓ para reactivar. Demostrar el ciclo: desactivar → intentar login con ese vendedor (debe fallar con "Credenciales incorrectas") → reactivar → login OK.

### 4.5 Tab Reportes

Tiene 4 sub-tabs:

- **General**: totales globales, top 10 productos más vendidos, últimas ventas.
- **Por Supermercado**: ventas agrupadas por empresa.
- **Por Sucursal**: filtrar por supermercado, ver cada sucursal.
- **Inventario**: selector de producto → muestra existencias agrupadas por **Supermercado → Sucursal** (con barras de porcentaje) y abajo un panel "Ventas del Día" desglosado por **Efectivo vs Tarjeta** con totales y tabla de detalle.

*(Al arranque las ventas son 0 — después de la demo del vendedor, volver aquí para mostrar los datos reales.)*

---

### 4.6 Cerrar sesión y login como Vendedor

1. Click **Cerrar sesión** → regresa a la pantalla de login.
2. Usuario: `canasta.centro` / Contraseña: `vendedor123` → **Iniciar Sesión**.
3. El menú muestra **solo Ventas** — la sucursal ya viene pre-seleccionada.

### 4.7 Tab Ventas — realizar una venta

1. El panel **Carrito de Compras** está listo con la sucursal `La Canasta Centro`.
2. Buscar producto → `Leche Entera PIL 1L` → agregar al carrito (cantidad 2).
3. Agregar otro: `Aceite Fino 1L` → cantidad 1.
4. Sección **Cliente**: empezar a tipear `Juan` → aparecen sugerencias del datalist (50 clientes seedeados). Elegir `Juanito Pérez Mamani` → el campo NIT se autocompleta con `5050505` y aparece toast verde "✓ Juanito Pérez Mamani — 120 pts acumulados". También funciona la inversa: tipear el CI primero → el nombre se completa.
5. Método de pago: probar tanto **Efectivo** (con monto recibido para ver el cálculo de cambio) como **Tarjeta**.
6. Click **Confirmar Venta** — aparece modal con resumen y total.
7. El panel de estadísticas actualiza: **Ventas Hoy**, **Total Ventas**, **Clientes Hoy**, **Ticket Promedio** — todos filtrados por esta sucursal.

> Internamente: `POST /sales` (con `metodo_pago`) → descuenta stock vía inventory → publica `SaleCompleted` → notification registra la notificación → customer acumula puntos.

---

### 4.8 Volver como admin y ver Reportes

1. Cerrar sesión → login `admin / admin123`.
2. Tab **Reportes** → ahora la venta de `canasta.centro` aparece en los tres niveles (General, La Canasta, La Canasta Centro).

---

## 5. Demostrar independencia entre servicios

```bash
# Bajar solo notification
docker compose stop notification

# Los demás siguen respondiendo:
curl http://localhost:8000/products/health
curl http://localhost:8000/sales/health

# Pero notification devuelve 502:
curl -i http://localhost:8000/notifications/health

# Volver a levantarlo:
docker compose start notification
```

---

## 6. Reset completo

```bash
docker compose down -v && docker compose up --build -d
```

`-v` borra los volúmenes de Postgres. El seed re-crea los 3 supermercados, 9 sucursales, 25 productos, 225 stocks, 10 usuarios (admin + 9 vendedores) y 50 clientes automáticamente.

---

## 7. Troubleshooting

| Síntoma | Solución |
|---|---|
| Un servicio rebota en loop | `docker compose logs <servicio>` para ver el error real |
| El frontend no carga datos | Verificar CORS en consola del navegador (F12); el gateway Nginx envía los headers correctos |
| `failed to set up container networking` | `docker compose down && docker compose up -d` recrea la red |
| Stock insuficiente al vender | El stock seed tiene variación intencional — elegir otro producto o hacer un reset |

---

## 8. Checklist de los 8 puntos del docente

| # | Punto | Cómo demostrarlo |
|---|---|---|
| 1 | Registrar nuevo supermercado "OXXO Bolivia" | Empresa → Supermercados → Crear |
| 2 | Crear sucursales **Prado** y **El Alto** | Empresa → Sucursales → Ciudad = "La Paz" / "El Alto" (dropdown) |
| 3 | Lote inicial 100 unid del Producto X a Bs 18.50 en Sucursal Prado | Productos → Nuevo (precio 18.50, SKU autogenerado) → Inventario → Registrar Movimiento (entrada, 100, Prado) |
| 4 | Venta de 2 unid del Producto X a Juanito Pérez | Ventas → seleccionar Producto X (cantidad 2) → tipear "Juanito" → autocompleta CI 5050505 → Efectivo → Confirmar |
| 5 | Transferir 50 unid Prado → El Alto | Inventario → buscar Producto X → Transferir |
| 6 | Vender 1 unid a Juanito en sucursal de **otro** supermercado | Ventas (admin) → cambiar sucursal a "Don Pedro Aeropuerto" → vender 1 unid con método **Tarjeta** |
| 7 | Reporte consolidado de stock del Producto X agrupado por supermercado | Reportes → tab **Inventario** → seleccionar Producto X → ver tabla agrupada por Supermercado → Sucursal |
| 8 | Reporte ventas del día separando Efectivo / Tarjeta | Reportes → tab **Inventario** → panel "Ventas del Día" con totales separados y tabla de detalle |

## 9. Otros criterios de evaluación

| Criterio | Cómo demostrarlo |
|---|---|
| `docker compose up --build` levanta todo | Sección 2 |
| Los `/health` responden 200 vía gateway | Sección 3 |
| JWT: login, roles diferenciados | Secciones 4.1 y 4.6 |
| Vendedor desactivado no puede hacer login | Empresa → desactivar `canasta.centro` → intentar login → 401 |
| Eventos RabbitMQ (SaleCompleted → notification) | Validar en http://localhost:15672 (guest/guest) |
| Datos seed pre-cargados al levantar | Visible en Productos, Inventario, Empresa y autocomplete de clientes en Ventas sin cargar nada |
| Independencia de servicios | Sección 5 |
| Integridad de datos | SKU autogenerado por categoría, ciudades como dropdown, autocomplete de clientes registrados |
