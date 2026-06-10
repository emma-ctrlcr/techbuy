/* ══════════════════════════════════════════════════════════════
   TECHBUY — factura.js
   Sistema de facturación post-pago.
   Requiere: datos.js → shared.js → factura.js
   Librerías externas: html2canvas, jsPDF (cargadas en el HTML)
══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  await TB_loadCart();
  TB_setupSharedHeader();
  TB_setupCartSidebar();
  TB_setupAccountBtn();
  TB_updateCartUI();

  renderFactura();
});

/* ── GENERAR NÚMERO DE FACTURA ────────────────────────────── */
function generateInvoiceNumber(order) {
  if (!order || !order.fecha) return 'TB-000000-XXXXXX';
  const d = new Date(order.fecha);
  if (isNaN(d.getTime())) return 'TB-000000-XXXXXX';
  const parts = new Intl.DateTimeFormat('es-NI', {
    timeZone: 'America/Managua',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  const ymd = map.year + map.month + map.day;
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `TB-${ymd}-${rand}`;
}

/* ── RENDER PRINCIPAL ─────────────────────────────────────── */
function renderFactura() {
  // 1. Leer datos del pedido desde sessionStorage (guardados por checkout.js)
  const raw = sessionStorage.getItem('tb_last_order');
  if (!raw) {
    // Si no hay pedido, redirigir al inicio
    window.location.href = '1.html';
    return;
  }

  const order = JSON.parse(raw);

  // 2. Leer datos del usuario
  const userRaw = localStorage.getItem('techbuy_user');
  let user = { nombre: 'Cliente', apellido: '', email: 'invitado@techbuy.com', city: '', address: '' };
  if (userRaw) {
    try { user = { ...user, ...JSON.parse(userRaw) }; } catch(e) {}
  }

  const fullName = (user.nombre + ' ' + (user.apellido || '')).trim() || 'Cliente TechBuy';
  const dept     = order.dept   || user.city || 'Nicaragua';
  const city     = order.city   || user.city || '';
  const invoiceNum = generateInvoiceNumber(order);

  // 3. Fecha oficial desde backend, formateada en timezone América/Managua
  const fechaStr = order.fecha ? TB_formatDate(order.fecha) : '—';

  // 4. Poblar cabecera
  document.getElementById('facNum').textContent       = invoiceNum;
  document.getElementById('facClientName').textContent = fullName;
  document.getElementById('facClientEmail').textContent = user.email;
  document.getElementById('facClientDept').textContent  =
    (city ? city + ', ' : '') + dept;
  document.getElementById('facDate').textContent = fechaStr;
  document.getElementById('facOrder').textContent = 'Pedido #' + (order.id || '—');

  // 5. Calcular totales
  const items    = order.items || [];         // array de { name, brand, qty, price }
  const subtotalSinIva = items.reduce((s, i) => s + i.price * i.qty, 0);
  const iva        = subtotalSinIva * 0.15;
  const withIva    = subtotalSinIva + iva;
  const discount   = order.discount || 0;     // monto ya calculado
  const SHIPPING_BY_DEPT = {"Managua":60,"Masaya":80,"Granada":90,"Carazo":90,"León":120,"Chinandega":140,"Rivas":130,"Boaco":120,"Chontales":150,"Matagalpa":140,"Jinotega":160,"Estelí":150,"Madriz":170,"Nueva Segovia":180,"Río San Juan":220,"Región Autónoma de la Costa Caribe Norte":320,"Región Autónoma de la Costa Caribe Sur":350};
  const costByDept  = (order.dept && SHIPPING_BY_DEPT[order.dept]) ? SHIPPING_BY_DEPT[order.dept] : null;
  const shipping    = order.shipping != null ? order.shipping : (costByDept != null ? costByDept : (withIva > 100 ? 0 : 9.99));
  const total      = withIva - discount + shipping;

  // 6. Renderizar filas de productos
  const tbody = document.getElementById('facTableBody');
  tbody.innerHTML = items.map(item => {
    const unitSinIva  = item.price;
    const ivaUnit     = unitSinIva * 0.15;
    const lineTotal   = (unitSinIva + ivaUnit) * item.qty;
    return `
      <tr>
        <td>
          <div class="fac-prod-name">${escapeHtml(item.name)}</div>
          <div class="fac-prod-brand">${escapeHtml(item.brand || '')}</div>
        </td>
        <td class="fac-td-center">
          <span class="fac-qty-badge">${item.qty}</span>
        </td>
        <td class="fac-td-center fac-price">${TB_formatPrice(unitSinIva)}</td>
        <td class="fac-td-center fac-price" style="color:#6b7280">${TB_formatPrice(ivaUnit * item.qty)}</td>
        <td class="fac-subtotal-cell">${TB_formatPrice(lineTotal)}</td>
      </tr>`;
  }).join('');

  // 7. Renderizar totales
  document.getElementById('facSubtotal').textContent = TB_formatPrice(subtotalSinIva);
  document.getElementById('facIva').textContent      = TB_formatPrice(iva);
  document.getElementById('facShipping').textContent = shipping === 0 ? 'Gratis' : (order.shipping != null ? TB_formatPrice(shipping) : TB_formatPrice(shipping));
  document.getElementById('facTotal').textContent    = TB_formatPrice(total);

  if (discount > 0) {
    document.getElementById('facDiscountRow').style.display = 'flex';
    document.getElementById('facDiscount').textContent = '-' + TB_formatPrice(discount);
  }

  // 8. Guardar número de factura en sessionStorage (para referencia)
  sessionStorage.setItem('tb_invoice_num', invoiceNum);
}

/* ── EXPORTAR A PDF (blanco y negro, diseño limpio) ──────────── */
/* ── Convierte img a base64 para jsPDF ─────────────────────── */
function imgToBase64(imgEl) {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = imgEl.naturalWidth  || imgEl.width  || 180;
      canvas.height = imgEl.naturalHeight || imgEl.height || 100;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    } catch(e) {
      resolve(null);
    }
  });
}

