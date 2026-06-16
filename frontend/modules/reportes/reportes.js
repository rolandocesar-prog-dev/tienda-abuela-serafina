(function () {
    "use strict";

    let ventas = [];
    let companies = [];
    // Map branchId → { nombre, ciudad, companyId, companyNombre }
    let branchMap = new Map();
    // Map productoId → { nombre, total_unidades, total_ingresos }
    let productoStats = new Map();

    window.initReportes = async function () {
        configurarTabs();
        await cargarDatos();
        renderGeneral();
        renderSupermercados();
        renderSucursales();
        configurarFiltros();
        document.getElementById("btn-refresh-reportes")
            ?.addEventListener("click", async () => {
                ventas = [];
                companies = [];
                branchMap.clear();
                productoStats.clear();
                await cargarDatos();
                renderGeneral();
                renderSupermercados();
                renderSucursales();
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
            });
        });
    }

    // ── Carga de datos ───────────────────────────────────────────────────────
    async function cargarDatos() {
        try {
            [ventas, companies] = await Promise.all([
                window.api("/sales"),
                window.api("/companies"),
            ]);
        } catch (e) {
            window.mostrarNotificacion("Error cargando datos: " + e.message, "error");
            ventas = [];
            companies = [];
        }

        // Construir branchMap
        branchMap.clear();
        for (const c of companies) {
            for (const b of (c.branches || [])) {
                branchMap.set(b.id, {
                    nombre: b.nombre,
                    ciudad: b.ciudad,
                    companyId: c.id,
                    companyNombre: c.nombre,
                });
            }
        }

        // Calcular stats por producto (de los items de cada venta)
        productoStats.clear();
        for (const v of ventas) {
            for (const item of (v.items || [])) {
                const pid = item.producto_id;
                const prev = productoStats.get(pid) || { nombre: item.producto_nombre, unidades: 0, ingresos: 0 };
                prev.unidades += item.cantidad;
                prev.ingresos += parseFloat(item.subtotal || 0);
                productoStats.set(pid, prev);
            }
        }
    }

    // ── General ──────────────────────────────────────────────────────────────
    function renderGeneral() {
        const totalIngresos = ventas.reduce((s, v) => s + parseFloat(v.total || 0), 0);
        const totalVentas   = ventas.length;
        const ticketProm    = totalVentas ? totalIngresos / totalVentas : 0;
        const sucActivas    = new Set(ventas.map(v => v.agencia_id)).size;

        setText("gen-total-ingresos",    `Bs ${totalIngresos.toFixed(2)}`);
        setText("gen-total-ventas",      totalVentas);
        setText("gen-ticket-promedio",   `Bs ${ticketProm.toFixed(2)}`);
        setText("gen-sucursales-activas", sucActivas);

        // Top productos
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

        // Últimas ventas
        const recientes = [...ventas].slice(0, 10);
        const recEl = document.getElementById("ventas-recientes-body");
        if (recEl) {
            if (recientes.length === 0) {
                recEl.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">Sin ventas registradas</td></tr>`;
            } else {
                recEl.innerHTML = recientes.map(v => {
                    const branch = branchMap.get(v.agencia_id);
                    const fecha = new Date(v.fecha).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
                    return `<tr>
                        <td><small>${fecha}</small></td>
                        <td>${esc(branch?.nombre || v.agencia_id)}</td>
                        <td>${esc(v.cliente_nombre || "Consumidor final")}</td>
                        <td class="text-end fw-semibold">Bs ${parseFloat(v.total).toFixed(2)}</td>
                    </tr>`;
                }).join("");
            }
        }
    }

    // ── Por Supermercado ─────────────────────────────────────────────────────
    function renderSupermercados() {
        // Agrupar ventas por company
        const stats = new Map(); // companyId → { nombre, sucursales:Set, ventas, ingresos }
        for (const c of companies) {
            stats.set(c.id, { nombre: c.nombre, sucursales: new Set(), ventas: 0, ingresos: 0 });
        }
        for (const v of ventas) {
            const branch = branchMap.get(v.agencia_id);
            if (!branch) continue;
            const s = stats.get(branch.companyId);
            if (!s) continue;
            s.sucursales.add(v.agencia_id);
            s.ventas++;
            s.ingresos += parseFloat(v.total || 0);
        }

        const rows = [...stats.values()].sort((a, b) => b.ingresos - a.ingresos);
        const el = document.getElementById("tabla-supermercados-body");
        if (!el) return;

        if (rows.length === 0) {
            el.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Sin datos</td></tr>`;
            return;
        }

        el.innerHTML = rows.map(r => {
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
        // Agrupar ventas por agencia_id
        const stats = new Map();
        for (const v of ventas) {
            const branch = branchMap.get(v.agencia_id);
            if (!branch) continue;
            if (filtroCompanyId && branch.companyId !== filtroCompanyId) continue;
            const s = stats.get(v.agencia_id) || {
                nombre: branch.nombre,
                ciudad: branch.ciudad,
                companyNombre: branch.companyNombre,
                ventas: 0,
                ingresos: 0,
            };
            s.ventas++;
            s.ingresos += parseFloat(v.total || 0);
            stats.set(v.agencia_id, s);
        }

        // Incluir sucursales sin ventas (solo si no hay filtro o coincide)
        for (const [bid, branch] of branchMap) {
            if (filtroCompanyId && branch.companyId !== filtroCompanyId) continue;
            if (!stats.has(bid)) {
                stats.set(bid, {
                    nombre: branch.nombre,
                    ciudad: branch.ciudad,
                    companyNombre: branch.companyNombre,
                    ventas: 0,
                    ingresos: 0,
                });
            }
        }

        const rows = [...stats.values()].sort((a, b) => b.ingresos - a.ingresos);
        const el = document.getElementById("tabla-sucursales-body");
        if (!el) return;

        if (rows.length === 0) {
            el.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Sin datos</td></tr>`;
            return;
        }

        el.innerHTML = rows.map(r => {
            const ticket = r.ventas ? r.ingresos / r.ventas : 0;
            const ventasBadge = r.ventas === 0
                ? `<span class="badge bg-light text-muted border">0</span>`
                : `<span class="fw-semibold">${r.ventas}</span>`;
            const ingresosTxt = r.ingresos === 0
                ? `<span class="text-muted">Bs 0.00</span>`
                : `<span class="fw-bold" style="color:#2a9d8f">Bs ${r.ingresos.toFixed(2)}</span>`;
            return `<tr>
                <td class="fw-semibold">${esc(r.nombre)}</td>
                <td><small class="text-muted">${esc(r.companyNombre)}</small></td>
                <td><small>${esc(r.ciudad)}</small></td>
                <td class="text-end">${ventasBadge}</td>
                <td class="text-end">${ingresosTxt}</td>
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
