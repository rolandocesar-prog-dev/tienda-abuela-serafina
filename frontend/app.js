// Contenedor principal
const appContainer = document.getElementById("app-container");
let currentScript = null;
let currentCss = null;
let currentModule = null;
let toastInstance = null;
let isLoadingModule = false;

// Verificar que api.js está cargado
function esperarApi() {
    return new Promise((resolve) => {
        if (typeof window.api !== 'undefined' && window.api !== null) {
            console.log("✅ api.js ya está listo");
            resolve();
        } else {
            console.log("⏳ Esperando que api.js se cargue...");
            const checkInterval = setInterval(() => {
                if (typeof window.api !== 'undefined' && window.api !== null) {
                    clearInterval(checkInterval);
                    console.log("✅ api.js listo");
                    resolve();
                }
            }, 50);
        }
    });
}

// Inicializar Toast de Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    const toastEl = document.getElementById('liveToast');
    if (toastEl) {
        toastInstance = new bootstrap.Toast(toastEl);
    }
    
    actualizarFecha();
    
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        if (currentModule && !isLoadingModule) {
            cargarModulo(currentModule);
            mostrarNotificacion('Recargando módulo...', 'info');
        }
    });
    
    // Iniciar después de esperar API
    esperarApi().then(() => {
        cargarModulo("catalog");
    });
});

// Actualizar fecha
function actualizarFecha() {
    const fecha = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const fechaEl = document.getElementById('fecha-actual');
    if (fechaEl) {
        fechaEl.textContent = fecha.toLocaleDateString('es-ES', options);
    }
}

// Mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'info') {
    if (!toastInstance) {
        if (tipo === 'error') {
            Swal.fire({
                title: 'Error',
                text: mensaje,
                icon: 'error',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
        return;
    }
    
    const toastBody = document.querySelector('#liveToast .toast-body');
    const toastHeader = document.querySelector('#liveToast .toast-header strong');
    
    if (toastBody) toastBody.textContent = mensaje;
    
    const iconos = {
        success: '<i class="bi bi-check-circle-fill text-success"></i> Éxito',
        error: '<i class="bi bi-exclamation-triangle-fill text-danger"></i> Error',
        warning: '<i class="bi bi-exclamation-circle-fill text-warning"></i> Advertencia',
        info: '<i class="bi bi-info-circle-fill text-info"></i> Información'
    };
    
    if (toastHeader) toastHeader.innerHTML = iconos[tipo] || iconos.info;
    toastInstance.show();
}

// Mostrar loading
function mostrarLoading(mensaje = 'Cargando...') {
    if (!appContainer) return;
    appContainer.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3 text-muted">${mensaje}</p>
        </div>
    `;
}

// Cargar módulo
async function cargarModulo(nombre) {
    if (isLoadingModule) {
        console.log(`⏳ Ya cargando un módulo, ignorando solicitud para: ${nombre}`);
        return;
    }
    
    if (currentModule === nombre) {
        console.log(`📌 Módulo ${nombre} ya está cargado`);
        return;
    }
    
    isLoadingModule = true;
    
    try {
        currentModule = nombre;
        mostrarLoading(`Cargando módulo ${nombre}...`);
        
        // 1. Cargar HTML
        const htmlResponse = await fetch(`modules/${nombre}/${nombre}.html`);
        if (!htmlResponse.ok) {
            throw new Error(`No se encontró ${nombre}.html (${htmlResponse.status})`);
        }
        
        appContainer.innerHTML = await htmlResponse.text();
        
        // 2. Cargar CSS
        if (currentCss) currentCss.remove();
        currentCss = document.createElement("link");
        currentCss.rel = "stylesheet";
        currentCss.href = `modules/${nombre}/${nombre}.css`;
        document.head.appendChild(currentCss);
        
        // 3. Cargar JS - Remover script anterior
        if (currentScript) {
            currentScript.remove();
            // Esperar un poco para que se limpie
            await new Promise(r => setTimeout(r, 50));
        }
        
        currentScript = document.createElement("script");
        currentScript.src = `modules/${nombre}/${nombre}.js?v=${Date.now()}`;
        
        currentScript.onload = () => {
            const initFunction = `init${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
            if (typeof window[initFunction] === "function") {
                window[initFunction]();
                mostrarNotificacion(`✅ Módulo ${nombre} cargado`, 'success');
            } else {
                console.warn(`⚠️ Función ${initFunction} no encontrada`);
                mostrarNotificacion(`Módulo ${nombre} cargado`, 'info');
            }
            isLoadingModule = false;
        };
        
        currentScript.onerror = () => {
            throw new Error(`Error cargando el script ${nombre}.js`);
        };
        
        document.body.appendChild(currentScript);
        
    } catch (error) {
        console.error("Error cargando módulo:", error);
        mostrarNotificacion(`❌ Error: ${error.message}`, 'error');
        isLoadingModule = false;
        if (appContainer) {
            appContainer.innerHTML = `
                <div class="alert alert-danger shadow-sm fade-in" role="alert">
                    <i class="bi bi-exclamation-octagon-fill me-2"></i>
                    <strong>Error:</strong> No se pudo cargar el módulo "${nombre}"
                    <hr>
                    <p class="mb-0">${error.message}</p>
                    <button class="btn btn-outline-danger mt-3" onclick="location.reload()">
                        <i class="bi bi-arrow-repeat me-1"></i>Recargar página
                    </button>
                </div>
            `;
        }
    }
}

// Navegación
function iniciarNavegacion() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(btn => {
        btn.addEventListener("click", async () => {
            const target = btn.dataset.tab;
            if (!target || currentModule === target) return;
            
            tabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            await cargarModulo(target);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// Iniciar navegación después de que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarNavegacion);
} else {
    iniciarNavegacion();
}

// Exportar funciones globales
window.mostrarNotificacion = mostrarNotificacion;
window.mostrarLoading = mostrarLoading;