/* =========================================================
   SECUREDOCS — documentos.js
   ========================================================= */

const user = requireAuth();
initLayout(user);

const ROLES_PUEDEN_CREAR = ['Administrador', 'Gerente', 'Supervisor', 'Empleado'];

const documentTable = document.getElementById('documentTable');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('documentModal');
const viewModal = document.getElementById('viewDocumentModal');

let documentos = [];

function claseNivel(nivel) {
    if (nivel >= 4) return 'badge-danger';
    if (nivel === 3) return 'badge-warn';
    return 'badge-ok';
}

function claseEstado(estado) {
    switch (String(estado).toUpperCase()) {
        case 'APROBADO': return 'badge-ok';
        case 'PUBLICADO': return 'badge-neutral';
        case 'ACTIVO': return 'badge-ok';
        default: return 'badge-warn';
    }
}

async function cargarDocumentos() {
    documentTable.innerHTML = `<tr><td colspan="6"><div class="state-message">Cargando documentos…</div></td></tr>`;

    try {
        const respuesta = await apiFetch('/documentos');
        documentos = obtenerLista(respuesta, ['documentos', 'data']);
        renderizarDocumentos(documentos);
    } catch (error) {
        console.error('Error cargando documentos:', error);
        documentTable.innerHTML = `<tr><td colspan="6"><div class="state-message error">No se pudieron cargar los documentos.</div></td></tr>`;
    }
}

function renderizarDocumentos(lista) {
    if (lista.length === 0) {
        documentTable.innerHTML = `
            <tr><td colspan="6">
                <div class="state-message">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></svg>
                    No hay documentos disponibles.
                </div>
            </td></tr>`;
        return;
    }

    documentTable.innerHTML = lista.map(doc => `
        <tr>
            <td>
                <div class="cell-doc">
                    <div class="document-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></svg>
                    </div>
                    <strong>${escaparHTML(doc.nombre)}</strong>
                </div>
            </td>
            <td>${escaparHTML(doc.departamento)}</td>
            <td><span class="badge ${claseNivel(doc.nivel_confidencialidad)}">Nivel ${doc.nivel_confidencialidad}</span></td>
            <td><span class="badge ${claseEstado(doc.estado)}">${escaparHTML(doc.estado)}</span></td>
            <td>${escaparHTML(doc.pais)}</td>
            <td>
                <button class="btn-icon" onclick="verDocumento(${doc.id})" title="Consultar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </td>
        </tr>
    `).join('');
}

searchInput.addEventListener('input', () => {
    const texto = searchInput.value.toLowerCase().trim();
    const filtrados = documentos.filter(doc =>
        doc.nombre.toLowerCase().includes(texto) ||
        doc.departamento.toLowerCase().includes(texto)
    );
    renderizarDocumentos(filtrados);
});

/* ---------- Ver documento ---------- */

async function verDocumento(id) {
    const body = document.getElementById('viewDocumentBody');

    body.innerHTML = `<div class="state-message">Cargando…</div>`;
    viewModal.classList.add('open');

    try {
        const respuesta = await apiFetch(`/documentos/${id}`);
        const doc = respuesta.documento || respuesta;

        body.innerHTML = `
            <div class="activity-item">
                <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6"/></svg></div>
                <div class="activity-info">
                    <strong>${escaparHTML(doc.nombre)}</strong>
                    <span>Nombre del documento</span>
                </div>
            </div>
            <div class="activity-item">
                <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21v-6h6v6"/></svg></div>
                <div class="activity-info">
                    <strong>${escaparHTML(doc.departamento)}</strong>
                    <span>Departamento</span>
                </div>
            </div>
            <div class="activity-item">
                <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
                <div class="activity-info">
                    <strong><span class="badge ${claseNivel(doc.nivel_confidencialidad)}">Nivel ${doc.nivel_confidencialidad}</span></strong>
                    <span>Confidencialidad</span>
                </div>
            </div>
            <div class="activity-item">
                <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
                <div class="activity-info">
                    <strong><span class="badge ${claseEstado(doc.estado)}">${escaparHTML(doc.estado)}</span></strong>
                    <span>Estado</span>
                </div>
            </div>
            <div class="activity-item">
                <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg></div>
                <div class="activity-info">
                    <strong>${escaparHTML(doc.pais)}</strong>
                    <span>País</span>
                </div>
            </div>
            <div class="activity-item">
                <div class="activity-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"/></svg></div>
                <div class="activity-info">
                    <strong class="mono">#${doc.id}</strong>
                    <span>ID · ${escaparHTML(respuesta.tipo_control || 'RBAC + ABAC')}</span>
                </div>
            </div>
        `;

    } catch (error) {
        body.innerHTML = `<div class="state-message error">${escaparHTML(error.message || 'No tienes acceso a este documento.')}</div>`;
    }
}

viewModal.querySelectorAll('[data-view-close]').forEach(el =>
    el.addEventListener('click', () => viewModal.classList.remove('open'))
);
viewModal.addEventListener('click', (event) => {
    if (event.target === viewModal) viewModal.classList.remove('open');
});

/* ---------- Modal: nuevo documento ---------- */

function abrirModal() {
    document.getElementById('documentDepartment').value = user.departamento || '';
    document.getElementById('documentCountry').value = user.pais || 'Peru';
    modal.classList.add('open');
}

function cerrarModal() {
    modal.classList.remove('open');
    document.getElementById('documentForm').reset();
}

modal.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', cerrarModal));
modal.addEventListener('click', (event) => { if (event.target === modal) cerrarModal(); });

const btnNuevo = document.getElementById('btnNuevoDocumento');
if (ROLES_PUEDEN_CREAR.includes(user.rol)) {
    btnNuevo.style.display = 'inline-flex';
    btnNuevo.addEventListener('click', abrirModal);
}

document.getElementById('documentForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const body = {
        nombre: document.getElementById('documentName').value.trim(),
        departamento: document.getElementById('documentDepartment').value.trim(),
        nivel_confidencialidad: Number(document.getElementById('documentLevel').value),
        estado: document.getElementById('documentState').value,
        pais: document.getElementById('documentCountry').value.trim()
    };

    try {
        await apiFetch('/documentos', { method: 'POST', body: JSON.stringify(body) });
        cerrarModal();
        cargarDocumentos();
    } catch (error) {
        alert(error.message || 'No se pudo crear el documento.');
    }
});

cargarDocumentos();