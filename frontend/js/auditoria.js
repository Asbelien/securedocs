/* =========================================================
   SECUREDOCS — auditoria.js
   ========================================================= */

const user = requireAuth();
initLayout(user);

function esPermitido(resultado) {
    const valor = String(resultado || '').toUpperCase();
    return valor === 'PERMITIDO' || valor === 'EXITOSO' || valor === 'OK';
}

async function cargarAuditoria() {
    const tbody = document.getElementById('tablaAuditoriaBody');
    tbody.innerHTML = `<tr><td colspan="8"><div class="state-message">Cargando auditoría…</div></td></tr>`;

    try {
        const respuesta = await apiFetch('/auditoria');
        const lista = obtenerLista(respuesta, ['auditoria', 'auditorias', 'data', 'registros']);
        renderizarAuditoria(lista);
    } catch (error) {
        console.error('Error cargando auditoría:', error);
        tbody.innerHTML = `<tr><td colspan="8"><div class="state-message error">No se pudieron cargar los registros de auditoría.</div></td></tr>`;
    }
}

function renderizarAuditoria(lista) {
    const tbody = document.getElementById('tablaAuditoriaBody');

    document.getElementById('totalAuditoria').textContent = lista.length;
    document.getElementById('auditoriasPermitidas').textContent = lista.filter(r => esPermitido(r.resultado)).length;
    document.getElementById('auditoriasDenegadas').textContent = lista.filter(r => !esPermitido(r.resultado)).length;

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="state-message">No hay registros de auditoría.</div></td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(r => {
        const badgeClase = esPermitido(r.resultado) ? 'badge-ok' : 'badge-danger';

        return `
            <tr>
                <td class="mono">#${r.id ?? '-'}</td>
                <td>
                    <strong>${escaparHTML(r.usuario_nombre || r.nombre_usuario || r.usuario || '-')}</strong>
                    ${r.usuario_email ? `<br><span class="mono" style="font-size:10.5px;">${escaparHTML(r.usuario_email)}</span>` : ''}
                </td>
                <td>${escaparHTML(r.accion || '-')}</td>
                <td>${escaparHTML(r.recurso || '-')}</td>
                <td><span class="badge ${badgeClase}">${escaparHTML(r.resultado || '-')}</span></td>
                <td>${escaparHTML(r.motivo || '-')}</td>
                <td class="mono">${escaparHTML(r.ip || '-')}</td>
                <td class="mono">${formatearFecha(r.fecha)}</td>
            </tr>
        `;
    }).join('');
}

cargarAuditoria();
