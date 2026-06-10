let catsActiveCat = "all";
let catsSearch = "";
let catsMaxPrice = 1300;
let catsSort = "default";
let catsPage = 1;
let catsTotalPages = 1;
let catsTotalProducts = 0;
let catsLoading = false;

document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  await TB_loadCats();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  const params = new URLSearchParams(window.location.search);
  const qParam = params.get("q");
  if (qParam) {
    catsSearch = qParam;
    document.getElementById("catsSearchInput").value = qParam;
  }
  const pageParam = parseInt(params.get("page")) || 1;
  catsPage = pageParam;

  renderCatList();
  applyCatFilters();
  setupCatInputs();
});

async function renderCatList() {
  const container = document.getElementById("catsCatList");
  try {
    const data = await TB_api.get('/productos/conteo-categorias');
    const counts = Array.isArray(data) ? data : [];

    const totalCount = counts.reduce((s, c) => s + c.count, 0);

    const cats = [
      { key:"all", icon:"fa-solid fa-store", label:"Todas", count: totalCount },
      ...TB_CATS.map(c => {
        const found = counts.find(x => x.key === c.key);
        return { key: c.key, icon: c.icon, label: c.label, count: found ? found.count : 0 };
      })
    ];
    container.innerHTML = cats.map(c => `
      <button class="cats-cat-item ${c.key === catsActiveCat ? 'active' : ''}" data-cat="${c.key}" onclick="selectCat('${c.key}')">
        <i class="${c.icon}"></i>
        <span>${c.label}</span>
        <span class="cats-cat-count">${c.count}</span>
      </button>`).join("");
  } catch (e) {
    console.warn('Error cargando conteos:', e.message);
  }
}

function closeFilterDrawer() {
  const sidebar = document.getElementById("catsSidebar");
  const overlay = document.getElementById("catsFilterOverlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

function selectCat(cat) {
  catsActiveCat = cat;
  catsPage = 1;
  renderCatList();
  applyCatFilters();
  closeFilterDrawer();
}

function buildApiUrl() {
  const p = new URLSearchParams();
  p.set('page', catsPage);
  p.set('limit', '12');
  if (catsActiveCat !== 'all') p.set('cat', catsActiveCat);
  if (catsSearch) p.set('q', catsSearch);
  if (catsMaxPrice < 1300) p.set('maxPrice', catsMaxPrice);
  p.set('sort', catsSort);
  return '/productos?' + p.toString();
}

function updateUrl() {
  const p = new URLSearchParams();
  if (catsPage > 1) p.set('page', catsPage);
  if (catsSearch) p.set('q', catsSearch);
  const qs = p.toString();
  const url = qs ? '?' + qs : window.location.pathname;
  window.history.replaceState(null, '', url);
}

async function applyCatFilters() {
  if (catsLoading) return;
  catsLoading = true;

  const grid = document.getElementById("catsGrid");
  grid.innerHTML = TB_SKELETON_GRID;

  updateUrl();

  try {
    const data = await TB_api.get(buildApiUrl());
    const products = data.products || [];
    catsTotalPages = data.totalPages || 1;
    catsTotalProducts = data.total || 0;

    TB_cacheProductList(products);

    document.getElementById("catsResultCount").textContent = catsTotalProducts + " producto" + (catsTotalProducts !== 1 ? "s" : "");
    document.getElementById("catsMainTitle").textContent =
      catsActiveCat === "all" ? "Todas las categorias"
      : catsActiveCat.charAt(0).toUpperCase() + catsActiveCat.slice(1);

    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 0">
          <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
          <h3>Sin resultados</h3>
          <p>Intenta con otro termino o ajusta los filtros.</p>
        </div>`;
      renderCatsPagination();
      catsLoading = false;
      return;
    }

    grid.innerHTML = products.map(p => productCardHTML(p)).join("");
    grid.addEventListener("click", TB_cardGridClickHandler);

    renderCatsPagination();
  } catch(e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:60px 0"><h3>Error al cargar</h3><p>${e.message}</p></div>`;
    document.getElementById("catsResultCount").textContent = "Error al cargar";
    console.warn('Error en applyCatFilters:', e.message);
  }
  catsLoading = false;
}

function renderCatsPagination() {
  TB_renderPagination({
    container: document.getElementById("catsGrid"),
    currentPage: catsPage,
    totalPages: catsTotalPages,
    onPageChange: (page) => {
      if (page < 1 || page > catsTotalPages || catsLoading) return;
      catsPage = page;
      applyCatFilters();
      window.scrollTo({ top: document.getElementById("catsGrid").offsetTop - 120, behavior: 'smooth' });
    },
    containerId: 'catsPagination'
  });
}

function resetCatFilters() {
  catsActiveCat = "all";
  catsSearch = "";
  catsMaxPrice = 1300;
  catsSort = "default";
  catsPage = 1;
  document.getElementById("catsSearchInput").value = "";
  document.getElementById("catsPriceRange").value = 1300;
  document.getElementById("catsPriceValue").textContent = TB_formatPrice(1300);
  updateSortSelect();
  updateSortRadios();
  renderCatList();
  applyCatFilters();
  closeFilterDrawer();
}

function setupCatInputs() {
  document.getElementById("catsPriceRange").addEventListener("input", e => {
    catsMaxPrice = Number(e.target.value);
    document.getElementById("catsPriceValue").textContent = TB_formatPrice(catsMaxPrice);
  });
  document.getElementById("catsPriceRange").addEventListener("change", e => {
    catsPage = 1;
    applyCatFilters();
  });

  let searchTimer = null;
  document.getElementById("catsSearchInput").addEventListener("input", e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      catsSearch = e.target.value.trim();
      catsPage = 1;
      applyCatFilters();
    }, 300);
  });

  document.querySelectorAll('input[name="catsSort"]').forEach(r => {
    r.addEventListener("change", e => {
      catsSort = e.target.value;
      updateSortSelect();
      catsPage = 1;
      applyCatFilters();
    });
  });

  const sortSelect = document.getElementById("catsSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", e => {
      catsSort = e.target.value;
      updateSortRadios();
      catsPage = 1;
      applyCatFilters();
    });
  }
}

function updateSortSelect() {
  const sel = document.getElementById("catsSortSelect");
  if (sel) sel.value = catsSort;
}
function updateSortRadios() {
  document.querySelectorAll('input[name="catsSort"]').forEach(r => {
    r.checked = r.value === catsSort;
  });
}

function productCardHTML(p) {
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
window.productCardHTML = productCardHTML;

function setupCatFilterDrawer() {
  const sidebar = document.getElementById("catsSidebar");
  const overlay = document.getElementById("catsFilterOverlay");
  const openBtn = document.getElementById("catsFilterBtn");
  const closeBtn = document.getElementById("catsFilterClose");
  if (!sidebar || !overlay || !openBtn || !closeBtn) return;
  function openDrawer() { sidebar.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow = "hidden"; }
  openBtn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeFilterDrawer);
  overlay.addEventListener("click", closeFilterDrawer);
}
document.addEventListener("DOMContentLoaded", setupCatFilterDrawer);
