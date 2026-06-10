let ofertasCat = "all";
let ofertasPage = 1;
let ofertasTotalPages = 1;
let ofertasTotal = 0;

document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  await TB_loadCats();
  TB_setupSharedHeader();
  TB_setupSearchAutocomplete();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  document.getElementById("ofertasGrid").innerHTML = TB_SKELETON_GRID;
  renderOfertasGrid();
});

function renderOfertasCatTabs() {
  const cats = [
    { key:"all", label:"Todas" },
    ...TB_CATS.map(c => ({ key: c.key, label: c.label }))
  ];
  const container = document.getElementById("ofertasCatTabs");
  container.innerHTML = cats.map(c => `
    <button class="ofertas-filter-tab ${c.key === ofertasCat ? 'active' : ''}"
            data-cat="${c.key}" onclick="selectOfertaCat('${c.key}')">${c.label}</button>`
  ).join("");
}

function selectOfertaCat(cat) {
  ofertasCat = cat;
  ofertasPage = 1;
  renderOfertasCatTabs();
  renderOfertasGrid();
}

async function renderOfertasGrid() {
  const grid = document.getElementById("ofertasGrid");
  grid.innerHTML = TB_SKELETON_GRID;

  const params = new URLSearchParams();
  params.set('page', ofertasPage);
  params.set('limit', '12');
  if (ofertasCat !== 'all') params.set('cat', ofertasCat);

  try {
    const data = await TB_api.get('/productos/ofertas?' + params.toString());
    const products = data.products || [];
    ofertasTotalPages = data.totalPages || 1;
    ofertasTotal = data.total || 0;

    if (products.length) TB_cacheProductList(products);

    document.getElementById("ofertaCount").textContent = ofertasTotal;
    const totalSavings = products.reduce((sum, p) => sum + ((p.old || 0) - (p.price || 0)), 0);
    document.getElementById("ofertaSavings").textContent = TB_formatPrice(totalSavings);

    if (!products.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 0">
          <i class="fa-solid fa-tag" style="font-size:60px;color:#ccc;margin-bottom:16px"></i>
          <h3 style="font-family:'Exo 2';color:var(--navy)">No hay ofertas en esta categoria</h3>
          <p style="color:var(--muted);margin-top:8px">Explora otras categorias</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(p => ofertaCardHTML(p)).join("");
    grid.addEventListener("click", TB_cardGridClickHandler);

    TB_renderPagination({
      container: grid,
      currentPage: data.page,
      totalPages: data.totalPages,
      onPageChange: (page) => {
        ofertasPage = page;
        renderOfertasGrid();
        grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      containerId: 'ofertasPagination'
    });
  } catch (e) {
    console.warn('Error cargando ofertas:', e.message);
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 0"><h3>Error al cargar</h3><p>Intenta de nuevo.</p></div>';
  }
}

function ofertaCardHTML(p) {
  const discount = p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
  const imgHTML = (p.imagenes && p.imagenes.length > 0)
    ? `<img src="${p.imagenes[0]}" alt="${p.name}" loading="lazy" width="260" height="200" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const iconDisplay = (p.imagenes && p.imagenes.length > 0) ? 'none' : 'flex';
  const badge = p.stock <= 0 ? '<div class="prod-badge badge-agotado">Agotado</div>'
    : `<div class="prod-badge badge-sale">-${discount}%</div>`;
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
            ${p.old ? `<span class="prod-old">${TB_formatPrice(p.old)}</span>` : ''}
          </div>
          ${TB_cartCardControls(p)}
        </div>
      </div>
    </div>`;
}
window.ofertaCardHTML = ofertaCardHTML;
