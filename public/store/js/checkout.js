/* ══════════════════════════════════════════════════════════════
   TECHBUY — checkout.js  (v13 — conectado a API REST)
   Página dedicada de pago. Carga: datos.js → api.js → shared.js → checkout.js
══════════════════════════════════════════════════════════════ */

let couponDiscount = 0;
let couponCode     = '';

document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  TB_setupSharedHeader();
  TB_setupCartSidebar();
  TB_setupAccountBtn();

  await TB_refreshCartCache();

  TB_setupSearchAutocomplete();
  TB_updateCartUI();
  renderPage();
});

/* ── RENDER PRINCIPAL ─────────────────────────────────────── */
function renderPage() {
  const wrapper = document.getElementById('chkWrapper');

  // Guard: debe estar logueado
  if (!TB_api.isLoggedIn()) {
    sessionStorage.setItem('tb_login_return', 'checkout.html');
    TB_navigate('login.html');
    return;
  }

  if (!TB_cart.length) {
    wrapper.innerHTML = `
      <div class="chk-empty">
        <i class="fa-solid fa-cart-shopping"></i>
        <h3>Tu carrito está vacío</h3>
        <p>Agrega productos antes de proceder al pago.</p>
        <a href="1.html"><i class="fa-solid fa-arrow-left"></i> Ver productos</a>
      </div>`;
    return;
  }

  // Pre-llenar datos del usuario desde sesión activa
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('techbuy_user') || 'null'); } catch(e) { return null; }
  })();

  wrapper.innerHTML = `
    <!-- FORMULARIO -->
    <div class="chk-form-card">
      <h2><i class="fa-solid fa-lock"></i> Finalizar compra</h2>

      <div class="chk-section-title"><i class="fa-solid fa-location-dot"></i> Dirección de entrega</div>

      <div class="chk-field">
        <label>Teléfono</label>
        <input type="text" id="chkTel" placeholder="12345678" maxlength="8"
               inputmode="numeric" value="${user?.tel || ''}" />
        <span class="chk-hint">8 dígitos numéricos</span>
      </div>
      <div class="chk-field">
        <label>Dirección</label>
        <input type="text" id="chkAddress" placeholder="Barrio, calle, casa #..."
               value="${user?.address || ''}" />
      </div>
      <div class="chk-row">
        <div class="chk-field">
          <label>Ciudad</label>
          <input type="text" id="chkCity" placeholder="Managua"
                 value="${user?.city || ''}" />
        </div>
        <div class="chk-field">
          <label>Departamento</label>
          <div class="dept-combo-wrapper" id="deptComboWrapper">
            <input type="text" id="deptComboInput" class="dept-combo-input"
              placeholder="Buscar departamento..." autocomplete="off"
              role="combobox" aria-expanded="false"
              aria-controls="deptComboList" aria-autocomplete="list" />
            <input type="hidden" id="chkDept" name="chkDept" />
            <ul id="deptComboList" class="dept-combo-list" role="listbox"
              aria-label="Departamentos de Nicaragua"></ul>
          </div>
          <div class="dept-shipping-cost" id="deptShippingCost"></div>
        </div>
      </div>
      <div class="chk-field">
        <label>Código Postal</label>
        <input type="text" id="chkZip" placeholder="10000" />
      </div>

      <div class="chk-section-title" style="margin-top:24px">
        <i class="fa-solid fa-credit-card"></i> Datos de pago
      </div>
      <div class="chk-accepted-cards">
        <span class="chk-accepted-label">Aceptamos</span>
        <img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/visa.svg" alt="Visa" class="tb-payment-icon">
        <img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/mastercard.svg" alt="Mastercard" class="tb-payment-icon">
        <img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/amex.svg" alt="American Express" class="tb-payment-icon">
      </div>

      <div id="chkPaymentSection"></div>

      <label class="chk-save-label" id="chkSaveLabelWrap" style="display:none">
        <input type="checkbox" id="chkSaveCard" />
        <span>Guardar tarjeta para futuras compras</span>
      </label>

      <button class="chk-pay-btn" id="chkPayBtn" onclick="handlePay()">
        <i class="fa-solid fa-lock"></i> Pagar ahora
      </button>
      <div class="chk-secure-note">
        <i class="fa-solid fa-shield-halved"></i> Compra 100% segura — Garantía de devolución
      </div>
    </div>

    <!-- RESUMEN -->
    <div class="chk-summary-card">
      <h3><i class="fa-solid fa-receipt"></i> Tu pedido</h3>
      <div class="chk-sum-items" id="chkSumItems"></div>

      <hr class="chk-sum-divider" />

      <div class="chk-coupon-box">
        <div class="chk-coupon-label"><i class="fa-solid fa-tag"></i> Código de descuento</div>
        <div class="chk-coupon-row">
          <input type="text" id="chkCouponInput" placeholder="Ingresa tu código" />
          <button onclick="applyCoupon()">Aplicar</button>
        </div>
        <div class="chk-coupon-msg" id="chkCouponMsg"></div>
      </div>

      <div class="chk-sum-row">
        <span>Subtotal + IVA (15%):</span>
        <span id="chkSumSubtotal">C$0.00</span>
      </div>
      <div class="chk-sum-row">
        <span>IVA incluido:</span>
        <span id="chkSumIva">C$0.00</span>
      </div>
      <div class="chk-sum-row discount" id="chkDiscountRow" style="display:none">
        <span>Descuento cupón:</span>
        <span id="chkDiscountVal">-C$0.00</span>
      </div>
      <div class="chk-sum-row" id="chkShippingRow" style="display:none">
        <span>Envío:</span>
        <span id="chkShippingVal">C$0</span>
      </div>

      <div class="chk-sum-total">
        <span>Total a pagar:</span>
        <strong id="chkSumTotal">C$0.00</strong>
      </div>

      <a href="carrito.html" class="chk-back-link">
        <i class="fa-solid fa-arrow-left"></i> Volver al carrito
      </a>
    </div>`;

  renderPaymentSection();

  document.getElementById('chkTel').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(0, 8);
  });
  document.getElementById('chkCouponInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyCoupon();
  });

  renderSummary();
}

