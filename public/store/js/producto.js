/* ══════════════════════════════════════════════════════════════
   PRODUCT DETAIL PAGE — producto.js
══════════════════════════════════════════════════════════════ */

let pdpQty = 1;

// Simulated product images (gradients/icons per category since no real imgs)
const PDP_IMG_SETS = {
  adaptadores:  ["fa-plug","fa-usb","fa-cable-car","fa-power-off"],
  audio:        ["fa-headphones","fa-volume-high","fa-music","fa-microphone"],
  baterias:     ["fa-battery-full","fa-bolt","fa-charging-station","fa-power-off"],
  cargadores:   ["fa-charging-station","fa-bolt","fa-plug","fa-cable-car"],
  celulares:    ["fa-mobile-screen","fa-mobile","fa-tablet-screen-button","fa-sim-card"],
  computacion:  ["fa-laptop","fa-hard-drive","fa-microchip","fa-server"],
  gamer:        ["fa-gamepad","fa-keyboard","fa-headphones","fa-computer-mouse"],
  hogar:        ["fa-headphones","fa-tv","fa-camera","fa-plug"],
  mochilas:     ["fa-bag-shopping","fa-backpack","fa-suitcase","fa-laptop"],
  oficina:      ["fa-laptop","fa-desktop","fa-keyboard","fa-display"],
  otros:        ["fa-box","fa-tag","fa-circle-check","fa-star"],
};

function pdpSetMainIcon(icon, animate) {
  const el = document.getElementById("pdpMainImg");
  if (animate) {
    el.style.opacity = "0";
    el.style.transform = "scale(0.93)";
    setTimeout(() => {
      el.dataset.icon = icon;
      el.querySelector(".pdp-main-icon").className = "pdp-main-icon fa-solid " + icon;
      el.style.opacity = "1";
      el.style.transform = "scale(1)";
    }, 120);
  } else {
    el.dataset.icon = icon;
    el.querySelector(".pdp-main-icon").className = "pdp-main-icon fa-solid " + icon;
  }
}

async function toggleFavorite(p) {
  TB_loadSession();
  const favBtn = document.getElementById("pdpFavBtn");
  let favs = JSON.parse(localStorage.getItem("techbuy_favorites") || "[]");

  if (favs.includes(p.id)) {
    // ── Eliminar de favoritos ──────────────────────────────
    try {
      await TB_api.delete(`/favoritos/${p.id}`);
    } catch(e) {
      // Si no estaba en la BD, igual limpiamos localmente
    }
    favs = favs.filter(id => id !== p.id);
    favBtn.classList.remove("active");
    favBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    // Sincronizar botón overlay
    const overlayIcon = document.querySelector("#overlayFavBtn i");
    if (overlayIcon) overlayIcon.className = "fa-regular fa-heart";
    TB_showToast('<i class="fa-regular fa-heart"></i>', `"${p.name}" eliminado de favoritos`);
  } else {
    // ── Requiere login ─────────────────────────────────────
    if (!TB_currentUser) {
      TB_showToast('<i class="fa-solid fa-user"></i>', "Inicia sesión para guardar favoritos");
      setTimeout(() => { TB_navigate("perfil.html"); }, 1200);
      return;
    }
    // ── Agregar a favoritos via API ────────────────────────
    try {
      await TB_api.post('/favoritos', { id_producto: p.id });
    } catch(e) {
      TB_showToast('<i class="fa-solid fa-circle-exclamation"></i>', "Error al guardar favorito");
      return;
    }
    favs.push(p.id);
    favBtn.classList.add("active");
    favBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
    // Sincronizar botón overlay
    const overlayIcon = document.querySelector("#overlayFavBtn i");
    if (overlayIcon) overlayIcon.className = "fa-solid fa-heart";
    TB_showToast('<i class="fa-solid fa-heart" style="color:#ff2d8a"></i>', `"${p.name}" añadido a favoritos`);
  }

  // Actualizar localStorage como caché local
  localStorage.setItem("techbuy_favorites", JSON.stringify(favs));
}

window.toggleFavorite = toggleFavorite;

