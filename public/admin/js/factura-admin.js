/* ══════════════════════════════════════════════════════════════
   TECHBUY — factura-admin.js (clon exacto de factura.js)
   Requiere: global.js (apiFetch, API)
══════════════════════════════════════════════════════════════ */

const SHIPPING_BY_DEPT = {
  "Managua":60,"Masaya":80,"Granada":90,"Carazo":90,
  "León":120,"Chinandega":140,"Rivas":130,"Boaco":120,
  "Chontales":150,"Matagalpa":140,"Jinotega":160,
  "Estelí":150,"Madriz":170,"Nueva Segovia":180,
  "Río San Juan":220,
  "Región Autónoma de la Costa Caribe Norte":320,
  "Región Autónoma de la Costa Caribe Sur":350
};

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('id');
  if (!orderId) {
    showAlert('No se especificó una orden', 'error');
    document.getElementById('loadingState').querySelector('p').textContent = 'ID de orden no válido';
    return;
  }

  await (window.authPromise || Promise.resolve());

  try {
    console.log('[factura-admin] orderId:', orderId);
    const ordenes = await apiFetch(API.ordenes);
    const orden = ordenes.find(o => o.id_pedido == orderId);
    if (!orden) throw new Error('Orden no encontrada');
    console.log('[factura-admin] orden keys:', Object.keys(orden));
    console.log('[factura-admin] fecha value:', orden.fecha, 'type:', typeof orden.fecha);
    console.log('[factura-admin] all date-like fields:', { fecha: orden.fecha, created_at: orden.created_at, fecha_creacion: orden.fecha_creacion, date: orden.date });

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('facturaContainer').style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Factura - Orden #' + orden.id_pedido;
    renderFactura(orden);
  } catch (e) {
    showAlert('Error al cargar orden: ' + e.message, 'error');
    document.getElementById('loadingState').querySelector('p').textContent = 'Error al cargar';
  }
});