/* ── RESUMEN ──────────────────────────────────────────────── */
function renderSummary() {
  const itemsEl = document.getElementById('chkSumItems');
  if (!itemsEl) return;

  itemsEl.innerHTML = TB_cart.map(i => `
    <div class="chk-sum-item">
      <div class="chk-sum-item-info">
        <div class="chk-sum-item-name">${i.name}</div>
        <div class="chk-sum-item-qty">${i.brand} · x${i.qty}</div>
      </div>
      <div class="chk-sum-item-price">${TB_formatPrice((i.price * 1.15) * i.qty)}</div>
    </div>`).join('');

  const subtotal   = TB_cartTotal();
  const iva        = subtotal * 0.15;
  const withIva    = subtotal + iva;
  const discount   = withIva * couponDiscount;
  const shipping   = (typeof TB_shippingCost !== 'undefined') ? TB_shippingCost : 0;
  const final      = withIva - discount + shipping;

  document.getElementById('chkSumSubtotal').textContent = TB_formatPrice(withIva);
  document.getElementById('chkSumIva').textContent      = TB_formatPrice(iva);
  document.getElementById('chkSumTotal').textContent    = TB_formatPrice(final);

  const shipRow = document.getElementById('chkShippingRow');
  const shipVal = document.getElementById('chkShippingVal');
  if (shipRow && shipVal) {
    if (shipping > 0) { shipRow.style.display='flex'; shipVal.textContent=TB_formatPrice(shipping); }
    else              { shipRow.style.display='none'; }
  }
  const discRow = document.getElementById('chkDiscountRow');
  if (couponDiscount > 0) {
    discRow.style.display='flex';
    document.getElementById('chkDiscountVal').textContent='-'+TB_formatPrice(discount);
  } else {
    discRow.style.display='none';
  }
}

