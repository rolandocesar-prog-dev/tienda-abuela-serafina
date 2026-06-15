// api.js - Gateway centralizado con mejor manejo de errores
const GATEWAY = "http://localhost:8000";
const TIMEOUT = 30000; // 30 segundos timeout

/**
 * Helper con timeout para fetch
 */
async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Timeout: La petición a ${url} excedió ${timeout/1000}s`);
        }
        throw error;
    }
}

/**
 * Helper genérico para llamar al gateway
 */
window.api = async function(path, options = {}) {
    const url = `${GATEWAY}${path}`;
    
    try {
        // Mostrar loading sutil en consola (opcional)
        console.debug(`🚀 API Request: ${options.method || 'GET'} ${path}`);
        
        const resp = await fetchWithTimeout(url, {
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            ...options,
        });

        // Manejo de errores específicos
        if (!resp.ok) {
            let errorMessage = `${resp.status} ${resp.statusText}`;
            
            try {
                const errorData = await resp.json();
                errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch (e) {
                const text = await resp.text();
                if (text) errorMessage = `${errorMessage}: ${text.substring(0, 200)}`;
            }
            
            const error = new Error(errorMessage);
            error.status = resp.status;
            error.statusText = resp.statusText;
            throw error;
        }

        // 204 No Content
        if (resp.status === 204) return null;
        
        // Parsear JSON
        const data = await resp.json();
        console.debug(`✅ API Response: ${path}`, data);
        return data;
        
    } catch (error) {
        console.error(`❌ API Error [${path}]:`, error);
        
        // Mejorar mensajes de error para el usuario
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            error.message = 'No se pudo conectar con el servidor. ¿Está el gateway funcionando?';
        } else if (error.message.includes('Timeout')) {
            error.message = 'El servidor tardó demasiado en responder. Intente nuevamente.';
        } else if (error.status === 404) {
            error.message = `El recurso ${path} no existe en el servidor.`;
        } else if (error.status === 500) {
            error.message = 'Error interno del servidor. Contacte al administrador.';
        }
        
        throw error;
    }
};

// Helper para POST con datos
window.apiPost = async function(path, data) {
    return api(path, {
        method: 'POST',
        body: JSON.stringify(data)
    });
};

// Helper para PUT
window.apiPut = async function(path, data) {
    return api(path, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

// Helper para DELETE
window.apiDelete = async function(path) {
    return api(path, {
        method: 'DELETE'
    });
};

// Helper para cargar recursos con reintentos
window.apiWithRetry = async function(path, options = {}, retries = 3) {
    let lastError;
    
    for (let i = 0; i < retries; i++) {
        try {
            return await api(path, options);
        } catch (error) {
            lastError = error;
            console.warn(`Intento ${i + 1} fallido para ${path}:`, error.message);
            
            if (i < retries - 1) {
                // Esperar exponencialmente más antes de reintentar
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
};