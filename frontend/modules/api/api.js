// api.js - Gateway centralizado con autenticación JWT
const GATEWAY = "http://localhost:8000";
const TIMEOUT = 30000;

console.log("🔧 Inicializando api.js...");

// ── Auth helpers ──────────────────────────────────────────────────────────────
window.getToken = function() {
    return localStorage.getItem("jwt_token");
};

window.setToken = function(token) {
    localStorage.setItem("jwt_token", token);
};

window.clearToken = function() {
    localStorage.removeItem("jwt_token");
};

window.isAuthenticated = function() {
    return !!window.getToken();
};

// ── Login / Logout ────────────────────────────────────────────────────────────
window.login = async function(username, password) {
    const resp = await fetch(`${GATEWAY}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Credenciales inválidas");
    }
    const data = await resp.json();
    window.setToken(data.access_token);
    return data;
};

window.logout = function() {
    window.clearToken();
    window.mostrarLogin?.();
};

// ── fetch con timeout ─────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === "AbortError") {
            throw new Error(`Timeout: La petición a ${url} excedió ${timeout / 1000}s`);
        }
        throw error;
    }
}

// ── Helper genérico ───────────────────────────────────────────────────────────
window.api = async function(path, options = {}) {
    const url = `${GATEWAY}${path}`;
    const token = window.getToken();

    const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    try {
        console.debug(`🚀 API Request: ${options.method || "GET"} ${path}`);

        const resp = await fetchWithTimeout(url, { ...options, headers });

        if (resp.status === 401) {
            window.clearToken();
            window.mostrarLogin?.();
            throw new Error("Sesión expirada. Inicie sesión nuevamente.");
        }

        if (!resp.ok) {
            let errorMessage = `${resp.status} ${resp.statusText}`;
            try {
                const errorData = await resp.json();
                if (resp.status === 422 && Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map(e => {
                        const campo = e.loc?.filter(l => l !== "body").join(".") || "campo";
                        return `${campo}: ${e.msg}`;
                    }).join(", ");
                } else if (errorData.detail) {
                    errorMessage = typeof errorData.detail === "string"
                        ? errorData.detail
                        : JSON.stringify(errorData.detail);
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (_) {
                const text = await resp.text();
                if (text) errorMessage += `: ${text.substring(0, 200)}`;
            }
            const error = new Error(errorMessage);
            error.status = resp.status;
            throw error;
        }

        if (resp.status === 204) return null;
        const data = await resp.json();
        console.debug(`✅ API Response: ${path}`, data);
        return data;

    } catch (error) {
        console.error(`❌ API Error [${path}]:`, error);
        if (error.name === "TypeError" && error.message.includes("fetch")) {
            error.message = "No se pudo conectar con el servidor. ¿Está el gateway funcionando?";
        }
        throw error;
    }
};

window.apiPost = async function(path, data) {
    return window.api(path, { method: "POST", body: JSON.stringify(data) });
};

window.apiPut = async function(path, data) {
    return window.api(path, { method: "PUT", body: JSON.stringify(data) });
};

window.apiDelete = async function(path) {
    return window.api(path, { method: "DELETE" });
};

window.apiWithRetry = async function(path, options = {}, retries = 3) {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await window.api(path, options);
        } catch (error) {
            lastError = error;
            if (error.status === 401) throw error; // no reintentar en 401
            console.warn(`⚠️ Intento ${i + 1} fallido para ${path}:`, error.message);
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
            }
        }
    }
    throw lastError;
};

console.log("✅ api.js cargado correctamente");
