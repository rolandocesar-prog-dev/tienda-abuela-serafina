// Contenedor principal
const appContainer = document.getElementById("app-container");
let currentScript = null;
let currentCss = null;
let currentModule = null;
let toastInstance = null;

// Inicializar Toast de Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    const toastEl = document.getElementById('liveToast');
    if (toastEl) {
        toastInstance = new bootstrap.Toast(toastEl);
    }
    
    // Mostrar fecha actual
    actualizarFecha();
    
    // Cargar agencias
    cargarAgencias();
    
    // Botón de refresh
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        if (currentModule) {
            cargarModulo(currentModule);
            mostrarNotificacion('Recargando módulo...', 'info');
        }
    });
});

// Actualizar fecha
function actualizarFecha() {
    const fecha = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fecha-actual').textContent = fecha.toLocaleDateString('es-ES', options);
}

// Cargar agencias disponibles
async function cargarAgencias() {
    try {
        const agencias = await api('/rrhh/agencias');
        const select = document.getElementById('agencia');
        
        if (agencias && agencias.length > 0) {
            select.innerHTML = '<option value="">Seleccionar agencia</option>';
            agencias.forEach(agencia => {
                const option = document.createElement('option');
                option.value = agencia.id;
                option.textContent = `${agencia.nombre} - ${agencia.ubicacion || 'Sin ubicación'}`;
                select.appendChild(option);
            });
            
            // Guardar agencia seleccionada
            select.addEventListener('change', (e) => {
                localStorage.setItem('agencia_id', e.target.value);
                mostrarNotificacion(`Agencia seleccionada: ${select.options[select.selectedIndex]?.text}`, 'success');
            });
            
            // Restaurar agencia guardada
            const savedAgencia = localStorage.getItem('agencia_id');
            if (savedAgencia) {
                select.value = savedAgencia;
            }
        }
    } catch (error) {
        console.error('Error cargando agencias:', error);
        document.getElementById('agencia').innerHTML = '<option value="">Error cargando agencias</option>';
    }
}

// Mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'info') {
    if (!toastInstance) return;
    
    const toastBody = document.querySelector('#liveToast .toast-body');
    const toastHeader = document.querySelector('#liveToast .toast-header strong');
    
    toastBody.textContent = mensaje;
    
    const iconos = {
        success: '<i class="bi bi-check-circle-fill text-success"></i> Éxito',
        error: '<i class="bi bi-exclamation-triangle-fill text-danger"></i> Error',
        warning: '<i class="bi bi-exclamation-circle-fill text-warning"></i> Advertencia',
        info: '<i class="bi bi-info-circle-fill text-info"></i> Información'
    };
    
    toastHeader.innerHTML = iconos[tipo] || iconos.info;
    toastInstance.show();
}

// Mostrar loading
function mostrarLoading(mensaje = 'Cargando...') {
    appContainer.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3 text-muted">${mensaje}</p>
        </div>
    `;
}

// Cargar módulo mejorado
async function cargarModulo(nombre) {
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
        
        // 3. Cargar JS
        if (currentScript) currentScript.remove();
        currentScript = document.createElement("script");
        currentScript.src = `modules/${nombre}/${nombre}.js`;
        
        currentScript.onload = () => {
            const initFunction = `init${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
            if (typeof window[initFunction] === "function") {
                window[initFunction]();
                mostrarNotificacion(`Módulo ${nombre} cargado correctamente`, 'success');
            } else {
                console.warn(`Función ${initFunction} no encontrada`);
            }
        };
        
        currentScript.onerror = () => {
            throw new Error(`Error cargando el script ${nombre}.js`);
        };
        
        document.body.appendChild(currentScript);
        
    } catch (error) {
        console.error("Error cargando módulo:", error);
        mostrarNotificacion(`Error cargando módulo: ${error.message}`, 'error');
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

// Navegación mejorada
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
        const target = btn.dataset.tab;
        
        // Actualizar UI
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        // Cargar módulo
        await cargarModulo(target);
        
        // Scroll suave al inicio
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

// Módulo inicial
cargarModulo("catalog");

// Exportar funciones globales
window.mostrarNotificacion = mostrarNotificacion;
window.mostrarLoading = mostrarLoading;