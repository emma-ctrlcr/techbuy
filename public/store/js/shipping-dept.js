/* ══════════════════════════════════════════════════════════════
   TECHBUY — shipping-dept.js
   Autocomplete de departamentos + cálculo de envío en tiempo real.

   CÓMO INTEGRAR:
   1. Copia este archivo a tu carpeta /js/
   2. Agrega en checkout.html ANTES de cerrar </body>:
        <script src="../js/shipping-dept.js"></script>
   3. Reemplaza el campo #chkDept en tu HTML por el bloque
      marcado como "BLOQUE HTML — pega esto en tu checkout.html"
   4. En tu updateSummary() agrega la línea marcada con ★
══════════════════════════════════════════════════════════════ */


/* ── 1. TABLA DE PRECIOS DE ENVÍO (C$) ─────────────────────── */
const shippingPrices = {
  "Managua":    60,
  "Masaya":     80,
  "Granada":    90,
  "Carazo":     90,
  "León":       120,
  "Chinandega": 140,
  "Rivas":      130,
  "Boaco":      120,
  "Chontales":  150,
  "Matagalpa":  140,
  "Jinotega":   160,
  "Estelí":     150,
  "Madriz":     170,
  "Nueva Segovia": 180,
  "Río San Juan":  220,
  "Región Autónoma de la Costa Caribe Norte": 320,
  "Región Autónoma de la Costa Caribe Sur":   350
};

const DEPT_LIST = Object.keys(shippingPrices);

/* Precio de envío actualmente seleccionado (córdobas).
   Tu updateSummary() debe leer esta variable. */
let TB_shippingCost = 0;


/* ── 2. INICIALIZAR EL AUTOCOMPLETE ─────────────────────────── */
function initDeptAutocomplete() {
  const wrapper  = document.getElementById('deptComboWrapper');
  const input    = document.getElementById('deptComboInput');
  const dropdown = document.getElementById('deptComboList');
  const hidden   = document.getElementById('chkDept');       // valor real
  const costEl   = document.getElementById('deptShippingCost');

  if (!wrapper || !input || !dropdown) return; // aún no está en el DOM

  let activeIdx = -1;

  /* ── Filtrar y renderizar opciones ── */
  function renderList(filter) {
    const q = removeAccents(filter.toLowerCase().trim());
    const matches = DEPT_LIST.filter(d =>
      removeAccents(d.toLowerCase()).includes(q)
    );

    dropdown.innerHTML = '';
    activeIdx = -1;

    if (!matches.length) {
      dropdown.innerHTML = '<li class="dept-no-result">Sin resultados</li>';
      openDropdown();
      return;
    }

    matches.forEach((dept, i) => {
      const li = document.createElement('li');
      li.className = 'dept-option';
      li.setAttribute('role', 'option');
      li.setAttribute('data-dept', dept);

      // Resaltar coincidencia
      const deptNorm = removeAccents(dept.toLowerCase());
      const start    = deptNorm.indexOf(q);
      if (q && start !== -1) {
        li.innerHTML =
          escHtml(dept.slice(0, start)) +
          '<mark>' + escHtml(dept.slice(start, start + filter.length)) + '</mark>' +
          escHtml(dept.slice(start + filter.length));
      } else {
        li.textContent = dept;
      }

      // Precio a la derecha
      const price = document.createElement('span');
      price.className = 'dept-price';
      price.textContent = TB_formatPrice(shippingPrices[dept]);
      li.appendChild(price);

      li.addEventListener('mousedown', e => {
        e.preventDefault(); // evitar blur antes de seleccionar
        selectDept(dept);
      });
      dropdown.appendChild(li);
    });

    openDropdown();
    if (matches.length === 1) setActive(0);
  }

  /* ── Seleccionar departamento ── */
  function selectDept(dept) {
    input.value  = dept;
    hidden.value = dept;

    TB_shippingCost = shippingPrices[dept] || 0;

    if (costEl) {
      costEl.textContent = 'Envío: ' + TB_formatPrice(TB_shippingCost);
      costEl.classList.add('dept-cost-visible');
    }

    closeDropdown();
    input.setAttribute('aria-expanded', 'false');

    // ★ Recalcular totales del checkout
    if (typeof updateSummary === 'function') updateSummary();
  }

  /* ── Navegación con teclado ── */
  input.addEventListener('keydown', e => {
    const items = dropdown.querySelectorAll('.dept-option');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) {
        selectDept(items[activeIdx].dataset.dept);
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  /* ── Input: filtrar mientras se escribe ── */
  input.addEventListener('input', () => {
    hidden.value = '';
    TB_shippingCost = 0;
    if (costEl) costEl.classList.remove('dept-cost-visible');
    if (typeof updateSummary === 'function') updateSummary();

    if (input.value.trim()) {
      renderList(input.value);
    } else {
      renderList('');
    }
  });

  /* ── Abrir al hacer foco ── */
  input.addEventListener('focus', () => {
    renderList(input.value);
    input.setAttribute('aria-expanded', 'true');
  });

  /* ── Cerrar al perder foco ── */
  input.addEventListener('blur', () => {
    // Pequeño delay para que mousedown en opciones se ejecute primero
    setTimeout(() => {
      closeDropdown();
      input.setAttribute('aria-expanded', 'false');
      // Si lo escrito no coincide exactamente, limpiar
      if (!shippingPrices[input.value]) {
        input.value  = '';
        hidden.value = '';
        TB_shippingCost = 0;
        if (costEl) costEl.classList.remove('dept-cost-visible');
        if (typeof updateSummary === 'function') updateSummary();
      }
    }, 150);
  });

  /* ── Helpers ── */
  function openDropdown()  { dropdown.classList.add('dept-open');  wrapper.classList.add('dept-wrapper-open'); }
  function closeDropdown() { dropdown.classList.remove('dept-open'); wrapper.classList.remove('dept-wrapper-open'); activeIdx = -1; }

  function setActive(idx) {
    const items = dropdown.querySelectorAll('.dept-option');
    items.forEach(li => li.classList.remove('dept-active'));
    activeIdx = idx;
    if (items[idx]) {
      items[idx].classList.add('dept-active');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }
}

/* ── 3. UTILIDADES ───────────────────────────────────────────── */
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ── 4. ESPERAR A QUE EL DOM DEL CHECKOUT ESTÉ LISTO ────────── */
/* El checkout.js renderiza el HTML dinámicamente; usamos un
   MutationObserver para detectar cuándo aparece el campo. */
(function waitForCheckoutDOM() {
  const target = document.body;
  const obs = new MutationObserver(() => {
    if (document.getElementById('deptComboWrapper')) {
      obs.disconnect();
      initDeptAutocomplete();
    }
  });
  obs.observe(target, { childList: true, subtree: true });

  // También intentar de inmediato si ya está en el DOM
  if (document.readyState !== 'loading') {
    if (document.getElementById('deptComboWrapper')) initDeptAutocomplete();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('deptComboWrapper')) initDeptAutocomplete();
    });
  }
})();
