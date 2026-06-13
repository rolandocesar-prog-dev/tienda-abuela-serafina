window.initRrhh = function() {
    const form = document.getElementById('form-empleado');
    const tbody = document.getElementById('rrhh-body');

    const cargarEmpleados = async () => {
        const data = await api('/rrhh/empleados');
        tbody.innerHTML = data.map(e => `
            <tr>
                <td>${e.nombre} ${e.apellido}</td>
                <td>${e.cargo}</td>
                <td>${e.salario}</td>
                <td><button class="btn btn-sm btn-danger" onclick="eliminar('${e.id}')">Baja</button></td>
            </tr>
        `).join('');
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            nombre: document.getElementById('nombre').value,
            apellido: document.getElementById('apellido').value,
            ci: document.getElementById('ci').value,
            cargo: "Empleado", // Placeholder
            fecha_ingreso: new Date().toISOString().split('T')[0],
            salario: 2500, // Placeholder
            agencia_id: "660e8400-e29b-41d4-a716-446655440001" // Default
        };
        await api('/rrhh/empleados', { method: 'POST', body: JSON.stringify(payload) });
        form.reset();
        cargarEmpleados();
    };

    window.eliminar = async (id) => {
        await api(`/rrhh/empleados/${id}`, { method: 'DELETE' });
        cargarEmpleados();
    };

    cargarEmpleados();
};