// app.js — Router y bootstrap de la SPA
const appContainer = document.getElementById("app-container");
let currentScript = null;
let currentCss    = null;
let currentModule = null;
let toastInstance = null;
let isLoadingModule = false;

// ── Usuario actual ────────────────────────────────────────────────────────────
window.currentUser = null;

function leerUsuarioDeJWT() {
    try {
        const token = window.getToken();
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return { id: payload.sub, rol: payload.rol, sucursal_id: payload.sucursal_id || null };
    } catch (_) { return null; }
}

window.esAdmin = function () {
    return window.currentUser?.rol === "Administrador";
};

// ── Tabs según rol ────────────────────────────────────────────────────────────
function configurarTabsSegunRol() {
    const isAdmin = window.esAdmin();
    document.querySelectorAll(".tab-admin").forEach(el => el.style.display = isAdmin ? "" : "none");
    document.querySelectorAll(".tab-vendedor").forEach(el => el.style.display = isAdmin ? "none" : "");

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    const primerTab = isAdmin ? "catalog" : "ventas";
    document.querySelector(`[data-tab="${primerTab}"]`)?.classList.add("active");
}

// ── Esperar api.js ────────────────────────────────────────────────────────────
function esperarApi() {
    return new Promise(resolve => {
        if (typeof window.api !== "undefined") { resolve(); return; }
        const id = setInterval(() => {
            if (typeof window.api !== "undefined") { clearInterval(id); resolve(); }
        }, 50);
    });
}

// ── Página de login completa ──────────────────────────────────────────────────
const LOGIN_HTML = `
<div class="login-page">
    <div class="login-card">
        <div class="login-brand">
            <div class="login-logo">
                <i class="bi bi-shop-window"></i>
            </div>
            <h1 class="login-title">Abuela Serafina</h1>
            <p class="login-subtitle">Sistema de Gestión de Tienda</p>
        </div>

        <div id="login-error" class="alert alert-danger d-none" role="alert"></div>

        <div class="mb-3">
            <label class="form-label fw-semibold" for="login-username">Usuario</label>
            <div class="input-group">
                <span class="input-group-text"><i class="bi bi-person"></i></span>
                <input type="text" id="login-username" class="form-control" placeholder="Ingrese su usuario" autocomplete="username">
            </div>
        </div>

        <div class="mb-4">
            <label class="form-label fw-semibold" for="login-password">Contraseña</label>
            <div class="input-group">
                <span class="input-group-text"><i class="bi bi-lock"></i></span>
                <input type="password" id="login-password" class="form-control" placeholder="Ingrese su contraseña" autocomplete="current-password">
            </div>
        </div>

        <button id="btn-login" class="btn btn-login w-100">
            <i class="bi bi-box-arrow-in-right me-2"></i>Iniciar Sesión
        </button>

        <p class="login-footer">Sistema exclusivo para personal autorizado</p>
    </div>
</div>`;

window.mostrarLogin = function () {
    currentModule = null;
    window.currentUser = null;
    localStorage.removeItem('_app_user');

    // Ocultar sidebar y controles de sesión
    document.getElementById("sidebar").style.display = "none";
    document.getElementById("btn-logout").style.display = "none";
    document.getElementById("btn-refresh").style.display = "none";
    document.getElementById("usuario-actual").textContent = "";
    const pill = document.getElementById("usuario-actual-pill");
    if (pill) pill.style.display = "none";
    const sidebarUsername = document.getElementById("sidebar-username");
    if (sidebarUsername) sidebarUsername.textContent = "—";

    // Renderizar página de login
    appContainer.innerHTML = LOGIN_HTML;
    appContainer.style.padding = "0";

    // Enfocar el campo usuario
    document.getElementById("login-username")?.focus();

    // Adjuntar eventos
    _adjuntarEventosLogin();
};

