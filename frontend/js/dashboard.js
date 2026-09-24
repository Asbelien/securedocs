/* =========================================================
   SECUREDOCS — dashboard.js
   ========================================================= */

const user = requireAuth();
initLayout(user);

document.getElementById('sessionName').textContent = user.nombre;
document.getElementById('sessionDepartment').textContent = user.departamento;
document.getElementById('sessionRole').textContent = user.rol;
document.getElementById('rolUsuario').textContent = user.rol;
document.getElementById('nivelSeguridad').textContent = user.nivel_seguridad ?? '—';
document.getElementById('estadoUsuario').textContent =
    user.estado === 'inactivo' ? 'Inactivo' : 'Activo';

function claseEstadoDocumento(estado) {
    switch (String(estado).toUpperCase()) {
        case 'APROBADO': return 'badge-ok';
        case 'PUBLICADO': return 'badge-neutral';
        case 'ACTIVO': return 'badge-ok';
        default: return 'badge-warn';
    }
}

async function cargarDocumentosRecientes() {
    const contenedor = document.getElementById('recentDocuments');

    try {
        // Se asume GET /documentos: lista ya filtrada por RBAC/ABAC del backend.
        const respuesta = await apiFetch('/documentos');
        const lista = obtenerLista(respuesta, ['documentos', 'data']);

        document.getElementById('totalDocumentos').textContent = lista.length;

        if (lista.length === 0) {
            contenedor.innerHTML = `
                <div class="state-message">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></svg>
                    No hay documentos disponibles para tu acceso.
                </div>`;
            return;
        }

        contenedor.innerHTML = lista.slice(0, 5).map(doc => `
            <div class="document-row">
                <div class="document-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></svg>
                </div>
                <div class="document-info">
                    <strong>${escaparHTML(doc.nombre)}</strong>
                    <small>${escaparHTML(doc.departamento)} · Nivel ${doc.nivel_confidencialidad}</small>
                </div>
                <span class="badge ${claseEstadoDocumento(doc.estado)}">${escaparHTML(doc.estado)}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error cargando documentos:', error);
        contenedor.innerHTML = `<div class="state-message error">No se pudieron cargar los documentos.</div>`;
    }
}

cargarDocumentosRecientes();
