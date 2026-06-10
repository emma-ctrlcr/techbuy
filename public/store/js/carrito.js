/* ══════════════════════════════════════════════════════════════
   CARRITO PAGE — carrito.js
   Carga: datos.js (PRODUCTS + utilidades)
══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  await TB_loadCats();
  TB_setupSharedHeader();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  await TB_refreshCartCache();

  TB_setupSearchAutocomplete();

  TB_updateCartUI();

  document.getElementById("cartCheckoutBtn").addEventListener("click", () => {
    if (!TB_api.isLoggedIn()) {
      sessionStorage.setItem("tb_login_return", "checkout.html");
      TB_navigate("login.html");
      return;
    }
    TB_navigate("checkout.html");
  });

  renderCartPage();
});

// ── OVERRIDE TB_renderCartItems for this page ──────────────────
function TB_renderCartItems_override() {
  const container = document.getElementById("cartPageItems");
  if (!container) return;

  if (!TB_cart.length) {
    container.innerHTML = `
      <div class="cart-page-empty">
        <i class="fa-solid fa-cart-shopping"></i>
        <h3>Tu carrito esta vacio</h3>
        <p>Agrega productos para comenzar a comprar.</p>
        <a href="1.html"><i class="fa-solid fa-arrow-right"></i> Ver productos</a>
      </div>`;
    renderCartSummary();
    document.getElementById("cartPageCount").textContent = "0 productos";
    document.getElementById("cartCheckoutBtn").disabled = true;
    return;
  }

  document.getElementById("cartCheckoutBtn").disabled = false;
  container.innerHTML = TB_cart.map(i => {
    const maxStock = TB_getMaxStock(i);
    const atLimit = maxStock > 0 && i.qty >= maxStock;
    const minusDisabled = i.qty <= 1;
    return `
    <div class="cart-page-item" data-id="${i.id}">
      <div class="cart-page-item-img">${(i.imagenes && i.imagenes.length > 0)
        ? `<img src="${i.imagenes[0]}" alt="${i.name}" width="260" height="200" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fa-solid ${TB_iconForCat(i.cat)}" style="display:none;position:absolute;"></i>`
        : `<i class="fa-solid ${TB_iconForCat(i.cat)}"></i>`}
      </div>
      <div class="cart-page-item-info">
        <div class="cart-page-item-name" onclick="window.location.href='producto.html?id=${i.id}'">${i.name}</div>
        <div class="cart-page-item-brand">${i.brand}</div>
        <div class="cart-page-item-price-row">
          <span class="cart-page-item-price">${TB_formatPrice(i.price)}</span>
        </div>
        <span class="cart-page-item-qty">Cant: ${i.qty}</span>
        ${atLimit ? `<div class="cart-page-item-stock-warn">Stock maximo alcanzado</div>` : ''}
      </div>
      <div class="cart-page-item-qty-controls">
        <button class="cart-qty-s-btn" onclick="changeQtyS(${i.id}, -1)" ${minusDisabled ? 'disabled' : ''}>-</button>
        <span class="cart-qty-s-val">${i.qty}</span>
        <button class="cart-qty-s-btn" onclick="changeQtyS(${i.id}, 1)" ${atLimit ? 'disabled' : ''}>+</button>
      </div>
      <div class="cart-page-item-actions">
        <div class="cart-page-item-subtotal">${TB_formatPrice(i.price * i.qty)}</div>
        <button class="cart-page-item-del" onclick="removeItemS(${i.id})"><i class="fa-solid fa-trash"></i></button>
        <span class="cart-page-item-view" onclick="window.location.href='producto.html?id=${i.id}'">Ver producto</span>
      </div>
    </div>`;
  }).join("");

  document.getElementById("cartPageCount").textContent = TB_cartCount() + " producto" + (TB_cartCount() !== 1 ? "s" : "");

  renderCartSummary();
}

async function changeQtyS(id, delta) {
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
    renderCartPage(); TB_updateBadge(); return;
  }
  if (delta > 0) {
    const maxStock = TB_getMaxStock(item);
    if (maxStock > 0 && proposed > maxStock) { TB_showToast('warn', `Solo hay ${maxStock} unidades disponibles`); return; }
  }
  item.qty = proposed;
  if (TB_api.isLoggedIn()) {
    try { await TB_api.put('/carrito/items/' + id, { cantidad: proposed }); } catch(e) {}
  } else {
    localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart));
  }
  renderCartPage();
  TB_updateBadge();
}
async function removeItemS(id) {
  TB_cart = TB_cart.filter(x => x.id !== id);
  if (TB_api.isLoggedIn()) {
    try { await TB_api.delete('/carrito/items/' + id); } catch(e) {}
  } else {
    localStorage.setItem("techbuy_cart", JSON.stringify(TB_cart));
  }
  renderCartPage();
  TB_updateBadge();
}

function renderCartPage() {
  TB_renderCartItems_override();
}

function renderCartSummary() {
  const subtotal = TB_cartTotal();
  document.getElementById("cartSubtotal").textContent = TB_formatPrice(subtotal);
  TB_updateBadge();
}

// Expose for inline onclick
window.changeQtyS = changeQtyS;
window.removeItemS = removeItemS;