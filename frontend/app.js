// Contenedor principal donde se cargan los módulos
const appContainer = document.getElementById("app-container");

// Referencias para evitar duplicar CSS y JS
let currentScript = null;
let currentCss = null;

/**
 * Carga dinámicamente un módulo:
 * - HTML
 * - CSS
 * - JS
 */
async function cargarModulo(nombre) {
    try {

        // 1. Cargar HTML
        const htmlResponse = await fetch(
            `modules/${nombre}/${nombre}.html`
        );

        if (!htmlResponse.ok) {
            throw new Error(`No se encontró ${nombre}.html`);
        }

        appContainer.innerHTML = await htmlResponse.text();

        // 2. Cargar CSS
        if (currentCss) {
            currentCss.remove();
        }

        currentCss = document.createElement("link");
        currentCss.rel = "stylesheet";
        currentCss.href = `modules/${nombre}/${nombre}.css`;

        document.head.appendChild(currentCss);

        // 3. Cargar JS
        if (currentScript) {
            currentScript.remove();
        }

        currentScript = document.createElement("script");
        currentScript.src = `modules/${nombre}/${nombre}.js`;

        currentScript.onload = () => {

            const initFunction =
                `init${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;

            if (typeof window[initFunction] === "function") {
                window[initFunction]();
            }
        };

        document.body.appendChild(currentScript);

    } catch (error) {

        console.error(error);

        appContainer.innerHTML = `
            <div class="alert alert-danger">
                Error cargando módulo: ${nombre}
            </div>
        `;
    }
}

/**
 * Navegación entre pestañas
 */
document.querySelectorAll(".tab-btn").forEach(btn => {

    btn.addEventListener("click", () => {

        document
            .querySelectorAll(".tab-btn")
            .forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        cargarModulo(btn.dataset.tab);
    });

});

// Módulo inicial
cargarModulo("catalog");