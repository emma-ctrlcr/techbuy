/* ══════════════════════════════════════════════════════════════
   CATEGORIAS PAGE — categorias.js
   Carga: datos.js
══════════════════════════════════════════════════════════════ */

let catsActiveCat = "all";
let catsSearch = "";
let catsMaxPrice = 1300;
let catsSort = "default";

document.addEventListener('DOMContentLoaded', async () => {
  TB_loadCart();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  // Cargar productos desde la API antes de renderizar
  try {
    const data = await TB_api.get('/productos?limit=500');
    const raw = Array.isArray(data) ? data : (data.products ?? []);
    TB_PRODUCTS.length = 0;
    raw.forEach(p => TB_PRODUCTS.push({
      id: p.id, name: p.name, brand: p.brand ?? '',
      cat: p.cat ?? 'otros', price: parseFloat(p.price ?? 0),
      old: p.old != null ? parseFloat(p.old) : null,
      badge: p.badge ?? null, stock: p.stock ?? 0,
      imagenes: p.imagenes || [],
    }));
  } catch(e) { console.warn('categorias.js:', e.message); }

  // Leer query param ?q= desde la URL (viene de la barra de búsqueda)
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get("q");
  if (qParam) {
    catsSearch = qParam;
    document.getElementById("catsSearchInput").value = qParam;
  }

  renderCatList();
  applyCatFilters();
  setupCatInputs();
});

// ── RENDER CATEGORY LIST ─────────────────────────────────────
function renderCatList() {
  const container = document.getElementById("catsCatList");
  const known = ["oficina","hogar","gamer","computacion","celulares"];
  const perCat = {};
  known.forEach(k => perCat[k] = 0);
  TB_PRODUCTS.forEach(p => { const c = p.cat || 'otros'; perCat[c] = (perCat[c] || 0) + 1; });
  const cats = [
    { key:"all",         icon:"fa-solid fa-store",      label:"Todas", count: TB_PRODUCTS.length },
    { key:"oficina",     icon:"fa-solid fa-briefcase",   label:"Oficina", count: perCat.oficina||0 },
    { key:"hogar",       icon:"fa-solid fa-house",        label:"Hogar", count: perCat.hogar||0 },
    { key:"gamer",       icon:"fa-solid fa-gamepad",      label:"Gamer", count: perCat.gamer||0 },
    { key:"computacion", icon:"fa-solid fa-laptop",       label:"Computacion", count: perCat.computacion||0 },
    { key:"celulares",   icon:"fa-solid fa-mobile-screen",label:"Celulares", count: perCat.celulares||0 },
    { key:"otros",       icon:"fa-solid fa-box-open",     label:"Otros", count: known.reduce((s,k)=>s-(perCat[k]||0), TB_PRODUCTS.length) },
  ];
  container.innerHTML = cats.map(c => `
    <button class="cats-cat-item ${c.key === catsActiveCat ? 'active' : ''}" data-cat="${c.key}" onclick="selectCat('${c.key}')">
      <i class="${c.icon}"></i>
      <span>${c.label}</span>
      <span class="cats-cat-count">${c.count}</span>
    </button>`).join("");
}

function selectCat(cat) {
  catsActiveCat = cat;
  renderCatList();
  applyCatFilters();
}

// ── APPLY FILTERS ─────────────────────────────────────────────
function applyCatFilters() {
  let list = TB_filterProducts(TB_PRODUCTS, catsActiveCat, catsSearch);
  list = list.filter(p => p.price <= catsMaxPrice);

  if (catsSort === "price-asc")  list.sort((a, b) => a.price - b.price);
  else if (catsSort === "price-desc") list.sort((a, b) => b.price - a.price);
  else if (catsSort === "name-asc")  list.sort((a, b) => a.name.localeCompare(b.name));
  else if (catsSort === "name-desc") list.sort((a, b) => b.name.localeCompare(a.name));

  document.getElementById("catsResultCount").textContent = list.length + " producto" + (list.length !== 1 ? "s" : "");
  document.getElementById("catsMainTitle").textContent =
    catsActiveCat === "all" ? "Todas las categorias"
    : catsActiveCat.charAt(0).toUpperCase() + catsActiveCat.slice(1);

  const grid = document.getElementById("catsGrid");
  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 0">
        <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <h3>Sin resultados</h3>
        <p>Intenta con otro termino o ajusta los filtros.</p>
      </div>`;
    return;
  }
  grid.innerHTML = list.map(p => productCardHTML(p)).join("");

  grid.querySelectorAll(".prod-card").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest(".btn-add")) return;
      TB_navigate("producto.html?id=" + card.dataset.id);
    });
  });
  grid.querySelectorAll(".btn-add").forEach(btn => {
    btn.addEventListener("click", () => {
      TB_addToCart(Number(btn.dataset.id), 1);
    });
  });
}

function resetCatFilters() {
  catsActiveCat = "all";
  catsSearch = "";
  catsMaxPrice = 1300;
  catsSort = "default";
  document.getElementById("catsSearchInput").value = "";
  document.getElementById("catsPriceRange").value = 1300;
  document.getElementById("catsPriceValue").textContent = "C$1300";
  document.querySelectorAll('input[name="catsSort"]').forEach(r => r.checked = r.value === "default");
  renderCatList();
  applyCatFilters();
}

// ── SETUP INPUTS ──────────────────────────────────────────────
function setupCatInputs() {
  document.getElementById("catsPriceRange").addEventListener("input", e => {
    catsMaxPrice = Number(e.target.value);
    document.getElementById("catsPriceValue").textContent = "C$" + catsMaxPrice;
    applyCatFilters();
  });

  let searchTimer = null;
  document.getElementById("catsSearchInput").addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      catsSearch = e.target.value.trim();
      applyCatFilters();
    }, 300);
  });

  document.querySelectorAll('input[name="catsSort"]').forEach(r => {
    r.addEventListener("change", e => {
      catsSort = e.target.value;
      applyCatFilters();
    });
  });
}

// ── PRODUCT CARD HTML ─────────────────────────────────────────
function productCardHTML(p) {
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
window.productCardHTML = productCardHTML;