function navigateTo(pageId) { TB_navigateTo(pageId); }

const state = {
  inicio:  { page: 1 },
  catalogo: { cat: "all", search: "", sort: "default", page: 1 },
  ofertas:  { cat: "all", search: "", page: 1 },
};

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

function TB_productCardHTML(p) {
  const imgHTML = (p.imagenes && p.imagenes.length > 0)
    ? `<img src="${p.imagenes[0]}" alt="${p.name}" width="260" height="200" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const iconDisplay = (p.imagenes && p.imagenes.length > 0) ? 'none' : 'flex';
  const badge = p.stock <= 0 ? '<div class="prod-badge badge-agotado">Agotado</div>'
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
            <span class="prod-price">${TB_formatPrice(p.price)}</span>
            ${p.old ? `<span class="prod-old">${TB_formatPrice(p.old)}</span>` : ""}
          </div>
          ${TB_cartCardControls(p)}
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
  container.addEventListener("click", TB_cardGridClickHandler);
}

function TB_renderCats(containerId, activeCat, onChange) {
  const container = document.getElementById(containerId);
  const all = [{ key:"all", icon:'fa-solid fa-store', label:"Todo" }];
  container.innerHTML = all.concat(TB_CATS).map(c => `
    <button class="cat-btn ${c.key === activeCat ? "active" : ""}" data-cat="${c.key}">
      <span class="cat-icon">${c.icon}</span>
      <span class="cat-label">${c.label}</span>
    </button>`).join("");
  container.querySelectorAll(".cat-btn").forEach(btn => {
    btn.addEventListener("click", () => onChange(btn.dataset.cat));
  });
}

let carouselIndex = 0;
let carouselItems = [];
let carouselTimer = null;
let carouselDrag = { isDown: false, startX: 0, startTranslate: 0, moved: false, touchHandled: false };

function TB_getCarouselVisible() {
  const w = window.innerWidth;
  if (w <= 600) return 2;
  if (w <= 900) return 3;
  return 4;
}

async function TB_renderCarousel(list) {
  const track = document.getElementById("carouselTrack");
  if (!track) return;

  if (!list) {
    try {
      const data = await TB_fetchJSON('/productos/destacados');
      const raw = Array.isArray(data) ? data : (data.products ?? []);
      TB_cacheProductList(raw);
      list = raw;
    } catch (e) {
      console.warn('Error al refrescar carrusel:', e.message);
      return;
    }
  }

  carouselItems = list;
  carouselIndex = 0;

  const cardHTML = p => {
    const imgHTML = (p.imagenes && p.imagenes.length > 0)
      ? `<img src="${p.imagenes[0]}" alt="${p.name}" width="260" height="200" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
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
        <div class="carousel-bottom">
          <div class="carousel-price-row">
            <span class="carousel-price">${TB_formatPrice(p.price)}</span>
            ${p.old ? `<span class="carousel-old">${TB_formatPrice(p.old)}</span>` : ""}
          </div>
          ${TB_cartCardControls(p)}
        </div>
      </div>
    </div>`;
  };

  track.innerHTML = carouselItems.map(cardHTML).join("");
  track.addEventListener("click", TB_cardGridClickHandler);

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
    carouselDrag.tapTarget = e.target;
    wrap.setPointerCapture(e.pointerId);
  });

  wrap.addEventListener("pointermove", e => {
    if (!carouselDrag.isDown) return;
    const deltaX = e.pageX - carouselDrag.startX;
    const cardWidth = TB_getCardWidth();
    if (!cardWidth) return;
    const maxTranslate = TB_getCarouselMax() * cardWidth;
    let newTranslate = carouselDrag.startTranslate - deltaX;
    newTranslate = Math.max(0, Math.min(maxTranslate, newTranslate));
    if (Math.abs(deltaX) > 5) { e.preventDefault(); carouselDrag.moved = true; }
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
    const wasMoved = carouselDrag.moved;
    TB_carouselEndDrag();
    if (!wasMoved) {
      const el = carouselDrag.tapTarget;
      const card = el?.closest(".carousel-card");
      if (!card) return;
      if (e.pointerType === 'mouse' && carouselDrag.touchHandled) {
        carouselDrag.touchHandled = false;
        return;
      }
      const btnAdd = el.closest(".btn-add");
      const btnQty = el.closest(".btn-qty");
      const btnRemove = el.closest(".btn-remove");
      if (btnAdd) { const id = Number(btnAdd.dataset.id); if (!btnAdd.disabled) { if (e.pointerType === 'touch') carouselDrag.touchHandled = true; TB_addToCart(id, 1); } return; }
      if (btnQty) { const id = Number(btnQty.dataset.id); const d = Number(btnQty.dataset.d); if (e.pointerType === 'touch') carouselDrag.touchHandled = true; TB_changeQty(id, d); return; }
      if (btnRemove) { const id = Number(btnRemove.dataset.id); if (e.pointerType === 'touch') carouselDrag.touchHandled = true; TB_removeFromCart(id); return; }
      TB_navigate("producto.html?id=" + Number(card.dataset.id));
    }
  });

  wrap.addEventListener("pointerleave", e => {
    TB_carouselEndDrag();
  });

  wrap.addEventListener("dragstart", e => e.preventDefault());
}

async function TB_fetchJSON(url) {
  const res = await fetch('/api/store' + url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function renderInicioGrid(products) {
  const grid = document.getElementById('inicio-grid');
  if (!grid) return;
  TB_cacheProductList(products);
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / TB_PAGE_SIZE));
  const start = (state.inicio.page - 1) * TB_PAGE_SIZE;
  const pageItems = products.slice(start, start + TB_PAGE_SIZE);

  TB_renderGrid('inicio-grid', pageItems);

  TB_renderPagination({
    container: grid,
    currentPage: state.inicio.page,
    totalPages: totalPages,
    onPageChange: (page) => {
      state.inicio.page = page;
      renderInicioGrid(products);
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    containerId: 'inicioPagination'
  });
}

async function TB_renderInicio() {
  const carouselTrack = document.getElementById('carouselTrack');
  const inicioGrid    = document.getElementById('inicio-grid');
  if (carouselTrack) carouselTrack.innerHTML = '<div style="padding:20px;color:var(--muted)">Cargando\u2026</div>';
  if (inicioGrid)    inicioGrid.innerHTML    = TB_SKELETON_GRID;

  state.inicio.page = 1;

  TB_renderHeroAds();

  try {
    const [destacados, nuevos] = await Promise.all([
      TB_fetchJSON('/productos/destacados?limit=10'),
      TB_fetchJSON('/productos/nuevos?page=1&limit=50'),
    ]);

    if (Array.isArray(destacados)) {
      TB_cacheProductList(destacados);
      TB_renderCarousel(destacados);
    }

    if (nuevos && nuevos.products) {
      renderInicioGrid(nuevos.products);
    }
  } catch (e) {
    console.warn('Error cargando inicio:', e.message);
    if (inicioGrid) inicioGrid.innerHTML = '<div class="empty-state"><h3>Error al cargar</h3><p>Intenta de nuevo m\u00e1s tarde.</p></div>';
  }
}

let heroIndex = 0;
let heroTimer = null;

async function TB_renderHeroAds(data) {
  const slide = document.getElementById('heroAdsSlide');
  if (!slide) return;

  if (!data) {
    slide.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Cargando\u2026</div>';
    try {
      data = await TB_fetchJSON('/carrusel');
    } catch (e) {
      console.warn('Error cargando carrusel de im\u00e1genes:', e.message);
      slide.innerHTML = '';
      return;
    }
  }

  if (!Array.isArray(data) || !data.length) {
    slide.innerHTML = '';
    return;
  }

  heroIndex = 0;

  slide.innerHTML = data.map((item, i) => `
    <div class="hero-ads-item" data-index="${i}">
      <div class="hero-ads-img">
        <img src="${item.url}" alt="${item.titulo || ''}" loading="${i === 0 ? 'eager' : 'lazy'}" />
      </div>
      <div class="hero-ads-content">
        ${item.subtitulo ? `<div class="hero-ads-tag"><i class="fa-solid fa-tag"></i> ${item.subtitulo}</div>` : ''}
        ${item.titulo ? `<h2 class="hero-ads-title">${item.titulo}</h2>` : ''}
        ${item.btn_texto && item.btn_url ? `<a class="hero-ads-btn" href="${item.btn_url}"><i class="fa-solid fa-arrow-right"></i> ${item.btn_texto}</a>` : ''}
      </div>
      <div class="hero-ads-deco">TB</div>
    </div>
  `).join('');

  const dots = document.getElementById('heroAdsDots');
  if (dots) {
    dots.innerHTML = data.map((_, i) =>
      `<span class="hero-ads-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
    ).join('');
    dots.querySelectorAll('.hero-ads-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        TB_goToHeroSlide(parseInt(dot.dataset.index));
        TB_stopHeroAutoScroll();
        TB_startHeroAutoScroll();
      });
    });
  }

  TB_startHeroAutoScroll();
}

