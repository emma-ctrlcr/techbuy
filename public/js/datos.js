/* ══════════════════════════════════════════════════════════════
   TECHBUY — datos.js
   Datos globales compartidos entre todas las paginas.
   NO tiene efectos colaterales, solo define constantes.
══════════════════════════════════════════════════════════════ */

// TB_PRODUCTS se llena dinámicamente desde la API (/api/productos).
// NO hay datos hardcodeados aquí — la única fuente de verdad es la base de datos.
const TB_PRODUCTS = [];

const TB_CATS = [
  { key:"all",         icon:"fa-solid fa-store",      label:"Todo" },
  { key:"oficina",     icon:"fa-solid fa-briefcase",   label:"Oficina" },
  { key:"hogar",       icon:"fa-solid fa-house",        label:"Hogar" },
  { key:"gamer",       icon:"fa-solid fa-gamepad",      label:"Gamer" },
  { key:"computacion", icon:"fa-solid fa-laptop",       label:"Computacion" },
  { key:"celulares",   icon:"fa-solid fa-mobile-screen",label:"Celulares" },
  { key:"otros",       icon:"fa-solid fa-box-open",     label:"Otros" },
];

const COLORS = {
  oficina:     [{ name:"Negro", hex:"#1a1a2e" }, { name:"Gris", hex:"#6b7280" }, { name:"Blanco", hex:"#f9fafb" }],
  hogar:       [{ name:"Rojo", hex:"#dc2626" }, { name:"Azul", hex:"#2563eb" }, { name:"Negro", hex:"#1a1a2e" }],
  gamer:       [{ name:"Negro", hex:"#1a1a2e" }, { name:"RGB", hex:"linear-gradient(135deg,#ff2d8a,#1a2fcc,#00d4ff)" }],
  computacion: [{ name:"Gris Espacial", hex:"#4b5563" }, { name:"Medianoche", hex:"#1f2937" }],
  celulares:   [{ name:"Phantom Black", hex:"#1a1a2e" }, { name:"Cloud Silver", hex:"#d1d5db" }, { name:"Forest Green", hex:"#16a34a" }, { name:"Sky Blue", hex:"#0ea5e9" }],
  otros:       [{ name:"Negro", hex:"#1a1a2e" }, { name:"Blanco", hex:"#f9fafb" }],
};

const SIZES = {
  oficina:     ["Unitalla"],
  hogar:       ["Unitalla"],
  gamer:       ["Unitalla"],
  computacion: ['13"', '14"', '15"', '16"'],
  celulares:   ["128GB", "256GB", "512GB", "1TB"],
  otros:       ["Unitalla"],
};

const THUMB_ICONS = {
  oficina:     ['fa-desktop', 'fa-keyboard', 'fa-computer-mouse'],
  hogar:       ['fa-headphones', 'fa-volume-high', 'fa-music'],
  gamer:       ['fa-gamepad', 'fa-computer-mouse', 'fa-keyboard'],
  computacion: ['fa-laptop', 'fa-display', 'fa-keyboard'],
  celulares:   ['fa-mobile-screen-button', 'fa-camera', 'fa-charging-station'],
  otros:       ['fa-box', 'fa-boxes-stacked', 'fa-box-open'],
};

function TB_getProductColors(cat) { return COLORS[cat] || COLORS.otros; }
function TB_getProductSizes(cat)  { return SIZES[cat]  || SIZES.otros; }
function TB_getThumbIcons(cat)    { return THUMB_ICONS[cat] || THUMB_ICONS.otros; }

function TB_iconForCat(cat) {
  const m = { oficina:'fa-desktop', hogar:'fa-headphones', gamer:'fa-gamepad', computacion:'fa-laptop', celulares:'fa-mobile-screen-button', otros:'fa-box' };
  return m[cat] || 'fa-box';
}



function TB_filterProducts(list, cat, search) {
  return list.filter(p => {
    const matchCat = cat === "all" || p.cat === cat;
    const q = (search || "").trim().toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.cat.includes(q);
    return matchCat && matchQ;
  });
}

function TB_addToCart(id, qty) {
  const p = TB_PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const maxStock = Math.max(0, parseInt(p.stock) || 0);
  if (maxStock <= 0) {
    TB_showToast('warn', `"${p.name}" no está disponible actualmente`);
    return;
  }
  const existing = TB_cart.find(x => x.id === id);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty >= maxStock) {
    TB_showToast('warn', `Solo hay ${maxStock} unidades disponibles de "${p.name}"`);
    return;
  }
  const newQty = Math.min(currentQty + qty, maxStock);
  if (existing) { existing.qty = newQty; } else { TB_cart.push({ ...p, qty: newQty }); }
  TB_saveCart();
  TB_updateCartUI();
  TB_showToast('cart', `"${p.name}" agregado al carrito`);
}

