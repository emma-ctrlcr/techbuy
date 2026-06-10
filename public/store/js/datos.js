const TB_SKELETON_GRID = '<div class="skel-grid">' + Array(8).fill(
  '<div class="skel-card"><div class="skel-img"></div><div class="skel-body"><div class="skel-line short"></div><div class="skel-line medium"></div><div class="skel-line btn-skel"></div></div></div>'
).join('') + '</div>';

let TB_CATS = [];

async function TB_loadCats() {
  try {
    const res = await fetch('/api/store/categorias');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    TB_CATS = data.map(c => ({
      key: c.key,
      icon: 'fa-solid ' + (c.icon || 'fa-box'),
      label: c.nombre,
      _icon: c.icon || 'fa-box'
    }));
  } catch (e) {
    console.warn('Error cargando categorías:', e);
  }
}

function TB_iconForCat(cat) {
  const c = TB_CATS.find(x => x.key === cat);
  return c ? c._icon : 'fa-box';
}

function TB_formatDate(val) {
  if (!val) return '\u2014';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return '\u2014';
    const parts = new Intl.DateTimeFormat('es-NI', {
      timeZone: 'America/Managua',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).formatToParts(d);
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    const raw = (map.dayPeriod || '').replace(/\s+/g, '').toLowerCase();
    const period = raw === 'am' || raw === 'a.m.' ? 'a.m.' : raw === 'pm' || raw === 'p.m.' ? 'p.m.' : raw;
    return `${map.day}/${map.month}/${map.year} \u00b7 ${map.hour}:${map.minute} ${period}`;
  } catch {
    return '\u2014';
  }
}

const COLORS = {
  adaptadores: [{ name:"Negro", hex:"#1a1a2e" }, { name:"Blanco", hex:"#f9fafb" }],
  audio:       [{ name:"Negro", hex:"#1a1a2e" }, { name:"Blanco", hex:"#f9fafb" }, { name:"Rojo", hex:"#dc2626" }],
  baterias:    [{ name:"Negro", hex:"#1a1a2e" }],
  cargadores:  [{ name:"Blanco", hex:"#f9fafb" }, { name:"Negro", hex:"#1a1a2e" }],
  celulares:   [{ name:"Phantom Black", hex:"#1a1a2e" }, { name:"Cloud Silver", hex:"#d1d5db" }, { name:"Forest Green", hex:"#16a34a" }, { name:"Sky Blue", hex:"#0ea5e9" }],
  computacion: [{ name:"Gris Espacial", hex:"#4b5563" }, { name:"Medianoche", hex:"#1f2937" }],
  gamer:       [{ name:"Negro", hex:"#1a1a2e" }, { name:"RGB", hex:"linear-gradient(135deg,#ff2d8a,#1a2fcc,#00d4ff)" }],
  hogar:       [{ name:"Rojo", hex:"#dc2626" }, { name:"Azul", hex:"#2563eb" }, { name:"Negro", hex:"#1a1a2e" }],
  mochilas:    [{ name:"Negro", hex:"#1a1a2e" }, { name:"Gris", hex:"#6b7280" }, { name:"Azul", hex:"#2563eb" }],
  oficina:     [{ name:"Negro", hex:"#1a1a2e" }, { name:"Gris", hex:"#6b7280" }, { name:"Blanco", hex:"#f9fafb" }],
  otros:       [{ name:"Negro", hex:"#1a1a2e" }, { name:"Blanco", hex:"#f9fafb" }],
};

const SIZES = {
  adaptadores: ["Unitalla"],
  audio:       ["Unitalla"],
  baterias:    ["Unitalla"],
  cargadores:  ["Unitalla"],
  celulares:   ["128GB", "256GB", "512GB", "1TB"],
  computacion: ['13"', '14"', '15"', '16"'],
  gamer:       ["Unitalla"],
  hogar:       ["Unitalla"],
  mochilas:    ["Unitalla"],
  oficina:     ["Unitalla"],
  otros:       ["Unitalla"],
};

