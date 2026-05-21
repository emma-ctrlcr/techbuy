/* ══════════════════════════════════════════════════════════════
   TECHBUY — 1.js (app.js)
   Pagina principal: navegacion, productos, carrito, toast, etc.
   Dependencias: datos.js (PRODUCTS, CATS, utilidades TB_*)
   shared.js (header, search autocomplete, cart sidebar)
══════════════════════════════════════════════════════════════ */

// ─── ESTADO ──────────────────────────────────────────────────

// Alias for inline onclick handlers in HTML
function navigateTo(pageId) { TB_navigateTo(pageId); }

// estado por página
const state = {
  catalogo: { cat: "all", search: "", sort: "default" },
  ofertas:  { cat: "all", search: "" },
};

// ─── NAVEGACIÓN ──────────────────────────────────────────────
function TB_navigateTo(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-" + pageId);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-link").forEach(l => {
    l.classList.toggle("active", l.dataset.page === pageId);
  });

  if (pageId === "inicio")   TB_renderInicio();
  if (pageId === "catalogo") TB_renderCatalogo();
  if (pageId === "ofertas")  TB_renderOfertas();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── RENDER TARJETA DE PRODUCTO ──────────────────────────────
function TB_productCardHTML(p) {
  const imgHTML = (p.imagenes && p.imagenes.length > 0)
    ? `<img src="${p.imagenes[0]}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const iconDisplay = (p.imagenes && p.imagenes.length > 0) ? 'none' : 'flex';
  const sinStock = p.stock <= 0;
  const badge = sinStock ? '<div class="prod-badge badge-agotado">Agotado</div>'
    : p.badge ? `<div class="prod-badge badge-${p.badge}">${TB_badgeLabel(p.badge)}</div>`
    : '';
  return `
    <div class="prod-card" data-id="${p.id}">
      ${badge}
      <div class="prod-img" style="position:relative;display:flex;align-items:center;justify-content:center;">
        ${imgHTML}
        <i class="fa-solid ${TB_iconForCat(p.cat)}" style="display:${iconDisplay};position:absolute;"></i>
      </div>
      <div class="prod-info">
        <div class="prod-brand">${p.brand}</div>
        <div class="prod-name">${p.name}</div>
        <div class="prod-bottom">
          <div class="prod-price-row">
            <span class="prod-price">C$${p.price}</span>
            ${p.old ? `<span class="prod-old">C$${p.old}</span>` : ""}
          </div>
          <button class="btn-add" data-id="${p.id}"${sinStock ? ' disabled' : ''}>${sinStock ? 'Agotado' : '+ Agregar al Carrito'}</button>
        </div>
      </div>
    </div>`;
}

function TB_renderGrid(containerId, list) {
  const container = document.getElementById(containerId);
  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Sin resultados</h3>
        <p>Intenta con otro término o categoría.</p>
      </div>`;
    return;
  }
  container.innerHTML = list.map(TB_productCardHTML).join("");

  container.querySelectorAll(".prod-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".btn-add")) return;
      const id = Number(card.dataset.id);
      TB_navigate("producto.html?id=" + id);
    });
  });
  container.querySelectorAll(".btn-add").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      TB_addToCart(Number(btn.dataset.id), 1);
    });
  });
}

// ─── RENDER CATEGORÍAS ───────────────────────────────────────
function TB_renderCats(containerId, activeCat, onChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = TB_CATS.map(c => `
    <button class="cat-btn ${c.key === activeCat ? "active" : ""}" data-cat="${c.key}">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-label">${c.label}</span>
    </button>`).join("");
  container.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => onChange(btn.dataset.cat));
  });
}

// ─── FILTRAR LISTA ───────────────────────────────────────────
function TB_filterProducts(list, cat, search) {
  return list.filter(p => {
    const matchCat = cat === "all" || p.cat === cat;
    const q = search.trim().toLowerCase();
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.cat.includes(q);
    return matchCat && matchQ;
  });
}