document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  TB_loadSession();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();
  TB_initLightbox();

  const params = new URLSearchParams(window.location.search);
  const productId = parseInt(params.get("id"));

  if (!productId) {
    document.getElementById("pdpName").textContent = "Producto no encontrado";
    document.getElementById("pdpBrand").textContent = "";
    return;
  }

  document.getElementById("pdpName").textContent = "Cargando...";
  let p = null;

  try {
    p = await TB_api.get('/productos/' + productId);
    if (p && p.id) {
      p.price = parseFloat(p.price ?? 0);
      p.old = p.old ? parseFloat(p.old) : null;
      p.stock = parseInt(p.stock) || 0;
      TB_cacheProduct(p);
    }
  } catch(e) {
    console.warn('Error cargando producto:', e.message);
  }

  if (!p) {
    document.getElementById("pdpName").textContent = "Producto no encontrado";
    document.getElementById("pdpBrand").textContent = "";
    return;
  }

  // Normalizar campos de la API
  if (p.nombre && !p.name) p.name = p.nombre;
  p.price = parseFloat(p.price ?? p.precio ?? 0);
  p.old = p.old || p.precio_anterior ? parseFloat(p.old || p.precio_anterior) : null;
  if (!p.description && p.descripcion) p.description = p.descripcion;

  // Read qty from cart if product already in it
  const cartItem = TB_cart.find(item => item.id === p.id);
  pdpQty = cartItem ? cartItem.qty : 1;
  document.getElementById("pdpQtyVal").textContent = pdpQty;

  // Breadcrumb
  document.getElementById("bcProductName").textContent = p.name;

  // Brand + Name
  document.getElementById("pdpBrand").textContent = p.brand;
  document.getElementById("pdpName").textContent = p.name;

  // SKU
  document.getElementById("pdpSku").textContent = "SKU: TB-" + String(p.id).padStart(6,"0") + "-" + p.cat.toUpperCase();

  // Pricing (precio base sin IVA — el IVA se suma en el carrito)
  document.getElementById("pdpPrice").textContent = TB_formatPrice(p.price);
  document.getElementById("pdpPriceBreakdown").innerHTML =
    `Precio base sin IVA · <span class="iva">+15% IVA en el carrito</span>`;

  if (p.old) {
    document.getElementById("pdpOldRow").innerHTML = `<span class="pdp-old">${TB_formatPrice(p.old)}</span>`;
    const saving = p.old - p.price;
    document.getElementById("pdpSaveRow").innerHTML =
      `<span class="pdp-save"><i class="fa-solid fa-tag"></i> AHORRAS ${TB_formatPrice(saving)}</span>`;
  }

  // Stock
  const sinStock = p.stock <= 0;
  document.getElementById("pdpStockText").textContent =
    sinStock ? "Agotado" : `En stock: ${p.stock} unidades disponibles`;
  document.getElementById("pdpAddCart").disabled = sinStock;
  document.getElementById("pdpBuyNow").disabled = sinStock;
  document.getElementById("pdpAddCart").innerHTML = sinStock
    ? '<i class="fa-solid fa-ban"></i> Agotado'
    : '<i class="fa-solid fa-cart-plus"></i> Agregar al carrito';

  // Description — usar la de la BD, con fallback generico
  const descs = {
    adaptadores:  "Adaptadores y conversores de alta calidad para todo tipo de dispositivos. Conexion estable y rapida.",
    audio:        "Sonido envolvente de alta fidelidad con cancelacion de ruido activa. Bateria de hasta 30 horas de reproduccion continua.",
    baterias:     "Baterias de alta capacidad con carga rapida y larga duracion. Compatibles con multiples dispositivos.",
    cargadores:   "Cargadores rapidos con tecnologia de carga inteligente. Seguros y eficientes para tus dispositivos.",
    celulares:    "Los ultimos modelos con pantalla AMOLED 120Hz, camara de alta resolucion y bateria de larga duracion con carga rapida.",
    computacion:  "Portatiles de alto rendimiento con pantallas de alta resolucion, ideales para desarrollo, diseno y gaming.",
    gamer:        "Equipamiento gaming profesional con iluminacion RGB personalizable, switches de alta precision y construccion reforzada.",
    hogar:        "Sonido envolvente de alta fidelidad con cancelacion de ruido activa. Bateria de hasta 30 horas de reproduccion continua.",
    mochilas:     "Mochilas ergonomicas con compartimentos acolchados para laptop. Material resistente al agua y cremalleras reforzadas.",
    oficina:      "Potente equipo de oficina con procesadores de ultima generacion, ideal para trabajo y productividad.",
    otros:        "Producto de alta calidad con garantia de fabricante. Diseno resistente y materiales premium.",
  };
  const descEl = document.getElementById("pdpDesc");
  descEl.textContent = p.description || descs[p.cat] || "Producto de alta calidad.";

  // ── EXPANDABLE DESCRIPTION ─────────────────────────────────────
  requestAnimationFrame(() => {
    const wrapper = document.getElementById("pdpDescWrapper");
    const toggle = document.getElementById("pdpDescToggle");
    if (!wrapper || !toggle) return;

    if (descEl.scrollHeight <= 120) {
      wrapper.style.maxHeight = "none";
      toggle.classList.add("hidden");
      return;
    }

    wrapper.classList.add("is-long");
    wrapper.style.maxHeight = "120px";
    toggle.classList.remove("hidden");
    let expanded = false;

    toggle.addEventListener("click", () => {
      expanded = !expanded;
      toggle.setAttribute("aria-expanded", expanded);

      if (expanded) {
        wrapper.style.maxHeight = descEl.scrollHeight + "px";
        wrapper.classList.remove("is-long");
        toggle.innerHTML = '<span>Ver menos</span><i class="fa-solid fa-chevron-up"></i>';
      } else {
        wrapper.style.maxHeight = "120px";
        wrapper.classList.add("is-long");
        toggle.innerHTML = '<span>Ver m&aacute;s</span><i class="fa-solid fa-chevron-down"></i>';
      }
    });
  });

  // ── IMAGE GALLERY ──────────────────────────────────────────────
  const icons = PDP_IMG_SETS[p.cat] || PDP_IMG_SETS.otros;
  const hasRealImages = p.imagenes && p.imagenes.length > 0;
  const mainImg = document.getElementById("pdpMainImg");

  if (hasRealImages) {
    mainImg.innerHTML = `
      <img id="pdpMainImgTag" src="${p.imagenes[0]}" alt="${p.name}" loading="lazy"
           onerror="this.style.display='none';document.getElementById('pdpMainImgIcon').style.display='flex'">
      <i id="pdpMainImgIcon" class="pdp-main-icon fa-solid ${icons[0]}" style="display:none;"></i>
      <div class="pdp-img-overlay">
        <button class="pdp-img-action fav" id="overlayFavBtn">
          <i class="fa-regular fa-heart"></i> Favoritos
        </button>
        <button class="pdp-img-action cart" onclick="TB_addToCart(${p.id}, pdpQty, true)">
          <i class="fa-solid fa-cart-plus"></i> Agregar
        </button>
      </div>`;

    document.getElementById('pdpMainImgTag').addEventListener('click', () => {
      TB_openZoom(p.imagenes, 0);
    });

    const thumbsEl = document.getElementById("pdpThumbs");
    thumbsEl.innerHTML = p.imagenes.map((url, i) => `
      <div class="pdp-thumb ${i === 0 ? 'active' : ''}" data-url="${url}" data-idx="${i}">
        <img src="${url}" alt="Imagen ${i+1}" loading="lazy" style="width:100%;height:100%;object-fit:contain;"
             onerror="this.parentElement.innerHTML='<i class=\'fa-solid ${icons[Math.min(i,icons.length-1)]}\'></i>'">
      </div>`).join("");

    thumbsEl.querySelectorAll(".pdp-thumb").forEach(thumb => {
      const activate = () => {
        const active = document.querySelector(".pdp-thumb.active");
        if (active === thumb) return;
        active?.classList.remove("active");
        thumb.classList.add("active");
        const imgTag = document.getElementById("pdpMainImgTag");
        if (imgTag) { imgTag.style.opacity="0"; setTimeout(()=>{ imgTag.src=thumb.dataset.url; imgTag.style.opacity="1"; },120); }
        TB_setZoomIndex(parseInt(thumb.dataset.idx));
      };
      thumb.addEventListener("mouseenter", activate);
      thumb.addEventListener("click", activate);
    });

  } else {
    // Fallback: íconos FontAwesome
    mainImg.innerHTML = `
      <i class="pdp-main-icon fa-solid ${icons[0]}"></i>
      <div class="pdp-img-overlay">
        <button class="pdp-img-action fav" id="overlayFavBtn">
          <i class="fa-regular fa-heart"></i> Favoritos
        </button>
        <button class="pdp-img-action cart" onclick="TB_addToCart(${p.id}, pdpQty, true)">
          <i class="fa-solid fa-cart-plus"></i> Agregar
        </button>
      </div>`;

    const thumbsEl = document.getElementById("pdpThumbs");
    thumbsEl.innerHTML = icons.map((icon, i) => `
      <div class="pdp-thumb ${i === 0 ? 'active' : ''}" data-icon="${icon}" data-idx="${i}">
        <i class="fa-solid ${icon}"></i>
      </div>`).join("");

    thumbsEl.querySelectorAll(".pdp-thumb").forEach(thumb => {
      const activate = () => {
        thumbsEl.querySelectorAll(".pdp-thumb").forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");
        pdpSetMainIcon(thumb.dataset.icon, true);
      };
      thumb.addEventListener("mouseenter", activate);
      thumb.addEventListener("click", activate);
    });
  }

  // Overlay fav button (if present)
  const overlayFav = document.getElementById("overlayFavBtn");
  if (overlayFav) {
    overlayFav.addEventListener("click", e => {
      e.stopPropagation();
      toggleFavorite(p);
    });
  }

  // ── FAVORITE BUTTON (top right) ────────────────────────────────
  const favs = JSON.parse(localStorage.getItem("techbuy_favorites") || "[]");
  const favBtn = document.getElementById("pdpFavBtn");
  if (favs.includes(p.id)) {
    favBtn.classList.add("active");
    favBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
  }
  // Verificar estado real desde la API si el usuario está logueado
  if (TB_currentUser) {
    TB_api.get('/favoritos').then(apiFavs => {
      const ids = apiFavs.map(f => f.id || f.id_producto);
      const isFav = ids.includes(p.id);
      // Sincronizar localStorage con la BD
      let localFavs = JSON.parse(localStorage.getItem("techbuy_favorites") || "[]");
      if (isFav && !localFavs.includes(p.id)) {
        localFavs.push(p.id);
        localStorage.setItem("techbuy_favorites", JSON.stringify(localFavs));
      } else if (!isFav && localFavs.includes(p.id)) {
        localFavs = localFavs.filter(id => id !== p.id);
        localStorage.setItem("techbuy_favorites", JSON.stringify(localFavs));
      }
      // Actualizar UI
      if (isFav) {
        favBtn.classList.add("active");
        favBtn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      } else {
        favBtn.classList.remove("active");
        favBtn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      }
    }).catch(() => {});
  }
  favBtn.addEventListener("click", () => toggleFavorite(p));

  // Mobile: move actions (share + fav) to gallery overlay
  if (window.innerWidth <= 600) {
    const gallery = document.querySelector(".pdp-gallery");
    const topRow = document.querySelector(".pdp-top-row");
    if (gallery && topRow) { gallery.appendChild(topRow); }
  }

  // ── SHARE BUTTON ──────────────────────────────────────────────
  const shareBtn = document.getElementById("pdpShareBtn");
  const shareMenu = document.getElementById("pdpShareMenu");
  shareBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const url = window.location.href;
    const title = document.getElementById("pdpName")?.textContent || "TechBuy";
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      shareMenu.classList.toggle("show");
    }
  });
  shareMenu.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent(document.getElementById("pdpName")?.textContent || "");
      const action = btn.dataset.action;
      const links = {
        copy: () => navigator.clipboard?.writeText(decodeURIComponent(url)),
        whatsapp: () => window.open(`https://wa.me/?text=${text}%20${url}`),
        facebook: () => window.open(`https://facebook.com/sharer/sharer.php?u=${url}`),
        telegram: () => window.open(`https://t.me/share/url?url=${url}&text=${text}`),
      };
      links[action]?.();
      shareMenu.classList.remove("show");
    });
  });
  document.addEventListener("click", () => shareMenu.classList.remove("show"));

  // ── QTY CONTROLS ──────────────────────────────────────────────
  const pdpMaxStock = Math.max(0, parseInt(p.stock) || 0);
  document.getElementById("pdpQtyMinus").addEventListener("click", () => {
    if (pdpQty > 1) { pdpQty--; document.getElementById("pdpQtyVal").textContent = pdpQty; }
  });
  document.getElementById("pdpQtyPlus").addEventListener("click", () => {
    if (pdpMaxStock > 0 && pdpQty >= pdpMaxStock) {
      TB_showToast('warn', `Solo hay ${pdpMaxStock} unidades disponibles`);
      return;
    }
    pdpQty++; document.getElementById("pdpQtyVal").textContent = pdpQty;
  });

  // ── ADD TO CART / BUY NOW ──────────────────────────────────────
  document.getElementById("pdpAddCart").addEventListener("click", () => {
    TB_addToCart(p.id, pdpQty, true);
    // Pulse animation on button
    const btn = document.getElementById("pdpAddCart");
    btn.classList.add("pulse");
    setTimeout(() => btn.classList.remove("pulse"), 400);
  });

  document.getElementById("pdpBuyNow").addEventListener("click", () => {
    TB_addToCart(p.id, pdpQty, true);
    TB_navigate("carrito.html");
  });

  // ── COLORS & SIZES (if product has them) ──────────────────────
  if (p.colors?.length) {
    const section = document.getElementById("pdpColorSection");
    if (section) {
      section.style.display = "block";
      const label = section.querySelector(".pdp-selected-color");
      const row   = section.querySelector(".pdp-color-row");
      row.innerHTML = p.colors.map((c, i) =>
        `<button class="pdp-color-btn ${i===0?'selected':''}" style="background:${c.hex}" title="${c.name}" data-name="${c.name}"></button>`
      ).join("");
      if (label) label.textContent = p.colors[0].name;
      row.querySelectorAll(".pdp-color-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          row.querySelectorAll(".pdp-color-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          if (label) label.textContent = btn.dataset.name;
        });
      });
    }
  }

  if (p.sizes?.length) {
    const section = document.getElementById("pdpSizeSection");
    if (section) {
      section.style.display = "block";
      const label = section.querySelector(".pdp-selected-size");
      const row   = section.querySelector(".pdp-size-row");
      row.innerHTML = p.sizes.map((s, i) =>
        `<button class="pdp-size-btn ${i===0?'selected':''}" data-size="${s}">${s}</button>`
      ).join("");
      if (label) label.textContent = p.sizes[0];
      row.querySelectorAll(".pdp-size-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          row.querySelectorAll(".pdp-size-btn").forEach(b => b.classList.remove("selected"));
          btn.classList.add("selected");
          if (label) label.textContent = btn.dataset.size;
        });
      });
    }
  }

  // ── RECOMMENDATIONS ────────────────────────────────────────────
  pdpRenderRecs(p);

  // Cart sidebar checkout
  document.getElementById("btnCheckout")?.addEventListener("click", () => TB_navigate("carrito.html"));
});