const THUMB_ICONS = {
  adaptadores: ['fa-plug', 'fa-usb', 'fa-cable-car'],
  audio:       ['fa-headphones', 'fa-volume-high', 'fa-music'],
  baterias:    ['fa-battery-full', 'fa-battery-three-quarters', 'fa-battery-half'],
  cargadores:  ['fa-charging-station', 'fa-bolt', 'fa-power-off'],
  celulares:   ['fa-mobile-screen-button', 'fa-camera', 'fa-sim-card'],
  computacion: ['fa-laptop', 'fa-display', 'fa-keyboard'],
  gamer:       ['fa-gamepad', 'fa-computer-mouse', 'fa-keyboard'],
  hogar:       ['fa-headphones', 'fa-volume-high', 'fa-music'],
  mochilas:    ['fa-bag-shopping', 'fa-backpack', 'fa-suitcase'],
  oficina:     ['fa-desktop', 'fa-keyboard', 'fa-computer-mouse'],
  otros:       ['fa-box', 'fa-boxes-stacked', 'fa-box-open'],
};

function TB_getProductColors(cat) { return COLORS[cat] || COLORS.otros; }
function TB_getProductSizes(cat)  { return SIZES[cat]  || SIZES.otros; }
function TB_getThumbIcons(cat)    { return THUMB_ICONS[cat] || THUMB_ICONS.otros; }

const TB_cache = new Map();

function TB_cacheClear() {
  TB_cache.clear();
}

function TB_cacheProduct(p) {
  TB_cache.set(p.id, p);
}

function TB_getCached(id) {
  return TB_cache.get(id) || null;
}

function TB_cacheProductList(products) {
  if (!products) return;
  products.forEach(p => {
    p.price = parseFloat(p.price ?? 0);
    p.old = p.old ? parseFloat(p.old) : null;
    p.stock = parseInt(p.stock) || 0;
    TB_cache.set(p.id, p);
  });
}

async function TB_ensureInCache(id) {
  if (TB_cache.has(id)) return TB_cache.get(id);
  try {
    const p = await TB_api.get('/productos/' + id);
    if (p && p.id) {
      p.price = parseFloat(p.price ?? 0);
      p.old = p.old ? parseFloat(p.old) : null;
      p.stock = parseInt(p.stock) || 0;
      TB_cacheProduct(p);
      return p;
    }
  } catch (e) {
    return null;
  }
}

async function TB_refreshCartCache() {
  if (!TB_cart.length) return;
  const ids = TB_cart.map(i => i.id);
  try {
    const data = await TB_api.post('/productos/carrito', { ids });
    const list = Array.isArray(data) ? data : [];
    list.forEach(p => {
      p.price = parseFloat(p.price ?? 0);
      p.old = p.old ? parseFloat(p.old) : null;
      p.stock = parseInt(p.stock) || 0;
      TB_cacheProduct(p);
    });
    TB_cart.forEach(item => {
      const fresh = TB_cache.get(item.id);
      if (fresh) {
        item.price = fresh.price;
        item.stock = fresh.stock;
        item.name = fresh.name;
        item.brand = fresh.brand;
        item.badge = fresh.badge;
        item.old = fresh.old;
        item.imagenes = fresh.imagenes || item.imagenes || [];
        item.cat = fresh.cat || item.cat;
      }
    });
  } catch (e) {
    console.warn('Error refreshing cart cache:', e.message);
  }
}

async function TB_addToCart(id, qty, replace = false) {
  let p = TB_getCached(id);
  if (!p) p = await TB_ensureInCache(id);
  if (!p) return;
  const maxStock = Math.max(0, parseInt(p.stock) || 0);
  if (maxStock <= 0) {
    TB_showToast('warn', `"${p.name}" no est\u00e1 disponible actualmente`);
    return;
  }
  const existing = TB_cart.find(x => x.id === id);

  let newQty;
  if (replace) {
    newQty = Math.min(qty, maxStock);
    if (newQty <= 0) return;
  } else {
    const currentQty = existing ? existing.qty : 0;
    if (currentQty >= maxStock) {
      TB_showToast('warn', `Solo hay ${maxStock} unidades disponibles de "${p.name}"`);
      return;
    }
    newQty = Math.min(currentQty + qty, maxStock);
  }
  if (TB_api.isLoggedIn()) {
    try {
      const data = await TB_api.post('/carrito/items', { id_producto: id, cantidad: newQty });
      TB_cart = (data.items || []).map(i => ({
        id: i.id_producto,
        name: i.name,
        price: parseFloat(i.price),
        qty: i.cantidad,
        stock: i.stock,
        brand: i.brand || '',
        badge: i.badge,
        old: i.old ? parseFloat(i.old) : null,
        imagenes: i.imagenes || [],
        cat: i.cat,
      }));
    } catch(e) {
      TB_showToast('warn', 'Error al guardar el carrito');
    }
  } else {
    if (existing) { existing.qty = newQty; } else { TB_cart.push({ ...p, qty: newQty }); }
    localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart));
  }
  TB_updateCartUI();
  TB_showToast('cart', `"${p.name}" agregado al carrito`);
}

