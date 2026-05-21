/* ══════════════════════════════════════════════════════════════
   CARRITO PAGE — carrito.js
   Carga: datos.js (PRODUCTS + utilidades)
══════════════════════════════════════════════════════════════ */

let couponDiscount = 0;
let couponCode = "";
const VALID_COUPONS = { "TECHBUY10": 0.10, "OFERTA15": 0.15, "BIENVENIDO": 0.05 };

document.addEventListener('DOMContentLoaded', async () => {
  TB_loadCart();
  TB_setupSharedHeader();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  // Cargar productos para que el buscador tenga datos
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
  } catch(e) { console.warn('carrito.js:', e.message); }
  TB_setupSearchAutocomplete();

  TB_updateCartUI();

  // Coupon
  document.getElementById("applyCouponBtn").addEventListener("click", applyCoupon);
  document.getElementById("cartCouponInput").addEventListener("keydown", e => { if (e.key === "Enter") applyCoupon(); });

  // Checkout — verifica sesión antes de redirigir
  document.getElementById("cartCheckoutBtn").addEventListener("click", () => {
    if (!TB_api.isLoggedIn()) {
      sessionStorage.setItem("tb_login_return", "checkout.html");
      TB_navigate("login.html");
      return;
    }
    TB_navigate("checkout.html");
  });

  // Render initial cart
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
        ? `<img src="${i.imagenes[0]}" alt="${i.name}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fa-solid ${TB_iconForCat(i.cat)}" style="display:none;position:absolute;"></i>`
        : `<i class="fa-solid ${TB_iconForCat(i.cat)}"></i>`}
      </div>
      <div class="cart-page-item-info">
        <div class="cart-page-item-name" onclick="window.location.href='producto.html?id=${i.id}'">${i.name}</div>
        <div class="cart-page-item-brand">${i.brand}</div>
        <div class="cart-page-item-price-row">
          <span class="cart-page-item-price">C$${i.price.toFixed(2)}</span>
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
        <div class="cart-page-item-subtotal">C$${(i.price * i.qty).toFixed(2)}</div>
        <button class="cart-page-item-del" onclick="removeItemS(${i.id})"><i class="fa-solid fa-trash"></i></button>
        <span class="cart-page-item-view" onclick="window.location.href='producto.html?id=${i.id}'">Ver producto</span>
      </div>
    </div>`;
  }).join("");

  document.getElementById("cartPageCount").textContent = TB_cartCount() + " producto" + (TB_cartCount() !== 1 ? "s" : "");

  renderCartSummary();
}

function changeQtyS(id, delta) {
  const item = TB_cart.find(x => x.id === id);
  if (!item) return;
  const proposed = item.qty + delta;
  if (proposed <= 0) { TB_cart = TB_cart.filter(x => x.id !== id); TB_saveCart(); renderCartPage(); TB_updateBadge(); return; }
  if (delta > 0) {
    const maxStock = TB_getMaxStock(item);
    if (maxStock > 0 && proposed > maxStock) { TB_showToast('warn', `Solo hay ${maxStock} unidades disponibles`); return; }
  }
  item.qty = proposed;
  TB_saveCart();
  renderCartPage();
  TB_updateBadge();
}
function removeItemS(id) {
  TB_cart = TB_cart.filter(x => x.id !== id);
  TB_saveCart();
  renderCartPage();
  TB_updateBadge();
}

function renderCartPage() {
  TB_renderCartItems_override();
}

function renderCartSummary() {
  const baseSubtotal = TB_cartTotal();
  const iva = baseSubtotal * 0.15;
  const totalConIva = baseSubtotal + iva;
  const discount = totalConIva * couponDiscount;
  const final = totalConIva - discount;

  // Items list - show base price * qty
  const itemsEl = document.getElementById("cartSummaryItems");
  itemsEl.innerHTML = TB_cart.map(i =>
    `<div class="cart-summary-item">
      <span class="cart-summary-item-name">${i.name} <span class="cart-summary-item-qty">x${i.qty}</span></span>
      <span class="cart-summary-item-price">C$${(i.price * i.qty).toFixed(2)}</span>
    </div>`
  ).join("");

  document.getElementById("cartSubtotal").textContent = "C$" + baseSubtotal.toFixed(2);
  document.getElementById("cartIva").textContent = "C$" + iva.toFixed(2);

  if (couponDiscount > 0) {
    document.getElementById("discountRow").style.display = "flex";
    document.getElementById("discountVal").textContent = "-C$" + discount.toFixed(2);
  } else {
    document.getElementById("discountRow").style.display = "none";
  }

  document.getElementById("cartFinalTotal").textContent = "C$" + final.toFixed(2);

  TB_updateBadge();
}

// ── COUPON ─────────────────────────────────────────────────────
function applyCoupon() {
  const input = document.getElementById("cartCouponInput");
  const msg = document.getElementById("cartCouponMsg");
  const code = input.value.trim().toUpperCase();

  if (!code) { msg.textContent = "Ingresa un codigo"; msg.className = "cart-coupon-msg error"; return; }

  if (VALID_COUPONS.hasOwnProperty(code)) {
    couponDiscount = VALID_COUPONS[code];
    couponCode = code;
    msg.textContent = `Descuento del ${(couponDiscount * 100).toFixed(0)}% aplicado!`;
    msg.className = "cart-coupon-msg success";
    input.value = code;
  } else {
    couponDiscount = 0;
    couponCode = "";
    msg.textContent = "Codigo invalido o expirado";
    msg.className = "cart-coupon-msg error";
  }
  renderCartSummary();
}

// Expose for inline onclick
window.changeQtyS = changeQtyS;
window.removeItemS = removeItemS;