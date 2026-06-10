const TB_API_BASE = '/api/store';

let TB_refreshPromise = null;

function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]*)/);
  return match ? match[1] : null;
}

const TB_api = {

  async _request(method, path, body = null) {
    const token = localStorage.getItem('techbuy_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const csrf = getCsrfToken();
    if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;

    const opts = { method, headers, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(TB_API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && data.code === 'TOKEN_EXPIRED') {
      const refreshed = await TB_refreshToken();
      if (refreshed) {
        const newToken = localStorage.getItem('techbuy_token');
        headers['Authorization'] = 'Bearer ' + newToken;
        opts.headers = headers;
        const retryRes = await fetch(TB_API_BASE + path, opts);
        const retryData = await retryRes.json().catch(() => ({}));
        if (!retryRes.ok) {
          const msg = retryData.error || retryData.message || `Error ${retryRes.status}`;
          throw new Error(msg);
        }
        return retryData;
      }
    }

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

  saveSession(token, user) {
    localStorage.setItem('techbuy_token', token);
    localStorage.setItem('techbuy_user',  JSON.stringify(user));
    TB_currentUser = user;
  },

  async clearSession() {
    try {
      const csrf = getCsrfToken();
      const headers = { 'Content-Type': 'application/json' };
      if (csrf) headers['X-CSRF-Token'] = csrf;
      await fetch(TB_API_BASE + '/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch (_) {}
    localStorage.removeItem('techbuy_token');
    localStorage.removeItem('techbuy_user');
    TB_currentUser = null;
  },

  getToken()       { return localStorage.getItem('techbuy_token'); },
  isLoggedIn()     { return !!this.getToken(); },
};

/* ── Sincronizar carrito local → backend ────────────────────── */
async function TB_syncLocalCartToBackend() {
  let local = [];
  try {
    const s = localStorage.getItem("techbuy_cart");
    if (s) local = JSON.parse(s);
  } catch(e) {}
  if (!local.length) return;
  for (const item of local) {
    try {
      await TB_api.post('/carrito/items', { id_producto: item.id, cantidad: item.qty });
    } catch(e) {}
  }
  localStorage.removeItem("techbuy_cart");
}

async function TB_refreshToken() {
  if (TB_refreshPromise) return TB_refreshPromise;
  TB_refreshPromise = (async () => {
    try {
      const csrf = getCsrfToken();
      const headers = { 'Content-Type': 'application/json' };
      if (csrf) headers['X-CSRF-Token'] = csrf;
      const res = await fetch(TB_API_BASE + '/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        TB_api.clearSession();
        return false;
      }
      localStorage.setItem('techbuy_token', data.token);
      return true;
    } catch (_) {
      TB_api.clearSession();
      return false;
    } finally {
      TB_refreshPromise = null;
    }
  })();
  return TB_refreshPromise;
}