async function TB_changeQty(id, delta) {
  const item = TB_cart.find(x => x.id === id);
  if (!item) return;
  const proposed = item.qty + delta;
  if (proposed <= 0) {
    TB_cart = TB_cart.filter(x => x.id !== id);
    if (TB_api.isLoggedIn()) {
      try { await TB_api.delete('/carrito/items/' + id); } catch(e) {}
    } else {
      localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart));
    }
    TB_updateCartUI();
    return;
  }
  if (delta > 0) {
    const maxStock = TB_getMaxStock(item);
    if (maxStock > 0 && proposed > maxStock) { TB_showToast('warn', `Solo hay ${maxStock} unidades disponibles`); return; }
  }
  item.qty = proposed;
  if (TB_api.isLoggedIn()) {
    try {
      await TB_api.put('/carrito/items/' + id, { cantidad: proposed });
    } catch(e) {
      TB_showToast('warn', 'Error al actualizar el carrito');
    }
  } else {
    localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart));
  }
  TB_updateCartUI();
}

async function TB_removeFromCart(id) {
  TB_cart = TB_cart.filter(x => x.id !== id);
  if (TB_api.isLoggedIn()) {
    try { await TB_api.delete('/carrito/items/' + id); } catch(e) {}
  } else {
    localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart));
  }
  TB_updateCartUI();
}

function TB_saveCart() {
  // Solo usado para guest (localStorage). Para auth, el backend es la fuente de verdad.
  if (!TB_api.isLoggedIn()) {
    localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart));
  }
}

async function TB_loadCart() {
  if (TB_api && TB_api.isLoggedIn()) {
    try {
      const data = await TB_api.get('/carrito');
      TB_cart = (data.items || []).map(i => ({
        id: i.id_producto,
        name: i.name,
        price: parseFloat(i.price),
        qty: i.cantidad,
        stock: i.stock,
        brand: i.brand || '',
        badge: i.badge,
        old: i.old ? parseFloat(i.old) : null,
        imagenes: i.imagenes || [],
        cat: i.cat,
      }));
      TB_updateCartUI();
      return;
    } catch(e) {
      TB_cart = [];
    }
  }
  try { const s = localStorage.getItem("techbuy_cart"); if (s) TB_cart = JSON.parse(s); }
  catch(e) { TB_cart = []; }
  TB_updateCartUI();
}

function TB_isValidPhone(v) { return /^\d{8}$/.test(v); }
function TB_clearInputError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("error");
  const wrap = el.parentElement;
  const err = wrap ? wrap.querySelector(".error-msg") : null;
  if (err) err.remove();
}
function TB_setInputError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("error");
  const wrap = el.parentElement;
  if (!wrap) return;
  let err = wrap.querySelector(".error-msg");
  if (!err) { err = document.createElement("div"); err.className = "error-msg"; wrap.appendChild(err); }
  err.textContent = msg;
}

function TB_saveSession() {
  if (TB_currentUser) {
    localStorage.setItem("techbuy_session", JSON.stringify({ currentUser: TB_currentUser }));
    localStorage.setItem("techbuy_user", JSON.stringify(TB_currentUser));
  } else {
    localStorage.removeItem("techbuy_session");
    localStorage.removeItem("techbuy_user");
  }
}
function TB_loadSession() {
  try {
    const u = localStorage.getItem("techbuy_user");
    if (u) {
      TB_currentUser = JSON.parse(u);
    } else {
      TB_currentUser = null;
    }
  } catch(e) { TB_currentUser = null; }
}

function TB_cartTotal() { return TB_cart.reduce((s, i) => s + i.price * i.qty, 0); }
function TB_cartTotalIva() { return TB_cartTotal() * 1.15; }
function TB_cartCount() { return TB_cart.reduce((s, i) => s + i.qty, 0); }

function TB_formatPrice(amount) {
  if (amount == null || isNaN(amount)) return "C$0.00";
  const num = Number(amount);
  const decimals = num === Math.floor(num) ? 0 : 2;
  return "C$" + num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: 2 });
}
window.TB_formatPrice = TB_formatPrice;