// ─── CARRUSEL ────────────────────────────────────────────────
let carouselIndex = 0;
let carouselItems = [];
let carouselTimer = null;
let carouselDrag = { isDown: false, startX: 0, startTranslate: 0, moved: false };  // estado para drag manual

function TB_getCarouselVisible() {
  const w = window.innerWidth;
  if (w <= 600) return 2;
  if (w <= 900) return 3;
  return 4;
}

function TB_renderCarousel(list) {
  const track = document.getElementById("carouselTrack");
  if (!track) return;

  carouselItems = list;
  carouselIndex = 0;

  const cardHTML = p => {
    const imgHTML = (p.imagenes && p.imagenes.length > 0)
      ? `<img src="${p.imagenes[0]}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const iconDisplay = (p.imagenes && p.imagenes.length > 0) ? 'none' : 'flex';
    const sinStock = p.stock <= 0;
    const badge = sinStock ? '<div class="carousel-badge badge-agotado">Agotado</div>'
      : p.badge ? `<div class="carousel-badge badge-${p.badge}">${TB_badgeLabel(p.badge)}</div>`
      : '';
    return `
    <div class="carousel-card" data-id="${p.id}">
      ${badge}
      <div class="carousel-img" style="position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        ${imgHTML}
        <i class="fa-solid ${TB_iconForCat(p.cat)}" style="display:${iconDisplay};position:absolute;"></i>
      </div>
      <div class="carousel-info">
        <div class="carousel-brand">${p.brand}</div>
        <div class="carousel-name">${p.name}</div>
        <div class="carousel-price-row">
          <span class="carousel-price">C$${p.price}</span>
          ${p.old ? `<span class="carousel-old">C$${p.old}</span>` : ""}
        </div>
      </div>
    </div>`;
  };

  track.innerHTML = carouselItems.map(cardHTML).join("");

  track.querySelectorAll(".carousel-card").forEach(card => {
    card.addEventListener("click", () => {
      if (carouselDrag.moved) return;
      const id = Number(card.dataset.id);
      TB_navigate("producto.html?id=" + id);
    });
  });

  requestAnimationFrame(() => {
    TB_applyCarouselTransform();
  });

  TB_startCarouselAutoScroll();
  TB_setupCarouselDrag();
}

function TB_startCarouselAutoScroll() {
  TB_stopCarouselAutoScroll();
  carouselTimer = setInterval(() => {
    const max = TB_getCarouselMax();
    if (carouselIndex >= max) { carouselIndex = 0; }
    else { carouselIndex++; }
    TB_applyCarouselTransform();
  }, 4500);
}

function TB_stopCarouselAutoScroll() {
  if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
}

function TB_getCarouselMax() {
  return Math.max(0, carouselItems.length - TB_getCarouselVisible());
}

function TB_applyCarouselTransform() {
  const track = document.getElementById("carouselTrack");
  if (!track) return;
  const firstCard = track.querySelector(".carousel-card");
  if (!firstCard) return;
  const cardWidth = firstCard.offsetWidth + 16;
  track.style.transform = `translateX(-${carouselIndex * cardWidth}px)`;
}

function TB_getCardWidth() {
  const track = document.getElementById("carouselTrack");
  if (!track) return 0;
  const card = track.querySelector(".carousel-card");
  return card ? card.offsetWidth + 16 : 0;
}

function TB_getTranslateX() {
  const track = document.getElementById("carouselTrack");
  if (!track) return 0;
  const m = track.style.transform.match(/translateX\((-?\d+)/);
  return m ? Math.abs(Number(m[1])) : 0;
}

function TB_setupCarouselDrag() {
  const wrap = document.getElementById("carouselTrackWrap");
  const track = document.getElementById("carouselTrack");
  if (!wrap || !track) return;

  wrap.addEventListener("pointerdown", e => {
    TB_stopCarouselAutoScroll();
    carouselDrag.isDown = true;
    carouselDrag.moved = false;
    carouselDrag.startX = e.pageX;
    carouselDrag.startTranslate = TB_getTranslateX();
    track.style.transition = "none";
    wrap.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  wrap.addEventListener("pointermove", e => {
    if (!carouselDrag.isDown) return;
    e.preventDefault();
    const deltaX = e.pageX - carouselDrag.startX;
    const cardWidth = TB_getCardWidth();
    if (!cardWidth) return;
    const maxTranslate = TB_getCarouselMax() * cardWidth;
    let newTranslate = carouselDrag.startTranslate - deltaX;
    newTranslate = Math.max(0, Math.min(maxTranslate, newTranslate));
    if (Math.abs(deltaX) > 5) carouselDrag.moved = true;
    track.style.transition = "none";
    track.style.transform = `translateX(-${newTranslate}px)`;
  });

  function TB_carouselEndDrag() {
    if (!carouselDrag.isDown) return;
    carouselDrag.isDown = false;
    const cardWidth = TB_getCardWidth();
    if (cardWidth && carouselDrag.moved) {
      const currentTranslate = TB_getTranslateX();
      carouselIndex = Math.round(currentTranslate / cardWidth);
      carouselIndex = Math.max(0, Math.min(TB_getCarouselMax(), carouselIndex));
    }
    track.style.transition = "transform .5s cubic-bezier(.25,.46,.45,.94)";
    TB_applyCarouselTransform();
    TB_startCarouselAutoScroll();
    setTimeout(() => { carouselDrag.moved = false; }, 0);
  }

  wrap.addEventListener("pointerup", e => {
    wrap.releasePointerCapture(e.pointerId);
    TB_carouselEndDrag();
  });

  wrap.addEventListener("pointerleave", e => {
    TB_carouselEndDrag();
  });

  wrap.addEventListener("dragstart", e => e.preventDefault());
}

// ─── PRODUCTOS DESDE API ─────────────────────────────────────
// TB_PRODUCTS se usa como caché en memoria; se carga desde la API al iniciar.
let TB_productsLoaded = false;

function TB_normalizeProduct(p) {
  return {
    id:    p.id,
    name:  p.name,
    brand: p.brand   ?? '',
    cat:   p.cat     ?? 'otros',
    price: parseFloat(p.price  ?? 0),
    old:   p.old != null ? parseFloat(p.old) : null,
    badge: p.badge   ?? null,
    stock: p.stock   ?? 0,
    imagenes: p.imagenes || [],
    description: p.description ?? '',
  };
}

async function TB_loadProductsFromAPI() {
  if (TB_productsLoaded) return;
  try {
    const data = await TB_api.get('/productos?limit=500');
    // La API puede devolver { productos: [...] } o directamente un array
    const raw = Array.isArray(data) ? data : (data.products ?? data.productos ?? data.items ?? []);
    if (raw.length > 0) {
      TB_PRODUCTS.length = 0; // vaciar el array en sitio para no romper referencias
      raw.map(TB_normalizeProduct).forEach(p => TB_PRODUCTS.push(p));
      TB_productsLoaded = true;
      // Limpiar carrito: eliminar items con IDs que ya no existen en la BD
      const validIds = new Set(TB_PRODUCTS.map(p => p.id));
      const before = TB_cart.length;
      TB_cart = TB_cart.filter(i => validIds.has(i.id));
      if (TB_cart.length !== before) {
        TB_saveCart();
        TB_updateCartUI();
      }
    }
  } catch(e) {
    console.warn('No se pudo cargar productos desde la API, usando datos locales:', e.message);
  }
}

// ─── PÁGINA: INICIO ──────────────────────────────────────────
async function TB_renderInicio() {
  // Mostrar skeleton mientras carga
  const carouselTrack = document.getElementById('carouselTrack');
  const inicioGrid    = document.getElementById('inicio-grid');
  if (carouselTrack) carouselTrack.innerHTML = '<div style="padding:20px;color:var(--muted)">Cargando productos…</div>';
  if (inicioGrid)    inicioGrid.innerHTML    = '<div style="padding:20px;color:var(--muted)">Cargando productos…</div>';

  await TB_loadProductsFromAPI();

  // Carrusel de "Destacados": usar todos los productos de la BD (con imágenes)
  // ordenados aleatoriamente. Solo productos con imagenes al frente.
  const featured = [...TB_PRODUCTS].sort((a, b) => {
    const aHasImg = a.imagenes && a.imagenes.length > 0 ? 1 : 0;
    const bHasImg = b.imagenes && b.imagenes.length > 0 ? 1 : 0;
    return bHasImg - aHasImg || Math.random() - 0.5;
  });
  TB_renderCarousel(featured);
  TB_renderGrid('inicio-grid', TB_PRODUCTS);
}

// ─── PÁGINA: CATÁLOGO ────────────────────────────────────────
async function TB_renderCatalogo() {
  if (!TB_productsLoaded) await TB_loadProductsFromAPI();
  TB_renderCats("cat-cats", state.catalogo.cat, cat => {
    state.catalogo.cat = cat;
    TB_applyCatalogoFilters();
  });
  const catSearchEl = document.getElementById("cat-search");
  if (catSearchEl) catSearchEl.value = state.catalogo.search;
  document.getElementById("cat-sort").value   = state.catalogo.sort;
  TB_applyCatalogoFilters();
}

function TB_applyCatalogoFilters() {
  let list = TB_filterProducts(TB_PRODUCTS, state.catalogo.cat, state.catalogo.search);
  if (state.catalogo.sort === "price-asc")  list = [...list].sort((a,b) => a.price - b.price);
  if (state.catalogo.sort === "price-desc") list = [...list].sort((a,b) => b.price - a.price);
  const el = document.getElementById("cat-count");
  if (el) el.textContent = `${list.length} producto${list.length !== 1 ? "s" : ""} encontrado${list.length !== 1 ? "s" : ""}`;
  TB_renderGrid("cat-grid", list);
  TB_renderCats("cat-cats", state.catalogo.cat, cat => {
    state.catalogo.cat = cat;
    TB_applyCatalogoFilters();
  });
}

// ─── PÁGINA: OFERTAS ─────────────────────────────────────────
async function TB_renderOfertas() {
  if (!TB_productsLoaded) await TB_loadProductsFromAPI();
  const list = TB_filterProducts(TB_PRODUCTS.filter(p => p.old), state.ofertas.cat, state.ofertas.search);
  const el = document.getElementById("oferta-count");
  if (el) el.textContent = `${list.length} oferta${list.length !== 1 ? "s" : ""} disponible${list.length !== 1 ? "s" : ""}`;
  TB_renderGrid("oferta-grid", list);
}

// ─── CHECKOUT ─────────────────────────────────────────────────
let checkoutDiscount = 0;
let checkoutCouponCode = "";

let chkSelectedCard = null; // null = nueva tarjeta, o objeto {type,last4,expiry,cvv}

function TB_openCheckoutModal() {
  document.getElementById("checkoutOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  checkoutDiscount = 0;
  checkoutCouponCode = "";
  chkSelectedCard = null;
  document.getElementById("chkCoupon").value = "";
  document.getElementById("chkCouponMsg").textContent = "";
  document.getElementById("chkCouponMsg").className = "chk-coupon-msg";
  document.getElementById("chkDiscountRow").style.display = "none";
  document.getElementById("chkTel").value = TB_currentUser?.tel || "";
  document.getElementById("chkCity").value = "";
  document.getElementById("chkDept").value = "";
  document.getElementById("chkZip").value = "";
  document.getElementById("chkAddress").value = "";
  document.getElementById("chkCard").value = "";
  document.getElementById("chkCVV").value = "";
  document.getElementById("chkExpiry").value = "";
  document.getElementById("chkSaveCard").checked = false;
  document.querySelectorAll("#checkoutForm .acct-input-wrap input").forEach(i => {
    const errEl = i.parentElement.querySelector(".error-msg");
    if (errEl) errEl.remove();
    i.classList.remove("error");
  });
  TB_renderCheckoutSummary();
  TB_chkLoadSavedCards();
}

function TB_closeCheckoutModal() {
  document.getElementById("checkoutOverlay").classList.remove("open");
  document.body.style.overflow = "";
}

function TB_setupPhoneInput(input) {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 8);
    TB_clearInputError(input.id);
  });
}

function TB_setupCVVInput(input) {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 4);
    TB_clearInputError(input.id);
  });
}

function TB_setupExpiryInput(input) {
  input.addEventListener("input", () => {
    let v = input.value.replace(/[^\d/]/g, "");
    const idx = v.indexOf("/");
    if (idx >= 0) {
      let mm = v.substring(0, idx).replace(/\D/g, "").slice(0, 2);
      let yy = v.substring(idx + 1).replace(/\D/g, "").slice(0, 2);
      v = mm + "/" + yy;
    } else {
      v = v.replace(/\D/g, "").slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
    }
    input.value = v;
    TB_clearInputError(input.id);
  });
}

// ─── CARD TYPE DETECTION ─────────────────────────────────────
function TB_detectCardType(cardNumber) {
  const num = cardNumber.replace(/\s/g, "");
  if (!num) return null;
  const first = num[0];
  if (first === "4") return "visa";
  if (first === "5") return "mastercard";
  if (first === "3") return "amex";
  return null;
}

function TB_getCardTypeEmoji(type) {
  const map = { visa: "visa", mastercard: "mastercard", amex: "amex" };
  if (map[type]) return `<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/${map[type]}.svg" alt="${type}" class="tb-payment-icon">`;
  return "";
}

function TB_updateCardTypeIcon(inputEl, iconEl, hintEl) {
  const raw = inputEl.value.replace(/\s/g, "");
  const type = TB_detectCardType(raw);

  if (type) {
    iconEl.innerHTML = TB_getCardTypeEmoji(type);
    iconEl.className = "card-type-icon " + type;
    if (hintEl) {
      if (type === "visa") hintEl.textContent = "Visa";
      else if (type === "mastercard") hintEl.textContent = "Mastercard";
      else if (type === "amex") hintEl.textContent = "American Express (15 dígitos)";
    }
  } else {
    iconEl.textContent = "";
    iconEl.className = "card-type-icon";
    if (hintEl) hintEl.textContent = raw.length >= 1 ? "Tipo no reconocido" : "Ingresa el número";
  }
}

function TB_setupCardInputWithTypeDetection(input, iconEl, hintEl) {
  input.addEventListener("input", () => {
    let raw = input.value.replace(/\D/g, "");
    const first = raw[0];
    let val;

    if (first === "3") {
      // Amex: 4-6-5 format (15 digits)
      raw = raw.slice(0, 15);
      val = raw.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) => {
        let formatted = a;
        if (b) formatted += " " + b;
        if (c) formatted += " " + c;
        return formatted.trim();
      });
      input.value = val;
    } else {
      // Visa/Mastercard: 4-4-4-4 format (16 digits)
      raw = raw.slice(0, 16);
      if (raw.length > 4) val = raw.match(/.{1,4}/g).join(" ");
      else val = raw;
      input.value = val;
    }
    TB_clearInputError(input.id);
    TB_updateCardTypeIcon(input, iconEl, hintEl);
  });
}

