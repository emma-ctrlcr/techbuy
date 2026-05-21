/* ══════════════════════════════════════════════════════════════
   PERFIL PAGE — perfil.js  (v13 — conectado a API REST)
   Carga: datos.js → api.js → shared.js → perfil.js
══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {

  // ── Verificar sesión ──────────────────────────────────────
  if (!TB_api.isLoggedIn()) {
    sessionStorage.setItem('tb_login_return', 'perfil.html'); TB_navigate('login.html');
    return;
  }

  // ── Cargar datos frescos del usuario desde la API ─────────
  try {
    const data = await TB_api.get('/auth/me');
    // /auth/me devuelve el usuario directamente (sin wrapper { user: ... })
    TB_currentUser = data.user || data;
    localStorage.setItem('techbuy_user', JSON.stringify(TB_currentUser));
  } catch (err) {
    // Token expirado u otro error → cerrar sesión
    TB_api.clearSession();
    sessionStorage.setItem('tb_login_return', 'perfil.html'); TB_navigate('login.html');
    return;
  }

  // ── Tab desde URL ─────────────────────────────────────────
  const params = new URLSearchParams(window.location.search);
  switchTab(params.get('tab') || 'perfil');

  // ── Pre-llenar formulario ─────────────────────────────────
  document.getElementById('perfilName').textContent =
    (TB_currentUser.nombre + ' ' + (TB_currentUser.apellido || '')).trim()
    || TB_currentUser.email.split('@')[0];
  document.getElementById('perfilEmail').textContent  = TB_currentUser.email;
  document.getElementById('editNombre').value   = TB_currentUser.nombre   || '';
  document.getElementById('editApellido').value = TB_currentUser.apellido || '';
  document.getElementById('editTel').value      = TB_currentUser.tel      || '';
  document.getElementById('editEmail').value    = TB_currentUser.email    || '';
  document.getElementById('editAddress').value  = TB_currentUser.address  || '';
  document.getElementById('editCity').value     = TB_currentUser.city     || '';

  // ── Badges ────────────────────────────────────────────────
  try {
    const favs = await TB_api.get('/favoritos');
    const favCountEl = document.getElementById('favCount');
    if (favs.length > 0) {
      favCountEl.textContent = favs.length;
      favCountEl.style.display = 'inline-flex';
    }
  } catch(e) {}

  try {
    const orders = await TB_api.get('/pedidos');
    const orderCountEl = document.getElementById('orderCount');
    if (orders.length > 0) {
      orderCountEl.textContent = orders.length;
      orderCountEl.style.display = 'inline-flex';
    }
  } catch(e) {}

  // ── Formulario editar perfil ──────────────────────────────
  document.getElementById('editProfileForm').addEventListener('submit', handleEditSubmit);

  // ── Tarjeta ───────────────────────────────────────────────
  setupCardInput('perfilCardNumber', 'perfilCardIcon', 'perfilCardHint');
  setupExpiryInput('perfilCardExpiry');
  document.getElementById('perfilAddCardForm').addEventListener('submit', handleAddCard);

  // ── Teléfono ──────────────────────────────────────────────
  document.getElementById('editTel').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 8);
  });

  // ── Header compartido ─────────────────────────────────────
  TB_loadCart();
  TB_setupSharedHeader();
  TB_setupCartSidebar();
  TB_setupAccountBtn();
});

// ── TAB SWITCHING ──────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.perfil-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.perfil-menu-item').forEach(m => m.classList.remove('active'));

  const tab = document.getElementById('tab-' + tabId);
  if (tab) tab.classList.add('active');
  const menuBtn = document.querySelector(`.perfil-menu-item[data-tab="${tabId}"]`);
  if (menuBtn) menuBtn.classList.add('active');

  if (tabId === 'favoritos') renderFavorites();
  if (tabId === 'pedidos')   renderOrders();
  if (tabId === 'metodos')   renderSavedCards();
}

// ── FAVORITES (API) ────────────────────────────────────────────
async function renderFavorites() {
  const grid = document.getElementById('perfilFavGrid');
  grid.innerHTML = '<p style="color:var(--muted)">Cargando favoritos…</p>';

  let favs = [];
  try { favs = await TB_api.get('/favoritos'); } catch(e) {}

  const favCountEl = document.getElementById('favCount');
  if (favCountEl) {
    if (favs.length > 0) { favCountEl.textContent = favs.length; favCountEl.style.display = 'inline-flex'; }
    else { favCountEl.style.display = 'none'; }
  }
  if (!favs.length) {
    grid.innerHTML = `
      <div class="perfil-empty-state">
        <i class="fa-solid fa-heart"></i>
        <h3>No tienes favoritos</h3>
        <p>Explora nuestros productos y guarda los que más te gusten.</p>
        <a href="1.html">Explorar productos</a>
      </div>`;
    return;
  }

  grid.innerHTML = favs.map(p => {
    const price = parseFloat(p.price ?? 0);
    const imgHTML = (p.imagenes && p.imagenes.length > 0)
      ? `<img src="${p.imagenes[0]}" alt="${p.name || p.nombre}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fa-solid ${TB_iconForCat(p.cat || 'otros')}" style="display:none;position:absolute;"></i>`
      : `<i class="fa-solid ${TB_iconForCat(p.cat || 'otros')}"></i>`;
    return `
    <div class="perfil-fav-card" onclick="window.location.href='producto.html?id=${p.id}'">
      <div class="perfil-fav-img" style="position:relative;display:flex;align-items:center;justify-content:center;">${imgHTML}</div>
      <div class="perfil-fav-info">
        <div class="perfil-fav-brand">${p.brand || p.marca || ''}</div>
        <div class="perfil-fav-name">${p.name || p.nombre}</div>
        <div class="perfil-fav-price-row">
          <span class="perfil-fav-price">C$${price.toFixed(2)}</span>
        </div>
        <div class="perfil-fav-actions">
          <button class="perfil-fav-add"
            onclick="event.stopPropagation(); TB_addToCart(${p.id}, 1);">
            <i class="fa-solid fa-cart-plus"></i> Agregar
          </button>
          <button class="perfil-fav-remove"
            onclick="event.stopPropagation(); removeFavorite(${p.id});">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function removeFavorite(idProducto) {
  try {
    await TB_api.delete('/favoritos/' + idProducto);
    TB_showToast('heart', 'Producto quitado de favoritos');
    renderFavorites();
  } catch(err) {
    TB_showToast('error', err.message || 'No se pudo quitar el favorito');
  }
}

// ── ORDERS (API) ───────────────────────────────────────────────
async function renderOrders() {
  const container = document.getElementById('perfilOrdersList');
  container.innerHTML = '<p style="color:var(--muted)">Cargando pedidos…</p>';

  let orders = [];
  try { orders = await TB_api.get('/pedidos'); } catch(e) {}

  if (!orders.length) {
    container.innerHTML = `
      <div class="perfil-empty-state">
        <i class="fa-solid fa-box-open"></i>
        <h3>No tienes pedidos aún</h3>
        <p>¡Realiza tu primera compra!</p>
        <a href="1.html">Explorar productos</a>
      </div>`;
    return;
  }

  const statusLabels = {
    pagado:'Pagado', entregado:'Entregado',
    enviado:'Enviado', pendiente:'Pendiente', cancelado:'Cancelado'
  };

  window._TB_orders = orders;

  container.innerHTML = orders.map(o => {
    const dateStr = o.fecha
      ? new Date(o.fecha).toLocaleDateString('es-NI',
          { day:'2-digit', month:'short', year:'numeric' })
      : (o.date || '—');
    const totalDisplay = o.total
      ? parseFloat(o.total).toFixed(2)
      : (o.items || []).reduce((s, i) => s + parseFloat(i.precio_unitario || i.price || i.precio || 0) * (i.cantidad || i.qty || 1), 0).toFixed(2);
    const itemsLabel = (o.items || []).map(i => `${i.cantidad || i.qty}x ${i.name || i.nombre}`).join(', ');
    return `
    <div class="perfil-order-card perfil-order-clickable"
         onclick="openOrderInvoice('${o.id_pedido || o.id}')">
      <div class="perfil-order-top">
        <span class="perfil-order-id">#${o.id_pedido || o.id}</span>
        <span class="perfil-order-date">${dateStr}</span>
        <span class="perfil-order-status ${o.status || 'pendiente'}">
          ${statusLabels[o.status] || o.status || 'Pendiente'}
        </span>
      </div>
      <div class="perfil-order-items">${itemsLabel || 'Ver detalle'}</div>
      <div class="perfil-order-total">Total: C$${totalDisplay}</div>
      <div class="perfil-order-hint"><i class="fa-solid fa-file-invoice"></i> Ver factura</div>
    </div>`;
  }).join('');
}

async function openOrderInvoice(orderId) {
  try {
    const o = await TB_api.get('/pedidos/' + orderId);
    const itemsData = (o.items || []).map(i => ({
      name:  i.name  || i.nombre || '',
      brand: i.brand || i.marca || '',
      qty:   i.cantidad || i.qty || 1,
      price: parseFloat(i.precio_unitario || i.price || i.precio || i.precio_base || 0),
    }));

    const invoiceData = {
      id:       o.id_pedido || o.id,
      dept:     o.dept || o.departamento || TB_currentUser.city || 'Nicaragua',
      city:     o.city || o.ciudad || TB_currentUser.city || '',
      discount: parseFloat(o.discount || o.descuento || 0),
      shipping: o.shipping ?? o.envio ?? null,
      items:    itemsData,
      fromHistory: true,
    };
    sessionStorage.setItem('tb_last_order', JSON.stringify(invoiceData));
    window.location.href = 'factura.html';
  } catch(err) {
    TB_showToast('error', 'No se pudo cargar el pedido');
  }
}

// ── PAYMENT METHODS (API) ──────────────────────────────────────
async function renderSavedCards() {
  const container = document.getElementById('perfilSavedCards');
  container.innerHTML = '<p style="color:var(--muted)">Cargando tarjetas…</p>';

  let savedCards = [];
  try { savedCards = await TB_api.get('/metodos-pago'); } catch(e) {}

  if (!savedCards.length) {
    container.innerHTML = `<div class="perfil-no-cards">
      <i class="fa-regular fa-credit-card"></i>
      <p>No tienes tarjetas guardadas</p></div>`;
    return;
  }

  const cardIcons = { visa:'visa', mastercard:'mastercard', amex:'amex' };
  const cardNames = { visa:'Visa', mastercard:'Mastercard', amex:'American Express', unknown:'Tarjeta' };

  container.innerHTML = `<div class="perfil-saved-cards">` +
    savedCards.map((c, idx) => `
    <div class="perfil-card-item">
      <div class="perfil-card-icon">
        ${cardIcons[c.tipo || c.type]
          ? `<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/${cardIcons[c.tipo || c.type]}.svg"
               alt="${c.tipo || c.type}" class="tb-payment-icon">`
          : `<i class="fa-regular fa-credit-card"></i>`}
      </div>
      <div class="perfil-card-info">
        <div class="perfil-card-name">
          ${cardNames[c.tipo || c.type] || 'Tarjeta'} •••• ${c.ultimos4 || c.last4}
        </div>
        <div class="perfil-card-expiry">${c.alias || ''}</div>
      </div>
      <button class="perfil-card-delete" onclick="deleteCard(${c.id_metodo || idx})">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('') + `</div>`;
}

async function deleteCard(idMetodo) {
  try {
    await TB_api.delete('/metodos-pago/' + idMetodo);
    TB_showToast('success', 'Tarjeta eliminada');
    renderSavedCards();
  } catch(err) {
    TB_showToast('error', err.message || 'No se pudo eliminar');
  }
}

async function handleAddCard(e) {
  e.preventDefault();
  const fields = ['perfilCardNumber','perfilCardName','perfilCardCVV','perfilCardExpiry'];
  fields.forEach(f => clearFieldError(f));

  const cardNum  = document.getElementById('perfilCardNumber').value.replace(/\s/g, '');
  const cardName = document.getElementById('perfilCardName').value.trim().toUpperCase();
  const cvv      = document.getElementById('perfilCardCVV').value.trim();
  const expiry   = document.getElementById('perfilCardExpiry').value.trim();
  const cardType = detectCard(cardNum);
  const expectedLen = cardType === 'amex' ? 15 : 16;
  const expectedCVV = cardType === 'amex' ? 4 : 3;

  let valid = true;
  if (!cardType)                      { setFieldError('perfilCardNumber', 'Solo Visa, Mastercard o Amex'); valid = false; }
  if (!cardNum || cardNum.length < expectedLen) { setFieldError('perfilCardNumber', cardType === 'amex' ? '15 dígitos' : '16 dígitos requeridos'); valid = false; }
  if (!cardName)                      { setFieldError('perfilCardName', 'Requerido'); valid = false; }
  if (!cvv || cvv.length < expectedCVV) { setFieldError('perfilCardCVV', expectedCVV + ' dígitos'); valid = false; }
  if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
    setFieldError('perfilCardExpiry', 'Formato MM/YY'); valid = false;
  } else {
    const [mm, yy] = expiry.split('/').map(Number);
    if (mm < 1 || mm > 12) {
      setFieldError('perfilCardExpiry', 'Mes inválido (01-12)'); valid = false;
    } else {
      const now = new Date();
      const cardExp = new Date(2000 + yy, mm, 0);
      if (cardExp <= now) {
        setFieldError('perfilCardExpiry', 'Tarjeta vencida'); valid = false;
      }
    }
  }
  if (!valid) return;

  try {
    await TB_api.post('/metodos-pago', {
      alias:    cardName + ' •••• ' + cardNum.slice(-4),
      tipo:     cardType || 'unknown',
      ultimos4: cardNum.slice(-4),
    });
    document.getElementById('perfilAddCardForm').reset();
    document.getElementById('perfilCardIcon').textContent = '';
    document.getElementById('perfilCardHint').textContent = '16 dígitos';
    renderSavedCards();
    TB_showToast('success', 'Tarjeta guardada correctamente');
  } catch(err) {
    TB_showToast('error', err.message || 'No se pudo guardar la tarjeta');
  }
}

// ── EDIT PROFILE (API) ─────────────────────────────────────────
async function handleEditSubmit(e) {
  e.preventDefault();
  const fields = ['editNombre','editApellido','editTel','editEmail'];
  fields.forEach(clearFieldError);

  const nombre   = document.getElementById('editNombre').value.trim();
  const apellido = document.getElementById('editApellido').value.trim();
  const tel      = document.getElementById('editTel').value.trim();
  const email    = document.getElementById('editEmail').value.trim();
  const address  = document.getElementById('editAddress').value.trim();
  const city     = document.getElementById('editCity').value.trim();

  let valid = true;
  if (!nombre)                          { setFieldError('editNombre',   'Requerido'); valid = false; }
  if (!apellido)                        { setFieldError('editApellido', 'Requerido'); valid = false; }
  if (!tel || !/^\d{8}$/.test(tel))    { setFieldError('editTel',      '8 dígitos numéricos'); valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('editEmail', 'Correo inválido'); valid = false; }
  if (!valid) return;

  try {
    await TB_api.put('/usuarios/perfil', { nombre, apellido, tel, email, address, city });
    TB_currentUser = { ...TB_currentUser, nombre, apellido, tel, email, address, city };
    localStorage.setItem('techbuy_user', JSON.stringify(TB_currentUser));
    document.getElementById('perfilName').textContent  = (nombre + ' ' + apellido).trim();
    document.getElementById('perfilEmail').textContent = email;
    TB_showToast('success', 'Perfil actualizado correctamente');
  } catch(err) {
    TB_showToast('error', err.message || 'No se pudo actualizar el perfil');
  }
}

// ── LOGOUT ──────────────────────────────────────────────────────
function handleLogout() {
  TB_api.clearSession();
  TB_showToast('success', 'Sesión cerrada');
  setTimeout(() => { window.location.href = '1.html'; }, 1000);
}

// ── HELPERS ─────────────────────────────────────────────────────
function detectCard(num) {
  if (!num) return null;
  const f = num[0];
  if (f === '4') return 'visa';
  if (f === '5') return 'mastercard';
  if (f === '3') return 'amex';
  return null;
}

function setupExpiryInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', () => {
    let v = input.value.replace(/[^\d/]/g, '');
    const idx = v.indexOf('/');
    if (idx >= 0) {
      let mm = v.substring(0, idx).replace(/\D/g, '').slice(0, 2);
      let yy = v.substring(idx + 1).replace(/\D/g, '').slice(0, 2);
      v = mm + '/' + yy;
    } else {
      v = v.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    }
    input.value = v;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && input.value.endsWith('/')) {
      input.value = input.value.slice(0, -1);
      e.preventDefault();
    }
  });
}

function setupCardInput(inputId, iconId, hintId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  const hint  = document.getElementById(hintId);
  const cardIcons = {
    visa:       '<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/visa.svg" alt="Visa" class="tb-payment-icon">',
    mastercard: '<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/mastercard.svg" alt="Mastercard" class="tb-payment-icon">',
    amex:       '<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/amex.svg" alt="Amex" class="tb-payment-icon">',
  };
  input.addEventListener('input', () => {
    let raw = input.value.replace(/\D/g, '');
    const first = raw[0];
    let val;
    if (first === '3') { raw = raw.slice(0,15); val = raw.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_,a,b,c)=>{ let f=a; if(b) f+=' '+b; if(c) f+=' '+c; return f.trim(); }); }
    else { raw = raw.slice(0,16); val = raw.length > 4 ? raw.match(/.{1,4}/g).join(' ') : raw; }
    input.value = val;
    const type = detectCard(raw);
    if (type) { icon.innerHTML = cardIcons[type]; hint.textContent = type.charAt(0).toUpperCase()+type.slice(1); }
    else { icon.textContent = ''; hint.textContent = raw.length >= 1 ? 'Tipo no reconocido' : '16 dígitos'; }
  });
}

function setFieldError(id, msg) {
  const wrap = document.getElementById(id).parentElement;
  let err = wrap.querySelector('.perfil-field-error');
  if (!err) { err = document.createElement('span'); err.className = 'perfil-field-error'; wrap.appendChild(err); }
  err.textContent = msg;
  document.getElementById(id).style.borderColor = '#e74c3c';
}
function clearFieldError(id) {
  const wrap = document.getElementById(id).parentElement;
  const err  = wrap.querySelector('.perfil-field-error');
  if (err) err.remove();
  document.getElementById(id).style.borderColor = '';
}

window.switchTab       = switchTab;
window.removeFavorite  = removeFavorite;
window.handleLogout    = handleLogout;
window.openOrderInvoice= openOrderInvoice;
window.deleteCard      = deleteCard;
