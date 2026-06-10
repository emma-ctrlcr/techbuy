/* ══════════════════════════════════════════════════════════════
   TECHBUY — login.js
   Lógica de la página dedicada de Login / Registro.
   Depende de: api.js (TB_api)
══════════════════════════════════════════════════════════════ */

/* ── Si ya hay sesión activa, ir directo al perfil ──────────── */
if (TB_api.isLoggedIn()) {
  window.location.href = 'perfil.html';
}

/* ── Determinar pestaña inicial por ?tab=register ───────────── */
const _params  = new URLSearchParams(window.location.search);
const _initTab = _params.get('tab') === 'register' ? 'register' : 'login';

/* ── Referencias DOM ─────────────────────────────────────────── */
const tabLogin    = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const panelLogin  = document.getElementById('panelLogin');
const panelReg    = document.getElementById('panelRegister');

/* ── Cambio de pestaña ───────────────────────────────────────── */
function showTab(tab) {
  const isLogin = tab === 'login';
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
  panelLogin.style.display  = isLogin ? 'block' : 'none';
  panelReg.style.display    = isLogin ? 'none'  : 'block';
  // Limpiar mensajes al cambiar
  setMsg('loginMsg', '', '');
  setMsg('registerMsg', '', '');
}
window.showTab = showTab;

/* ── Helper mensajes ─────────────────────────────────────────── */
function setMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className   = 'lf-msg' + (type ? ' ' + type : '');
}

/* ── Toggle ojo contraseña ───────────────────────────────────── */
function setupEye(btnId, inputId, iconId) {
  document.getElementById(btnId)?.addEventListener('click', () => {
    const inp  = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (inp.type === 'password') {
      inp.type = 'text';
      icon.className = 'fa-regular fa-eye-slash';
    } else {
      inp.type = 'password';
      icon.className = 'fa-regular fa-eye';
    }
  });
}

/* ── LOGIN ───────────────────────────────────────────────────── */
async function handleLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  setMsg('loginMsg', '', '');

  if (!email || !password) {
    setMsg('loginMsg', 'Completa todos los campos.', 'error'); return;
  }

  const btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.innerHTML = '<span class="lf-spinner"></span> Entrando…';

  try {
    const data = await TB_api.post('/auth/login', { email, password });
    TB_api.saveSession(data.token, data.user);

    // Recordar si el usuario lo indicó
    if (document.getElementById('loginRemember')?.checked) {
      localStorage.setItem('techbuy_remember', '1');
    }

    // Sincronizar carrito local al backend
    await TB_syncLocalCartToBackend();

    setMsg('loginMsg', '¡Bienvenido, ' + (data.user?.nombre || '') + '!', 'success');

    // Regresar a la página de origen si existe, si no al perfil
    const returnTo = sessionStorage.getItem('tb_login_return') || 'perfil.html';
    sessionStorage.removeItem('tb_login_return');
    setTimeout(() => { window.location.href = returnTo; }, 700);

  } catch (err) {
    setMsg('loginMsg', err.message || 'Credenciales incorrectas.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión';
  }
}
window.handleLogin = handleLogin;

/* ── REGISTRO ────────────────────────────────────────────────── */
async function handleRegister() {
  const nombre   = document.getElementById('regNombre').value.trim();
  const apellido = document.getElementById('regApellido').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const tel      = document.getElementById('regTel').value.trim();

  setMsg('registerMsg', '', '');

  if (!nombre || !apellido || !email || !password) {
    setMsg('registerMsg', 'Completa todos los campos requeridos.', 'error'); return;
  }
  if (password.length < 6) {
    setMsg('registerMsg', 'La contraseña debe tener al menos 6 caracteres.', 'error'); return;
  }
  if (tel && !/^\d{8}$/.test(tel)) {
    setMsg('registerMsg', 'Teléfono: 8 dígitos numéricos.', 'error'); return;
  }

  const btn = document.getElementById('btnRegister');
  btn.disabled = true;
  btn.innerHTML = '<span class="lf-spinner"></span> Creando cuenta…';

  try {
    const data = await TB_api.post('/auth/register', { nombre, apellido, email, password, tel });
    TB_api.saveSession(data.token, data.user);

    await TB_syncLocalCartToBackend();

    setMsg('registerMsg', '¡Cuenta creada! Redirigiendo…', 'success');
    setTimeout(() => { window.location.href = 'perfil.html'; }, 900);

  } catch (err) {
    setMsg('registerMsg', err.message || 'Error al registrar.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Crear cuenta';
  }
}
window.handleRegister = handleRegister;

/* ── Enter en inputs ─────────────────────────────────────────── */
function bindEnter(ids, fn) {
  ids.forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') fn();
    });
  });
}

/* ── Solo números en teléfono ────────────────────────────────── */
document.getElementById('regTel')?.addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').slice(0, 8);
});

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  showTab(_initTab);

  setupEye('eyeLoginPwd',  'loginPassword', 'eyeLoginIcon');
  setupEye('eyeRegPwd',    'regPassword',   'eyeRegIcon');

  bindEnter(['loginEmail', 'loginPassword'], handleLogin);
  bindEnter(['regNombre', 'regApellido', 'regEmail', 'regPassword', 'regTel'], handleRegister);
});