async function downloadPDF() {
  const btn = document.getElementById('facBtnPdf');
  btn.classList.add('loading');
  btn.innerHTML = '<div class="fac-btn-spinner"></div> Generando PDF...';
  btn.disabled  = true;

  try {
    await sleep(60);

    // Obtener logo desde la imagen del header (sin logo_b64.js)
    const logoImgEl = document.querySelector('.tb-logo-img');
    const logoB64   = logoImgEl ? await imgToBase64(logoImgEl) : null;

    // ── Leer datos del DOM ──────────────────────────────────
    const invNum     = document.getElementById('facNum').textContent;
    const clientName = document.getElementById('facClientName').textContent;
    const clientEmail= document.getElementById('facClientEmail').textContent;
    const clientDept = document.getElementById('facClientDept').textContent;
    const dateStr    = document.getElementById('facDate').textContent;
    const orderStr   = document.getElementById('facOrder').textContent;
    const subtotalTx = document.getElementById('facSubtotal').textContent;
    const ivaTx      = document.getElementById('facIva').textContent;
    const shippingTx = document.getElementById('facShipping').textContent.replace('🎉','').trim();
    const totalTx    = document.getElementById('facTotal').textContent;

    const discRow    = document.getElementById('facDiscountRow');
    const hasDiscount= discRow && discRow.style.display !== 'none';
    const discountTx = hasDiscount ? document.getElementById('facDiscount').textContent : null;

    const rows = document.querySelectorAll('#facTableBody tr');
    const items = Array.from(rows).map(tr => {
      const tds = tr.querySelectorAll('td');
      return {
        name:     tds[0].querySelector('.fac-prod-name')?.textContent.trim() || '',
        brand:    tds[0].querySelector('.fac-prod-brand')?.textContent.trim() || '',
        qty:      tds[1].textContent.trim(),
        unitPrice:tds[2].textContent.trim(),
        iva:      tds[3].textContent.trim(),
        subtotal: tds[4].textContent.trim(),
      };
    });

    // ── Configurar jsPDF ────────────────────────────────────
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const PW = 215.9;
    const ML = 18;
    const MR = PW - ML;
    const CW = PW - ML * 2;

    // Paleta: solo blanco, negro y grises
    const BLACK  = [0,   0,   0  ];
    const DGRAY  = [60,  60,  60 ];
    const MGRAY  = [120, 120, 120];
    const LGRAY  = [210, 210, 210];
    const XLGRAY = [245, 245, 245];
    const WHITE  = [255, 255, 255];

    let y = ML;

    // ══════════════════════════════════════════════
    // BLOQUE 1: ENCABEZADO
    // ══════════════════════════════════════════════

    // Logo (izquierda)
    try {
      if (!logoB64) throw new Error('no logo');
      pdf.addImage(logoB64, 'PNG', ML, y, 36, 20);
    } catch(e) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(...BLACK);
      pdf.text('TECHBUY', ML, y + 14);
    }

    // Número de factura (derecha)
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...MGRAY);
    pdf.text('FACTURA N\u00BA', MR, y + 6, { align: 'right' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(...BLACK);
    pdf.text(invNum, MR, y + 14, { align: 'right' });

    // Badge PAGADO simple (borde negro)
    const bW = 24, bH = 6;
    pdf.setDrawColor(...DGRAY);
    pdf.setLineWidth(0.4);
    pdf.rect(MR - bW, y + 17, bW, bH, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...DGRAY);
    pdf.text('• PAGADO', MR - bW / 2, y + 21.2, { align: 'center' });

    y += 26;

    // Línea separadora
    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.4);
    pdf.line(ML, y, MR, y);

    // Datos de contacto debajo del logo
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...MGRAY);
    pdf.text('Managua, NI  \u00b7  +505 8888-0000  \u00b7  info@techbuy.com', ML, y);

    // ══════════════════════════════════════════════
    // BLOQUE 2: DATOS DEL CLIENTE Y FECHA
    // ══════════════════════════════════════════════
    y += 10;

    // Columna izquierda
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...MGRAY);
    pdf.text('FACTURADO A', ML, y);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...BLACK);
    pdf.text(clientName, ML, y + 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...DGRAY);
    pdf.text(clientEmail, ML, y + 12);
    pdf.text(clientDept,  ML, y + 18);

    // Columna derecha
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...MGRAY);
    pdf.text('FECHA DE EMISI\u00d3N', MR, y, { align: 'right' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...BLACK);
    const dateShort = dateStr.length > 42 ? dateStr.substring(0, 42) + '...' : dateStr;
    pdf.text(dateShort, MR, y + 6, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...DGRAY);
    pdf.text('M\u00e9todo: Tarjeta de cr\u00e9dito/d\u00e9bito', MR, y + 12, { align: 'right' });
    pdf.text(orderStr, MR, y + 18, { align: 'right' });

    y += 26;

    // Línea separadora
    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.4);
    pdf.line(ML, y, MR, y);

    // ══════════════════════════════════════════════
    // BLOQUE 3: TABLA DE PRODUCTOS
    // ══════════════════════════════════════════════
    y += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MGRAY);
    pdf.text('DETALLE DE PRODUCTOS', ML, y);
    y += 5;

    // Columnas
    const cols = [
      { label: 'PRODUCTO',     x: ML,        w: 80,  align: 'left'   },
      { label: 'CANT.',        x: ML + 80,   w: 18,  align: 'center' },
      { label: 'PRECIO UNIT.', x: ML + 98,   w: 30,  align: 'center' },
      { label: 'IVA (15%)',    x: ML + 128,  w: 28,  align: 'center' },
      { label: 'SUBTOTAL',     x: ML + 156,  w: CW - 156, align: 'right' },
    ];

    // Encabezado tabla — fondo gris claro
    const TH_H = 8;
    pdf.setFillColor(...XLGRAY);
    pdf.rect(ML, y, CW, TH_H, 'F');
    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.3);
    pdf.rect(ML, y, CW, TH_H, 'S');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...DGRAY);

    cols.forEach(col => {
      const tx = col.align === 'right'  ? col.x + col.w - 1 :
                 col.align === 'center' ? col.x + col.w / 2  : col.x + 2;
      pdf.text(col.label, tx, y + 5.5, { align: col.align });
    });

    y += TH_H;

    // Filas de productos
    const ROW_H = 13;
    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.2);

    items.forEach((item) => {
      // Nombre
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...BLACK);
      const nameMax = 42;
      const nameTxt = item.name.length > nameMax ? item.name.substring(0, nameMax) + '\u2026' : item.name;
      pdf.text(nameTxt, cols[0].x + 2, y + 5.5);

      // Marca
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...MGRAY);
      pdf.text(item.brand, cols[0].x + 2, y + 10.5);

      // Cantidad
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...DGRAY);
      const qtyX = cols[1].x + cols[1].w / 2;
      pdf.text(item.qty, qtyX, y + 8, { align: 'center' });

      // Precio unit
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...DGRAY);
      const priceX = cols[2].x + cols[2].w / 2;
      pdf.text(item.unitPrice, priceX, y + 8, { align: 'center' });

      // IVA
      const ivaX = cols[3].x + cols[3].w / 2;
      pdf.text(item.iva, ivaX, y + 8, { align: 'center' });

      // Subtotal
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...BLACK);
      const stX = cols[4].x + cols[4].w - 1;
      pdf.text(item.subtotal, stX, y + 8, { align: 'right' });

      // Línea inferior
      pdf.setDrawColor(...LGRAY);
      pdf.line(ML, y + ROW_H, MR, y + ROW_H);

      y += ROW_H;
    });

    // ══════════════════════════════════════════════
    // BLOQUE 4: TOTALES (caja derecha)
    // ══════════════════════════════════════════════
    y += 8;

    const BOX_W = 84;
    const BOX_X = MR - BOX_W;
    const ROW_T = 8;
    const numRows = 3 + (hasDiscount ? 1 : 0);
    const BOX_H  = ROW_T * numRows + ROW_T + 2;

    // Borde de la caja
    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.3);
    pdf.rect(BOX_X, y, BOX_W, BOX_H, 'S');

    let ty = y + ROW_T - 1;

    const drawTotalRow = (label, value, isGrand = false) => {
      if (isGrand) {
        // Fondo negro para el total
        const grandH = ROW_T + 3;
        const grandY = ty - ROW_T + 1;
        pdf.setFillColor(...BLACK);
        pdf.rect(BOX_X, grandY, BOX_W, grandH, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(...WHITE);
        pdf.text(label, BOX_X + 4, ty + 2.5);
        pdf.setFontSize(10);
        pdf.text(value, MR - 1, ty + 2.5, { align: 'right' });
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(...DGRAY);
        pdf.text(label, BOX_X + 4, ty);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...BLACK);
        pdf.text(value, MR - 1, ty, { align: 'right' });
        // Línea divisora
        pdf.setDrawColor(...LGRAY);
        pdf.setLineWidth(0.2);
        pdf.line(BOX_X + 2, ty + 3, MR, ty + 3);
      }
      ty += ROW_T;
    };

    drawTotalRow('Subtotal (sin IVA)', subtotalTx);
    drawTotalRow('IVA incluido (15%)', ivaTx);
    if (hasDiscount) drawTotalRow('Descuento cup\u00f3n', discountTx);
    drawTotalRow('Env\u00edo', shippingTx);
    drawTotalRow('TOTAL PAGADO', totalTx, true);

    y += BOX_H + 14;

    // ══════════════════════════════════════════════
    // BLOQUE 5: PIE DE PÁGINA
    // ══════════════════════════════════════════════
    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.4);
    pdf.line(ML, y, MR, y);
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MGRAY);
    pdf.text(
      'Esta factura es un comprobante v\u00e1lido de tu compra en TechBuy. Conserva este documento.',
      ML, y
    );
    y += 5;
    pdf.text('techbuy.com  |  info@techbuy.com  |  +505 8888-0000', ML, y);

    // Sello verificado (solo texto, sin color)
    const sealX = MR - 10;
    pdf.setDrawColor(...DGRAY);
    pdf.setLineWidth(0.6);
    pdf.circle(sealX, y - 4, 7, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6);
    pdf.setTextColor(...DGRAY);
    pdf.text('\u2713 OK', sealX, y - 2.5, { align: 'center' });
    pdf.setFontSize(5.5);
    pdf.text('VERIFICADO', sealX, y + 4.5, { align: 'center' });

    // ── Guardar ──────────────────────────────────
    const invoiceNum = sessionStorage.getItem('tb_invoice_num') || invNum || 'factura';
    pdf.save(`TechBuy_${invoiceNum}.pdf`);

    TB_showToast('<i class="fa-solid fa-circle-check" style="color:#16a34a"></i>', '\u00a1PDF descargado correctamente!');

  } catch (err) {
    console.error('Error al generar PDF:', err);
    TB_showToast('<i class="fa-solid fa-triangle-exclamation"></i>', 'Error al generar el PDF. Intenta de nuevo.');
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Descargar Factura PDF';
    btn.disabled  = false;
  }
}

/* ── UTILIDADES ───────────────────────────────────────────── */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
