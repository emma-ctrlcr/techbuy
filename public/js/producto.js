/* ══════════════════════════════════════════════════════════════
   PRODUCT DETAIL PAGE — producto.js
══════════════════════════════════════════════════════════════ */

let pdpQty = 1;

// Simulated product images (gradients/icons per category since no real imgs)
const PDP_IMG_SETS = {
  oficina:      ["fa-laptop","fa-desktop","fa-keyboard","fa-display"],
  gamer:        ["fa-gamepad","fa-keyboard","fa-headphones","fa-computer-mouse"],
  computacion:  ["fa-laptop","fa-hard-drive","fa-microchip","fa-server"],
  celulares:    ["fa-mobile-screen","fa-mobile","fa-tablet-screen-button","fa-sim-card"],
  hogar:        ["fa-headphones","fa-tv","fa-camera","fa-plug"],
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
  TB_loadCart();
  TB_loadSession();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  const params = new URLSearchParams(window.location.search);
  const productId = parseInt(params.get("id"));

  if (!productId) {
    document.getElementById("pdpName").textContent = "Producto no encontrado";
    document.getElementById("pdpBrand").textContent = "";
    return;
  }

  // Mostrar estado de carga
  document.getElementById("pdpName").textContent = "Cargando...";

  // Cargar todos los productos para el buscador y carrito
  let p = null;
  try {
    const data = await TB_api.get('/productos?limit=500');
    const raw = Array.isArray(data) ? data : (data.products ?? []);
    if (raw.length > 0) {
      TB_PRODUCTS.length = 0;
      raw.forEach(prod => TB_PRODUCTS.push({
        id: prod.id, name: prod.name, brand: prod.brand ?? '',
        cat: prod.cat ?? 'otros', price: parseFloat(prod.price ?? 0),
        old: prod.old != null ? parseFloat(prod.old) : null,
        badge: prod.badge ?? null, stock: prod.stock ?? 0,
        imagenes: prod.imagenes || [],
        description: prod.description ?? '',
      }));
      p = TB_PRODUCTS.find(x => x.id === productId) || null;
    }
  } catch(e) {
    // Fallback: intentar solo este producto
    try {
      p = await TB_api.get('/productos/' + productId);
      if (p && !TB_PRODUCTS.find(x => x.id === p.id)) {
        TB_PRODUCTS.push(p);
      }
    } catch(e2) {
      p = TB_PRODUCTS.find(x => x.id === productId) || null;
    }
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

  pdpQty = 1;

  // Breadcrumb
  document.getElementById("bcProductName").textContent = p.name;

  // Brand + Name
  document.getElementById("pdpBrand").textContent = p.brand;
  document.getElementById("pdpName").textContent = p.name;

  // SKU
  document.getElementById("pdpSku").textContent = "SKU: TB-" + String(p.id).padStart(6,"0") + "-" + p.cat.toUpperCase();

  // Pricing (precio base sin IVA — el IVA se suma en el carrito)
  document.getElementById("pdpPrice").textContent = "C$" + p.price.toFixed(2);
  document.getElementById("pdpPriceBreakdown").innerHTML =
    `Precio base sin IVA · <span class="iva">+15% IVA en el carrito</span>`;

  if (p.old) {
    document.getElementById("pdpOldRow").innerHTML = `<span class="pdp-old">C$${p.old.toFixed(2)}</span>`;
    const saving = p.old - p.price;
    document.getElementById("pdpSaveRow").innerHTML =
      `<span class="pdp-save"><i class="fa-solid fa-tag"></i> AHORRAS C$${saving.toFixed(2)}</span>`;
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
    oficina:     "Potente setup de oficina con procesadores de ultima generacion, ideal para trabajo y productividad. Diseno ultradelgado con bateria de larga duracion.",
    hogar:       "Sonido envolvente de alta fidelidad con cancelacion de ruido activa. Bateria de hasta 30 horas de reproduccion continua.",
    gamer:       "Equipamiento gaming profesional con iluminacion RGB personalizable, switches de alta precision y construccion reforzada.",
    computacion: "Portatiles de alto rendimiento con pantallas de alta resolucion, ideales para desarrollo, diseno y gaming.",
    celulares:   "Los ultimos modelos con pantalla AMOLED 120Hz, camara de alta resolucion y bateria de larga duracion con carga rapida.",
    otros:       "Producto de alta calidad con garantia de fabricante. Diseno resistente y materiales premium.",
  };
  document.getElementById("pdpDesc").textContent = p.description || descs[p.cat] || "Producto de alta calidad.";

  // ── IMAGE GALLERY ──────────────────────────────────────────────
  const icons = PDP_IMG_SETS[p.cat] || PDP_IMG_SETS.otros;
  const hasRealImages = p.imagenes && p.imagenes.length > 0;
  const mainImg = document.getElementById("pdpMainImg");
  mainImg.style.transition = "opacity .12s ease, transform .12s ease";

  if (hasRealImages) {
    // Mostrar imagen real de la BD
    mainImg.innerHTML = `
      <img id="pdpMainImgTag" src="${p.imagenes[0]}" alt="${p.name}"
           style="width:100%;height:100%;object-fit:cover;"
           onerror="this.style.display='none';document.getElementById('pdpMainImgIcon').style.display='flex'">
      <i id="pdpMainImgIcon" class="pdp-main-icon fa-solid ${icons[0]}" style="display:none;"></i>
      <div class="pdp-img-overlay">
        <button class="pdp-img-action fav" id="overlayFavBtn">
          <i class="fa-regular fa-heart"></i> Favoritos
        </button>
        <button class="pdp-img-action cart" onclick="TB_addToCart(${p.id}, pdpQty)">
          <i class="fa-solid fa-cart-plus"></i> Agregar
        </button>
      </div>`;

    // Thumbnails con imágenes reales
    const thumbsEl = document.getElementById("pdpThumbs");
    thumbsEl.innerHTML = p.imagenes.map((url, i) => `
      <div class="pdp-thumb ${i === 0 ? 'active' : ''}" data-url="${url}" data-idx="${i}">
        <img src="${url}" alt="Imagen ${i+1}" style="width:100%;height:100%;object-fit:contain;"
             onerror="this.parentElement.innerHTML='<i class=\'fa-solid ${icons[Math.min(i,icons.length-1)]}\'></i>'">
      </div>`).join("");

    thumbsEl.querySelectorAll(".pdp-thumb").forEach(thumb => {
      const activate = () => {
        thumbsEl.querySelectorAll(".pdp-thumb").forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");
        const imgTag = document.getElementById("pdpMainImgTag");
        if (imgTag) { imgTag.style.opacity="0"; setTimeout(()=>{ imgTag.src=thumb.dataset.url; imgTag.style.opacity="1"; },120); }
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
        <button class="pdp-img-action cart" onclick="TB_addToCart(${p.id}, pdpQty)">
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

  // Overlay fav button
  document.getElementById("overlayFavBtn").addEventListener("click", e => {
    e.stopPropagation();
    toggleFavorite(p);
  });

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
    TB_addToCart(p.id, pdpQty);
    // Pulse animation on button
    const btn = document.getElementById("pdpAddCart");
    btn.classList.add("pulse");
    setTimeout(() => btn.classList.remove("pulse"), 400);
  });

  document.getElementById("pdpBuyNow").addEventListener("click", () => {
    TB_addToCart(p.id, pdpQty);
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

  // Cart sidebar checkout
  document.getElementById("btnCheckout")?.addEventListener("click", () => TB_navigate("carrito.html"));
});
