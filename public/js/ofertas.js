/* ══════════════════════════════════════════════════════════════
   OFERTAS PAGE — ofertas.js
   Carga: datos.js
══════════════════════════════════════════════════════════════ */

let ofertasCat = "all";

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
    if (raw.length > 0) {
      TB_PRODUCTS.length = 0;
      raw.forEach(p => TB_PRODUCTS.push({
        id: p.id, name: p.name, brand: p.brand ?? '',
        cat: p.cat ?? 'otros', price: parseFloat(p.price ?? 0),
        old: p.old != null ? parseFloat(p.old) : null,
        badge: p.badge ?? null, stock: p.stock ?? 0,
        imagenes: p.imagenes || [],
      }));
    }
  } catch(e) { console.warn('ofertas.js:', e.message); }

  renderOfertasGrid();
});

// ── HERO STATS ────────────────────────────────────────────────
function initOfertasHero() {
  const saleProducts = TB_PRODUCTS.filter(p => p.old);
  document.getElementById("ofertaCount").textContent = saleProducts.length;
  const totalSavings = saleProducts.reduce((sum, p) => sum + (p.old - p.price), 0);
  document.getElementById("ofertaSavings").textContent = "C$" + totalSavings.toFixed(0);
}

// ── CATEGORY TABS ─────────────────────────────────────────────
function renderOfertasCatTabs() {
  const cats = [
    { key:"all", label:"Todas" },
    { key:"oficina", label:"Oficina" },
    { key:"hogar", label:"Hogar" },
    { key:"gamer", label:"Gamer" },
    { key:"computacion", label:"Computacion" },
    { key:"celulares", label:"Celulares" },
    { key:"otros", label:"Otros" },
  ];
  const container = document.getElementById("ofertasCatTabs");
  container.innerHTML = cats.map(c => `
    <button class="ofertas-filter-tab ${c.key === ofertasCat ? 'active' : ''}"
            data-cat="${c.key}" onclick="selectOfertaCat('${c.key}')">${c.label}</button>`
  ).join("");
}

function selectOfertaCat(cat) {
  ofertasCat = cat;
  renderOfertasCatTabs();
  renderOfertasGrid();
}

// ── RENDER GRID ───────────────────────────────────────────────
function renderOfertasGrid() {
  let list = TB_PRODUCTS.filter(p => p.old);
  if (ofertasCat !== "all") list = list.filter(p => p.cat === ofertasCat);

  const grid = document.getElementById("ofertasGrid");
  if (!list.length) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:60px 0">
        <i class="fa-solid fa-tag" style="font-size:60px;color:#ccc;margin-bottom:16px"></i>
        <h3 style="font-family:'Exo 2';color:var(--navy)">No hay ofertas en esta categoria</h3>
        <p style="color:var(--muted);margin-top:8px">Explora otras categorias</p>
      </div>`;
    return;
  }
  grid.innerHTML = list.map(p => ofertaCardHTML(p)).join("");

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

// ── PRODUCT CARD ─────────────────────────────────────────────
function ofertaCardHTML(p) {
  const discount = p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
  const imgHTML = (p.imagenes && p.imagenes.length > 0)
    ? `<img src="${p.imagenes[0]}" alt="${p.name}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const iconDisplay = (p.imagenes && p.imagenes.length > 0) ? 'none' : 'flex';
  const sinStock = p.stock <= 0;
  const badge = sinStock ? '<div class="prod-badge badge-agotado">Agotado</div>'
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
            <span class="prod-price">C$${p.price.toFixed(2)}</span>
            ${p.old ? `<span class="prod-old">C$${p.old.toFixed(2)}</span>` : ''}
          </div>
          <button class="btn-add" data-id="${p.id}"${sinStock ? ' disabled' : ''}>${sinStock ? 'Agotado' : '+ Agregar al Carrito'}</button>
        </div>
      </div>
    </div>`;
}
window.ofertaCardHTML = ofertaCardHTML;