// ── RECOMMENDATION CARD HTML ──────────────────────────────────
function pdpRecCardHTML(p) {
  const imgHTML = (p.imagenes && p.imagenes.length > 0)
    ? `<img src="${p.imagenes[0]}" alt="${p.name}" loading="lazy" width="260" height="200" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
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

async function pdpRenderRecs(product) {
  if (!product || !product.id) return;

  try {
    const data = await TB_api.get('/productos/' + product.id + '/relacionados');
    if (!data) return;

    if (data.related && data.related.length) TB_cacheProductList(data.related);
    if (data.sameBrand && data.sameBrand.length) TB_cacheProductList(data.sameBrand);
    if (data.crossSell && data.crossSell.length) TB_cacheProductList(data.crossSell);

    const renderTrack = (trackId, products) => {
      const track = document.getElementById(trackId);
      if (!track) return;
      const section = track.closest('.pdp-rec-section');
      if (!products || !products.length) {
        if (section) section.style.display = 'none';
        track.innerHTML = '';
        return;
      }
      if (section) section.style.display = '';
      track.innerHTML = products.map(p => pdpRecCardHTML(p)).join('');
      track.addEventListener('click', TB_cardGridClickHandler);
    };

    renderTrack('pdpRecRelatedTrack', data.related);
    renderTrack('pdpRecBrandTrack', data.sameBrand);
    renderTrack('pdpRecCrossTrack', data.crossSell);
    setupRecArrows();
  } catch (e) {
    console.warn('Error cargando recomendaciones:', e.message);
  }
}

/* ── CAROUSEL ARROW NAVIGATION ───────────────────────────── */
function setupRecArrows() {
  document.querySelectorAll('.pdp-rec-section').forEach(section => {
    const track = section.querySelector('.pdp-rec-track');
    const prev = section.querySelector('.pdp-rec-arrow.prev');
    const next = section.querySelector('.pdp-rec-arrow.next');
    if (!track || !prev || !next) return;

    const step = () => {
      const card = track.querySelector('.prod-card');
      return card ? card.offsetWidth + 16 : 200;
    };

    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

    const sync = () => {
      prev.classList.toggle('hidden', track.scrollLeft <= 2);
      next.classList.toggle('hidden', track.scrollLeft + track.clientWidth >= track.scrollWidth - 2);
    };

    track.addEventListener('scroll', sync);
    setTimeout(sync, 150);
  });
}