function TB_getMaxStock(item) {
  const p = TB_getCached(item.id);
  if (p) return Math.max(0, parseInt(p.stock) || 0);
  return Math.max(0, parseInt(item.stock) || 0);
}

function TB_cartCardControls(p) {
  const sinStock = p.stock <= 0;
  if (sinStock) {
    return `<button class="btn-add" data-id="${p.id}" disabled>Agotado</button>`;
  }
  const item = TB_cart.find(x => x.id === p.id);
  if (!item) {
    return `<button class="btn-add" data-id="${p.id}">+ Agregar al Carrito</button>`;
  }
  return `<div class="prod-ctrls-incart">
    <div class="prod-qty-row">
      <button class="btn-qty" data-id="${p.id}" data-d="-1"><i class="fa-solid fa-minus"></i></button>
      <span class="qty-num">${item.qty}</span>
      <button class="btn-qty" data-id="${p.id}" data-d="1"><i class="fa-solid fa-plus"></i></button>
    </div>
    <button class="btn-remove" data-id="${p.id}"><i class="fa-solid fa-trash-can"></i></button>
  </div>`;
}

function TB_cardGridClickHandler(e) {
  if (e.target.closest(".carousel-card")) {
    const carouselBtn = e.target.closest(".btn-add, .btn-qty, .btn-remove");
    if (carouselBtn) return;
  }
  const addBtn = e.target.closest(".btn-add");
  const qtyBtn = e.target.closest(".btn-qty");
  const removeBtn = e.target.closest(".btn-remove");
  const card = e.target.closest(".prod-card");
  const cardClick = !addBtn && !qtyBtn && !removeBtn && card;

  if (addBtn) {
    e.stopPropagation();
    if (addBtn.disabled) return;
    const id = Number(addBtn.dataset.id);
    TB_addToCart(id, 1);
    const p = TB_getCached(id);
    if (p) {
      const div = document.createElement("div");
      div.innerHTML = TB_cartCardControls(p);
      addBtn.replaceWith(div.firstElementChild);
    }
    return;
  }

  if (qtyBtn) {
    e.stopPropagation();
    const id = Number(qtyBtn.dataset.id);
    const wasInCart = TB_cart.find(x => x.id === id);
    if (!wasInCart) return;
    TB_changeQty(id, Number(qtyBtn.dataset.d));
    const stillInCart = TB_cart.find(x => x.id === id);
    const row = qtyBtn.closest(".prod-ctrls-incart") || qtyBtn.closest(".prod-qty-row");
    if (!stillInCart && row) {
      const p = TB_getCached(id);
      if (p) {
        const div = document.createElement("div");
        div.innerHTML = TB_cartCardControls(p);
        (row.closest(".prod-ctrls-incart") || row).replaceWith(div.firstElementChild);
      }
    } else if (stillInCart) {
      const ctrls = qtyBtn.closest(".prod-ctrls-incart");
      if (ctrls) {
        const num = ctrls.querySelector(".qty-num");
        if (num) num.textContent = stillInCart.qty;
      }
    }
    return;
  }

  if (removeBtn) {
    e.stopPropagation();
    const id = Number(removeBtn.dataset.id);
    TB_removeFromCart(id);
    const ctrls = removeBtn.closest(".prod-ctrls-incart");
    if (ctrls) {
      const p = TB_getCached(id);
      if (p) {
        const div = document.createElement("div");
        div.innerHTML = TB_cartCardControls(p);
        ctrls.replaceWith(div.firstElementChild);
      }
    }
    return;
  }

  if (cardClick) {
    const id = Number(card.dataset.id);
    TB_navigate("producto.html?id=" + id);
  }
}

function TB_updateBadge() {
  const count = TB_cartCount();
  const badge = document.getElementById("tb-cart-badge") || document.getElementById("cartBadge");
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? "inline-flex" : "none"; }
}

function TB_updateCartUI() {
  TB_updateBadge();
  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = TB_formatPrice(TB_cartTotalIva());
  TB_renderCartItems();
  TB_refreshCardControls();
}

