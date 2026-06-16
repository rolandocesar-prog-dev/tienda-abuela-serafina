// app.js — Router y bootstrap de la SPA
const appContainer = document.getElementById("app-container");
let currentScript = null;
let currentCss = null;
let currentModule = null;
let toastInstance = null;
let isLoadingModule = false;
let loginModal = null;

// ── Esperar api.js ────────────────────────────────────────────────────────────
function esperarApi() {
    return new Promise((resolve) => {
        if (typeof window.api !== "undefined") { resolve(); return; }
        const id = setInterval(() => {
            if (typeof window.api !== "undefined") { clearInterval(id); resolve(); }
        }, 50);
    });
}

// ── Login modal ───────────────────────────────────────────────────────────────
window.mostrarLogin = function() {
    if (!loginModal) loginModal = new bootstrap.Modal(document.getElementById("modalLogin"));
    document.getElementById("login-error").classList.add("d-none");
    loginModal.show();
    document.getElementById("btn-logout").style.display = "none";
    document.getElementById("usuario-actual").textContent = "";
};

function ocultarLogin(username) {
    loginModal?.hide();
    document.getElementById("btn-logout").style.display = "";
    document.getElementById("usuario-actual").textContent = `👤 ${username}`;
}

function configurarLogin() {
    const btn = document.getElementById("btn-login");
    const usernameEl = document.getElementById("login-username");
    const passwordEl = document.getElementById("login-password");
    const errorEl = document.getElementById("login-error");

    async function doLogin() {
        const username = usernameEl.value.trim();
        const password = passwordEl.value.trim();
        if (!username || !password) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Ingresando...';
        errorEl.classList.add("d-none");

        try {
            await window.login(username, password);
            ocultarLogin(username);
            await cargarModulo("catalog");
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.classList.remove("d-none");
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Ingresar';
        }
    }

    btn.addEventListener("click", doLogin);
    [usernameEl, passwordEl].forEach(el => {
        el.addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
        window.logout();
        currentModule = null;
    });
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
    const toastBody = document.querySelector("#liveToast .toast-body");
    const toastHeader = document.querySelector("#liveToast .toast-header strong");
    if (toastBody) toastBody.textContent = mensaje;
    const iconos = {
        success: '<i class="bi bi-check-circle-fill text-success"></i> Éxito',
        error:   '<i class="bi bi-exclamation-triangle-fill text-danger"></i> Error',
        warning: '<i class="bi bi-exclamation-circle-fill text-warning"></i> Advertencia',
        info:    '<i class="bi bi-info-circle-fill text-info"></i> Información'
    };
    if (toastHeader) toastHeader.innerHTML = iconos[tipo] || iconos.info;
    toastInstance.show();
}

function mostrarLoading(mensaje = "Cargando...") {
    if (!appContainer) return;
    appContainer.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" style="width:3rem;height:3rem;" role="status"></div>
            <p class="mt-3 text-muted">${mensaje}</p>
        </div>`;
}

// ── Cargar módulo ─────────────────────────────────────────────────────────────
async function cargarModulo(nombre) {
    if (isLoadingModule) return;
    if (currentModule === nombre) return;
    isLoadingModule = true;

    try {
        currentModule = nombre;
        mostrarLoading(`Cargando módulo ${nombre}...`);

        const htmlResp = await fetch(`modules/${nombre}/${nombre}.html`);
        if (!htmlResp.ok) throw new Error(`No se encontró ${nombre}.html (${htmlResp.status})`);
        appContainer.innerHTML = await htmlResp.text();

        if (currentCss) currentCss.remove();
        currentCss = document.createElement("link");
        currentCss.rel = "stylesheet";
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

// ── Navegación ────────────────────────────────────────────────────────────────
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
    if (fechaEl) fechaEl.textContent = fecha.toLocaleDateString("es-ES", { year:"numeric", month:"long", day:"numeric" });

    document.getElementById("btn-refresh")?.addEventListener("click", () => {
        if (currentModule && !isLoadingModule) {
            const prev = currentModule; currentModule = null;
            cargarModulo(prev);
        }
    });

    configurarLogin();
    iniciarNavegacion();

    await esperarApi();

    if (window.isAuthenticated()) {
        // Token guardado — arrancar directamente
        document.getElementById("btn-logout").style.display = "";
        await cargarModulo("catalog");
    } else {
        window.mostrarLogin();
    }
});

window.mostrarNotificacion = mostrarNotificacion;
window.mostrarLoading = mostrarLoading;
