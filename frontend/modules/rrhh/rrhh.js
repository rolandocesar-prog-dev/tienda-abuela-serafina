// RRHH Module - Encapsulado para evitar conflictos globales
(function() {
    "use strict";
    
    // Variables privadas del módulo
    let empleadosDataRrhh = [];
    let agenciasMapRrhh = new Map();
    let currentPageRrhh = 1;
    let itemsPerPageRrhh = 10;
    let currentFiltersRrhh = {
        search: '',
        agencia: 'todas',
        cargo: 'todos'
    };
    let idEditandoRrhh = null;
    let empleadoAEliminarRrhh = null;

    /**
     * Inicializar módulo de RRHH
     */
    window.initRrhh = async () => {
        console.log("👥 Iniciando módulo de RRHH...");
        
        mostrarLoadingRrhh();
        
        await Promise.all([
            cargarAgenciasRrhh(),
            cargarEmpleadosRrhh()
        ]);
        
        configurarEventosRrhh();
        actualizarEstadisticasRrhh();
    };

    /**
     * Mostrar loading
     */
    function mostrarLoadingRrhh() {
        const tbody = document.getElementById('rrhh-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Cargando empleados...</p></td></table>';
        }
    }

    /**
     * Cargar agencias
     */
    async function cargarAgenciasRrhh() {
        try {
            const agencias = await window.api('/rrhh/agencias');
            
            if (agencias && Array.isArray(agencias)) {
                agenciasMapRrhh.clear();
                agencias.forEach(a => {
                    agenciasMapRrhh.set(a.id, {
                        nombre: a.nombre,
                        ubicacion: a.ubicacion
                    });
                });
                
                const selectAgencia = document.getElementById('agencia_id');
                const filterAgencia = document.getElementById('filtro-agencia');
                
                const opciones = '<option value="">Seleccionar agencia...</option>' + 
                    agencias.map(a => `<option value="${a.id}">${escapeHtmlRrhh(a.nombre)} - ${a.ubicacion || 'Sin ubicación'}</option>`).join('');
                
                if (selectAgencia) selectAgencia.innerHTML = opciones;
                if (filterAgencia) {
                    filterAgencia.innerHTML = '<option value="todas">📊 Todas las agencias</option>' +
                        agencias.map(a => `<option value="${a.id}">🏢 ${escapeHtmlRrhh(a.nombre)}</option>`).join('');
                }
                
                const totalAgenciasEl = document.getElementById('total-agencias');
                if (totalAgenciasEl) totalAgenciasEl.textContent = agencias.length;
            }
        } catch (error) {
            console.error("Error cargando agencias:", error);
            window.mostrarNotificacion('Error cargando agencias: ' + error.message, 'error');
        }
    }

    /**
     * Cargar empleados desde API
     */
    async function cargarEmpleadosRrhh() {
        try {
            const data = await window.apiWithRetry('/rrhh/empleados', {}, 2);
            
            if (data && Array.isArray(data)) {
                empleadosDataRrhh = data.map(e => ({
                    ...e,
                    salario: parseFloat(e.salario) || 0
                }));
                renderizarEmpleadosRrhh();
                actualizarEstadisticasRrhh();
            } else {
                empleadosDataRrhh = [];
                renderizarEmpleadosRrhh();
            }
        } catch (error) {
            console.error("Error cargando empleados:", error);
            window.mostrarNotificacion('Error cargando empleados: ' + error.message, 'error');
            
            const tbody = document.getElementById('rrhh-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-5 text-danger">
                            <i class="bi bi-exclamation-triangle-fill" style="font-size: 3rem;"></i>
                            <p class="mt-2">Error al cargar los empleados</p>
                            <button class="btn btn-primary mt-2" onclick="window.initRrhh()">
                                <i class="bi bi-arrow-repeat"></i> Reintentar
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * Renderizar tabla de empleados
     */
    function renderizarEmpleadosRrhh() {
        const tbody = document.getElementById('rrhh-body');
        if (!tbody) return;
        
        let datosFiltrados = [...empleadosDataRrhh];
        
        if (currentFiltersRrhh.search) {
            const term = currentFiltersRrhh.search.toLowerCase();
            datosFiltrados = datosFiltrados.filter(e => 
                (e.nombre && e.nombre.toLowerCase().includes(term)) ||
                (e.apellido && e.apellido.toLowerCase().includes(term)) ||
                (e.ci && e.ci.toLowerCase().includes(term))
            );
        }
        
        if (currentFiltersRrhh.agencia !== 'todas') {
            datosFiltrados = datosFiltrados.filter(e => e.agencia_id === currentFiltersRrhh.agencia);
        }
        
        if (currentFiltersRrhh.cargo !== 'todos') {
            datosFiltrados = datosFiltrados.filter(e => e.cargo === currentFiltersRrhh.cargo);
        }
        
        const totalItems = datosFiltrados.length;
        const totalPages = Math.ceil(totalItems / itemsPerPageRrhh);
        const start = (currentPageRrhh - 1) * itemsPerPageRrhh;
        const end = start + itemsPerPageRrhh;
        const datosPagina = datosFiltrados.slice(start, end);
        
        if (datosPagina.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-inbox" style="font-size: 3rem;"></i><p class="mt-2">No hay empleados que coincidan con los filtros</p></td></tr>';
            renderizarPaginacionRrhh(totalPages);
            return;
        }
        
        tbody.innerHTML = datosPagina.map(e => {
            const nombreCompleto = `${e.nombre || ''} ${e.apellido || ''}`;
            const agencia = agenciasMapRrhh.get(e.agencia_id);
            const nombreAgencia = agencia?.nombre || e.agencia_id?.substring(0, 8) || '-';
            const fechaIngreso = e.fecha_ingreso ? new Date(e.fecha_ingreso).toLocaleDateString() : '-';
            const estadoBadge = e.activo !== false 
                ? '<span class="badge-activo"><i class="bi bi-check-circle"></i> Activo</span>'
                : '<span class="badge-inactivo"><i class="bi bi-x-circle"></i> Inactivo</span>';
            
            return `
                <tr>
                    <td class="fw-bold">${escapeHtmlRrhh(nombreCompleto)}</td>
                    <td>${escapeHtmlRrhh(e.ci || '-')}</td>
                    <td><span class="badge bg-secondary">${escapeHtmlRrhh(e.cargo || '-')}</span></td>
                    <td>${escapeHtmlRrhh(nombreAgencia)}</td>
                    <td>${fechaIngreso}</td>
                    <td class="text-primary fw-bold">Bs ${(e.salario || 0).toFixed(2)}</td>
                    <td>${estadoBadge}</td>
                    <td>
                        <div class="btn-action-group">
                            <button class="btn btn-sm btn-outline-primary btn-icon btn-editar-rrhh" data-id="${e.id}" title="Editar">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-icon btn-eliminar-rrhh" data-id="${e.id}" data-nombre="${escapeHtmlRrhh(nombreCompleto)}" title="Eliminar">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        renderizarPaginacionRrhh(totalPages);
    }

    /**
     * Renderizar paginación
     */
    function renderizarPaginacionRrhh(totalPages) {
        const container = document.getElementById('pagination-container');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }
        
        let html = `
            <nav>
                <ul class="pagination">
                    <li class="page-item ${currentPageRrhh === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaRrhh(${currentPageRrhh - 1})">
                            <i class="bi bi-chevron-left"></i>
                        </button>
                    </li>
        `;
        
        let startPage = Math.max(1, currentPageRrhh - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${currentPageRrhh === i ? 'active' : ''}">
                    <button class="page-link" onclick="cambiarPaginaRrhh(${i})">${i}</button>
                </li>
            `;
        }
        
        html += `
                    <li class="page-item ${currentPageRrhh === totalPages ? 'disabled' : ''}">
                        <button class="page-link" onclick="cambiarPaginaRrhh(${currentPageRrhh + 1})">
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
    window.cambiarPaginaRrhh = function(page) {
        currentPageRrhh = page;
        renderizarEmpleadosRrhh();
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    /**
     * Actualizar estadísticas
     */
    function actualizarEstadisticasRrhh() {
        const total = empleadosDataRrhh.length;
        const totalSalarios = empleadosDataRrhh.reduce((sum, e) => sum + (e.salario || 0), 0);
        const salarioPromedio = total > 0 ? totalSalarios / total : 0;
        
        const totalEmpleadosEl = document.getElementById('total-empleados');
        const totalSalariosEl = document.getElementById('total-salarios');
        const salarioPromedioEl = document.getElementById('salario-promedio');
        
        if (totalEmpleadosEl) totalEmpleadosEl.textContent = total;
        if (totalSalariosEl) totalSalariosEl.textContent = `Bs ${totalSalarios.toFixed(2)}`;
        if (salarioPromedioEl) salarioPromedioEl.textContent = `Bs ${salarioPromedio.toFixed(2)}`;
    }

    /**
     * Abrir modal para nuevo empleado
     */
    function abrirModalNuevoRrhh() {
        idEditandoRrhh = null;
        document.getElementById('modal-titulo').textContent = 'Nuevo Empleado';
        document.getElementById('form-empleado').reset();
        document.getElementById('empleado-id').value = '';
        document.getElementById('fecha_ingreso').value = new Date().toISOString().split('T')[0];
        
        const modal = new bootstrap.Modal(document.getElementById('modalEmpleado'));
        modal.show();
    }

    /**
     * Abrir modal para editar empleado
     */
    async function abrirModalEditarRrhh(id) {
        const empleado = empleadosDataRrhh.find(e => e.id === id);
        if (!empleado) return;
        
        idEditandoRrhh = id;
        document.getElementById('modal-titulo').textContent = 'Editar Empleado';
        document.getElementById('empleado-id').value = empleado.id;
        document.getElementById('nombre').value = empleado.nombre || '';
        document.getElementById('apellido').value = empleado.apellido || '';
        document.getElementById('ci').value = empleado.ci || '';
        document.getElementById('cargo').value = empleado.cargo || '';
        document.getElementById('salario').value = empleado.salario || 0;
        document.getElementById('agencia_id').value = empleado.agencia_id || '';
        document.getElementById('fecha_ingreso').value = empleado.fecha_ingreso?.split('T')[0] || '';
        
        const modal = new bootstrap.Modal(document.getElementById('modalEmpleado'));
        modal.show();
    }

    /**
     * Guardar empleado
     */
    async function guardarEmpleadoRrhh() {
        const nombre = document.getElementById('nombre').value.trim();
        const apellido = document.getElementById('apellido').value.trim();
        const ci = document.getElementById('ci').value.trim();
        const cargo = document.getElementById('cargo').value;
        const salario = parseFloat(document.getElementById('salario').value);
        const agenciaId = document.getElementById('agencia_id').value;
        const fechaIngreso = document.getElementById('fecha_ingreso').value;
        
        if (!nombre || !apellido || !ci || !cargo || !salario || !agenciaId || !fechaIngreso) {
            window.mostrarNotificacion('Por favor complete todos los campos obligatorios', 'warning');
            return;
        }
        
        if (salario <= 0) {
            window.mostrarNotificacion('Ingrese un salario válido', 'warning');
            return;
        }
        
        const payload = {
            nombre: nombre,
            apellido: apellido,
            ci: ci,
            cargo: cargo,
            salario: salario,
            agencia_id: agenciaId,
            fecha_ingreso: fechaIngreso,
            activo: true
        };
        
        const btnGuardar = document.getElementById('btn-guardar-empleado');
        const originalText = btnGuardar?.innerHTML;
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
        }
        
        try {
            if (idEditandoRrhh) {
                await window.api(`/rrhh/empleados/${idEditandoRrhh}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                window.mostrarNotificacion('Empleado actualizado correctamente', 'success');
            } else {
                await window.api('/rrhh/empleados', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                window.mostrarNotificacion('Empleado creado correctamente', 'success');
            }
            
            bootstrap.Modal.getInstance(document.getElementById('modalEmpleado')).hide();
            await cargarEmpleadosRrhh();
            
        } catch (error) {
            console.error('Error guardando empleado:', error);
            window.mostrarNotificacion('Error al guardar: ' + error.message, 'error');
            
        } finally {
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = originalText;
            }
        }
    }

    /**
     * Eliminar empleado
     */
    function mostrarConfirmarEliminarRrhh(id, nombre) {
        empleadoAEliminarRrhh = { id, nombre };
        document.getElementById('empleado-eliminar-nombre').textContent = nombre;
        const modal = new bootstrap.Modal(document.getElementById('modalEliminar'));
        modal.show();
    }

    async function confirmarEliminarRrhh() {
        if (!empleadoAEliminarRrhh) return;
        
        try {
            await window.api(`/rrhh/empleados/${empleadoAEliminarRrhh.id}`, { method: 'DELETE' });
            window.mostrarNotificacion('Empleado eliminado correctamente', 'success');
            await cargarEmpleadosRrhh();
        } catch (error) {
            console.error('Error eliminando empleado:', error);
            window.mostrarNotificacion('Error al eliminar: ' + error.message, 'error');
        } finally {
            bootstrap.Modal.getInstance(document.getElementById('modalEliminar')).hide();
            empleadoAEliminarRrhh = null;
        }
    }

    /**
     * Configurar eventos
     */
    function configurarEventosRrhh() {
        const btnNuevo = document.getElementById('btn-nuevo-empleado');
        const btnActualizar = document.getElementById('btn-actualizar');
        const btnGuardar = document.getElementById('btn-guardar-empleado');
        const btnConfirmarEliminar = document.getElementById('btn-confirmar-eliminar');
        
        if (btnNuevo) btnNuevo.addEventListener('click', abrirModalNuevoRrhh);
        if (btnActualizar) btnActualizar.addEventListener('click', () => cargarEmpleadosRrhh());
        if (btnGuardar) btnGuardar.addEventListener('click', guardarEmpleadoRrhh);
        if (btnConfirmarEliminar) btnConfirmarEliminar.addEventListener('click', confirmarEliminarRrhh);
        
        const buscarInput = document.getElementById('buscar-empleado');
        if (buscarInput) {
            buscarInput.addEventListener('input', (e) => {
                currentFiltersRrhh.search = e.target.value;
                currentPageRrhh = 1;
                renderizarEmpleadosRrhh();
            });
        }
        
        const filterAgencia = document.getElementById('filtro-agencia');
        if (filterAgencia) {
            filterAgencia.addEventListener('change', (e) => {
                currentFiltersRrhh.agencia = e.target.value;
                currentPageRrhh = 1;
                renderizarEmpleadosRrhh();
            });
        }
        
        const filterCargo = document.getElementById('filtro-cargo');
        if (filterCargo) {
            filterCargo.addEventListener('change', (e) => {
                currentFiltersRrhh.cargo = e.target.value;
                currentPageRrhh = 1;
                renderizarEmpleadosRrhh();
            });
        }
        
        const limpiarFiltros = document.getElementById('limpiar-filtros');
        if (limpiarFiltros) {
            limpiarFiltros.addEventListener('click', () => {
                currentFiltersRrhh = { search: '', agencia: 'todas', cargo: 'todos' };
                currentPageRrhh = 1;
                if (buscarInput) buscarInput.value = '';
                if (filterAgencia) filterAgencia.value = 'todas';
                if (filterCargo) filterCargo.value = 'todos';
                renderizarEmpleadosRrhh();
                window.mostrarNotificacion('Filtros limpiados', 'info');
            });
        }
        
        document.body.addEventListener('click', (e) => {
            const btnEditar = e.target.closest('.btn-editar-rrhh');
            if (btnEditar) {
                e.preventDefault();
                e.stopPropagation();
                const id = btnEditar.getAttribute('data-id');
                if (id) abrirModalEditarRrhh(id);
                return;
            }
            
            const btnEliminar = e.target.closest('.btn-eliminar-rrhh');
            if (btnEliminar) {
                e.preventDefault();
                e.stopPropagation();
                const id = btnEliminar.getAttribute('data-id');
                const nombre = btnEliminar.getAttribute('data-nombre') || 'este empleado';
                if (id) mostrarConfirmarEliminarRrhh(id, nombre);
                return;
            }
        });
    }

    /**
     * Escapar HTML
     */
    function escapeHtmlRrhh(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})(); // Fin del IIFE