function TB_changeQty(id, delta) {
  const item = TB_cart.find(x => x.id === id);
  if (!item) return;
  const proposed = item.qty + delta;
  if (proposed <= 0) { TB_cart = TB_cart.filter(x => x.id !== id); TB_saveCart(); TB_updateCartUI(); return; }
  if (delta > 0) {
    const maxStock = TB_getMaxStock(item);
    if (maxStock > 0 && proposed > maxStock) { TB_showToast('warn', `Solo hay ${maxStock} unidades disponibles`); return; }
  }
  item.qty = proposed;
  TB_saveCart(); TB_updateCartUI();
}

function TB_removeFromCart(id) { TB_cart = TB_cart.filter(x => x.id !== id); TB_saveCart(); TB_updateCartUI(); }

function TB_saveCart() { localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart)); }

function TB_loadCart() {
  try { const s = localStorage.getItem("techbuy_cart"); if (s) TB_cart = JSON.parse(s); }
  catch(e) { TB_cart = []; }
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
  // Delegado a TB_api.saveSession() — usar solo para compatibilidad
  if (TB_currentUser) {
    localStorage.setItem("techbuy_session", JSON.stringify({ currentUser: TB_currentUser }));
    localStorage.setItem("techbuy_user", JSON.stringify(TB_currentUser));
  } else {
    localStorage.removeItem("techbuy_session");
    localStorage.removeItem("techbuy_user");
  }
}
function TB_loadSession() {
  // Cargar usuario desde localStorage (el token JWT vive en techbuy_token)
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

function TB_getMaxStock(item) {
  const p = TB_PRODUCTS.find(x => x.id === item.id);
  if (p) return Math.max(0, parseInt(p.stock) || 0);
  return Math.max(0, parseInt(item.stock) || 0);
}

function TB_updateBadge() {
  const count = TB_cartCount();
  const badge = document.getElementById("tb-cart-badge") || document.getElementById("cartBadge");
  if (badge) { badge.textContent = count; badge.style.display = count > 0 ? "inline-flex" : "none"; }
}

function TB_updateCartUI() {
  TB_updateBadge();
  const totalEl = document.getElementById("cartTotal");
  if (totalEl) totalEl.textContent = "C$" + TB_cartTotalIva().toFixed(2);
  TB_renderCartItems();
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
        ? `<img src="${i.imagenes[0]}" alt="${i.name}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fa-solid ${TB_iconForCat(i.cat)}" style="display:none;position:absolute;"></i>`
        : `<i class="fa-solid ${TB_iconForCat(i.cat)}"></i>`}
      </div>
      <div class="citem-info">
        <div class="citem-name" onclick="goToProduct(${i.id})">${i.name}</div>
        <div class="citem-brand">${i.brand}</div>
        <div class="citem-price">C$${i.price} <span class="citem-qty-note">x${i.qty}</span> <span class="citem-subtotal">= C$${(i.price * i.qty).toFixed(2)}</span></div>
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

// ══════════════════════════════════════════════════════════════
//  NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════════════════

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
      s.includes("guardad")  || s.includes("actualiz") || s.includes("éxito") ||
      s.includes("exito")    || s.includes("creada"))                               return "success";
  if (s.includes("fa-triangle") || s.includes("requerido") || s.includes("nválido") ||
      s.includes("nvalido")  || s.includes("vacio") || s.includes("vacío") ||
      s.includes("atención") || s.includes("atencion"))                             return "warn";
  if (s.includes("fa-xmark") || s.includes("error") || s.includes("incorrecto"))   return "error";
  return "info";
}

const _TB_NOTIF_TITLES = { cart:"Carrito", heart:"Favoritos", success:"Listo", warn:"Atención", error:"Error", info:"Información" };
const _TB_NOTIF_ICONS  = {
  cart:    '<i class="fa-solid fa-cart-shopping"></i>',
  heart:   '<i class="fa-solid fa-heart"></i>',
  success: '<i class="fa-solid fa-circle-check"></i>',
  warn:    '<i class="fa-solid fa-triangle-exclamation"></i>',
  error:   '<i class="fa-solid fa-circle-xmark"></i>',
  info:    '<i class="fa-solid fa-circle-info"></i>',
};

function TB_showToast(icon, msg, durationMs) {
  const duration = durationMs || 3500;
  const type  = TB_detectNotifType(icon, msg);
  const stack = TB_getNotifStack();

  // Cap at 4 toasts
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

  // Animate bar
  requestAnimationFrame(() => {
    notif.querySelector(".tb-notif-bar").style.transition = `width ${duration}ms linear`;
    notif.querySelector(".tb-notif-bar").style.width = "0%";
  });

  notif._tbTimer = setTimeout(() => TB_dismissNotif(notif), duration);

  // Pause on hover
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

let TB_toastTimer = null; // legacy compat
let TB_cart = [];
let TB_currentUser = null;
document.addEventListener('DOMContentLoaded', () => { TB_loadCart(); });