function generateInvoiceNumber(orderId, fechaStr) {
  if (!fechaStr) return 'TB-000000-' + String(orderId).padStart(6, '0');
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return 'TB-000000-' + String(orderId).padStart(6, '0');
  const parts = new Intl.DateTimeFormat('es-NI', {
    timeZone: 'America/Managua',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  const ymd = map.year + map.month + map.day;
  return 'TB-' + ymd + '-' + String(orderId).padStart(6, '0');
}

function renderFactura(orden) {
  const invoiceNum = generateInvoiceNumber(orden.id_pedido, orden.fecha);
  const dateVal = orden.fecha ?? orden.created_at ?? orden.fecha_creacion ?? orden.date;
  if (dateVal == null) console.warn('[factura-admin] No date field found in orden:', Object.keys(orden));
  const fecha = formatDate(dateVal);

  const fullName = orden.usuario_nombre || 'Cliente TechBuy';
  const dept     = orden.dept || 'Nicaragua';
  const city     = orden.city || '';

  document.getElementById('facNum').textContent        = invoiceNum;
  document.getElementById('facClientName').textContent  = fullName;
  document.getElementById('facClientEmail').textContent = orden.email || orden.usuario_email || '';
  document.getElementById('facClientDept').textContent  = (city ? city + ', ' : '') + dept;
  document.getElementById('facDate').textContent = fecha;
  document.getElementById('facOrder').textContent = 'Pedido #' + orden.id_pedido;

  const detalles = orden.detalles || [];
  const items = detalles.map(d => ({
    name:  d.producto_nombre || 'Producto #' + d.id_producto,
    brand: d.brand || '',
    qty:   d.cantidad,
    price: parseFloat(d.precio_unitario),
  }));

  const subtotalSinIva = items.reduce((s, i) => s + i.price * i.qty, 0);
  const iva        = subtotalSinIva * 0.15;
  const withIva    = subtotalSinIva + iva;
  const discount   = parseFloat(orden.discount || 0);
  const costByDept = (orden.dept && SHIPPING_BY_DEPT[orden.dept]) ? SHIPPING_BY_DEPT[orden.dept] : null;
  const shipping   = orden.shipping != null ? orden.shipping : (costByDept != null ? costByDept : (withIva > 100 ? 0 : 9.99));
  const total      = withIva - discount + shipping;

  const tbody = document.getElementById('facTableBody');
  tbody.innerHTML = items.map(item => {
    const unitSinIva = item.price;
    const ivaUnit    = unitSinIva * 0.15;
    const lineTotal  = (unitSinIva + ivaUnit) * item.qty;
    return `
      <tr>
        <td>
          <div class="fac-prod-name">${escapeHtml(item.name)}</div>
          <div class="fac-prod-brand">${escapeHtml(item.brand)}</div>
        </td>
        <td class="fac-td-center">
          <span class="fac-qty-badge">${item.qty}</span>
        </td>
        <td class="fac-td-center fac-price">C$${formatPrice(unitSinIva)}</td>
        <td class="fac-td-center fac-price" style="color:#6b7280">C$${formatPrice(ivaUnit * item.qty)}</td>
        <td class="fac-subtotal-cell">C$${formatPrice(lineTotal)}</td>
      </tr>`;
  }).join('');

  document.getElementById('facSubtotal').textContent = 'C$' + formatPrice(subtotalSinIva);
  document.getElementById('facIva').textContent      = 'C$' + formatPrice(iva);
  document.getElementById('facShipping').textContent = shipping === 0 ? 'Gratis' : 'C$' + formatPrice(shipping);
  document.getElementById('facTotal').textContent    = 'C$' + formatPrice(total);

  if (discount > 0) {
    document.getElementById('facDiscountRow').style.display = 'flex';
    document.getElementById('facDiscount').textContent = '-C$' + formatPrice(discount);
  }
}

/* ── EXPORTAR A PDF ──────────────────────────────────────── */
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

    const logoImgEl = document.querySelector('.fac-brand-logo');
    const logoB64   = logoImgEl && logoImgEl.complete && logoImgEl.naturalWidth > 0 ? await imgToBase64(logoImgEl) : null;

    const invNum     = document.getElementById('facNum').textContent;
    const clientName = document.getElementById('facClientName').textContent;
    const clientEmail= document.getElementById('facClientEmail').textContent;
    const clientDept = document.getElementById('facClientDept').textContent;
    const dateStr    = document.getElementById('facDate').textContent;
    const orderStr   = document.getElementById('facOrder').textContent;
    const subtotalTx = document.getElementById('facSubtotal').textContent;
    const ivaTx      = document.getElementById('facIva').textContent;
    const shippingTx = document.getElementById('facShipping').textContent;
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

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    const PW = 215.9;
    const ML = 18;
    const MR = PW - ML;
    const CW = PW - ML * 2;

    const BLACK  = [0,   0,   0  ];
    const DGRAY  = [60,  60,  60 ];
    const MGRAY  = [120, 120, 120];
    const LGRAY  = [210, 210, 210];
    const XLGRAY = [245, 245, 245];
    const WHITE  = [255, 255, 255];

    let y = ML;

    try {
      if (!logoB64) throw new Error('no logo');
      pdf.addImage(logoB64, 'PNG', ML, y, 36, 20);
    } catch(e) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(...BLACK);
      pdf.text('TECHBUY', ML, y + 14);
    }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...MGRAY);
    pdf.text('FACTURA N\u00ba', MR, y + 6, { align: 'right' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(...BLACK);
    pdf.text(invNum, MR, y + 14, { align: 'right' });

    const bW = 24, bH = 6;
    pdf.setDrawColor(...DGRAY);
    pdf.setLineWidth(0.4);
    pdf.rect(MR - bW, y + 17, bW, bH, 'S');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...DGRAY);
    pdf.text('\u2022 PAGADO', MR - bW / 2, y + 21.2, { align: 'center' });

    y += 26;

    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.4);
    pdf.line(ML, y, MR, y);

    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...MGRAY);
    pdf.text('Managua, NI  \u00b7  +505 8888-0000  \u00b7  info@techbuy.com', ML, y);

    y += 10;

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

    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.4);
    pdf.line(ML, y, MR, y);

    y += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MGRAY);
    pdf.text('DETALLE DE PRODUCTOS', ML, y);
    y += 5;

    const cols = [
      { label: 'PRODUCTO',     x: ML,        w: 80,  align: 'left'   },
      { label: 'CANT.',        x: ML + 80,   w: 18,  align: 'center' },
      { label: 'PRECIO UNIT.', x: ML + 98,   w: 30,  align: 'center' },
      { label: 'IVA (15%)',    x: ML + 128,  w: 28,  align: 'center' },
      { label: 'SUBTOTAL',     x: ML + 156,  w: CW - 156, align: 'right' },
    ];

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

    const ROW_H = 13;
    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.2);

    items.forEach((item) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...BLACK);
      const nameMax = 42;
      const nameTxt = item.name.length > nameMax ? item.name.substring(0, nameMax) + '\u2026' : item.name;
      pdf.text(nameTxt, cols[0].x + 2, y + 5.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...MGRAY);
      pdf.text(item.brand, cols[0].x + 2, y + 10.5);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...DGRAY);
      const qtyX = cols[1].x + cols[1].w / 2;
      pdf.text(item.qty, qtyX, y + 8, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...DGRAY);
      const priceX = cols[2].x + cols[2].w / 2;
      pdf.text(item.unitPrice, priceX, y + 8, { align: 'center' });

      const ivaX = cols[3].x + cols[3].w / 2;
      pdf.text(item.iva, ivaX, y + 8, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...BLACK);
      const stX = cols[4].x + cols[4].w - 1;
      pdf.text(item.subtotal, stX, y + 8, { align: 'right' });

      pdf.setDrawColor(...LGRAY);
      pdf.line(ML, y + ROW_H, MR, y + ROW_H);

      y += ROW_H;
    });

    y += 8;

    const BOX_W = 84;
    const BOX_X = MR - BOX_W;
    const ROW_T = 8;
    const numRows = 3 + (hasDiscount ? 1 : 0);
    const BOX_H  = ROW_T * numRows + ROW_T + 2;

    pdf.setDrawColor(...LGRAY);
    pdf.setLineWidth(0.3);
    pdf.rect(BOX_X, y, BOX_W, BOX_H, 'S');

    let ty = y + ROW_T - 1;

    const drawTotalRow = (label, value, isGrand) => {
      if (isGrand) {
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

    const invoiceNum = document.getElementById('facNum').textContent || 'factura';
    pdf.save('TechBuy_' + invoiceNum + '.pdf');

    showAlert('\u00a1PDF descargado correctamente!', 'success');

  } catch (err) {
    console.error('Error al generar PDF:', err);
    showAlert('Error al generar el PDF. Intenta de nuevo.', 'error');
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

window.downloadPDF = downloadPDF;