/* ── CUPÓN (API) ──────────────────────────────────────────── */
async function applyCoupon() {
  const input = document.getElementById('chkCouponInput');
  const msg   = document.getElementById('chkCouponMsg');
  const code  = input.value.trim().toUpperCase();

  if (!code) { msg.textContent='Ingresa un código'; msg.className='chk-coupon-msg error'; return; }

  if (!TB_api.isLoggedIn()) {
    // Validación local de respaldo
    const local = { 'TECHBUY10':0.10, 'OFERTA15':0.15, 'BIENVENIDO':0.05 };
    if (local[code]) {
      couponDiscount = local[code]; couponCode = code;
      msg.textContent=`¡Descuento del ${(couponDiscount*100).toFixed(0)}% aplicado!`;
      msg.className='chk-coupon-msg success';
    } else {
      couponDiscount = 0; couponCode = '';
      msg.textContent='Código inválido o expirado'; msg.className='chk-coupon-msg error';
    }
    renderSummary(); return;
  }

  try {
    const data = await TB_api.post('/cupones/validar', { codigo: code });
    if (data.valid) {
      couponDiscount = data.descuento; couponCode = code;
      msg.textContent=`¡Descuento del ${data.porcentaje}% aplicado!`;
      msg.className='chk-coupon-msg success';
    } else {
      couponDiscount = 0; couponCode = '';
      msg.textContent='Código inválido o expirado'; msg.className='chk-coupon-msg error';
    }
  } catch(err) {
    couponDiscount = 0; couponCode = '';
    msg.textContent='Error al validar el cupón'; msg.className='chk-coupon-msg error';
  }
  renderSummary();
}

/* ── PAYMENT SECTION ──────────────────────────────────────── */
let chkSelectedSavedIdx = null;

async function renderPaymentSection() {
  const sec      = document.getElementById('chkPaymentSection');
  const saveWrap = document.getElementById('chkSaveLabelWrap');

  let saved = [];
  if (TB_api.isLoggedIn()) {
    try { saved = await TB_api.get('/metodos-pago'); } catch(e) {}
  }

  if (!saved.length) {
    chkSelectedSavedIdx = null;
    if (saveWrap) saveWrap.style.display = 'flex';
    sec.innerHTML = buildNewCardForm();
    setupNewCardInputs();
    return;
  }

  chkSelectedSavedIdx = 0;
  if (saveWrap) saveWrap.style.display = 'none';

  sec.innerHTML = `
    <div class="chk-saved-cards-header">
      <span class="chk-saved-cards-label"><i class="fa-solid fa-wallet"></i> Métodos guardados</span>
      <button class="chk-toggle-cards-btn" id="chkToggleCardsBtn" onclick="toggleCardDropdown()">
        <i class="fa-solid fa-chevron-down" id="chkToggleIcon"></i>
      </button>
    </div>
    <div class="chk-selected-card" id="chkSelectedCard">
      ${buildSelectedCardDisplay(saved[0])}
    </div>
    <div class="chk-cards-dropdown" id="chkCardsDropdown">
      <div class="chk-cards-list" id="chkCardsList">
        ${saved.map((c, i) => `
          <div class="chk-card-option ${i===0?'active':''}" data-idx="${i}"
               onclick="selectSavedCard(${i})">
            <span class="chk-card-opt-icon">${cardBrandIcon(c.tipo||c.type)}</span>
            <div class="chk-card-opt-info">
              <span class="chk-card-opt-name">${cardBrandName(c.tipo||c.type)} •••• ${c.ultimos4||c.last4}</span>
              <span class="chk-card-opt-exp">${c.alias||''}</span>
            </div>
            ${i===0?'<span class="chk-card-opt-check"><i class="fa-solid fa-check"></i></span>':''}
          </div>`).join('')}
        <div class="chk-card-option chk-add-new-opt" onclick="selectNewCard()">
          <span class="chk-card-opt-icon"><i class="fa-solid fa-plus-circle"></i></span>
          <div class="chk-card-opt-info">
            <span class="chk-card-opt-name">Agregar nueva tarjeta</span>
          </div>
        </div>
      </div>
    </div>
    <div id="chkNewCardWrap" style="display:none; margin-top:14px;">
      ${buildNewCardForm()}
    </div>`;

  // Save cards list for later reference
  window._chkSavedCards = saved;
  setupNewCardInputs();
}