function _syncCardControl(card, bottomSel) {
  const id = Number(card.dataset.id);
  const p = TB_getCached(id);
  if (!p) return;
  const bottom = card.querySelector(bottomSel);
  if (!bottom) return;
  const existingAddBtn = bottom.querySelector(".btn-add");
  const existingCtrls = bottom.querySelector(".prod-ctrls-incart");
  const item = TB_cart.find(x => x.id === id);
  if (!item && existingCtrls) {
    const div = document.createElement("div");
    div.innerHTML = TB_cartCardControls(p);
    existingCtrls.replaceWith(div.firstElementChild);
  } else if (item && existingAddBtn && !existingAddBtn.disabled) {
    const div = document.createElement("div");
    div.innerHTML = TB_cartCardControls(p);
    existingAddBtn.replaceWith(div.firstElementChild);
  } else if (item && existingCtrls) {
    const num = existingCtrls.querySelector(".qty-num");
    if (num) num.textContent = item.qty;
  }
}

function TB_refreshCardControls() {
  document.querySelectorAll(".prod-card").forEach(function (c) { _syncCardControl(c, ".prod-bottom"); });
  document.querySelectorAll(".carousel-card").forEach(function (c) { _syncCardControl(c, ".carousel-bottom"); });
}

function TB_renderCartItems() {
  const container = document.getElementById("cartItems");
  if (!container) return;
  if (!TB_cart.length) {
    container.innerHTML = '<div class="cart-empty"><div class="cart-empty-icon"><i class="fa-solid fa-bag-shopping"></i></div><h4>Tu carrito esta vacio</h4><p>Explora nuestros productos y anade tus favoritos!</p></div>';
    return;
  }
  container.innerHTML = TB_cart.map(i => `
    <div class="cart-item" data-id="${i.id}">
      <div class="citem-img">${(i.imagenes && i.imagenes.length > 0)
        ? `<img src="${i.imagenes[0]}" alt="${i.name}" loading="lazy" width="260" height="200" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fa-solid ${TB_iconForCat(i.cat)}" style="display:none;position:absolute;"></i>`
        : `<i class="fa-solid ${TB_iconForCat(i.cat)}"></i>`}
      </div>
      <div class="citem-info">
        <div class="citem-name" onclick="goToProduct(${i.id})">${i.name}</div>
        <div class="citem-brand">${i.brand}</div>
        <div class="citem-price">${TB_formatPrice(i.price)} <span class="citem-qty-note">x${i.qty}</span> <span class="citem-subtotal">= ${TB_formatPrice(i.price * i.qty)}</span></div>
        <div class="qty-row">
          <button class="qty-btn" data-id="${i.id}" data-d="-1">-</button>
          <span class="qty-val">${i.qty}</span>
          <button class="qty-btn" data-id="${i.id}" data-d="1">+</button>
        </div>
      </div>
      <button class="citem-del" data-id="${i.id}"><i class="fa-solid fa-trash"></i></button>
    </div>`).join("");
  container.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); TB_changeQty(Number(btn.dataset.id), Number(btn.dataset.d)); });
  });
  container.querySelectorAll(".citem-del").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); TB_removeFromCart(Number(btn.dataset.id)); });
  });
}

function TB_getNotifStack() {
  let stack = document.getElementById("tb-notif-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "tb-notif-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

function TB_detectNotifType(icon, msg) {
  const s = (icon + msg).toLowerCase();
  if (s.includes("fa-cart") || s.includes("carrito") || s.includes("agregado al")) return "cart";
  if (s.includes("fa-heart") || s.includes("favorito"))                             return "heart";
  if (s.includes("fa-check") || s.includes("listo") || s.includes("correcto") ||
      s.includes("guardad")  || s.includes("actualiz") || s.includes("\u00e9xito") ||
      s.includes("exito")    || s.includes("creada"))                               return "success";
  if (s.includes("fa-triangle") || s.includes("requerido") || s.includes("nv\u00e1lido") ||
      s.includes("nvalido")  || s.includes("vacio") || s.includes("vac\u00edo") ||
      s.includes("atenci\u00f3n") || s.includes("atencion"))                             return "warn";
  if (s.includes("fa-xmark") || s.includes("error") || s.includes("incorrecto"))   return "error";
  return "info";
}

const _TB_NOTIF_TITLES = { cart:"Carrito", heart:"Favoritos", success:"Listo", warn:"Atenci\u00f3n", error:"Error", info:"Informaci\u00f3n" };
const _TB_NOTIF_ICONS  = {
  cart:    '<i class="fa-solid fa-cart-shopping"></i>',
  heart:   '<i class="fa-solid fa-heart"></i>',
  success: '<i class="fa-solid fa-circle-check"></i>',
  warn:    '<i class="fa-solid fa-triangle-exclamation"></i>',
  error:   '<i class="fa-solid fa-circle-xmark"></i>',
  info:    '<i class="fa-solid fa-circle-info"></i>',
};

function TB_showToast(icon, msg, durationMs) {
  const isMobile = window.innerWidth <= 768;
  const duration = durationMs || (isMobile ? 2000 : 3500);
  const type  = TB_detectNotifType(icon, msg);
  const stack = TB_getNotifStack();

  /* ── MOBILE: singleton compact notification ── */
  if (isMobile) {
    let notif = stack.querySelector('.tb-notif:not(.hiding)');

    if (notif) {
      clearTimeout(notif._tbTimer);
    } else {
      stack.innerHTML = '';
      notif = document.createElement('div');
      stack.appendChild(notif);
    }

    notif.className = 'tb-notif tb-notif-' + type + ' tb-notif-mobile';
    notif.innerHTML =
      `<div class="tb-notif-icon">${_TB_NOTIF_ICONS[type]}</div>` +
      `<div class="tb-notif-msg">${msg}</div>` +
      (type === 'cart' ? '<span class="tb-notif-cart-link">Ver carrito</span>' : '');

    const link = notif.querySelector('.tb-notif-cart-link');
    if (link) {
      link.addEventListener('click', e => {
        e.stopPropagation();
        TB_dismissNotif(notif, true);
        window.location.href = 'carrito.html';
      });
    }

    notif._tbTimer = setTimeout(() => TB_dismissNotif(notif), duration);
    return;
  }

  /* ── DESKTOP (unchanged) ── */
  const active = stack.querySelectorAll(".tb-notif:not(.hiding)");
  if (active.length >= 4) TB_dismissNotif(active[active.length - 1], true);

  const notif = document.createElement("div");
  notif.className = "tb-notif tb-notif-" + type;
  notif.innerHTML =
    `<div class="tb-notif-icon">${_TB_NOTIF_ICONS[type]}</div>` +
    `<div class="tb-notif-body">` +
      `<div class="tb-notif-title">${_TB_NOTIF_TITLES[type]}</div>` +
      `<div class="tb-notif-msg">${msg}</div>` +
    `</div>` +
    `<button class="tb-notif-close" title="Cerrar"><i class="fa-solid fa-xmark"></i></button>` +
    `<div class="tb-notif-bar" style="width:100%"></div>`;

  stack.prepend(notif);
  notif.querySelector(".tb-notif-close").addEventListener("click", () => TB_dismissNotif(notif));

  requestAnimationFrame(() => {
    notif.querySelector(".tb-notif-bar").style.transition = `width ${duration}ms linear`;
    notif.querySelector(".tb-notif-bar").style.width = "0%";
  });

  notif._tbTimer = setTimeout(() => TB_dismissNotif(notif), duration);

  notif.addEventListener("mouseenter", () => {
    clearTimeout(notif._tbTimer);
    const bar = notif.querySelector(".tb-notif-bar");
    const pct  = parseFloat(bar.style.width) || 0;
    bar.style.transition = "none";
    notif._tbRemaining = (pct / 100) * duration;
  });
  notif.addEventListener("mouseleave", () => {
    const bar = notif.querySelector(".tb-notif-bar");
    const rem  = notif._tbRemaining || 800;
    bar.style.transition = `width ${rem}ms linear`;
    bar.style.width = "0%";
    notif._tbTimer = setTimeout(() => TB_dismissNotif(notif), rem);
  });
}

function TB_dismissNotif(notif, instant) {
  if (!notif || notif.classList.contains("hiding")) return;
  clearTimeout(notif._tbTimer);
  if (instant) { notif.remove(); return; }
  notif.classList.add("hiding");
  setTimeout(() => notif.remove(), 300);
}

function TB_badgeLabel(b) { return b === "new" ? "Nuevo" : "Oferta"; }

function goToProduct(id) { window.location.href = "producto.html?id=" + id; }

let TB_toastTimer = null;
let TB_cart = [];
let TB_currentUser = null;
// NOTA: TB_loadCart se llama desde cada página individualmente
// para evitar duplicar la llamada API en usuarios autenticados.