function TB_renderCheckoutSummary() {
  const list = document.getElementById("chkItems");
  const total = document.getElementById("chkTotal");
  if (!list || !total) return;
  list.innerHTML = TB_cart.map(i => `
    <div class="chk-item">
      <span class="chk-item-name">${i.emoji} ${i.name} <span class="chk-item-qty">x${i.qty}</span></span>
      <span class="chk-item-price">C$${(i.price * i.qty).toFixed(2)}</span>
    </div>`).join("");
  total.textContent = "C$" + TB_cartTotalIva().toFixed(2);
}

function TB_handleCheckoutSubmit(e) {
  e.preventDefault();
  const fields = ["chkTel","chkCity","chkDept","chkZip","chkAddress","chkCard","chkCVV","chkExpiry"];
  fields.forEach(TB_clearInputError);

  const tel      = document.getElementById("chkTel").value.trim();
  const city     = document.getElementById("chkCity").value.trim();
  const dept     = document.getElementById("chkDept").value.trim();
  const zip      = document.getElementById("chkZip").value.trim();
  const address  = document.getElementById("chkAddress").value.trim();
  // Si hay tarjeta guardada seleccionada, usarla; si no, leer campos nuevos
  let card, cvv, expiry, cardType, saveCard;
  if (chkSelectedCard) {
    card     = "xxxxxxxxxxxx" + chkSelectedCard.last4; // número enmascarado
    cvv      = chkSelectedCard.cvv || "***";
    expiry   = chkSelectedCard.expiry;
    cardType = chkSelectedCard.type;
    saveCard = false;
  } else {
    card     = document.getElementById("chkCard").value.replace(/\s/g, "");
    cvv      = document.getElementById("chkCVV").value.trim();
    expiry   = document.getElementById("chkExpiry").value.trim();
    saveCard = document.getElementById("chkSaveCard").checked;
    cardType = TB_detectCardType(card);
  }

  const expectedLen = cardType === "amex" ? 15 : 16;
  const expectedCVV = cardType === "amex" ? 4 : 3;

  let valid = true;
  if (!tel || !TB_isValidPhone(tel)) { TB_setInputError("chkTel", "8 digitos numericos"); valid = false; }
  if (!city)    { TB_setInputError("chkCity", "Requerido"); valid = false; }
  if (!dept)    { TB_setInputError("chkDept", "Requerido"); valid = false; }
  if (!zip)     { TB_setInputError("chkZip", "Requerido"); valid = false; }
  if (!address) { TB_setInputError("chkAddress", "Requerido"); valid = false; }

  if (!chkSelectedCard) {
    if (!cardType)                          { TB_setInputError("chkCard", "Solo Visa, Mastercard o Amex"); valid = false; }
    else if (card.length < expectedLen)     { TB_setInputError("chkCard", cardType === "amex" ? "15 digitos" : "16 digitos requeridos"); valid = false; }
    if (!cvv || cvv.length < expectedCVV)  { TB_setInputError("chkCVV", expectedCVV + " digitos"); valid = false; }
    if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) { TB_setInputError("chkExpiry", "MM/YY"); valid = false; }
  }
  if (!valid) return;

  if (saveCard && !chkSelectedCard && TB_currentUser) {
    const savedCards = JSON.parse(localStorage.getItem("techbuy_saved_cards_" + TB_currentUser.email) || "[]");
    if (!savedCards.find(c => c.last4 === card.slice(-4))) {
      savedCards.push({ type: cardType || "unknown", last4: card.slice(-4), expiry });
      localStorage.setItem("techbuy_saved_cards_" + TB_currentUser.email, JSON.stringify(savedCards));
    }
  }

  TB_showToast('<i class="fa-regular fa-credit-card"></i>', "Procesando tu pago…");
  setTimeout(() => {
    const orderId = Date.now().toString().slice(-6);
    const order = {
      id: orderId,
      date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }),
      items: TB_cart.map(i => i.qty + "x " + i.name),
      total: TB_cartTotal(),
      status: "pendiente",
      statusLabel: "Pendiente"
    };
    const orders = JSON.parse(localStorage.getItem("techbuy_orders_" + TB_currentUser.email) || "[]");
    orders.unshift(order);
    localStorage.setItem("techbuy_orders_" + TB_currentUser.email, JSON.stringify(orders));
    TB_cart = [];
    TB_saveCart();
    TB_updateCartUI();
    TB_closeCheckoutModal();
    TB_navigate("carrito.html");
  }, 2000);
}