function cardBrandIcon(type) {
  const map = { visa:'visa', mastercard:'mastercard', amex:'amex' };
  return map[type]
    ? `<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/${map[type]}.svg" alt="${type}" class="tb-payment-icon">`
    : '<i class="fa-solid fa-credit-card"></i>';
}
function cardBrandName(type) {
  return type==='visa'?'Visa':type==='mastercard'?'Mastercard':type==='amex'?'Amex':'Tarjeta';
}
function buildSelectedCardDisplay(card) {
  return `<div class="chk-sel-card-inner">
    <span class="chk-sel-card-icon">${cardBrandIcon(card.tipo||card.type)}</span>
    <div>
      <div class="chk-sel-card-name">${cardBrandName(card.tipo||card.type)} •••• ${card.ultimos4||card.last4}</div>
      <div class="chk-sel-card-exp">${card.alias||''}</div>
    </div></div>`;
}
function buildNewCardForm() {
  return `
    <div class="chk-field">
      <label>Número de tarjeta</label>
      <div class="chk-card-wrap">
        <input type="text" id="chkCard" placeholder="1234 5678 9012 3456" maxlength="19" inputmode="numeric" />
        <span class="chk-card-icon" id="chkCardIcon"></span>
      </div>
      <span class="chk-hint" id="chkCardHint">16 dígitos</span>
    </div>
    <div class="chk-row">
      <div class="chk-field">
        <label>CVV</label>
        <input type="text" id="chkCVV" placeholder="123" maxlength="4" inputmode="numeric" />
      </div>
      <div class="chk-field">
        <label>Vencimiento</label>
        <input type="text" id="chkExpiry" placeholder="MM/YY" maxlength="5" inputmode="numeric" />
      </div>
    </div>`;
}
function setupNewCardInputs() {
  const cardEl = document.getElementById('chkCard');
  if (cardEl) setupCardInput('chkCard','chkCardIcon','chkCardHint');
  const cvvEl = document.getElementById('chkCVV');
  if (cvvEl) cvvEl.addEventListener('input', function(){ this.value=this.value.replace(/\D/g,'').slice(0,4); });
  const expEl = document.getElementById('chkExpiry');
  if (expEl) expEl.addEventListener('input', function(){
    let v = this.value.replace(/[^\d/]/g, '');
    const idx = v.indexOf('/');
    if (idx >= 0) {
      let mm = v.substring(0, idx).replace(/\D/g, '').slice(0, 2);
      let yy = v.substring(idx + 1).replace(/\D/g, '').slice(0, 2);
      v = mm + '/' + yy;
    } else {
      v = v.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
    }
    this.value = v;
  });
  const saveWrap = document.getElementById('chkSaveLabelWrap');
  if (saveWrap) saveWrap.style.display = TB_api.isLoggedIn() ? 'flex' : 'none';
}

let dropdownOpen = false;
function toggleCardDropdown() {
  const dd   = document.getElementById('chkCardsDropdown');
  const icon = document.getElementById('chkToggleIcon');
  dropdownOpen = !dropdownOpen;
  dd.classList.toggle('open', dropdownOpen);
  icon.style.transform = dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}
function selectSavedCard(idx) {
  const saved = window._chkSavedCards || [];
  chkSelectedSavedIdx = idx;
  document.getElementById('chkSelectedCard').innerHTML = buildSelectedCardDisplay(saved[idx]);
  document.querySelectorAll('.chk-card-option[data-idx]').forEach((el, i) => {
    el.classList.toggle('active', i===idx);
    const chk = el.querySelector('.chk-card-opt-check');
    if (chk) chk.remove();
    if (i===idx) el.insertAdjacentHTML('beforeend','<span class="chk-card-opt-check"><i class="fa-solid fa-check"></i></span>');
  });
  document.getElementById('chkNewCardWrap').style.display='none';
  const saveWrap = document.getElementById('chkSaveLabelWrap');
  if (saveWrap) saveWrap.style.display='none';
  dropdownOpen=false;
  document.getElementById('chkCardsDropdown').classList.remove('open');
  document.getElementById('chkToggleIcon').style.transform='rotate(0deg)';
}
function selectNewCard() {
  chkSelectedSavedIdx = null;
  document.getElementById('chkSelectedCard').innerHTML=`
    <div class="chk-sel-card-inner">
      <span class="chk-sel-card-icon"><i class="fa-solid fa-plus-circle" style="color:var(--blue)"></i></span>
      <div><div class="chk-sel-card-name" style="color:var(--blue)">Nueva tarjeta</div></div>
    </div>`;
  document.querySelectorAll('.chk-card-option[data-idx]').forEach(el=>{ el.classList.remove('active'); const chk=el.querySelector('.chk-card-opt-check'); if(chk)chk.remove(); });
  document.querySelector('.chk-add-new-opt')?.classList.add('active');
  const wrap=document.getElementById('chkNewCardWrap');
  wrap.style.display='block'; wrap.innerHTML=buildNewCardForm(); setupNewCardInputs();
  dropdownOpen=false;
  document.getElementById('chkCardsDropdown').classList.remove('open');
  document.getElementById('chkToggleIcon').style.transform='rotate(0deg)';
}