function TB_startHeroAutoScroll() {
  TB_stopHeroAutoScroll();
  heroTimer = setInterval(() => {
    const slide = document.getElementById('heroAdsSlide');
    if (!slide) return;
    const items = slide.querySelectorAll('.hero-ads-item');
    if (!items.length) return;
    TB_goToHeroSlide((heroIndex + 1) % items.length);
  }, 5000);
}

function TB_stopHeroAutoScroll() {
  if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
}

function TB_goToHeroSlide(index) {
  const slide = document.getElementById('heroAdsSlide');
  if (!slide) return;
  const items = slide.querySelectorAll('.hero-ads-item');
  if (!items.length) return;
  heroIndex = Math.max(0, Math.min(index, items.length - 1));
  slide.style.transform = 'translateX(-' + (heroIndex * 100) + '%)';
  const dots = document.getElementById('heroAdsDots');
  if (dots) {
    dots.querySelectorAll('.hero-ads-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === heroIndex);
    });
  }
}

async function TB_renderCatalogo() {
  if (!TB_CATS.length) await TB_loadCats();

  TB_renderCats("cat-cats", state.catalogo.cat, cat => {
    state.catalogo.cat = cat;
    state.catalogo.page = 1;
    TB_renderCatalogo();
  });

  const el = document.getElementById("cat-count");
  if (el) el.textContent = "Cargando\u2026";

  const params = new URLSearchParams();
  params.set('page', state.catalogo.page);
  params.set('limit', '12');
  if (state.catalogo.cat !== 'all') params.set('cat', state.catalogo.cat);
  if (state.catalogo.search) params.set('q', state.catalogo.search);
  if (state.catalogo.sort !== 'default') params.set('sort', state.catalogo.sort);

  try {
    const data = await TB_fetchJSON('/productos?' + params.toString());
    TB_cacheProductList(data.products);

    if (el) el.textContent = `${data.total} producto${data.total !== 1 ? "s" : ""} encontrado${data.total !== 1 ? "s" : ""}`;

    TB_renderGrid("cat-grid", data.products);

    TB_renderPagination({
      container: 'cat-grid',
      currentPage: data.page,
      totalPages: data.totalPages,
      onPageChange: (page) => {
        state.catalogo.page = page;
        TB_renderCatalogo();
        document.getElementById('cat-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      containerId: 'catalogoPagination'
    });
  } catch (e) {
    console.warn('Error cargando cat\u00e1logo:', e.message);
  }
}

function TB_applyCatalogoFilters() {
  state.catalogo.search = document.getElementById("cat-search")?.value.trim() || '';
  state.catalogo.sort = document.getElementById("cat-sort")?.value || 'default';
  state.catalogo.page = 1;
  TB_renderCatalogo();
}

async function TB_renderOfertas() {
  const el = document.getElementById("oferta-count");
  if (el) el.textContent = "Cargando\u2026";

  const params = new URLSearchParams();
  params.set('page', state.ofertas.page);
  params.set('limit', '12');
  if (state.ofertas.cat !== 'all') params.set('cat', state.ofertas.cat);

  try {
    const data = await TB_fetchJSON('/productos/ofertas?' + params.toString());
    TB_cacheProductList(data.products);

    if (el) el.textContent = `${data.total} oferta${data.total !== 1 ? "s" : ""} disponible${data.total !== 1 ? "s" : ""}`;

    TB_renderGrid("oferta-grid", data.products);

    TB_renderPagination({
      container: 'oferta-grid',
      currentPage: data.page,
      totalPages: data.totalPages,
      onPageChange: (page) => {
        state.ofertas.page = page;
        TB_renderOfertas();
        document.getElementById('oferta-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      containerId: 'ofertasPagination'
    });
  } catch (e) {
    console.warn('Error cargando ofertas:', e.message);
  }
}

let checkoutDiscount = 0;
let checkoutCouponCode = "";

let chkSelectedCard = null;

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
      else if (type === "amex") hintEl.textContent = "American Express (15 d\u00edgitos)";
    }
  } else {
    iconEl.textContent = "";
    iconEl.className = "card-type-icon";
    if (hintEl) hintEl.textContent = raw.length >= 1 ? "Tipo no reconocido" : "Ingresa el n\u00famero";
  }
}

function TB_setupCardInputWithTypeDetection(input, iconEl, hintEl) {
  input.addEventListener("input", () => {
    let raw = input.value.replace(/\D/g, "");
    const first = raw[0];
    let val;
    if (first === "3") {
      raw = raw.slice(0, 15);
      val = raw.replace(/(\d{4})(\d{0,6})(\d{0,5})/, (_, a, b, c) => { let f = a; if (b) f += ' ' + b; if (c) f += ' ' + c; return f.trim(); });
    } else {
      raw = raw.slice(0, 16);
      val = raw.length > 4 ? raw.match(/.{1,4}/g).join(' ') : raw;
    }
    input.value = val;
    const type = first === '4' ? 'visa' : first === '5' ? 'mastercard' : first === '3' ? 'amex' : null;
    if (type) { iconEl.innerHTML = TB_getCardTypeEmoji(type); iconEl.className = "card-type-icon " + type; hintEl.textContent = type.charAt(0).toUpperCase() + type.slice(1); }
    else { iconEl.textContent = ''; hintEl.textContent = raw.length >= 1 ? 'Tipo no reconocido' : '16 d\u00edgitos'; }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  await TB_loadCats();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();
  TB_renderInicio();
});
