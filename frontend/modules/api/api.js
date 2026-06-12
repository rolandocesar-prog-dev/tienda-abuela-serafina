// api.js - Gateway centralizado para todas las peticiones
const GATEWAY = "http://localhost:8000";

/**
 * Helper genérico para llamar al gateway
 * @param {string} path - Ruta del endpoint (ej: "/catalog/products")
 * @param {Object} options - Opciones de fetch (method, body, etc.)
 */
window.api = async function(path, options = {}) {
    try {
        const resp = await fetch(`${GATEWAY}${path}`, {
            headers: { 
                "Content-Type": "application/json" 
            },
            ...options,
        });

        // Manejo de errores del servidor
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
        }

        // Si es código 204 (No Content), devolvemos null
        return resp.status === 204 ? null : await resp.json();
        
    } catch (error) {
        console.error("Error en petición API:", error);
        throw error; // Relanzamos para que el módulo que llamó al API pueda manejar el error
    }
};