/* ── PAGO (API) ───────────────────────────────────────────── */
async function handlePay() {
  const tel     = document.getElementById('chkTel').value.trim();
  const address = document.getElementById('chkAddress').value.trim();
  const city    = document.getElementById('chkCity').value.trim();
  const dept    = document.getElementById('chkDept').value.trim();
  const zip     = document.getElementById('chkZip').value.trim();

  let valid = true;
  if (!tel || !/^\d{8}$/.test(tel))  { TB_showToast('warn','Teléfono: 8 dígitos');   valid=false; }
  if (!address)                       { TB_showToast('warn','Dirección requerida');    valid=false; }
  if (!city)                          { TB_showToast('warn','Ciudad requerida');       valid=false; }
  if (!dept)                          { TB_showToast('warn','Selecciona un departamento'); valid=false; }
  if (!valid) return;

  // Validar pago
  let cardNum='', expiry='', saveCard=false;
  if (chkSelectedSavedIdx !== null) {
    const saved = window._chkSavedCards || [];
    const card  = saved[chkSelectedSavedIdx];
    cardNum='guardada'; expiry=card?.alias||'';
  } else {
    const cardEl   = document.getElementById('chkCard');
    const cvvEl    = document.getElementById('chkCVV');
    const expiryEl = document.getElementById('chkExpiry');
    const saveEl   = document.getElementById('chkSaveCard');
    if (!cardEl||!cvvEl||!expiryEl) { TB_showToast('warn','Completa los datos de pago'); return; }
    cardNum  = cardEl.value.replace(/\s/g,'');
    const cvv= cvvEl.value.trim();
    expiry   = expiryEl.value.trim();
    saveCard = saveEl ? saveEl.checked : false;
    const cardType = cardNum[0]==='4'?'visa':cardNum[0]==='5'?'mastercard':cardNum[0]==='3'?'amex':null;
    const expLen   = cardType==='amex'?15:16;
    const expCVV   = cardType==='amex'?4:3;
    if (!cardType)              { TB_showToast('warn','Tipo de tarjeta no reconocido'); return; }
    if (cardNum.length<expLen)  { TB_showToast('warn','Número de tarjeta inválido'); return; }
    if (!cvv||cvv.length<expCVV){ TB_showToast('warn','CVV inválido'); return; }
    if (!expiry||!/^\d{2}\/\d{2}$/.test(expiry)) { TB_showToast('warn','Vencimiento: MM/YY'); return; }
    const [mm, yy] = expiry.split('/').map(Number);
    if (mm < 1 || mm > 12) { TB_showToast('warn','Mes inválido (01-12)'); return; }
    const now = new Date();
    const expDate = new Date(2000 + yy, mm, 0);
    if (expDate <= now) { TB_showToast('warn','La tarjeta está vencida'); return; }
  }

  showProcessingState('loading');
  document.getElementById('chkPayBtn').disabled = true;

  // Guardar tarjeta nueva si el usuario lo pidió
  if (saveCard && TB_api.isLoggedIn() && cardNum !== 'guardada') {
    try {
      const type = cardNum[0]==='4'?'visa':cardNum[0]==='5'?'mastercard':'amex';
      await TB_api.post('/metodos-pago', {
        alias:    type.charAt(0).toUpperCase()+type.slice(1)+' •••• '+cardNum.slice(-4),
        tipo:     type,
        ultimos4: cardNum.slice(-4),
      });
    } catch(e) { /* no bloquear el pago */ }
  }

  // Crear pedido en la API si el usuario está logueado
  if (TB_api.isLoggedIn()) {
    try {
      const body  = { tel, address, city, dept: dept||city, zip };
      if (couponCode) body.cupon = couponCode;

      const result = await TB_api.post('/pedidos', body);
      const pedido = result.pedido;

      // Guardar datos de factura
      const shippingAmt = (typeof TB_shippingCost !== 'undefined' && TB_shippingCost > 0)
        ? TB_shippingCost : parseFloat(pedido.shipping || 0);
      const invoiceData = {
        id:       pedido.id_pedido,
        fecha:    pedido.fecha,
        dept:     dept || city,
        city:     city,
        discount: parseFloat(pedido.discount || 0),
        shipping: shippingAmt,
        items:    TB_cart.map(i=>({ name:i.name, brand:i.brand||'', qty:i.qty, price:i.price })),
      };
      sessionStorage.setItem('tb_last_order', JSON.stringify(invoiceData));

      TB_cart=[]; TB_updateCartUI();
      document.getElementById('chkSuccessOrderId').textContent =
        'Pedido #' + pedido.id_pedido + ' registrado correctamente';
      showProcessingState('success');
      setTimeout(() => { window.location.href='factura.html'; }, 1800);

    } catch(err) {
      console.error('Error al crear pedido:', err);
      showProcessingState('error');
      document.getElementById('chkPayBtn').disabled = false;
      TB_showToast('warn', err.message || 'Error al procesar el pedido. Intenta de nuevo.');
    }

  } else {
    TB_showToast('warn', 'Debes iniciar sesión para completar tu compra');
    setTimeout(() => {
      sessionStorage.setItem('tb_login_return', 'checkout.html');
      TB_navigate('login.html');
    }, 1200);
  }
}