function TB_chkLoadSavedCards() {
  const section  = document.getElementById("chkSavedCardsSection");
  const newSect  = document.getElementById("chkNewCardSection");
  const listEl   = document.getElementById("chkSavedCardsList");
  if (!section || !listEl) return;

  const cards = TB_currentUser
    ? JSON.parse(localStorage.getItem("techbuy_saved_cards_" + TB_currentUser.email) || "[]")
    : [];

  if (!cards.length) {
    // No saved cards — show only new card form
    section.style.display = "none";
    newSect.style.display = "block";
    return;
  }

  // Has saved cards — show selector, hide new form by default
  section.style.display = "block";
  newSect.style.display = "none";
  chkSelectedCard = null;

  const iconMap = { visa:"visa", mastercard:"mastercard", amex:"amex" };
  const names = { visa:"Visa", mastercard:"Mastercard", amex:"American Express" };

  listEl.innerHTML = cards.map((c, i) => `
    <div class="chk-saved-card" data-idx="${i}" onclick="TB_chkSelectCard(${i})">
      <div class="chk-saved-card-radio"><span class="chk-radio-dot"></span></div>
      ${iconMap[c.type] ? `<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/${iconMap[c.type]}.svg" alt="${c.type}" class="tb-payment-icon chk-card-brand-icon">` : `<i class="fa-solid fa-credit-card chk-card-brand-icon"></i>`}
      <div class="chk-saved-card-info">
        <span class="chk-saved-card-name">${names[c.type] || "Tarjeta"} •••• ${c.last4}</span>
        <span class="chk-saved-card-exp">Vence ${c.expiry}</span>
      </div>
    </div>`).join("") +
    `<div class="chk-saved-card" data-idx="new" onclick="TB_chkSelectNewCard()">
      <div class="chk-saved-card-radio"><span class="chk-radio-dot"></span></div>
      <i class="fa-solid fa-plus chk-card-brand-icon" style="color:var(--blue)"></i>
      <div class="chk-saved-card-info">
        <span class="chk-saved-card-name">Usar otra tarjeta</span>
        <span class="chk-saved-card-exp">Ingresar nueva tarjeta</span>
      </div>
    </div>`;

  // Auto-select first card
  TB_chkSelectCard(0);
}

function TB_chkSelectCard(idx) {
  const cards = TB_currentUser
    ? JSON.parse(localStorage.getItem("techbuy_saved_cards_" + TB_currentUser.email) || "[]")
    : [];
  chkSelectedCard = cards[idx] || null;

  // Update UI
  document.querySelectorAll(".chk-saved-card").forEach((el, i) => {
    el.classList.toggle("selected", i === idx);
  });
  document.getElementById("chkNewCardSection").style.display = "none";
}

function TB_chkSelectNewCard() {
  chkSelectedCard = null;
  document.querySelectorAll(".chk-saved-card").forEach((el, i) => {
    const isNew = el.dataset.idx === "new";
    el.classList.toggle("selected", isNew);
  });
  document.getElementById("chkNewCardSection").style.display = "block";
  document.getElementById("chkCard").focus();
}

window.TB_chkSelectCard = TB_chkSelectCard;
window.TB_chkSelectNewCard = TB_chkSelectNewCard;

function TB_setupCheckoutModal() {
  document.getElementById("chkClose").addEventListener("click", TB_closeCheckoutModal);
  document.getElementById("checkoutForm").addEventListener("submit", TB_handleCheckoutSubmit);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.getElementById("checkoutOverlay").classList.contains("open")) {
      TB_closeCheckoutModal();
    }
  });

  TB_setupPhoneInput(document.getElementById("chkTel"));
  const cardIconEl = document.getElementById("checkoutCardIcon");
  const cardHintEl = document.getElementById("checkoutCardHint");
  TB_setupCardInputWithTypeDetection(document.getElementById("chkCard"), cardIconEl, cardHintEl);
  TB_setupCVVInput(document.getElementById("chkCVV"));
  TB_setupExpiryInput(document.getElementById("chkExpiry"));
}

// ─── HERO ADS BANNER AUTO-SCROLL ────────────────────────
let heroAdsIndex = 0;
let heroAdsCount = 0;
let heroAdsTimer = null;

function TB_renderHeroAdsDots() {
  const container = document.getElementById("heroAdsDots");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < heroAdsCount; i++) {
    const dot = document.createElement("div");
    dot.className = "hero-ads-dot" + (i === heroAdsIndex ? " active" : "");
    dot.addEventListener("click", () => TB_goToHeroAd(i));
    container.appendChild(dot);
  }
}

function TB_goToHeroAd(index) {
  heroAdsIndex = index;
  const slide = document.getElementById("heroAdsSlide");
  if (slide) slide.style.transform = `translateX(-${heroAdsIndex * 100}%)`;
  TB_renderHeroAdsDots();
  TB_resetHeroAdsTimer();
}

function TB_nextHeroAd() {
  heroAdsIndex = (heroAdsIndex + 1) % Math.max(1, heroAdsCount);
  TB_goToHeroAd(heroAdsIndex);
}

function TB_resetHeroAdsTimer() {
  clearInterval(heroAdsTimer);
  heroAdsTimer = setInterval(TB_nextHeroAd, 8000);
}

async function TB_setupHeroAdsBanner() {
  const slide = document.getElementById("heroAdsSlide");
  const track = document.getElementById("heroAdsTrack");

  // Intentar cargar slides del carrusel desde la API (admin los configura)
  try {
    const apiSlides = await TB_api.get('/carrusel');
    if (apiSlides && apiSlides.length > 0) {
      // Reemplazar slides del HTML con los de la BD
      if (slide) {
        slide.innerHTML = apiSlides.map(s => `
          <div class="hero-ads-item">
            <div class="hero-ads-img">
              <img src="${s.url}" alt="${s.titulo || 'Anuncio'}"
                   onerror="this.style.display='none'">
            </div>
            <div class="hero-ads-content">
              ${s.titulo    ? `<h1 class="hero-ads-title">${s.titulo}</h1>` : ''}
              ${s.subtitulo ? `<p class="hero-ads-desc">${s.subtitulo}</p>` : ''}
              ${s.btn_texto && s.btn_url ? `<a href="${s.btn_url}" class="hero-ads-btn"><i class="fa-solid fa-arrow-right"></i> ${s.btn_texto}</a>` : ''}
            </div>
          </div>`).join('');
      }
    }
  } catch(e) {
    // Si la API falla, ocultar el carrusel
    const wrap = document.querySelector('.hero-ads-wrap');
    if (wrap) wrap.style.display = 'none';
    return;
  }

  if (slide) heroAdsCount = slide.querySelectorAll(".hero-ads-item").length;
  if (heroAdsCount > 0) {
    TB_renderHeroAdsDots();
    TB_resetHeroAdsTimer();
  }

  // Swipe on hero ads track
  if (track) {
    let startX = 0;
    track.addEventListener("pointerdown", e => { startX = e.clientX; });
    track.addEventListener("pointerup", e => {
      const delta = e.clientX - startX;
      if (Math.abs(delta) > 50) {
        if (delta > 0) {
          heroAdsIndex = (heroAdsIndex - 1 + heroAdsCount) % heroAdsCount;
        } else {
          heroAdsIndex = (heroAdsIndex + 1) % heroAdsCount;
        }
        TB_goToHeroAd(heroAdsIndex);
      }
    });
  }
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Unified header (shared across all pages) ──
  TB_loadCart();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupNavLinks();
  TB_setupAccountBtn();

  // ── Session ──
  TB_loadSession();

  // ── Checkout modal ──
  TB_setupCheckoutModal();

  // ── Render inicial ──
  TB_setupHeroAdsBanner();
  // Leer parametro ?page= para navegacion desde paginas externas
  const _initParams = new URLSearchParams(window.location.search);
  const _initPage   = _initParams.get('page');
  const _validPages = ['inicio','catalogo','ofertas','contacto'];
  TB_navigateTo(_validPages.includes(_initPage) ? _initPage : 'inicio');

  TB_updateCartUI();

  // ── Checkout button ──
  document.getElementById('btnCheckout')?.addEventListener('click', TB_openCheckoutModal);

  // ── Footer links ──
  document.querySelectorAll("[data-nav]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); TB_navigateTo(el.dataset.nav); });
  });
});
// Las funciones de auth (TB_openAuthModal, TB_closeAuthModal, switchAuthTab,
// handleLogin, handleRegister) están centralizadas en shared.js y se inyectan
// automáticamente en todas las páginas. No se duplican aquí.