function _adjuntarEventosLogin() {
    const btn        = document.getElementById("btn-login");
    const usernameEl = document.getElementById("login-username");
    const passwordEl = document.getElementById("login-password");
    const errorEl    = document.getElementById("login-error");

    async function doLogin() {
        const username = usernameEl.value.trim();
        const password = passwordEl.value.trim();
        if (!username || !password) {
            errorEl.textContent = "Ingrese usuario y contraseña";
            errorEl.classList.remove("d-none");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ingresando...';
        errorEl.classList.add("d-none");

        try {
            await window.login(username, password);
            window.currentUser = leerUsuarioDeJWT();
            localStorage.setItem('_app_user', username);
            _mostrarSesion(username);
            configurarTabsSegunRol();
            await cargarModulo(window.esAdmin() ? "catalog" : "ventas");
        } catch (err) {
            errorEl.textContent = err.message || "Credenciales inválidas";
            errorEl.classList.remove("d-none");
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Iniciar Sesión';
        }
    }

    btn.addEventListener("click", doLogin);
    [usernameEl, passwordEl].forEach(el => {
        el.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
    });
}

function _mostrarSesion(username) {
    // Restaurar padding normal del app-container
    appContainer.style.padding = "";

    // Mostrar sidebar y controles
    document.getElementById("sidebar").style.display = "";
    document.getElementById("btn-logout").style.display = "";
    document.getElementById("btn-refresh").style.display = "";
    document.getElementById("usuario-actual").textContent = username;
    const pill = document.getElementById("usuario-actual-pill");
    if (pill) pill.style.display = "flex";
    const sidebarUsername = document.getElementById("sidebar-username");
    if (sidebarUsername) sidebarUsername.textContent = username;
}

// ── Notificaciones ────────────────────────────────────────────────────────────
function mostrarNotificacion(mensaje, tipo = "info") {
    if (!toastInstance) {
        if (tipo === "error") {
            Swal.fire({ title: "Error", text: mensaje, icon: "error", toast: true,
                position: "top-end", showConfirmButton: false, timer: 3000 });
        }
        return;
    }
    const toastBody   = document.querySelector("#liveToast .toast-body");
    const toastHeader = document.querySelector("#liveToast .toast-header strong");
    if (toastBody) toastBody.textContent = mensaje;
    const iconos = {
        success: '<i class="bi bi-check-circle-fill text-success"></i> Éxito',
        error:   '<i class="bi bi-exclamation-triangle-fill text-danger"></i> Error',
        warning: '<i class="bi bi-exclamation-circle-fill text-warning"></i> Advertencia',
        info:    '<i class="bi bi-info-circle-fill text-info"></i> Información',
    };
    if (toastHeader) toastHeader.innerHTML = iconos[tipo] || iconos.info;
    toastInstance.show();
}

function mostrarLoading(mensaje = "Cargando...") {
    if (!appContainer) return;
    appContainer.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border" style="width:3rem;height:3rem;color:var(--amber);" role="status"></div>
            <p class="mt-3" style="color:rgba(255,255,255,0.55);font-size:0.9rem;">${mensaje}</p>
        </div>`;
}

// ── Cargar módulo ─────────────────────────────────────────────────────────────
async function cargarModulo(nombre) {
    if (isLoadingModule) return;
    if (currentModule === nombre) return;

    const soloAdmin    = ["catalog", "almacen", "empresa", "reportes"];
    const soloVendedor = ["ventas"];
    if (soloAdmin.includes(nombre) && !window.esAdmin()) {
        mostrarNotificacion("Acceso restringido a Administradores", "error");
        return;
    }
    if (soloVendedor.includes(nombre) && window.esAdmin()) {
        mostrarNotificacion("Las ventas las gestiona el Vendedor", "error");
        return;
    }

    isLoadingModule = true;
    try {
        currentModule = nombre;
        mostrarLoading();

        const htmlResp = await fetch(`modules/${nombre}/${nombre}.html?v=${Date.now()}`, { cache: "no-store" });
        if (!htmlResp.ok) throw new Error(`No se encontró ${nombre}.html (${htmlResp.status})`);
        appContainer.innerHTML = await htmlResp.text();

        if (currentCss) currentCss.remove();
        currentCss = document.createElement("link");
        currentCss.rel  = "stylesheet";
        currentCss.href = `modules/${nombre}/${nombre}.css`;
        document.head.appendChild(currentCss);

        if (currentScript) { currentScript.remove(); await new Promise(r => setTimeout(r, 50)); }
        currentScript = document.createElement("script");
        currentScript.src = `modules/${nombre}/${nombre}.js?v=${Date.now()}`;
        currentScript.onload = () => {
            const fn = `init${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
            if (typeof window[fn] === "function") window[fn]();
            isLoadingModule = false;
        };
        currentScript.onerror = () => { isLoadingModule = false; };
        document.body.appendChild(currentScript);

    } catch (error) {
        console.error("Error cargando módulo:", error);
        mostrarNotificacion(`Error: ${error.message}`, "error");
        isLoadingModule = false;
        appContainer.innerHTML = `
            <div class="alert alert-danger m-4">
                <strong>Error:</strong> No se pudo cargar el módulo "${nombre}"<br>
                <small>${error.message}</small>
            </div>`;
    }
}

// ── Navegación por tabs ───────────────────────────────────────────────────────
function iniciarNavegacion() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const target = btn.dataset.tab;
            if (!target || currentModule === target) return;
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            await cargarModulo(target);
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    const toastEl = document.getElementById("liveToast");
    if (toastEl) toastInstance = new bootstrap.Toast(toastEl);

    const fecha = new Date();
    const fechaEl = document.getElementById("fecha-actual");
    if (fechaEl) fechaEl.textContent = fecha.toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });

    document.getElementById("btn-refresh")?.addEventListener("click", () => {
        if (currentModule && !isLoadingModule) {
            const prev = currentModule;
            currentModule = null;
            cargarModulo(prev);
        }
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
        window.logout(); // clearToken + mostrarLogin
        currentModule = null;
        window.currentUser = null;
    });

    iniciarNavegacion();
    await esperarApi();

    if (window.isAuthenticated()) {
        window.currentUser = leerUsuarioDeJWT();
        try {
            const stored = localStorage.getItem('_app_user');
            const payload = JSON.parse(atob(window.getToken().split('.')[1]));
            _mostrarSesion(stored || payload.sub || "Usuario");
        } catch (_) {
            _mostrarSesion("Usuario");
        }
        configurarTabsSegunRol();
        await cargarModulo(window.esAdmin() ? "catalog" : "ventas");
    } else {
        window.mostrarLogin();
    }
});

window.mostrarNotificacion = mostrarNotificacion;
window.mostrarLoading = mostrarLoading;