/* ── PROCESSING OVERLAY ───────────────────────────────────── */
function showProcessingState(state) {
  document.getElementById('chkProcessing').classList.add('active');
  document.getElementById('chkStateLoading').style.display = state==='loading'?'flex':'none';
  document.getElementById('chkStateSuccess').style.display = state==='success'?'flex':'none';
  document.getElementById('chkStateError').style.display   = state==='error'  ?'flex':'none';
  if (state==='success'||state==='error') {
    const id  = state==='success'?'chkStateSuccess':'chkStateError';
    const el  = document.getElementById(id);
    const svg = el.querySelector('svg');
    if (svg) { const clone=svg.cloneNode(true); svg.parentNode.replaceChild(clone,svg); }
  }
}
function closeProcessingOverlay() {
  document.getElementById('chkProcessing').classList.remove('active');
  showProcessingState('loading');
}

function setupCardInput(inputId, iconId, hintId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = document.getElementById(iconId);
  const hint = document.getElementById(hintId);
  const cardIcons = {
    visa:       '<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/visa.svg" alt="Visa" class="tb-payment-icon">',
    mastercard: '<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/mastercard.svg" alt="Mastercard" class="tb-payment-icon">',
    amex:       '<img src="https://cdn.jsdelivr.net/npm/payment-icons/min/flat/amex.svg" alt="Amex" class="tb-payment-icon">',
  };
  input.addEventListener('input', () => {
    let raw=input.value.replace(/\D/g,'');
    const first=raw[0]; let val;
    if (first==='3') {
      raw=raw.slice(0,15);
      val=raw.replace(/(\d{4})(\d{0,6})(\d{0,5})/,(_,a,b,c)=>{ let f=a; if(b)f+=' '+b; if(c)f+=' '+c; return f.trim(); });
    } else {
      raw=raw.slice(0,16);
      val=raw.length>4?raw.match(/.{1,4}/g).join(' '):raw;
    }
    input.value=val;
    const type=first==='4'?'visa':first==='5'?'mastercard':first==='3'?'amex':null;
    if (type) { icon.innerHTML=cardIcons[type]; hint.textContent=type.charAt(0).toUpperCase()+type.slice(1); }
    else { icon.textContent=''; hint.textContent=raw.length>=1?'Tipo no reconocido':'16 dígitos'; }
  });
}
