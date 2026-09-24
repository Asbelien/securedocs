/* =========================================================
   SECUREDOCS — usuarios.js
   ========================================================= */

const user = requireAuth();
initLayout(user);

// El backend no expone GET /roles; usamos el mapeo fijo según
// el orden de inserción de tu seed (Rol.id autoincremental).
const ROLES = [
    { id: 1, nombre: 'Administrador' },
    { id: 2, nombre: 'Gerente' },
    { id: 3, nombre: 'Supervisor' },
    { id: 4, nombre: 'Empleado' },
    { id: 5, nombre: 'Auditor' },
    { id: 6, nombre: 'Invitado' }
];

const PUEDE_GESTIONAR = user.rol === 'Administrador';

let usuarios = [];

function poblarSelectRoles(select) {
    select.innerHTML = ROLES.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
}

poblarSelectRoles(document.getElementById('newRol'));
poblarSelectRoles(document.getElementById('editRol'));

/* ---------- Cargar / renderizar ---------- */

async function cargarUsuarios() {
    const tbody = document.getElementById('tablaUsuariosBody');
    tbody.innerHTML = `<tr><td colspan="8"><div class="state-message">Cargando usuarios…</div></td></tr>`;

    try {
        const respuesta = await apiFetch('/usuarios');
        usuarios = obtenerLista(respuesta, ['usuarios', 'data', 'users']);
        renderizarUsuarios(usuarios);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        tbody.innerHTML = `<tr><td colspan="8"><div class="state-message error">No se pudieron cargar los usuarios.</div></td></tr>`;
    }
}

function renderizarUsuarios(lista) {
    const tbody = document.getElementById('tablaUsuariosBody');

    document.getElementById('totalUsuarios').textContent = lista.length;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="state-message">No hay usuarios registrados.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(u => {
        const estado = String(u.estado || '').toLowerCase();
        const estadoClase = estado === 'activo' ? 'badge-ok' : 'badge-danger';

        const accionesGestion = PUEDE_GESTIONAR ? `
            <button class="btn-icon" onclick="abrirEditarUsuario(${u.id})" title="Editar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="btn-icon" onclick="alternarEstado(${u.id}, '${estado}')" title="${estado === 'activo' ? 'Desactivar' : 'Activar'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>
            </button>
        ` : '';

        return `
            <tr>
                <td class="mono">#${u.id ?? '-'}</td>
                <td>
                    <div class="cell-doc">
                        <div class="avatar">${iniciales(u.nombre)}</div>
                        <div>
                            <strong>${escaparHTML(u.nombre || '-')}</strong><br>
                            <span class="mono" style="font-size: 10.5px;">${escaparHTML(u.email || '-')}</span>
                        </div>
                    </div>
                </td>
                <td>${escaparHTML(u.rol || u.rol_nombre || '-')}</td>
                <td>${escaparHTML(u.departamento || '-')}</td>
                <td>${u.nivel_seguridad ?? '-'}</td>
                <td>${escaparHTML(u.pais || '-')}</td>
                <td><span class="badge ${estadoClase}">${escaparHTML(u.estado || '-')}</span></td>
                <td style="white-space: nowrap;">
                    <button class="btn-icon" onclick="verUsuario(${u.id})" title="Ver detalle">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    ${accionesGestion}
                </td>
            </tr>
        `;
    }).join('');
}

/* ---------- Ver detalle ---------- */

function verUsuario(id) {
    const body = document.getElementById('viewUserBody');
    const u = usuarios.find(item => item.id === id);

    if (!u) {
        body.innerHTML = `<div class="state-message error">No se encontró el usuario.</div>`;
        abrirModal('viewUserModal');
        return;
    }

    const estadoClase = String(u.estado).toLowerCase() === 'activo' ? 'badge-ok' : 'badge-danger';

    body.innerHTML = `
        <div class="activity-item">
            <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></div>
            <div class="activity-info">
                <strong>${escaparHTML(u.nombre)}</strong>
                <span class="mono">${escaparHTML(u.email)}</span>
            </div>
        </div>
        <div class="activity-item">
            <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"/></svg></div>
            <div class="activity-info">
                <strong>${escaparHTML(u.rol || u.rol_nombre || '-')}</strong>
                <span>Rol asignado</span>
            </div>
        </div>
        <div class="activity-item">
            <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21v-6h6v6"/></svg></div>
            <div class="activity-info">
                <strong>${escaparHTML(u.departamento)}</strong>
                <span>Departamento</span>
            </div>
        </div>
        <div class="activity-item">
            <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
            <div class="activity-info">
                <strong>Nivel ${u.nivel_seguridad}</strong>
                <span>Nivel de seguridad</span>
            </div>
        </div>
        <div class="activity-item">
            <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg></div>
            <div class="activity-info">
                <strong>${escaparHTML(u.pais)}</strong>
                <span>País</span>
            </div>
        </div>
        <div class="activity-item">
            <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
            <div class="activity-info">
                <strong><span class="badge ${estadoClase}">${escaparHTML(u.estado)}</span></strong>
                <span>ID · <span class="mono">#${u.id}</span></span>
            </div>
        </div>
    `;

    abrirModal('viewUserModal');
}

