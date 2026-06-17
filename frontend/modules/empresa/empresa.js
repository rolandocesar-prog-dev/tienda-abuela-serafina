(function () {
    "use strict";

    let companiesEmpresa = [];
    let branchesEmpresa = [];
    let sucursalesParaUsuario = [];

    window.initEmpresa = async function () {
        configurarTabs();
        // Sucursales deben cargarse antes de usuarios para poder mostrar el nombre
        await Promise.all([cargarCompanies(), cargarTodasLasSucursales()]);
        await cargarUsuarios();
        configurarFormularios();
    };

    // ── Tabs internos ────────────────────────────────────────────────────────
    function configurarTabs() {
        document.querySelectorAll(".empresa-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".empresa-tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".empresa-section").forEach(s => s.classList.add("d-none"));
                btn.classList.add("active");
                document.getElementById(`section-${btn.dataset.section}`)?.classList.remove("d-none");
            });
        });
    }

    // ── Supermercados ────────────────────────────────────────────────────────
    async function cargarCompanies() {
        try {
            companiesEmpresa = await window.api("/companies");
            renderizarCompanies();
            poblarSelectCompanies();
        } catch (e) {
            document.getElementById("companies-list").innerHTML =
                `<p class="text-danger">Error: ${e.message}</p>`;
        }
    }

    function renderizarCompanies() {
        const el = document.getElementById("companies-list");
        if (!el) return;
        if (companiesEmpresa.length === 0) {
            el.innerHTML = '<p class="text-muted text-center py-3">No hay supermercados registrados</p>';
            return;
        }
        el.innerHTML = companiesEmpresa.map(c => `
            <div class="empresa-card mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold">${esc(c.nombre)}</div>
                        <small class="text-muted">NIT: ${esc(c.nit)} &nbsp;|&nbsp; ${c.branches?.length || 0} sucursales</small>
                    </div>
                    <span class="badge ${c.activo ? 'bg-success' : 'bg-secondary'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
            </div>
        `).join("");
    }

    function poblarSelectCompanies() {
        const sel = document.getElementById("branch-company-id");
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccionar supermercado...</option>' +
            companiesEmpresa.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join("");
    }

    // ── Sucursales ───────────────────────────────────────────────────────────
    async function cargarTodasLasSucursales() {
        try {
            sucursalesParaUsuario = await window.api("/inventory/agencias");
            poblarSelectSucursalesUsuario();
        } catch (e) {
            console.error("Error cargando sucursales:", e);
        }
    }

    async function cargarBranchesDe(companyId) {
        const el = document.getElementById("branches-list");
        if (!companyId) {
            el.innerHTML = '<p class="text-muted text-center py-3">Seleccione un supermercado</p>';
            return;
        }
        el.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm" style="color:var(--brown)"></div></div>';
        try {
            branchesEmpresa = await window.api(`/companies/${companyId}/branches`);
            renderizarBranches(companyId);
        } catch (e) {
            el.innerHTML = `<p class="text-danger">Error: ${e.message}</p>`;
        }
    }

    function renderizarBranches(companyId) {
        const el = document.getElementById("branches-list");
        if (!el) return;
        if (branchesEmpresa.length === 0) {
            el.innerHTML = '<p class="text-muted text-center py-3">Este supermercado no tiene sucursales aún</p>';
            return;
        }
        el.innerHTML = branchesEmpresa.map(b => `
            <div class="empresa-card mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold">${esc(b.nombre)}</div>
                        <small class="text-muted">
                            <i class="bi bi-geo-alt"></i> ${esc(b.ciudad)}
                            ${b.direccion ? ` &nbsp;·&nbsp; ${esc(b.direccion)}` : ""}
                        </small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="eliminarBranchEmpresa('${companyId}','${b.id}')">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            </div>
        `).join("");
    }

    window.eliminarBranchEmpresa = async function (companyId, branchId) {
        const confirmado = await Swal.fire({
            title: "¿Eliminar sucursal?",
            text: "Se eliminará también su registro de inventario.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Eliminar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#e76f51",
        });
        if (!confirmado.isConfirmed) return;
        try {
            await window.api(`/companies/${companyId}/branches/${branchId}`, { method: "DELETE" });
            window.mostrarNotificacion("Sucursal eliminada", "success");
            await cargarBranchesDe(companyId);
            await cargarTodasLasSucursales();
        } catch (e) {
            window.mostrarNotificacion("Error: " + e.message, "error");
        }
    };

    function poblarSelectSucursalesUsuario() {
        const sel = document.getElementById("user-sucursal-id");
        if (!sel) return;
        sel.innerHTML = '<option value="">Seleccionar sucursal...</option>' +
            sucursalesParaUsuario.map(s => `<option value="${s.id}">${esc(s.nombre)}</option>`).join("");
    }

    // ── Usuarios ─────────────────────────────────────────────────────────────
    async function cargarUsuarios() {
        const el = document.getElementById("usuarios-list");
        try {
            const usuarios = await window.api("/auth/users");
            if (!usuarios || usuarios.length === 0) {
                el.innerHTML = '<p class="text-muted text-center py-3">No hay usuarios</p>';
                return;
            }
            el.innerHTML = `
                <div class="table-responsive">
                    <table class="table table-sm table-hover mb-0">
                        <thead><tr>
                            <th>Usuario</th><th>Rol</th><th>Sucursal</th><th>Estado</th><th></th>
                        </tr></thead>
                        <tbody>
                            ${usuarios.map(u => {
                                const sucursal = sucursalesParaUsuario.find(s => s.id === u.sucursal_id);
                                return `
                                <tr>
                                    <td class="fw-semibold">${esc(u.username)}<br><small class="text-muted">${esc(u.email)}</small></td>
                                    <td><span class="badge ${u.rol === 'Administrador' ? 'bg-primary' : 'bg-teal'}">${esc(u.rol)}</span></td>
                                    <td><small>${sucursal ? esc(sucursal.nombre) : (u.rol === 'Administrador' ? '<span class="text-muted">Todas</span>' : '<span class="text-warning">Sin asignar</span>')}</small></td>
                                    <td><span class="badge ${u.activo ? 'bg-success' : 'bg-secondary'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
                                    <td>
                                        ${u.activo && u.rol !== 'Administrador' ? `
                                        <button class="btn btn-sm btn-outline-danger" onclick="desactivarUsuarioEmpresa('${u.id}')">
                                            <i class="bi bi-person-x"></i>
                                        </button>` : ''}
                                    </td>
                                </tr>`;
                            }).join("")}
                        </tbody>
                    </table>
                </div>`;
        } catch (e) {
            el.innerHTML = `<p class="text-danger">Error: ${e.message}</p>`;
        }
    }

    window.desactivarUsuarioEmpresa = async function (userId) {
        const confirmado = await Swal.fire({
            title: "¿Desactivar usuario?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Desactivar",
            cancelButtonText: "Cancelar",
        });
        if (!confirmado.isConfirmed) return;
        try {
            await window.api(`/auth/users/${userId}/desactivar`, { method: "PATCH" });
            window.mostrarNotificacion("Usuario desactivado", "success");
            await cargarUsuarios();
        } catch (e) {
            window.mostrarNotificacion("Error: " + e.message, "error");
        }
    };

    // ── Formularios ──────────────────────────────────────────────────────────
    function configurarFormularios() {
        // Crear company
        document.getElementById("btn-crear-company")?.addEventListener("click", async () => {
            const nombre = document.getElementById("company-nombre").value.trim();
            const nit = document.getElementById("company-nit").value.trim();
            if (!nombre || !nit) {
                window.mostrarNotificacion("Complete nombre y NIT", "warning");
                return;
            }
            try {
                await window.apiPost("/companies", { nombre, nit });
                window.mostrarNotificacion("Supermercado creado correctamente", "success");
                document.getElementById("company-nombre").value = "";
                document.getElementById("company-nit").value = "";
                await cargarCompanies();
            } catch (e) {
                window.mostrarNotificacion("Error: " + e.message, "error");
            }
        });

        // Select company → cargar branches
        document.getElementById("branch-company-id")?.addEventListener("change", e => {
            cargarBranchesDe(e.target.value);
        });

        // Crear branch
        document.getElementById("btn-crear-branch")?.addEventListener("click", async () => {
            const companyId = document.getElementById("branch-company-id").value;
            const nombre = document.getElementById("branch-nombre").value.trim();
            const ciudad = document.getElementById("branch-ciudad").value.trim();
            const direccion = document.getElementById("branch-direccion").value.trim();
            if (!companyId || !nombre || !ciudad) {
                window.mostrarNotificacion("Seleccione supermercado e ingrese nombre y ciudad", "warning");
                return;
            }
            try {
                await window.apiPost(`/companies/${companyId}/branches`, {
                    nombre, ciudad, direccion: direccion || null
                });
                window.mostrarNotificacion("Sucursal creada y registrada en inventario", "success");
                document.getElementById("branch-nombre").value = "";
                document.getElementById("branch-ciudad").value = "";
                document.getElementById("branch-direccion").value = "";
                await cargarBranchesDe(companyId);
                await cargarTodasLasSucursales();
            } catch (e) {
                window.mostrarNotificacion("Error: " + e.message, "error");
            }
        });

        // Crear usuario vendedor
        document.getElementById("btn-crear-usuario")?.addEventListener("click", async () => {
            const username = document.getElementById("user-username").value.trim();
            const email = document.getElementById("user-email").value.trim();
            const password = document.getElementById("user-password").value.trim();
            const sucursal_id = document.getElementById("user-sucursal-id").value;
            if (!username || !email || !password || !sucursal_id) {
                window.mostrarNotificacion("Complete todos los campos incluyendo la sucursal", "warning");
                return;
            }
            try {
                await window.apiPost("/auth/register", {
                    username, email, password,
                    rol: "Vendedor",
                    sucursal_id,
                });
                window.mostrarNotificacion(`Vendedor "${username}" creado correctamente`, "success");
                document.getElementById("user-username").value = "";
                document.getElementById("user-email").value = "";
                document.getElementById("user-password").value = "";
                document.getElementById("user-sucursal-id").value = "";
                await cargarUsuarios();
            } catch (e) {
                window.mostrarNotificacion("Error: " + e.message, "error");
            }
        });
    }

    function esc(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

})();
