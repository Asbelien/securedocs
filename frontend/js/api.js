/* =========================================================
   SECUREDOCS — api.js
   Utilidades compartidas por todas las páginas: fetch
   autenticado, sesión, layout (sidebar/topbar) y logout.
   ========================================================= */

const API_URL = 'http://localhost:4000/api';

const ROLES_MENU_USUARIOS = ['Administrador'];
const ROLES_MENU_AUDITORIA = ['Administrador', 'Gerente', 'Auditor'];

function getToken() {
    return localStorage.getItem('securedocs_token');
}

function getUser() {
    try {
        const raw = localStorage.getItem('securedocs_user');
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.error('Error leyendo usuario de sesión:', error);
        return null;
    }
}

function guardarSesion(token, usuario) {
    localStorage.setItem('securedocs_token', token);
    localStorage.setItem('securedocs_user', JSON.stringify(usuario));
}

/**
 * Llama al backend con el JWT ya incluido.
 * Lanza un Error con el mensaje del backend si la respuesta no es OK.
 */
async function apiFetch(endpoint, options = {}) {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const mensaje =
            (data && (data.error || data.message || data.mensaje)) ||
            `Error HTTP ${response.status}`;
        throw new Error(mensaje);
    }

    return data;
}

/**
 * Exige sesión activa. Si no hay token/usuario, redirige al login
 * y detiene la ejecución del resto del script de la página.
 * Debe llamarse al inicio de cada página protegida.
 */
function requireAuth() {
    const token = getToken();
    const user = getUser();

    if (!token || !user) {
        window.location.href = './index.html';
        throw new Error('Sesión no encontrada — redirigiendo al login.');
    }

    return user;
}

function iniciales(nombre) {
    if (!nombre) return 'U';
    const partes = nombre.trim().split(/\s+/);
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[1][0]).toUpperCase();
}

/**
 * Rellena sidebar + topbar con los datos del usuario, aplica
 * visibilidad de menú según rol y conecta el botón de logout.
 * Debe llamarse en cada página protegida, después de requireAuth().
 */
function initLayout(user) {
    const setText = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.textContent = valor;
    };

    setText('sidebarUserName', user.nombre);
    setText('sidebarUserRole', user.rol);
    setText('sidebarAvatar', iniciales(user.nombre));

    setText('topUserName', user.nombre);
    setText('topUserDepartment', user.departamento);
    setText('topAvatar', iniciales(user.nombre));

    if (!ROLES_MENU_USUARIOS.includes(user.rol)) {
        const el = document.getElementById('menuUsuarios');
        if (el) el.style.display = 'none';
    }

    if (!ROLES_MENU_AUDITORIA.includes(user.rol)) {
        const el = document.getElementById('menuAuditoria');
        if (el) el.style.display = 'none';
    }

    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            cerrarSesion();
        });
    }
}

async function cerrarSesion() {
    try {
        if (getToken()) {
            await apiFetch('/auth/logout', { method: 'POST' });
        }
    } catch (error) {
        console.warn('No se pudo registrar el logout en el servidor:', error.message);
    } finally {
        localStorage.removeItem('securedocs_token');
        localStorage.removeItem('securedocs_user');
        window.location.href = './index.html';
    }
}

function escaparHTML(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatearFecha(fecha) {
    if (!fecha) return '—';
    const fechaObj = new Date(fecha);
    if (Number.isNaN(fechaObj.getTime())) return escaparHTML(fecha);
    return fechaObj.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

/** Normaliza distintas formas de respuesta del backend a un array. */
function obtenerLista(respuesta, propiedades = []) {
    if (Array.isArray(respuesta)) return respuesta;

    if (respuesta && typeof respuesta === 'object') {
        for (const propiedad of propiedades) {
            if (Array.isArray(respuesta[propiedad])) return respuesta[propiedad];
        }
    }

    return [];
}