/* ---------- Crear usuario ---------- */

const btnNuevoUsuario = document.getElementById('btnNuevoUsuario');
if (PUEDE_GESTIONAR) {
    btnNuevoUsuario.style.display = 'inline-flex';
    btnNuevoUsuario.addEventListener('click', () => {
        document.getElementById('newUserForm').reset();
        abrirModal('newUserModal');
    });
}

document.getElementById('newUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const body = {
        nombre: document.getElementById('newNombre').value.trim(),
        email: document.getElementById('newEmail').value.trim(),
        password: document.getElementById('newPassword').value,
        rol_id: Number(document.getElementById('newRol').value),
        departamento: document.getElementById('newDepartamento').value.trim(),
        nivel_seguridad: Number(document.getElementById('newNivel').value),
        pais: document.getElementById('newPais').value.trim(),
        tipo_contrato: document.getElementById('newTipoContrato').value
    };

    try {
        await apiFetch('/usuarios', { method: 'POST', body: JSON.stringify(body) });
        cerrarModal('newUserModal');
        cargarUsuarios();
    } catch (error) {
        alert(error.message || 'No se pudo crear el usuario.');
    }
});

/* ---------- Editar usuario (datos + rol) ---------- */

function abrirEditarUsuario(id) {
    const u = usuarios.find(item => item.id === id);
    if (!u) return;

    document.getElementById('editUserId').value = u.id;
    document.getElementById('editNombre').value = u.nombre || '';
    document.getElementById('editEmail').value = u.email || '';
    document.getElementById('editDepartamento').value = u.departamento || '';
    document.getElementById('editNivel').value = u.nivel_seguridad || 1;
    document.getElementById('editPais').value = u.pais || '';
    document.getElementById('editTipoContrato').value = u.tipo_contrato || 'INTERNO';

    const rolActual = ROLES.find(r => r.nombre === (u.rol || u.rol_nombre));
    document.getElementById('editRol').value = rolActual ? rolActual.id : ROLES[0].id;

    // Guardamos el rol original para saber si hay que llamar a /rol
    document.getElementById('editUserForm').dataset.rolOriginal = rolActual ? rolActual.id : '';

    abrirModal('editUserModal');
}

document.getElementById('editUserForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('editUserId').value;
    const rolSeleccionado = Number(document.getElementById('editRol').value);
    const rolOriginal = Number(event.target.dataset.rolOriginal);

    const body = {
        nombre: document.getElementById('editNombre').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        departamento: document.getElementById('editDepartamento').value.trim(),
        nivel_seguridad: Number(document.getElementById('editNivel').value),
        pais: document.getElementById('editPais').value.trim(),
        tipo_contrato: document.getElementById('editTipoContrato').value
    };

    try {
        await apiFetch(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) });

        if (rolSeleccionado !== rolOriginal) {
            await apiFetch(`/usuarios/${id}/rol`, {
                method: 'PUT',
                body: JSON.stringify({ rol_id: rolSeleccionado })
            });
        }

        cerrarModal('editUserModal');
        cargarUsuarios();
    } catch (error) {
        alert(error.message || 'No se pudo actualizar el usuario.');
    }
});

/* ---------- Activar / desactivar ---------- */

async function alternarEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo';

    if (!confirm(`¿${nuevoEstado === 'activo' ? 'Activar' : 'Desactivar'} este usuario?`)) return;

    try {
        await apiFetch(`/usuarios/${id}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ estado: nuevoEstado })
        });
        cargarUsuarios();
    } catch (error) {
        alert(error.message || 'No se pudo cambiar el estado del usuario.');
    }
}

/* ---------- Modales (genérico) ---------- */

function abrirModal(id) {
    document.getElementById(id).classList.add('open');
}

function cerrarModal(id) {
    document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => cerrarModal(el.dataset.close));
});

document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) backdrop.classList.remove('open');
    });
});

cargarUsuarios();