/* =========================================================
   SECUREDOCS — auth.js (página de login)
   ========================================================= */

// Si ya hay sesión activa, no tiene sentido mostrar el login de nuevo.
if (getToken() && getUser()) {
    window.location.href = './dashboard.html';
}

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const loginError = document.getElementById('loginError');
const loginErrorText = document.getElementById('loginErrorText');

togglePassword.addEventListener('click', () => {
    const mostrando = passwordInput.type === 'text';
    passwordInput.type = mostrando ? 'password' : 'text';
    togglePassword.innerHTML = mostrando
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.6 10.6 0 0 1 12 19c-7 0-11-7-11-7a19.4 19.4 0 0 1 4.2-5.1M9.9 4.2A10 10 0 0 1 12 4c7 0 11 7 11 7a19.5 19.5 0 0 1-2.3 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
});

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ocultarError();

    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        mostrarError('Ingresa tu correo y contraseña.');
        return;
    }

    loginButton.disabled = true;
    loginButton.innerHTML = '<span class="spinner"></span><span>Verificando...</span>';

    try {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        guardarSesion(data.token, data.usuario);
        window.location.href = './dashboard.html';

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        mostrarError(error.message);

        loginButton.disabled = false;
        loginButton.innerHTML = '<span>Iniciar sesión</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    }
});

function mostrarError(mensaje) {
    loginErrorText.textContent = mensaje;
    loginError.classList.remove('d-none');
}

function ocultarError() {
    loginError.classList.add('d-none');
    loginErrorText.textContent = '';
}
