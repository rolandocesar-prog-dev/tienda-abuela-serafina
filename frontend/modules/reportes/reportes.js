(function () {
    "use strict";

    let ventas = [];
    let companies = [];
    let productos = [];
    let branchMap = new Map();
    let productoStats = new Map();

    // ── Variables para inventario ──
    let productosInventario = [];
    let productoSeleccionadoId = null;

    window.initReportes = async function () {
        configurarTabs();
        await cargarDatosReales();
        renderGeneral();
        renderSupermercados();
        renderSucursales();
        await cargarProductosInventario();
        configurarFiltros();
        
        document.getElementById("btn-refresh-reportes")
            ?.addEventListener("click", async () => {
                ventas = [];
                companies = [];
                productos = [];
                branchMap.clear();
                productoStats.clear();
                await cargarDatosReales();
                renderGeneral();
                renderSupermercados();
                renderSucursales();
                await cargarProductosInventario();
            });
    };

    // ── Tabs ─────────────────────────────────────────────────────────────────
    function configurarTabs() {
        document.querySelectorAll(".reportes-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".reportes-tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".reportes-section").forEach(s => s.classList.add("d-none"));
                btn.classList.add("active");
                document.getElementById(`section-${btn.dataset.section}`)?.classList.remove("d-none");
                
                if (btn.dataset.section === "inventario") {
                    if (productosInventario.length > 0 && productoSeleccionadoId) {
                        renderInventarioProducto(productoSeleccionadoId);
                    } else {
                        cargarProductosInventario();
                    }
                }
            });
        });
    }

    // ── Carga de datos reales ──────────────────────────────────────────────
    async function cargarDatosReales() {
        try {
            const [ventasRes, companiesRes, productosRes, agenciasRes] = await Promise.all([
                window.api("/sales"),
                window.api("/companies"),
                window.api("/products"),
                window.api("/inventory/agencias").catch(() => [])
            ]);
            
            ventas = ventasRes || [];
            companies = companiesRes || [];
            productos = productosRes || [];
            const agencias = agenciasRes || [];
            
            console.log("📊 Datos cargados:", {
                ventas: ventas.length,
                companies: companies.length,
                productos: productos.length,
                agencias: agencias.length
            });

            // Construir branchMap combinando companies y agencias
            branchMap.clear();
            
            // Primero, agregar de companies
            for (const c of companies) {
                for (const b of (c.branches || [])) {
                    branchMap.set(b.id, {
                        nombre: b.nombre,
                        ciudad: b.ciudad || "Sin ciudad",
                        companyId: c.id,
                        companyNombre: c.nombre,
                    });
                }
            }
            
            // Luego, agregar/actualizar con agencias de inventario
            for (const a of agencias) {
                if (!branchMap.has(a.id)) {
                    let companyNombre = "Sin supermercado";
                    for (const c of companies) {
                        if (c.branches?.some(b => b.id === a.id)) {
                            companyNombre = c.nombre;
                            break;
                        }
                    }
                    
                    branchMap.set(a.id, {
                        nombre: a.nombre,
                        ciudad: "Sin ciudad",
                        companyId: a.id,
                        companyNombre: companyNombre,
                    });
                }
            }
            
            console.log("🏢 Sucursales:", Array.from(branchMap.values()).map(b => b.nombre));

        } catch (e) {
            console.error("❌ Error cargando datos:", e);
            window.mostrarNotificacion("Error cargando datos: " + e.message, "error");
            
            ventas = [];
            companies = [];
            productos = [];
        }

        // Calcular stats por producto para el top de productos
        productoStats.clear();
        for (const v of ventas) {
            for (const item of (v.items || [])) {
                const pid = item.producto_id || item.productId;
                if (!pid) continue;
                
                const prev = productoStats.get(pid) || { 
                    nombre: item.producto_nombre || item.nombre || `Producto ${pid}`, 
                    unidades: 0, 
                    ingresos: 0 
                };
                prev.unidades += item.cantidad || 0;
                prev.ingresos += parseFloat(item.subtotal || 0);
                productoStats.set(pid, prev);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 📦 INVENTARIO - CON STOCK REAL
    // ═══════════════════════════════════════════════════════════════════

    async function obtenerStockReal(productoId) {
        try {
            const stockData = await window.api("/inventory/stock");
            
            if (!stockData || stockData.length === 0) {
                return null;
            }
            
            // Filtrar por producto
            const stockProducto = stockData.filter(item => item.producto_id === productoId);
            
            if (stockProducto.length === 0) {
                return null;
            }
            
            // Mapear a nuestro formato
            const existenciasMap = new Map();
            
            for (const item of stockProducto) {
                const agenciaId = item.agencia_id;
                const cantidad = item.cantidad || 0;
                
                if (cantidad > 0) {
                    const branch = branchMap.get(agenciaId);
                    
                    const key = agenciaId || "sin-sucursal";
                    if (!existenciasMap.has(key)) {
                        existenciasMap.set(key, {
                            supermercado: branch?.companyNombre || "Sin supermercado",
                            sucursal: branch?.nombre || "Sin sucursal",
                            cantidad: 0
                        });
                    }
                    existenciasMap.get(key).cantidad += cantidad;
                }
            }
            
            const existenciasFinal = Array.from(existenciasMap.values());
            
            if (existenciasFinal.length > 0 && existenciasFinal.some(e => e.cantidad > 0)) {
                return existenciasFinal;
            }
            
            return null;
        } catch (error) {
            console.warn("⚠️ Error obteniendo stock real:", error.message);
            return null;
        }
    }

    async function cargarProductosInventario() {
        try {
            const productosRes = await window.api("/products");
            productosInventario = productosRes || [];
            
            const selector = document.getElementById("selector-producto-inventario");
            if (selector) {
                if (productosInventario.length === 0) {
                    selector.innerHTML = '<option value="">No hay productos disponibles</option>';
                    return;
                }
                
                let options = '<option value="">Selecciona un producto...</option>';
                productosInventario.forEach(p => {
                    const nombre = p.nombre || p.name || "Producto sin nombre";
                    options += `<option value="${p.id}">${esc(nombre)}</option>`;
                });
                selector.innerHTML = options;
                
                // Buscar "Leche Entera PIL 1L"
                const lechePil = productosInventario.find(p => {
                    const nombre = (p.nombre || p.name || "").toLowerCase();
                    return nombre.includes("leche entera pil") || 
                           nombre.includes("leche pil") || 
                           nombre.includes("leche entera");
                });
                
                if (lechePil) {
                    selector.value = lechePil.id;
                    productoSeleccionadoId = lechePil.id;
                    await renderInventarioProducto(lechePil.id);
                } else if (productosInventario.length > 0) {
                    selector.value = productosInventario[0].id;
                    productoSeleccionadoId = productosInventario[0].id;
                    await renderInventarioProducto(productosInventario[0].id);
                }
                
                selector.addEventListener("change", async function() {
                    if (this.value) {
                        productoSeleccionadoId = this.value;
                        await renderInventarioProducto(this.value);
                    } else {
                        limpiarVistaInventario("Selecciona un producto para ver su distribución");
                    }
                });
            }
        } catch (error) {
            console.error("❌ Error cargando productos:", error);
            const selector = document.getElementById("selector-producto-inventario");
            if (selector) {
                selector.innerHTML = '<option value="">Error al cargar productos</option>';
            }
        }
    }

    async function renderInventarioProducto(productoId) {
        try {
            const producto = productosInventario.find(p => p.id === productoId);
            if (!producto) {
                limpiarVistaInventario("Producto no encontrado");
                return;
            }

            const nombreProducto = producto.nombre || producto.name || "Producto";
            let existenciasFinal = [];

            // 🔥 Obtener stock REAL
            const stockReal = await obtenerStockReal(productoId);
            
            if (stockReal && stockReal.length > 0 && stockReal.some(e => e.cantidad > 0)) {
                // ✅ Usar stock real
                existenciasFinal = stockReal;
                console.log(`📦 Stock real para "${nombreProducto}":`, existenciasFinal);
            } else {
                // ❌ No hay stock real
                console.warn(`⚠️ No hay stock real para "${nombreProducto}"`);
                limpiarVistaInventario(`No hay stock registrado para "${nombreProducto}"`);
                return;
            }

            // Obtener ventas del día del producto
            const hoy = new Date().toISOString().split('T')[0];
            const ventasHoy = ventas.filter(v => {
                const fechaVenta = new Date(v.fecha).toISOString().split('T')[0];
                return fechaVenta === hoy;
            });

            const transacciones = [];
            for (const v of ventasHoy) {
                for (const item of (v.items || [])) {
                    const pid = item.producto_id || item.productId;
                    if (pid === productoId) {
                        transacciones.push({
                            producto: item.producto_nombre || item.nombre || nombreProducto,
                            cantidad: item.cantidad || 0,
                            precio: item.precio_unitario || item.precio || 0,
                            subtotal: parseFloat(item.subtotal || 0),
                            metodo: v.metodo_pago || "No especificado"
                        });
                    }
                }
            }

            const ventasDia = {
                fecha: hoy,
                total: transacciones.reduce((sum, t) => sum + t.subtotal, 0),
                transacciones: transacciones
            };

            renderInventarioConDatos(nombreProducto, existenciasFinal, ventasDia);

        } catch (error) {
            console.error("❌ Error:", error);
            limpiarVistaInventario("Error al cargar datos del producto");
        }
    }

    function limpiarVistaInventario(mensaje) {
        document.getElementById("inv-producto-nombre").textContent = "Selecciona un producto";
        document.getElementById("inv-total-existencias").textContent = "0";
        document.getElementById("inv-total-foot").textContent = "0";
        document.getElementById("inv-existencias-body").innerHTML = 
            `<div class="text-center py-3 text-muted">${mensaje}</div>`;
        document.getElementById("inv-ventas-body").innerHTML = 
            `<tr><td colspan="5" class="text-center py-3 text-muted">${mensaje}</td></tr>`;
        document.getElementById("inv-total-ingresos").textContent = "Bs 0.00";
        document.getElementById("inv-efectivo-total").textContent = "Bs 0.00";
        document.getElementById("inv-tarjeta-total").textContent = "Bs 0.00";
        document.getElementById("inv-total-transacciones").textContent = "0";
        document.getElementById("inv-ventas-total").textContent = "Bs 0.00";
    }

    function renderInventarioConDatos(nombreProducto, existencias, ventasDia) {
        const totalExistencias = existencias.reduce((sum, item) => sum + item.cantidad, 0);

        document.getElementById("inv-producto-nombre").textContent = nombreProducto;
        document.getElementById("inv-total-existencias").textContent = totalExistencias;
        document.getElementById("inv-total-foot").textContent = totalExistencias;

        const existenciasBody = document.getElementById("inv-existencias-body");
        if (existenciasBody) {
            const agrupado = {};
            existencias.forEach(item => {
                if (!agrupado[item.supermercado]) {
                    agrupado[item.supermercado] = [];
                }
                agrupado[item.supermercado].push(item);
            });

            let html = '';
            for (const [supermercado, items] of Object.entries(agrupado)) {
                const totalSuper = items.reduce((sum, i) => sum + i.cantidad, 0);
                const porcentajeSuper = totalExistencias > 0 ? ((totalSuper / totalExistencias) * 100).toFixed(1) : 0;
                
                html += `<div class="mb-2">`;
                html += `<div class="d-flex justify-content-between align-items-center fw-bold text-secondary border-bottom pb-1">`;
                html += `<span>${esc(supermercado)}</span>`;
                html += `<span class="text-muted small">${totalSuper} unidades (${porcentajeSuper}%)</span>`;
                html += `</div>`;
                
                items.forEach(item => {
                    const porcentaje = totalExistencias > 0 ? ((item.cantidad / totalExistencias) * 100).toFixed(1) : 0;
                    html += `<div class="d-flex justify-content-between align-items-center ps-3 py-1 border-bottom" style="border-color: #f0f0f0 !important;">`;
                    html += `<span>${esc(item.sucursal)}</span>`;
                    html += `<div class="d-flex align-items-center gap-3">
                        <span class="fw-semibold">${item.cantidad} unidades</span>
                        <span class="text-muted small" style="min-width:45px;">${porcentaje}%</span>
                        <div class="progress" style="width:80px;height:6px;">
                            <div class="progress-bar" role="progressbar" style="width:${porcentaje}%;background:#2a9d8f;"></div>
                        </div>
                    </div>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }
            existenciasBody.innerHTML = html;
        }

        document.getElementById("inv-fecha-venta").textContent = ventasDia.fecha;

        const efectivoTotal = ventasDia.transacciones
            .filter(t => t.metodo && t.metodo.toLowerCase().includes("efectivo"))
            .reduce((sum, t) => sum + t.subtotal, 0);
        
        const tarjetaTotal = ventasDia.transacciones
            .filter(t => t.metodo && t.metodo.toLowerCase().includes("tarjeta"))
            .reduce((sum, t) => sum + t.subtotal, 0);

        document.getElementById("inv-total-ingresos").textContent = `Bs ${ventasDia.total.toFixed(2)}`;
        document.getElementById("inv-efectivo-total").textContent = `Bs ${efectivoTotal.toFixed(2)}`;
        document.getElementById("inv-tarjeta-total").textContent = `Bs ${tarjetaTotal.toFixed(2)}`;
        document.getElementById("inv-total-transacciones").textContent = ventasDia.transacciones.length;
        document.getElementById("inv-ventas-total").textContent = `Bs ${ventasDia.total.toFixed(2)}`;

        const ventasBody = document.getElementById("inv-ventas-body");
        if (ventasBody) {
            const efectivo = ventasDia.transacciones.filter(t => t.metodo && t.metodo.toLowerCase().includes("efectivo"));
            const tarjeta = ventasDia.transacciones.filter(t => t.metodo && t.metodo.toLowerCase().includes("tarjeta"));

            let html = '';
            
            if (efectivo.length > 0) {
                html += `<tr><td colspan="5" class="fw-bold text-success bg-light">💵 Ventas Efectivo</td></tr>`;
                efectivo.forEach(t => {
                    html += `<tr>
                        <td>${esc(t.producto)}</td>
                        <td class="text-center">${t.cantidad}</td>
                        <td class="text-end">Bs ${t.precio.toFixed(2)}</td>
                        <td class="text-end fw-semibold">Bs ${t.subtotal.toFixed(2)}</td>
                        <td class="text-center"><span class="badge bg-success">Efectivo</span></td>
                    </tr>`;
                });
            }

            if (tarjeta.length > 0) {
                html += `<tr><td colspan="5" class="fw-bold text-warning bg-light">💳 Ventas Tarjeta</td></tr>`;
                tarjeta.forEach(t => {
                    html += `<tr>
                        <td>${esc(t.producto)}</td>
                        <td class="text-center">${t.cantidad}</td>
                        <td class="text-end">Bs ${t.precio.toFixed(2)}</td>
                        <td class="text-end fw-semibold">Bs ${t.subtotal.toFixed(2)}</td>
                        <td class="text-center"><span class="badge bg-warning text-dark">Tarjeta</span></td>
                    </tr>`;
                });
            }

            ventasBody.innerHTML = html;
        }
    }

    // ── General ──────────────────────────────────────────────────────────────
    function renderGeneral() {
        const totalIngresos = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const totalVentas   = ventas.length;
        const ticketProm    = totalVentas ? totalIngresos / totalVentas : 0;
        const sucActivas    = new Set(ventas.map(v => v.agencia_id || v.branchId || v.sucursal_id)).size;

        setText("gen-total-ingresos",    `Bs ${totalIngresos.toFixed(2)}`);
        setText("gen-total-ventas",      totalVentas);
        setText("gen-ticket-promedio",   `Bs ${ticketProm.toFixed(2)}`);
        setText("gen-sucursales-activas", sucActivas);

        const sorted = [...productoStats.values()].sort((a, b) => b.ingresos - a.ingresos).slice(0, 10);
        const topEl = document.getElementById("top-productos-body");
        if (topEl) {
            if (sorted.length === 0) {
                topEl.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Sin ventas registradas</td></tr>`;
            } else {
                topEl.innerHTML = sorted.map((p, i) => {
                    const rankClass = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
                    return `<tr>
                        <td><span class="badge-rank ${rankClass}">${i + 1}</span></td>
                        <td>${esc(p.nombre)}</td>
                        <td class="text-end">${p.unidades}</td>
                        <td class="text-end fw-semibold">Bs ${p.ingresos.toFixed(2)}</td>
                    </tr>`;
                }).join("");
            }
        }

        const recientes = [...ventas].slice(0, 10);
        const recEl = document.getElementById("ventas-recientes-body");
        if (recEl) {
            if (recientes.length === 0) {
                recEl.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Sin ventas registradas</td></tr>`;
            } else {
                recEl.innerHTML = recientes.map(v => {
                    const branchId = v.agencia_id || v.branchId || v.sucursal_id;
                    const branch = branchMap.get(branchId);
                    const fecha = new Date(v.fecha).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
                    return `<tr>
                        <td><small>${fecha}</small></td>
                        <td>${esc(branch?.nombre || branchId)}</td>
                        <td>${esc(v.cliente_nombre || v.clientName || "Consumidor final")}</td>
                        <td class="text-end fw-semibold">Bs ${parseFloat(v.total).toFixed(2)}</td>
                    </tr>`;
                }).join("");
            }
        }
    }

    // ── Por Supermercado ─────────────────────────────────────────────────────
    function renderSupermercados() {
        const stats = new Map();
        for (const c of companies) {
            stats.set(c.id, { nombre: c.nombre, sucursales: new Set(), ventas: 0, ingresos: 0 });
        }
        for (const v of ventas) {
            const branchId = v.agencia_id || v.branchId || v.sucursal_id;
            const branch = branchMap.get(branchId);
            if (!branch) continue;
            const s = stats.get(branch.companyId);
            if (!s) continue;
            s.sucursales.add(branchId);
            s.ventas++;
            s.ingresos += parseFloat(v.total || 0);
        }

        const rows = [...stats.values()].sort((a, b) => b.ingresos - a.ingresos);
        const el = document.getElementById("tabla-supermercados-body");
        if (!el) return;

        if (rows.length === 0 || rows.every(r => r.ventas === 0)) {
            el.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Sin datos de ventas</td></tr>`;
            return;
        }

        el.innerHTML = rows.filter(r => r.ventas > 0).map(r => {
            const ticket = r.ventas ? r.ingresos / r.ventas : 0;
            return `<tr>
                <td class="fw-semibold">${esc(r.nombre)}</td>
                <td class="text-center"><span class="badge bg-secondary">${r.sucursales.size}</span></td>
                <td class="text-end">${r.ventas}</td>
                <td class="text-end fw-bold" style="color:#2a9d8f">Bs ${r.ingresos.toFixed(2)}</td>
                <td class="text-end text-muted">Bs ${ticket.toFixed(2)}</td>
            </tr>`;
        }).join("");
    }

    // ── Por Sucursal ─────────────────────────────────────────────────────────
    function renderSucursales(filtroCompanyId = "") {
        const stats = new Map();
        for (const v of ventas) {
            const branchId = v.agencia_id || v.branchId || v.sucursal_id;
            const branch = branchMap.get(branchId);
            if (!branch) continue;
            if (filtroCompanyId && branch.companyId !== filtroCompanyId) continue;
            const s = stats.get(branchId) || {
                nombre: branch.nombre,
                ciudad: branch.ciudad,
                companyNombre: branch.companyNombre,
                ventas: 0,
                ingresos: 0,
            };
            s.ventas++;
            s.ingresos += parseFloat(v.total || 0);
            stats.set(branchId, s);
        }

        const rows = [...stats.values()].sort((a, b) => b.ingresos - a.ingresos);
        const el = document.getElementById("tabla-sucursales-body");
        if (!el) return;

        if (rows.length === 0) {
            el.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Sin datos de ventas</td></tr>`;
            return;
        }

        el.innerHTML = rows.map(r => {
            const ticket = r.ventas ? r.ingresos / r.ventas : 0;
            return `<tr>
                <td class="fw-semibold">${esc(r.nombre)}</td>
                <td><small class="text-muted">${esc(r.companyNombre)}</small></td>
                <td><small>${esc(r.ciudad)}</small></td>
                <td class="text-end"><span class="fw-semibold">${r.ventas}</span></td>
                <td class="text-end"><span class="fw-bold" style="color:#2a9d8f">Bs ${r.ingresos.toFixed(2)}</span></td>
                <td class="text-end text-muted">Bs ${ticket.toFixed(2)}</td>
            </tr>`;
        }).join("");
    }

    // ── Filtros ──────────────────────────────────────────────────────────────
    function configurarFiltros() {
        const sel = document.getElementById("filter-company-sucursal");
        if (sel) {
            sel.innerHTML = '<option value="">Todos los supermercados</option>' +
                companies.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
            sel.addEventListener("change", e => renderSucursales(e.target.value));
        }
    }

    // ── Utils ─────────────────────────────────────────────────────────────────
    function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function esc(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

})();