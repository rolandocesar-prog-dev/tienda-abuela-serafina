// Prevenir carga duplicada - CORREGIDO
if (typeof window.catalogLoaded !== 'undefined' && window.catalogLoaded === true) {
    console.warn('⚠️ Catálogo ya está cargado, omitiendo...');
    // No usar return, usar un bloque condicional
} else {
    window.catalogLoaded = true;

// Variables globales - asegurar inicialización
let productos = [];
let categoriasDisponibles = [];
let unidadesDisponibles = ['kg', 'g', 'l', 'ml', 'unidad', 'docena', 'paquete'];
let currentView = 'tarjetas';
let currentPage = 1;
let itemsPerPage = 12;
let currentFilters = {
    search: '',
    categoria: 'todas',
    precio: 'todos'
};
let idEditando = null;

    /**
     * Inicializar módulo de catálogo
     */
    window.initCatalog = async function() {
        console.log('📦 Inicializando Catálogo...');
        
        mostrarSkeleton();
        
        await cargarProductos();
        extraerCategoriasUnicas();
        cargarEstadisticas();
        configurarEventos();
        renderizarVista();
        cargarSelectCategorias();
    };

    /**
     * Extraer categorías únicas de los productos
     */
    function extraerCategoriasUnicas() {
        const categorias = productos
            .map(p => p.categoria)
            .filter(c => c && c.trim() !== '');
        categoriasDisponibles = [...new Set(categorias)];
    }

    /**
     * Cargar el select de categorías en el modal
     */
    function cargarSelectCategorias() {
        const selectCategoria = document.getElementById('prod-categoria');
        if (!selectCategoria) return;
        
        selectCategoria.innerHTML = '<option value="">Seleccionar o crear categoría...</option>';
        
        // Agregar categorías existentes
        categoriasDisponibles.forEach(cat => {
            selectCategoria.innerHTML += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
        });
        
        // Agregar opción para crear nueva
        selectCategoria.innerHTML += '<option value="__NUEVA__">➕ Crear nueva categoría...</option>';
    }

    /**
     * Agregar nueva categoría
     */
    async function agregarNuevaCategoria() {
        const nombreCategoria = document.getElementById('nueva-categoria-nombre').value.trim();
        const iconoCategoria = document.getElementById('nueva-categoria-icono').value;
        
        if (!nombreCategoria) {
            window.mostrarNotificacion('Ingrese un nombre para la categoría', 'warning');
            return;
        }
        
        // Verificar si ya existe
        if (categoriasDisponibles.includes(nombreCategoria)) {
            window.mostrarNotificacion('Esta categoría ya existe', 'warning');
            return;
        }
        
        // Agregar a la lista local
        categoriasDisponibles.push(nombreCategoria);
        categoriasDisponibles.sort();
        
        // Actualizar select de categorías
        cargarSelectCategorias();
        
        // Seleccionar la nueva categoría
        const selectCategoria = document.getElementById('prod-categoria');
        if (selectCategoria) {
            selectCategoria.value = nombreCategoria;
        }
        
        // Actualizar filtro de categorías
        actualizarFiltrosCategorias();
        
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('modalNuevaCategoria')).hide();
        
        // Limpiar campo
        document.getElementById('nueva-categoria-nombre').value = '';
        
        window.mostrarNotificacion(`Categoría "${nombreCategoria}" creada`, 'success');
    }

    /**
     * Agregar nueva unidad de medida
     */
    function agregarNuevaUnidad() {
        const nombreUnidad = document.getElementById('nueva-unidad-nombre').value.trim();
        const abrevUnidad = document.getElementById('nueva-unidad-abrev').value.trim();
        const unidadFinal = abrevUnidad || nombreUnidad;
        
        if (!nombreUnidad) {
            window.mostrarNotificacion('Ingrese un nombre para la unidad', 'warning');
            return;
        }
        
        // Verificar si ya existe
        if (unidadesDisponibles.includes(unidadFinal) || unidadesDisponibles.includes(nombreUnidad)) {
            window.mostrarNotificacion('Esta unidad ya existe', 'warning');
            return;
        }
        
        // Agregar a la lista local
        unidadesDisponibles.push(unidadFinal);
        unidadesDisponibles.sort();
        
        // Actualizar select de unidades
        const selectUnidad = document.getElementById('prod-unidad');
        if (selectUnidad) {
            // Mantener opciones predefinidas + nuevas
            const opcionesBase = [
                { value: 'kg', label: 'Kilogramo (kg)' },
                { value: 'g', label: 'Gramo (g)' },
                { value: 'l', label: 'Litro (l)' },
                { value: 'ml', label: 'Mililitro (ml)' },
                { value: 'unidad', label: 'Unidad' },
                { value: 'docena', label: 'Docena' },
                { value: 'paquete', label: 'Paquete' }
            ];
            
            selectUnidad.innerHTML = '<option value="">Seleccionar unidad...</option>';
            
            // Agregar opciones base
            opcionesBase.forEach(opt => {
                selectUnidad.innerHTML += `<option value="${opt.value}">${opt.label}</option>`;
            });
            
            // Agregar unidades personalizadas
            const personalizadas = unidadesDisponibles.filter(u => 
                !opcionesBase.some(opt => opt.value === u)
            );
            
            if (personalizadas.length > 0) {
                selectUnidad.innerHTML += '<option disabled>──────────</option>';
                personalizadas.forEach(u => {
                    selectUnidad.innerHTML += `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`;
                });
            }
            
            selectUnidad.value = unidadFinal;
        }
        
        // Cerrar modal
        bootstrap.Modal.getInstance(document.getElementById('modalNuevaUnidad')).hide();
        
        // Limpiar campos
        document.getElementById('nueva-unidad-nombre').value = '';
        document.getElementById('nueva-unidad-abrev').value = '';
        
        window.mostrarNotificacion(`Unidad "${nombreUnidad}" creada`, 'success');
    }

    /**
     * Mostrar modal para nueva categoría
     */
    function mostrarModalNuevaCategoria() {
        document.getElementById('nueva-categoria-nombre').value = '';
        const modal = new bootstrap.Modal(document.getElementById('modalNuevaCategoria'));
        modal.show();
    }

    /**
     * Mostrar modal para nueva unidad
     */
    function mostrarModalNuevaUnidad() {
        document.getElementById('nueva-unidad-nombre').value = '';
        document.getElementById('nueva-unidad-abrev').value = '';
        const modal = new bootstrap.Modal(document.getElementById('modalNuevaUnidad'));
        modal.show();
    }

    /**
     * Manejar cambio en select de categoría
     */
    function manejarCambioCategoria() {
        const selectCategoria = document.getElementById('prod-categoria');
        if (!selectCategoria) return;
        
        if (selectCategoria.value === '__NUEVA__') {
            mostrarModalNuevaCategoria();
            // Resetear el select al valor anterior
            setTimeout(() => {
                if (idEditando) {
                    const producto = productos.find(p => p.id === idEditando);
                    if (producto && producto.categoria) {
                        selectCategoria.value = producto.categoria;
                    } else {
                        selectCategoria.value = '';
                    }
                } else {
                    selectCategoria.value = '';
                }
            }, 100);
        }
    }

    /**
     * Mostrar skeleton loading
     */
    function mostrarSkeleton() {
        const container = document.getElementById('vista-tarjetas');
        if (container) {
            container.innerHTML = '';
            for (let i = 0; i < 12; i++) {
                container.innerHTML += `<div class="col-md-3 col-sm-6"><div class="skeleton-card"></div></div>`;
            }
        }
    }

    /**
     * Convertir precio a número de forma segura
     */
    function toNumber(value, defaultValue = 0) {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
    }

    /**
     * Formatear precio para mostrar
     */
    function formatPrice(price) {
        const num = toNumber(price);
        return num.toFixed(2);
    }

    /**
     * Cargar productos desde API
     */
    async function cargarProductos() {
        try {
            const data = await window.apiWithRetry('/products', {}, 2);
            
            if (data && Array.isArray(data)) {
                productos = data.map(p => ({
                    ...p,
                    precio_base: toNumber(p.precio_base),
                    stock: toNumber(p.stock)
                }));
                
                extraerCategoriasUnicas();
                actualizarFiltrosCategorias();
                renderizarVista();
                cargarEstadisticas();
            } else {
                // Si data es undefined o no es array, usar array vacío
                productos = [];
                console.warn('No se recibieron productos válidos, usando array vacío');
                renderizarVista();
                cargarEstadisticas();
            }
        } catch (error) {
            console.error('Error cargando productos:', error);
            window.mostrarNotificacion('Error cargando productos: ' + error.message, 'error');
            
            // Asegurar que productos sea un array vacío para evitar errores
            productos = [];
            
            const container = document.getElementById('vista-tarjetas');
            if (container) {
                container.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <i class="bi bi-exclamation-triangle-fill" style="font-size: 4rem; color: #dc3545;"></i>
                        <p class="mt-3">Error al cargar los productos</p>
                        <p class="text-muted">${error.message}</p>
                        <button class="btn btn-primary mt-2" onclick="window.initCatalog()">
                            <i class="bi bi-arrow-repeat"></i> Reintentar
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * Actualizar opciones de filtro de categorías
     */
    function actualizarFiltrosCategorias() {
        const selectCategoria = document.getElementById('filtro-categoria');
        if (!selectCategoria) return;
        
        selectCategoria.innerHTML = '<option value="todas">📊 Todas las categorías</option>';
        
        categoriasDisponibles.forEach(cat => {
            const icono = getIconoCategoria(cat);
            selectCategoria.innerHTML += `<option value="${escapeHtml(cat)}">${icono} ${escapeHtml(cat)}</option>`;
        });
    }

    /**
     * Renderizar vista actual
     */
    function renderizarVista() {
        // 🔥 Validación más segura
        if (!productos) {
            console.warn('productos no está definido, inicializando como array vacío');
            productos = [];
        }
        
        if (!Array.isArray(productos)) {
            console.error('productos no es un array:', productos);
            productos = [];
        }
        
        const productosFiltrados = aplicarFiltros();
        const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage);
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const productosPagina = productosFiltrados.slice(start, end);
        
        if (currentView === 'tarjetas') {
            renderizarTarjetas(productosPagina);
        } else {
            renderizarTabla(productosPagina);
        }
        
        renderizarPaginacion(totalPages);
    }

    /**
     * Aplicar filtros
     */
    function aplicarFiltros() {
        // 🔥 Validación: si productos no existe o no es array, retornar array vacío
        if (!productos || !Array.isArray(productos)) {
            console.warn('⚠️ productos no está disponible, retornando array vacío');
            return [];
        }
        
        let resultado = [...productos];
        
        if (currentFilters.search) {
            const term = currentFilters.search.toLowerCase();
            resultado = resultado.filter(p => 
                (p.nombre && p.nombre.toLowerCase().includes(term)) || 
                (p.codigo && p.codigo.toLowerCase().includes(term))
            );
        }
        
        if (currentFilters.categoria !== 'todas') {
            resultado = resultado.filter(p => p.categoria === currentFilters.categoria);
        }
        
        if (currentFilters.precio !== 'todos') {
            resultado = resultado.filter(p => {
                const precio = toNumber(p.precio_base);
                switch (currentFilters.precio) {
                    case '0-50': return precio <= 50;
                    case '50-100': return precio > 50 && precio <= 100;
                    case '100-200': return precio > 100 && precio <= 200;
                    case '200+': return precio > 200;
                    default: return true;
                }
            });
        }
        
        return resultado;
    }

    /**
     * Renderizar tarjetas de productos
     */
    function renderizarTarjetas(productosLista) {
        const container = document.getElementById('vista-tarjetas');
        const tablaContainer = document.getElementById('vista-tabla');
        
        if (container) container.classList.remove('d-none');
        if (tablaContainer) tablaContainer.classList.add('d-none');
        
        if (!container) return;
        
        if (productosLista.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="bi bi-inbox" style="font-size: 4rem; color: rgba(255,255,255,0.25);"></i>
                    <p class="mt-3" style="color:rgba(255,255,255,0.5);font-size:0.9rem;">No hay productos que coincidan con los filtros</p>
                    <button class="btn btn-outline-primary" id="limpiar-filtros-btn">
                        <i class="bi bi-eraser"></i> Limpiar filtros
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = productosLista.map(producto => {
            const precio = toNumber(producto.precio_base);
            return `
                <div class="col-md-3 col-sm-6" data-producto-id="${producto.id}">
                    <div class="product-card" data-id="${producto.id}">
                        <div class="product-card-header ${getColorClaseCategoria(producto.categoria)}">
                            <div class="product-icon">
                                ${getIconoCategoria(producto.categoria)}
                            </div>
                            <div class="product-card-badge">
                                ${escapeHtml(producto.categoria || 'General')}
                            </div>
                        </div>
                        <div class="product-card-body">
                            <h6 class="product-card-title">${escapeHtml(producto.nombre)}</h6>
                            <div class="product-card-category">
                                <i class="bi bi-upc-scan"></i> ${escapeHtml(producto.codigo || 'Sin código')}
                            </div>
                            <div class="product-card-price">
                                Bs. ${formatPrice(precio)}
                            </div>
                            <div class="product-card-footer">
                                <span class="product-card-code">
                                    <i class="bi bi-box"></i> ${escapeHtml(producto.unidad_medida || 'unidad')}
                                </span>
                                <div class="btn-action-group">
                                    <button class="btn btn-sm btn-outline-primary btn-icon btn-editar" data-id="${producto.id}" data-action="editar">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger btn-icon btn-eliminar" data-id="${producto.id}" data-action="eliminar">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Renderizar tabla de productos
     */
    function renderizarTabla(productosLista) {
        const container = document.getElementById('vista-tarjetas');
        const tablaContainer = document.getElementById('vista-tabla');
        const tbody = document.getElementById('tabla-productos');
        
        if (container) container.classList.add('d-none');
        if (tablaContainer) tablaContainer.classList.remove('d-none');
        
        if (!tbody) return;
        
        if (productosLista.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        No hay productos que coincidan con los filtros
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = productosLista.map(producto => {
            const precio = toNumber(producto.precio_base);
            return `
                <tr data-producto-id="${producto.id}">
                    <td><code>${escapeHtml(producto.codigo || '-')}</code></td>
                    <td class="fw-bold">${escapeHtml(producto.nombre)}</td>
                    <td><span class="badge bg-secondary">${getIconoCategoria(producto.categoria)} ${escapeHtml(producto.categoria || 'General')}</span></td>
                    <td>${escapeHtml(producto.unidad_medida || '-')}</td>
                    <td class="text-primary fw-bold">Bs. ${formatPrice(precio)}</td>
                    <td class="text-center">
                        <div class="btn-action-group">
                            <button class="btn btn-sm btn-outline-primary btn-icon btn-editar" data-id="${producto.id}" data-action="editar">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-icon btn-eliminar" data-id="${producto.id}" data-action="eliminar">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Obtener ícono según categoría
     */
    function getIconoCategoria(categoria) {
        const iconos = {
            'Alimentos': '🍔',
            'Bebidas': '🥤',
            'Limpieza': '🧹',
            'Higiene': '🧴',
            'Electrodomésticos': '🔌',
            'Lácteos': '🥛',
            'Verduras': '🥬',
            'Frutas': '🍎',
            'Carnes': '🍖',
            'Panadería': '🍞'
        };
        return iconos[categoria] || '📦';
    }

    function getColorClaseCategoria(categoria) {
        const c = (categoria || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (c.includes('lact'))                            return 'cat-lacteos';
        if (c.includes('beb'))                             return 'cat-bebidas';
        if (c.includes('carne') || c.includes('embutid')) return 'cat-carnes';
        if (c.includes('limp')  || c.includes('hogar'))   return 'cat-limpieza';
        if (c.includes('pan'))                             return 'cat-panaderia';
        return 'cat-abarrotes';
    }

    /**
     * Renderizar paginación
     */
    function renderizarPaginacion(totalPages) {
        const container = document.getElementById('pagination-container');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        
        let html = `
            <nav>
                <ul class="pagination">
                    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaProductos(${currentPage - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                    </li>
        `;
        
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${currentPage === i ? 'active' : ''}">
                    <button class="page-link" onclick="cambiarPaginaProductos(${i})">${i}</button>
                </li>
            `;
        }
        
        html += `
                    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaProductos(${currentPage + 1})">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                    </li>
                </ul>
            </nav>
        `;
        
        container.innerHTML = html;
    }

    /**
     * Cambiar página
     */
    window.cambiarPaginaProductos = function(page) {
        currentPage = page;
        renderizarVista();
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    /**
     * Cargar estadísticas
     */
    function cargarEstadisticas() {
        const total = productos.length;
        const valorTotal = productos.reduce((sum, p) => sum + toNumber(p.precio_base), 0);
        const precioPromedio = total > 0 ? valorTotal / total : 0;
        
        const totalProductosEl = document.getElementById('total-productos');
        const totalCategoriasEl = document.getElementById('total-categorias');
        const valorInventarioEl = document.getElementById('valor-inventario');
        const precioPromedioEl = document.getElementById('precio-promedio');
        
        if (totalProductosEl) totalProductosEl.textContent = total;
        if (totalCategoriasEl) totalCategoriasEl.textContent = categoriasDisponibles.length;
        if (valorInventarioEl) valorInventarioEl.textContent = `Bs. ${formatPrice(valorTotal)}`;
        if (precioPromedioEl) precioPromedioEl.textContent = `Bs. ${formatPrice(precioPromedio)}`;
    }

    /**
     * Ver detalle de producto
     */
    function verDetalleProductoPorId(id) {
        const producto = productos.find(p => p.id === id);
        if (!producto) return;
        
        const precio = toNumber(producto.precio_base);
        
        Swal.fire({
            title: producto.nombre,
            html: `
                <div class="text-start">
                    <p><strong>Código:</strong> ${escapeHtml(producto.codigo || '-')}</p>
                    <p><strong>Categoría:</strong> ${getIconoCategoria(producto.categoria)} ${escapeHtml(producto.categoria || '-')}</p>
                    <p><strong>Unidad:</strong> ${escapeHtml(producto.unidad_medida || '-')}</p>
                    <p><strong>Precio:</strong> <span class="text-primary fw-bold">Bs. ${formatPrice(precio)}</span></p>
                    <p><strong>Descripción:</strong> ${escapeHtml(producto.descripcion || 'Sin descripción')}</p>
                </div>
            `,
            icon: 'info',
            confirmButtonText: 'Cerrar',
            showCancelButton: true,
            cancelButtonText: 'Editar',
            cancelButtonColor: '#667eea'
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel) {
                abrirModalEditar(producto.id);
            }
        });
    }

    /**
     * Abrir modal para nuevo producto
     */
    function abrirModalNuevo() {
        idEditando = null;
        document.getElementById('modal-titulo').textContent = 'Nuevo Producto';
        document.getElementById('form-producto').reset();
        document.getElementById('producto-id').value = '';
        document.getElementById('prod-codigo').disabled = false;
        document.getElementById('prod-codigo').value = '';
        document.getElementById('prod-nombre').value = '';
        document.getElementById('prod-categoria').value = '';
        document.getElementById('prod-unidad').value = '';
        document.getElementById('prod-precio').value = '';
        document.getElementById('prod-desc').value = '';
        
        const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
        modal.show();
    }

    /**
     * Abrir modal para editar producto
     */
    function abrirModalEditar(id) {
        const producto = productos.find(p => p.id === id);
        if (!producto) return;
        
        idEditando = id;
        document.getElementById('modal-titulo').textContent = 'Editar Producto';
        document.getElementById('producto-id').value = producto.id;
        document.getElementById('prod-codigo').value = producto.codigo || '';
        document.getElementById('prod-codigo').disabled = true;
        document.getElementById('prod-nombre').value = producto.nombre || '';
        document.getElementById('prod-categoria').value = producto.categoria || '';
        document.getElementById('prod-unidad').value = producto.unidad_medida || '';
        document.getElementById('prod-precio').value = toNumber(producto.precio_base);
        document.getElementById('prod-desc').value = producto.descripcion || '';
        
        const modal = new bootstrap.Modal(document.getElementById('modalProducto'));
        modal.show();
    }

    /**
     * Guardar producto
     */
    async function guardarProducto() {
        const codigo = document.getElementById('prod-codigo').value.trim();
        const nombre = document.getElementById('prod-nombre').value.trim();
        let categoria = document.getElementById('prod-categoria').value;
        const unidad = document.getElementById('prod-unidad').value;
        const precio = parseFloat(document.getElementById('prod-precio').value);
        const descripcion = document.getElementById('prod-desc').value;
        
        // Si la categoría es la opción especial, ignorar
        if (categoria === '__NUEVA__') {
            categoria = '';
        }
        
        if (!nombre || !precio || !categoria || !unidad) {
            window.mostrarNotificacion('Por favor complete todos los campos obligatorios', 'warning');
            return;
        }
        
        if (isNaN(precio) || precio <= 0) {
            window.mostrarNotificacion('Ingrese un precio válido', 'warning');
            return;
        }
        
        const payload = {
            codigo: codigo,
            nombre: nombre,
            categoria: categoria,
            unidad_medida: unidad,
            descripcion: descripcion,
            precio_base: precio
        };
        
        try {
            if (idEditando) {
                await api(`/products/${idEditando}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.mostrarNotificacion('Producto actualizado correctamente', 'success');
            } else {
                await api('/products', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.mostrarNotificacion('Producto creado correctamente', 'success');
            }
            
            bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide();
            await cargarProductos();
            
        } catch (error) {
            console.error('Error guardando producto:', error);
            window.mostrarNotificacion('Error al guardar: ' + error.message, 'error');
        }
    }

    /**
     * Eliminar producto
     */
    async function eliminarProducto(id) {
        const producto = productos.find(p => p.id === id);
        
        const result = await Swal.fire({
            title: '¿Eliminar producto?',
            text: `¿Estás seguro de eliminar "${producto?.nombre}"?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
        });
        
        if (result.isConfirmed) {
            try {
                await api(`/products/${id}`, { method: 'DELETE' });
                window.mostrarNotificacion('Producto eliminado correctamente', 'success');
                await cargarProductos();
            } catch (error) {
                console.error('Error eliminando producto:', error);
                window.mostrarNotificacion('Error al eliminar: ' + error.message, 'error');
            }
        }
    }

    /**
     * Configurar eventos
     */
    function configurarEventos() {
        // Botón nuevo producto
        const btnNuevo = document.getElementById('btn-nuevo-producto');
        if (btnNuevo) btnNuevo.addEventListener('click', abrirModalNuevo);
        
        // Botón actualizar
        const btnActualizar = document.getElementById('btn-actualizar');
        if (btnActualizar) btnActualizar.addEventListener('click', () => cargarProductos());
        
        // Botón guardar
        const btnGuardar = document.getElementById('btn-guardar-producto');
        if (btnGuardar) btnGuardar.addEventListener('click', guardarProducto);
        
        // Botón nueva categoría
        const btnNuevaCategoria = document.getElementById('btn-nueva-categoria');
        if (btnNuevaCategoria) btnNuevaCategoria.addEventListener('click', mostrarModalNuevaCategoria);
        
        // Botón nueva unidad
        const btnNuevaUnidad = document.getElementById('btn-nueva-unidad');
        if (btnNuevaUnidad) btnNuevaUnidad.addEventListener('click', mostrarModalNuevaUnidad);
        
        // Guardar categoría
        const btnGuardarCategoria = document.getElementById('btn-guardar-categoria');
        if (btnGuardarCategoria) btnGuardarCategoria.addEventListener('click', agregarNuevaCategoria);
        
        // Guardar unidad
        const btnGuardarUnidad = document.getElementById('btn-guardar-unidad');
        if (btnGuardarUnidad) btnGuardarUnidad.addEventListener('click', agregarNuevaUnidad);
        
        // Cambio en select de categoría
        const selectCategoria = document.getElementById('prod-categoria');
        if (selectCategoria) selectCategoria.addEventListener('change', manejarCambioCategoria);
        
        // Toggle vista
        const btnToggle = document.getElementById('btn-toggle-view');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                currentView = currentView === 'tarjetas' ? 'tabla' : 'tarjetas';
                const viewText = document.getElementById('view-text');
                if (viewText) viewText.textContent = currentView === 'tarjetas' ? 'Tarjetas' : 'Tabla';
                currentPage = 1;
                renderizarVista();
            });
        }
        
        // Búsqueda
        const buscador = document.getElementById('buscador');
        if (buscador) {
            buscador.addEventListener('input', (e) => {
                currentFilters.search = e.target.value;
                currentPage = 1;
                renderizarVista();
            });
        }
        
        // Filtro categoría
        const filtroCategoria = document.getElementById('filtro-categoria');
        if (filtroCategoria) {
            filtroCategoria.addEventListener('change', (e) => {
                currentFilters.categoria = e.target.value;
                currentPage = 1;
                renderizarVista();
            });
        }
        
        // Filtro precio
        const filtroPrecio = document.getElementById('filtro-precio');
        if (filtroPrecio) {
            filtroPrecio.addEventListener('change', (e) => {
                currentFilters.precio = e.target.value;
                currentPage = 1;
                renderizarVista();
            });
        }
        
        // Limpiar filtros
        const limpiarFiltros = document.getElementById('limpiar-filtros');
        if (limpiarFiltros) {
            limpiarFiltros.addEventListener('click', () => {
                currentFilters = { search: '', categoria: 'todas', precio: 'todos' };
                currentPage = 1;
                const buscadorEl = document.getElementById('buscador');
                const filtroCategoriaEl = document.getElementById('filtro-categoria');
                const filtroPrecioEl = document.getElementById('filtro-precio');
                if (buscadorEl) buscadorEl.value = '';
                if (filtroCategoriaEl) filtroCategoriaEl.value = 'todas';
                if (filtroPrecioEl) filtroPrecioEl.value = 'todos';
                renderizarVista();
                window.mostrarNotificacion('Filtros limpiados', 'info');
            });
        }
        
        // Evento principal: Delegación de eventos
        document.body.addEventListener('click', (e) => {
            const btnEditar = e.target.closest('.btn-editar');
            if (btnEditar) {
                e.preventDefault();
                e.stopPropagation();
                const id = btnEditar.getAttribute('data-id');
                if (id) abrirModalEditar(id);
                return;
            }
            
            const btnEliminar = e.target.closest('.btn-eliminar');
            if (btnEliminar) {
                e.preventDefault();
                e.stopPropagation();
                const id = btnEliminar.getAttribute('data-id');
                if (id) eliminarProducto(id);
                return;
            }
            
            const tarjeta = e.target.closest('.product-card');
            if (tarjeta && !e.target.closest('.btn-editar') && !e.target.closest('.btn-eliminar')) {
                e.preventDefault();
                const id = tarjeta.getAttribute('data-id');
                if (id) verDetalleProductoPorId(id);
                return;
            }
            
            const filaTabla = e.target.closest('tr[data-producto-id]');
            if (filaTabla && !e.target.closest('.btn-editar') && !e.target.closest('.btn-eliminar')) {
                const id = filaTabla.getAttribute('data-producto-id');
                if (id) verDetalleProductoPorId(id);
            }
        });
    }

    /**
     * Escapar HTML
     */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Exportar funciones
    window.verDetalleProducto = verDetalleProductoPorId;

} 