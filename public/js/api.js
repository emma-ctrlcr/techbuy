/* ══════════════════════════════════════════════════════════════
   TECHBUY — api.js
   Cliente centralizado para todas las llamadas al backend REST.
   Cargar ANTES que cualquier otro JS (después de datos.js).

   Uso:
     const data = await TB_api.get('/productos');
     const data = await TB_api.post('/auth/login', { email, password });
══════════════════════════════════════════════════════════════ */

/* ── Limpieza única de claves legacy / datos corruptos ───────
   Se ejecuta una sola vez por sesión de navegador.
   Elimina cualquier dato de usuario que no tenga token válido.
══════════════════════════════════════════════════════════════ */
(function TB_cleanLegacyStorage() {
  const DONE_KEY = 'tb_clean_v3';
  if (sessionStorage.getItem(DONE_KEY)) return; // ya se limpió esta sesión
  sessionStorage.setItem(DONE_KEY, '1');

  // Claves legacy del sistema anterior
  const legacyKeys = [
    'techbuy_session', 'currentUser', 'user', 'token',
    'tb_user', 'tb_token', 'tb_session', 'tb_cart_backup',
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));

  // Si hay datos de usuario pero NO hay token, limpiar también
  const hasToken = !!localStorage.getItem('techbuy_token');
  const hasUser  = !!localStorage.getItem('techbuy_user');
  if (hasUser && !hasToken) {
    localStorage.removeItem('techbuy_user');
  }

  // Limpiar carrito de ítems con IDs locales hardcodeados (rango 1-35 del sistema anterior)
  // Los IDs de la BD pueden empezar diferente; se re-validan al cargar productos de la API.
  // Solo limpiamos si el carrito parece ser del sistema anterior (items sin campo 'imagenes').
  try {
    const cartKey = 'techbuy_cart';
    const raw = localStorage.getItem(cartKey);
    if (raw) {
      const items = JSON.parse(raw);
      // Si algún item no tiene referencia a ID de BD válida, limpiar todo el carrito
      // La re-validación real la hace TB_loadProductsFromAPI
      if (!Array.isArray(items)) {
        localStorage.removeItem(cartKey);
      }
    }
  } catch(e) {
    localStorage.removeItem('techbuy_cart');
  }
})();

const TB_API_BASE = '/api';

const TB_api = {

  /* ── Petición base ─────────────────────────────────────── */
  async _request(method, path, body = null) {
    const token = localStorage.getItem('techbuy_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(TB_API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || data.message || `Error ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },

  get(path)         { return this._request('GET', path); },
  post(path, body)  { return this._request('POST', path, body); },
  put(path, body)   { return this._request('PUT', path, body); },
  delete(path)      { return this._request('DELETE', path); },

  /* ── Token / sesión ─────────────────────────────────────── */
  saveSession(token, user) {
    localStorage.setItem('techbuy_token', token);
    localStorage.setItem('techbuy_user',  JSON.stringify(user));
    localStorage.setItem('techbuy_session', JSON.stringify({ currentUser: user }));
    TB_currentUser = user;
  },

  clearSession() {
    localStorage.removeItem('techbuy_token');
    localStorage.removeItem('techbuy_user');
    localStorage.removeItem('techbuy_session');
    TB_currentUser = null;
  },

  getToken()       { return localStorage.getItem('techbuy_token'); },
  isLoggedIn()     { return !!this.getToken(); },
};
