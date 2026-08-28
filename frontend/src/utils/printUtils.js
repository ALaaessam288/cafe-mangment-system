import { storage } from './storage';

/**
 * printReceipt - Works in both Electron (via IPC) and browser (via window.open)
 * @param {string} htmlContent - Full HTML string to print
 * @param {{width:number,maxHeight:number}=} pageSize - Page width in mm plus options
 */
export function printReceipt(htmlContent, pageSize) {
  // If running inside Electron, use native IPC print.
  if (window.api && window.api.isElectron && window.api.printReceipt) {
    window.api.printReceipt(htmlContent, pageSize);
    return;
  }

  // Fallback: browser print via new window
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة');
    return;
  }
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}

/* ────────────────────────────────────────────────────────────
 * Thermal-printer-safe primitives (ASCII digits & safe text).
 * ──────────────────────────────────────────────────────────── */

/** Latin digits always - never Intl currency formatting on a receipt. */
function money(amount) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (num == null || Number.isNaN(num)) return '0.00';
  return num.toFixed(2);
}

/** dd/MM/yyyy HH:mm in ASCII digits. */
function stamp(value) {
  const date = value ? new Date(value) : new Date();
  const d = Number.isNaN(date.getTime()) ? new Date() : date;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Receipts are built from untrusted product/customer names - escape them. */
function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Shared 80mm thermal page setup - exact full width for 80mm/80*210 rolls.
 */
const baseCss = (pageSize = '80mm auto') => `
  @page { size: ${pageSize}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body {
    width: 100%;
    margin: 0;
    padding: 1.5mm 1mm 5mm 1mm;
    background: #fff;
    color: #000;
    direction: rtl;
    text-align: right;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 13.5px;
    line-height: 1.3;
    -webkit-font-smoothing: antialiased;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  @media print {
    html, body { width: 100% !important; max-width: 100% !important; margin: 0 auto !important; padding: 1mm 0.5mm 4mm 0.5mm !important; }
  }
  /* Latin digits in an RTL run */
  .num { font-family: Arial, sans-serif; direction: ltr; unicode-bidi: embed; white-space: nowrap; font-weight: 800; }
`;

/**
 * Build receipt HTML for an order
 */
export function buildReceiptHtml({ order, cafeName }) {
  let user = null;
  try {
    user = storage.getUser();
  } catch (_) {}
  const displayCafeName = cafeName || order?.tenantName || user?.tenantName || 'كافيه ونس';
  const items = (order?.items || []).filter((i) => i.status !== 'CANCELLED');

  // Aggregate by name + unit price + note
  const aggregated = items.reduce((acc, item) => {
    const name = item.productNameSnapshot || item.name || '';
    const note = item.note || '';
    const unit = Number(item.unitPriceSnapshot ?? 0);
    const qty = Number(item.quantity ?? 0);
    const lineTotal = Number(item.lineTotal ?? unit * qty);
    const key = `${name}@@${unit}@@${note}`;
    if (!acc[key]) acc[key] = { name, note, unit, quantity: 0, lineTotal: 0 };
    acc[key].quantity += qty;
    acc[key].lineTotal += lineTotal;
    return acc;
  }, {});
  const aggregatedItems = Object.values(aggregated);

  const itemsRows = aggregatedItems
    .map(
      (ai) => `
    <tr>
      <td class="it-name">
        ${esc(ai.name)}
        ${ai.note ? `<div class="it-note">(${esc(ai.note)})</div>` : ''}
      </td>
      <td class="it-qty num">${ai.quantity}</td>
      <td class="it-price num">${money(ai.lineTotal)}</td>
    </tr>`
    )
    .join('');

  const subtotal = aggregatedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const discount = Number(order?.discount ?? order?.discountAmount ?? 0);
  const deliveryFee = Number(order?.deliveryFee ?? 0);
  const service = Number(order?.service ?? 0);
  const total = Number(order?.total ?? subtotal - discount + service + deliveryFee);
  const totalQty = aggregatedItems.reduce((sum, i) => sum + i.quantity, 0);

  const placeInfo = order?.tableNumber
    ? `🪑 ترابيزة رقم ${order.tableNumber}`
    : `🥡 تيك أواي${deliveryFee > 0 ? ' (توصيل)' : ''}`;

  const row = (label, value, cls = '') =>
    `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>فاتورة رقم ${esc(order?.orderNumber ?? '')}</title>
    <style>
      ${baseCss('80mm auto')}
      .brand-box { text-align:center; padding: 2px 0 4px; }
      .brand { font-size:22px; font-weight:900; letter-spacing:0.5px; line-height:1.2; }
      .brand-badge { display:inline-block; font-size:12px; font-weight:800; border:1.5px solid #000; padding:1px 10px; border-radius:10px; margin-top:3px; background:#fff; }
      
      .meta-box { border:1.5px solid #000; border-radius:5px; padding:6px 8px; margin:6px 0; background:#fbfbfb; }
      .inv-head { display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #000; padding-bottom:4px; margin-bottom:4px; }
      .inv-no { font-size:16px; font-weight:900; }
      .place { font-size:14px; font-weight:800; }
      
      .row { display:flex; justify-content:space-between; align-items:baseline; gap:6px; font-size:13px; margin:3px 0; }
      .row span:first-child { font-weight:700; color:#111; }
      
      .rule { border-top:1.5px dashed #000; margin:6px 0; }
      
      table { width:100%; border-collapse:collapse; margin-top:4px; table-layout:fixed; }
      th { font-size:13px; font-weight:900; padding:5px 2px; border-bottom:2px solid #000; background:#f0f0f0; }
      th:nth-child(1), td:nth-child(1) { width:52%; text-align:right; }
      th:nth-child(2), td:nth-child(2) { width:16%; text-align:center; }
      th:nth-child(3), td:nth-child(3) { width:32%; text-align:left; }
      td { font-size:13.5px; padding:5px 2px; border-bottom:1px dotted #888; vertical-align:top; }
      .it-name { font-weight:800; overflow-wrap:break-word; word-break:break-word; line-height:1.25; }
      .it-note { font-size:11px; font-weight:600; color:#444; margin-top:1px; }
      .it-qty { font-weight:900; font-size:15px; }
      .it-price { white-space:nowrap; font-weight:800; font-size:14px; }
      
      .totals-box { margin-top:6px; }
      .grand { display:flex; justify-content:space-between; align-items:center;
               font-size:19px; font-weight:900; border:2px solid #000;
               border-radius:6px; padding:6px 10px; margin-top:6px; background:#000; color:#fff; }
      .grand .num { color:#fff; font-size:20px; font-weight:900; }
      
      .footer { text-align:center; font-size:12px; margin-top:10px; line-height:1.4; font-weight:700; }
      .barcode-line { border-top:1px dashed #000; margin:8px 0 4px; text-align:center; letter-spacing:4px; font-size:11px; font-family:monospace; font-weight:bold; }
    </style>
  </head>
  <body>
    <div class="brand-box">
      <div class="brand">✦ ${esc(displayCafeName)} ✦</div>
      <div class="brand-badge">فاتورة مبيعات</div>
    </div>

    <div class="meta-box">
      <div class="inv-head">
        <span class="inv-no">فاتورة <span class="num">#${esc(order?.orderNumber ?? '')}</span></span>
        <span class="place">${esc(placeInfo)}</span>
      </div>
      ${order?.customerName ? row('العميل', esc(order.customerName)) : ''}
      ${order?.customerPhone ? row('الموبايل', esc(order.customerPhone)) : ''}
      ${order?.customerAddress ? row('العنوان', esc(order.customerAddress)) : ''}
      ${order?.cashierName ? row('الكاشير', esc(order.cashierName)) : ''}
      ${row('التاريخ والوقت', stamp(order?.closedAt || order?.createdAt || order?.openedAt))}
    </div>

    <table>
      <thead>
        <tr><th>الصنف</th><th>العدد</th><th>السعر</th></tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="totals-box">
      <div class="rule"></div>
      ${row('إجمالي الأصناف', `${aggregatedItems.length} صنف (${totalQty} قطعة)`)}
      ${row('المجموع الفرعي', `${money(subtotal)} ج.م`)}
      ${discount > 0 ? row('الخصم', `- ${money(discount)} ج.م`) : ''}
      ${service > 0 ? row('الخدمة', `+ ${money(service)} ج.م`) : ''}
      ${deliveryFee > 0 ? row('رسوم التوصيل', `+ ${money(deliveryFee)} ج.م`) : ''}

      <div class="grand"><span>الإجمالي المستحق</span><span class="num">${money(total)} ج.م</span></div>
    </div>

    <div class="barcode-line">* ${esc(order?.orderNumber ?? '')} *</div>
    <div class="footer">
      ✨ شكراً لزيارتكم ${esc(displayCafeName)} ✨<br>
      نتمنى لكم يوماً سعيداً ✦ تفضلوا بزيارتنا مجدداً
    </div>
  </body>
</html>`;
}

/**
 * Build a kitchen/bar ticket HTML for a set of order items - no prices, grouped by
 * category, with a large station banner so the runner instantly knows who it's for.
 */
export function buildKitchenTicketHtml({
  orderNumber,
  tableNumber,
  type,
  guestCount,
  items,
  label,
  time,
  waiterName,
  ticketType,
}) {
  // Group by category
  const sections = [];
  (items || []).forEach((item) => {
    const cat = item.categoryNameSnapshot || 'أخرى';
    let section = sections.find((s) => s.category === cat);
    if (!section) {
      section = { category: cat, items: [] };
      sections.push(section);
    }
    section.items.push(item);
  });

  const totalItems = (items || []).length;
  const totalQty = (items || []).reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);
  const isTakeaway = type === 'TAKEAWAY';

  const sectionsHtml = sections
    .map(
      (section) => `
    <div class="cat-pill">${esc(section.category)}</div>
    ${section.items
      .map(
        (item) => `
      <div class="item-row">
        <div class="item-qty num">×${Number(item.quantity ?? 0)}</div>
        <div class="item-detail">
          <div class="item-name">${esc(item.productNameSnapshot)}</div>
          ${item.note ? `<div class="item-note">💡 ${esc(item.note)}</div>` : ''}
        </div>
      </div>`
      )
      .join('')}`
    )
    .join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>بون ${esc(label)} - #${esc(orderNumber ?? '')}</title>
    <style>
      ${baseCss('80mm auto')}
      .ticket-wrap { padding: 2mm 0; }
      
      /* Compact Inverted Station Banner */
      .banner { text-align:center; font-size:18px; font-weight:800;
                background:#000; color:#fff; padding:4px 2px; border-radius:4px; margin-bottom:4px; }
      
      .tag-alert { text-align:center; font-size:12px; font-weight:800; color:#000;
                   border:2px dashed #000; border-radius:4px; padding:2px; margin-bottom:4px; background:#fff; }
      
      /* Compact Header Info Bar */
      .info-bar { display:flex; justify-content:space-between; align-items:center;
                  border:1.5px solid #000; border-radius:4px; padding:4px 6px; margin-bottom:4px; background:#fafafa; }
      .order-no { font-size:16px; font-weight:800; }
      .order-place { font-size:15px; font-weight:800; }
      
      .sub-meta { display:flex; justify-content:space-between; font-size:11px; font-weight:600; padding:0 2px; margin-bottom:4px; }
      
      .rule-dash { border-top:1px dashed #000; margin:4px 0; }
      .rule-solid { border-top:2px solid #000; margin:5px 0; }
      
      /* Category Badge */
      .cat-pill { font-size:11px; font-weight:800; background:#eee; color:#000;
                  padding:2px 6px; border-radius:3px; border:1px solid #ccc; display:inline-block; margin:6px 0 2px; }
      
      /* Compact Item Line */
      .item-row { display:flex; align-items:center; gap:8px; padding:4px 0; border-bottom:1px dotted #bbb; }
      .item-qty { font-size:18px; font-weight:800; min-width:32px; text-align:center;
                  border:1.5px solid #000; border-radius:4px; padding:1px 3px; background:#fff; flex-shrink:0; }
      .item-detail { flex:1; }
      .item-name { font-size:15px; font-weight:800; line-height:1.2; overflow-wrap:break-word; word-break:break-word; }
      .item-note { font-size:11px; font-weight:700; color:#222; margin-top:2px; background:#fff8dc; padding:1px 4px; border-radius:3px; border:1px solid #ddd; display:inline-block; }
      
      /* Ticket Summary Footer */
      .summary-foot { display:flex; justify-content:space-between; font-size:12px; font-weight:800; margin-top:4px; }
    </style>
  </head>
  <body>
    <div class="ticket-wrap">
      <div class="banner">${esc(label)}</div>
      ${ticketType && ticketType !== 'NEW'
        ? `<div class="tag-alert">${esc(
            ticketType === 'ADDITION' ? '⚠️ إضافة طلب جديد'
            : ticketType === 'REPRINT' ? '*** إعادة طباعة (تذكرة مكررة) ***'
            : ticketType
          )}</div>`
        : ''}

      <div class="info-bar">
        <span class="order-no">أوردر <span class="num">#${esc(orderNumber ?? '')}</span></span>
        <span class="order-place">${isTakeaway ? '🥡 تيك أواي' : `🪑 ترابيزة <span class="num">${esc(tableNumber ?? '-')}</span>`}</span>
      </div>

      <div class="sub-meta">
        <span>${waiterName ? `الكابتن: <strong>${esc(waiterName)}</strong>` : ''}${guestCount ? ` (${guestCount} أفراد)` : ''}</span>
        <span class="num">${esc(time || '')}</span>
      </div>

      <div class="rule-dash"></div>
      ${sectionsHtml}
      <div class="rule-solid"></div>

      <div class="summary-foot">
        <span>عدد الأصناف: <strong class="num">${totalItems}</strong></span>
        <span>إجمالي الكمية: <strong class="num">${totalQty}</strong></span>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Build Employee Weekly Statement / Salary Slip (80mm thermal receipt)
 */
export function buildEmployeeStatementHtml({ employeeName, jobTitle, baseSalary, summary, transactions = [], startDate, endDate, cafeName }) {
  const displayCafeName = cafeName || 'الكافيه';
  const txList = summary?.transactions || transactions || [];
  
  const deductions = txList.filter(t => t.type === 'DEDUCTION');
  const advances = txList.filter(t => t.type === 'ADVANCE');
  const bonuses = txList.filter(t => t.type === 'BONUS');
  
  const base = Number(summary?.baseWeeklySalary ?? baseSalary ?? 0);
  const totalDed = Number(summary?.totalDeductions ?? deductions.reduce((s, t) => s + Number(t.amount || 0), 0));
  const totalAdv = Number(summary?.totalAdvances ?? advances.reduce((s, t) => s + Number(t.amount || 0), 0));
  const totalBonus = Number(summary?.totalBonuses ?? bonuses.reduce((s, t) => s + Number(t.amount || 0), 0));
  const netPay = Number(summary?.netPayable ?? Math.max(0, base + totalBonus - totalDed - totalAdv));

  const row = (label, value, cls = '') =>
    `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

  const renderTxTable = (title, list, sign = '-') => {
    if (!list || list.length === 0) return '';
    return `
      <div style="margin-top:6px;">
        <div style="font-size:11px; font-weight:800; border-bottom:1px solid #000; padding-bottom:2px; margin-bottom:3px;">
          📌 ${title} (${list.length})
        </div>
        ${list.map(t => `
          <div class="row" style="font-size:11px; margin:2px 0;">
            <span>${esc(t.notes || t.type)} <span style="font-size:10px; color:#555;">(${esc(t.transactionDate || '')})</span></span>
            <span class="num">${sign} ${money(t.amount)} ج.م</span>
          </div>
        `).join('')}
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>كشف حساب موظف - ${esc(employeeName)}</title>
    <style>
      ${baseCss('80mm auto')}
      .brand-box { text-align:center; padding: 4px 0 2px; }
      .brand { font-size:20px; font-weight:800; }
      .badge-title { display:inline-block; font-size:12px; font-weight:800; border:1.5px solid #000; padding:2px 10px; border-radius:10px; margin-top:4px; }
      .meta-card { border:1px solid #000; border-radius:6px; padding:6px 8px; margin:6px 0; background:#fbfbfb; }
      .emp-title { font-size:15px; font-weight:800; border-bottom:1px dashed #000; padding-bottom:4px; margin-bottom:4px; }
      .row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:12px; margin:3px 0; }
      .row span:first-child { font-weight:600; }
      .rule { border-top:1px dashed #000; margin:6px 0; }
      .rule-double { border-top:3px double #000; margin:6px 0; }
      .grand { display:flex; justify-content:space-between; align-items:center;
               font-size:16px; font-weight:800; border:2px solid #000;
               border-radius:6px; padding:6px 8px; margin-top:8px; background:#000; color:#fff; }
      .grand .num { color:#fff; }
      .sig-box { margin-top:16px; padding-top:8px; border-top:1px dashed #000; font-size:11.5px; }
    </style>
  </head>
  <body>
    <div class="brand-box">
      <div class="brand">✦ ${esc(displayCafeName)} ✦</div>
      <div class="badge-title">مسير وقبض راتب أسبوعي</div>
    </div>

    <div class="meta-card">
      <div class="emp-title">الموظف: <strong>${esc(employeeName)}</strong></div>
      ${row('المسمى الوظيفي', esc(jobTitle || 'موظف'))}
      ${startDate && endDate ? row('الفترة', `${esc(startDate)} إلى ${esc(endDate)}`) : ''}
      ${row('تاريخ الطباعة', stamp(new Date()))}
    </div>

    <div style="margin:6px 0;">
      ${row('الراتب الأساسي الأسبوعي', `${money(base)} ج.م`, 'style="font-weight:800;"')}
    </div>

    ${renderTxTable('الخصومات والجزاءات', deductions, '-')}
    ${renderTxTable('السُلف والمسحوبات', advances, '-')}
    ${renderTxTable('المكافآت والحوافز', bonuses, '+')}

    <div class="rule-double"></div>

    <div class="totals-summary" style="margin-top:4px;">
      ${row('إجمالي الراتب الأساسي', `${money(base)} ج.م`)}
      ${totalBonus > 0 ? row('إجمالي الحوافز والمكافآت', `+ ${money(totalBonus)} ج.م`) : ''}
      ${totalDed > 0 ? row('إجمالي الخصومات', `- ${money(totalDed)} ج.م`) : ''}
      ${totalAdv > 0 ? row('إجمالي السُلف المسحوبة', `- ${money(totalAdv)} ج.م`) : ''}
      
      <div class="grand">
        <span>صافي الراتب المستحق</span>
        <span class="num">${money(netPay)} ج.م</span>
      </div>
    </div>

    <div class="sig-box">
      <div style="margin-bottom:24px;">توقيع واستلام الموظف: ___________________</div>
      <div style="text-align:center; font-size:10px; color:#555;">نظام Caffio لإدارة الكافيهات والمطاعم</div>
    </div>
  </body>
</html>`;
}

/**
 * Build Customer Debt Receipt / Slip (80mm thermal receipt)
 */
export function buildDebtReceiptHtml({ debt, paymentAmount, cafeName }) {
  const displayCafeName = cafeName || 'الكافيه';
  const totalAmount = Number(debt.amount || 0);
  const paidAmount = Number(debt.paidAmount || 0);
  const remaining = Number(debt.remainingAmount ?? Math.max(0, totalAmount - paidAmount));
  const currentPaid = paymentAmount != null ? Number(paymentAmount) : null;

  const row = (label, value, cls = '') =>
    `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>إيصال مديونية - ${esc(debt.creditorName)}</title>
    <style>
      ${baseCss('80mm auto')}
      .brand-box { text-align:center; padding: 4px 0 2px; }
      .brand { font-size:20px; font-weight:800; }
      .badge-title { display:inline-block; font-size:12px; font-weight:800; border:1.5px solid #000; padding:2px 10px; border-radius:10px; margin-top:4px; }
      .meta-card { border:1px solid #000; border-radius:6px; padding:6px 8px; margin:6px 0; background:#fbfbfb; }
      .creditor-title { font-size:15px; font-weight:800; border-bottom:1px dashed #000; padding-bottom:4px; margin-bottom:4px; }
      .row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:12px; margin:3px 0; }
      .row span:first-child { font-weight:600; }
      .rule { border-top:1px dashed #000; margin:6px 0; }
      .grand { display:flex; justify-content:space-between; align-items:center;
               font-size:16px; font-weight:800; border:2px solid #000;
               border-radius:6px; padding:6px 8px; margin-top:8px; background:#000; color:#fff; }
      .grand .num { color:#fff; }
      .sig-box { margin-top:16px; padding-top:8px; border-top:1px dashed #000; font-size:11.5px; }
    </style>
  </head>
  <body>
    <div class="brand-box">
      <div class="brand">✦ ${esc(displayCafeName)} ✦</div>
      <div class="badge-title">إيصال حساب آجل / مديونية</div>
    </div>

    <div class="meta-card">
      <div class="creditor-title">العميل / الحساب: <strong>${esc(debt.creditorName)}</strong></div>
      ${debt.debtDate ? row('تاريخ تسجيل المديونية', esc(debt.debtDate)) : ''}
      ${debt.dueDate ? row('تاريخ الاستحقاق', esc(debt.dueDate)) : ''}
      ${row('تاريخ الطباعة', stamp(new Date()))}
      ${debt.notes ? row('ملاحظات', esc(debt.notes)) : ''}
    </div>

    <div class="rule"></div>

    <div style="margin:6px 0;">
      ${row('إجمالي أصل المديونية', `${money(totalAmount)} ج.م`)}
      ${currentPaid != null ? row('المبلغ المسدد الآن', `+ ${money(currentPaid)} ج.م`, 'style="color:#16a34a; font-weight:800;"') : ''}
      ${row('إجمالي المسدد حتى الآن', `${money(paidAmount)} ج.م`)}
      
      <div class="grand">
        <span>المتبقي المستحق</span>
        <span class="num">${money(remaining)} ج.م</span>
      </div>
    </div>

    <div class="sig-box">
      <div style="margin-bottom:24px;">توقيع المستلم / المحاسب: ___________________</div>
      <div style="text-align:center; font-size:10px; color:#555;">شكراً لتعاملكم مع ${esc(displayCafeName)}</div>
    </div>
  </body>
</html>`;
}

/**
 * Build Comprehensive Daily / Shift Report HTML (80mm thermal receipt)
 */
export function buildShiftSummaryHtml({ report, cafeName }) {
  let user = null;
  try {
    user = storage.getUser();
  } catch (_) {}
  const displayCafeName = cafeName || user?.tenantName || 'كافيه ونس';
  const shift = report?.shift || {};
  
  const totalRevenue = Number(report?.totalRevenue ?? 0);
  const totalCash = Number(report?.totalCash ?? 0);
  const totalInstapay = Number(report?.totalInstapay ?? 0);
  const totalWallet = Number(report?.totalWallet ?? 0);
  const foodRevenue = Number(report?.foodRevenue ?? 0);
  const buffetRevenue = Number(report?.buffetRevenue ?? 0);
  const snacksNet = Number(report?.snacksNet ?? 0);
  const totalDiscounts = Number(report?.totalDiscounts ?? 0);
  const totalService = Number(report?.totalService ?? 0);
  const totalExpenses = Number(report?.totalExpenses ?? 0);
  const totalNewDebts = Number(report?.totalNewDebts ?? 0);
  const totalCollectedDebts = Number(report?.totalCollectedDebts ?? 0);
  const totalEmployeeAdvances = Number(report?.totalEmployeeAdvances ?? 0);
  const totalEmployeeDeductions = Number(report?.totalEmployeeDeductions ?? 0);
  const totalEmployeeBonuses = Number(report?.totalEmployeeBonuses ?? 0);
  const expectedCashInDrawer = Number(report?.expectedCashInDrawer ?? 0);
  const countedCash = shift.countedCash != null ? Number(shift.countedCash) : null;
  const variance = shift.variance != null ? Number(shift.variance) : null;
  const productSales = report?.productSales || [];
  const expenses = report?.expenses || [];
  const employeeMovements = report?.employeeMovements || [];
  const totalItemsSold = Number(report?.totalItemsSold ?? 0);

  const row = (label, value, cls = '') =>
    `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

  const productRows = productSales.map((p, idx) => `
    <tr>
      <td class="p-name">${idx + 1}. ${esc(p.productName)}<div class="p-cat">${esc(p.categoryName || '')}</div></td>
      <td class="p-qty num">${p.quantitySold}</td>
      <td class="p-total num">${money(p.totalAmount)}</td>
    </tr>
  `).join('');

  const expenseRows = expenses.map(e => `
    <div class="row" style="font-size:11.5px; margin:2px 0;">
      <span>▪ ${esc(e.description)}</span>
      <span class="num">- ${money(e.amount)} ج.م</span>
    </div>
  `).join('');

  const empRows = employeeMovements.map(m => {
    const typeLabel = m.type === 'ADVANCE' ? 'سلفة' : m.type === 'DEDUCTION' ? 'خصم' : 'مكافأة';
    const sign = m.type === 'BONUS' ? '+' : '-';
    return `
      <div class="row" style="font-size:11.5px; margin:2px 0;">
        <span>▪ ${esc(m.employeeName)} (${typeLabel}${m.notes ? `: ${esc(m.notes)}` : ''})</span>
        <span class="num">${sign} ${money(m.amount)} ج.م</span>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير اليومية - شيفت #${esc(shift.id ?? '')}</title>
    <style>
      ${baseCss('80mm auto')}
      .brand-box { text-align:center; padding: 2px 0 4px; }
      .brand { font-size:22px; font-weight:900; }
      .rep-badge { display:inline-block; font-size:12px; font-weight:800; border:1.5px solid #000; padding:2px 10px; border-radius:10px; margin-top:3px; background:#fff; }
      
      .meta-box { border:1.5px solid #000; border-radius:5px; padding:6px 8px; margin:6px 0; background:#fbfbfb; }
      .meta-head { display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #000; padding-bottom:4px; margin-bottom:4px; font-weight:800; }
      
      .sec-title { font-size:13px; font-weight:900; border-bottom:1.5px solid #000; padding:3px 0 2px; margin:8px 0 4px; background:#f0f0f0; padding-inline-start:4px; }
      
      .row { display:flex; justify-content:space-between; align-items:baseline; gap:6px; font-size:12.5px; margin:2px 0; }
      .row span:first-child { font-weight:700; color:#111; }
      
      .rule { border-top:1px dashed #000; margin:6px 0; }
      .rule-double { border-top:3px double #000; margin:6px 0; }
      
      table { width:100%; border-collapse:collapse; margin-top:4px; table-layout:fixed; }
      th { font-size:12px; font-weight:900; padding:4px 2px; border-bottom:2px solid #000; background:#e5e5e5; }
      th:nth-child(1), td:nth-child(1) { width:54%; text-align:right; }
      th:nth-child(2), td:nth-child(2) { width:18%; text-align:center; }
      th:nth-child(3), td:nth-child(3) { width:28%; text-align:left; }
      td { font-size:12px; padding:4px 2px; border-bottom:1px dotted #aaa; vertical-align:top; }
      .p-name { font-weight:800; line-height:1.2; }
      .p-cat { font-size:10px; font-weight:normal; color:#444; }
      .p-qty { font-weight:900; font-size:13px; }
      .p-total { font-weight:800; white-space:nowrap; }
      
      .cash-box { border:2px solid #000; border-radius:6px; padding:6px 8px; margin:8px 0; background:#f4f4f4; }
      .grand { display:flex; justify-content:space-between; align-items:center;
               font-size:16px; font-weight:900; border:2px solid #000;
               border-radius:6px; padding:6px 8px; margin-top:6px; background:#000; color:#fff; }
      .grand .num { color:#fff; font-size:17px; }
      
      .footer { text-align:center; font-size:11px; margin-top:12px; font-weight:700; line-height:1.4; }
    </style>
  </head>
  <body>
    <div class="brand-box">
      <div class="brand">✦ ${esc(displayCafeName)} ✦</div>
      <div class="rep-badge">تقرير اليومية وإغلاق الشيفت (Z-Report)</div>
    </div>

    <div class="meta-box">
      <div class="meta-head">
        <span>شيفت رقم: <span class="num">#${esc(shift.id ?? '-')}</span></span>
        <span>الكاشير: <strong>${esc(shift.userName || user?.name || 'كاشير')}</strong></span>
      </div>
      ${row('الخزينة / النقطة', esc(shift.registerName || 'الرئيسية'))}
      ${row('توقيت الفتح', stamp(shift.openedAt))}
      ${shift.closedAt ? row('توقيت الإغلاق', stamp(shift.closedAt)) : row('الحالة', '🟢 الشيفت مفتوح حالياً')}
      ${row('تاريخ التقرير', stamp(new Date()))}
    </div>

    <div class="sec-title">💰 إجمالي المبيعات والإيرادات</div>
    ${row('إجمالي المبيعات الكلي', `${money(totalRevenue + totalDiscounts - totalService)} ج.م`)}
    ${totalDiscounts > 0 ? row('إجمالي الخصومات الممنوحة', `- ${money(totalDiscounts)} ج.م`, 'style="color:#dc2626;"') : ''}
    ${totalService > 0 ? row('إجمالي رسوم الخدمة', `+ ${money(totalService)} ج.م`) : ''}
    ${row('صافي مبيعات الشيفت', `${money(totalRevenue)} ج.م`, 'style="font-weight:900; font-size:13.5px;"')}

    <div class="sec-title">🍽️ تفصيل الإيراد حسب الأقسام</div>
    ${row('🍕 إجمالي الأكل (المطبخ)', `${money(foodRevenue)} ج.م`)}
    ${row('☕ إجمالي البوفيه والمشروبات', `${money(buffetRevenue)} ج.م`)}
    ${snacksNet > 0 ? row('🍿 إجمالي السناكس والحلويات', `${money(snacksNet)} ج.م`) : ''}

    <div class="sec-title">💳 طرق التحصيل والدفع</div>
    ${row('💵 نقدي (كاش في الدرج)', `${money(totalCash)} ج.م`)}
    ${totalInstapay > 0 ? row('📱 إنستاباي / فيزا', `${money(totalInstapay)} ج.م`) : ''}
    ${totalWallet > 0 ? row('👛 محافظ إلكترونية', `${money(totalWallet)} ج.م`) : ''}

    ${expenses.length > 0 || totalExpenses > 0 ? `
      <div class="sec-title">💸 المصاريف والمسحوبات (${expenses.length})</div>
      ${expenseRows}
      ${row('إجمالي المصاريف', `- ${money(totalExpenses)} ج.م`, 'style="font-weight:800; color:#dc2626;"')}
    ` : ''}

    ${employeeMovements.length > 0 || totalEmployeeAdvances > 0 ? `
      <div class="sec-title">👥 حركة سُلف وحسابات الموظفين</div>
      ${empRows}
      ${totalEmployeeAdvances > 0 ? row('إجمالي سُلف الموظفين', `- ${money(totalEmployeeAdvances)} ج.م`) : ''}
    ` : ''}

    <div class="sec-title">📊 تفصيل الأصناف المباعة (${productSales.length} صنف - ${totalItemsSold} قطعة)</div>
    <table>
      <thead>
        <tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>
        ${productRows.length > 0 ? productRows : '<tr><td colspan="3" style="text-align:center; padding:6px;">لا توجد مبيعات مسجلة</td></tr>'}
      </tbody>
    </table>

    <div class="cash-box">
      <div style="font-weight:900; font-size:13px; border-bottom:1.5px solid #000; padding-bottom:3px; margin-bottom:4px;">
        💵 صافي النقدية في الدرج (Cash Drawer)
      </div>
      ${row('رصيد فتح الدرج (Opening Float)', `${money(shift.openingFloat || 0)} ج.م`)}
      ${row('المبيعات النقدية (Cash)', `+ ${money(totalCash)} ج.م`)}
      ${totalCollectedDebts > 0 ? row('سداد مديونيات كاش', `+ ${money(totalCollectedDebts)} ج.م`) : ''}
      ${totalExpenses > 0 ? row('المصاريف المدفوعة من الدرج', `- ${money(totalExpenses)} ج.م`) : ''}
      ${totalEmployeeAdvances > 0 ? row('سُلف موظفين من الدرج', `- ${money(totalEmployeeAdvances)} ج.م`) : ''}
      
      <div class="grand">
        <span>النقدية المفترضة بالدرج</span>
        <span class="num">${money(expectedCashInDrawer)} ج.م</span>
      </div>

      ${countedCash != null ? `
        <div style="margin-top:6px; font-size:13px;">
          ${row('النقدية الفعلية المحصية', `${money(countedCash)} ج.م`, 'style="font-weight:800;"')}
          <div class="row" style="font-size:13.5px; font-weight:900; color:${variance < 0 ? '#dc2626' : variance > 0 ? '#16a34a' : '#000'};">
            <span>${variance < 0 ? '⚠️ عجز في النقدية' : variance > 0 ? '✨ زيادة في النقدية' : '✅ النقدية متطابقة بالكامل'}</span>
            <span class="num">${variance > 0 ? '+' : ''}${money(variance)} ج.م</span>
          </div>
        </div>
      ` : ''}
    </div>

    <div class="footer">
      توقيع واستلام الكاشير: ___________________<br>
      توقيع الإدارة / المشرف: ___________________<br>
      <span style="font-size:9px; color:#555; margin-top:4px; display:inline-block;">تم إصدار التقرير بواسطة نظام Caffio POS</span>
    </div>
  </body>
</html>`;
}

/**
 * Build Periodic Financial Summary HTML Report (80mm / A4 printable)
 */
export function buildPeriodicFinancialReportHtml({ financialData, startDate, endDate, cafeName, periodLabel }) {
  let user = null;
  try {
    user = storage.getUser();
  } catch (_) {}
  const displayCafeName = cafeName || user?.tenantName || 'كافيو';
  const data = financialData || {};

  const totalCafeRevenue = Number(data.totalCafeRevenue ?? 0);
  const totalRestaurantRevenue = Number(data.totalRestaurantRevenue ?? 0);
  const totalSnacksNet = Number(data.totalSnacksNet ?? 0);
  const totalRevenue = totalCafeRevenue + totalRestaurantRevenue + totalSnacksNet;

  const totalCafeExpenses = Number(data.totalCafeExpenses ?? 0);
  const totalRestaurantExpenses = Number(data.totalRestaurantExpenses ?? 0);
  const totalGeneralExpenses = Number(data.totalGeneralExpenses ?? 0);
  const totalWages = Number(data.totalWages ?? 0);
  const totalExpenses = totalCafeExpenses + totalRestaurantExpenses + totalGeneralExpenses + totalWages;

  const netProfit = Number(data.netProfit ?? (totalRevenue - totalExpenses));

  const productSales = data.productSales || [];
  const categorySales = data.categorySales || [];
  const paymentMethods = data.paymentMethods || [];

  const row = (label, value, cls = '') =>
    `<div class="row ${cls}"><span>${label}</span><span class="num">${value}</span></div>`;

  const PAYMENT_NAMES = {
    CASH: 'نقدي (كاش)',
    INSTAPAY: 'إنستاباي / بطاقة',
    WALLET: 'محفظة إلكترونية'
  };

  const productRows = productSales.slice(0, 20).map((p, idx) => `
    <tr>
      <td class="p-name">${idx + 1}. ${esc(p.name)}</td>
      <td class="p-qty num">${p.quantity}</td>
      <td class="p-total num">${money(p.totalRevenue)}</td>
    </tr>
  `).join('');

  const catRows = categorySales.map((c) => `
    <div class="row" style="font-size:12px; margin:2px 0;">
      <span>▪ ${esc(c.name)} (${c.quantity} طلب)</span>
      <span class="num">${money(c.totalRevenue)} ج.م</span>
    </div>
  `).join('');

  const payRows = paymentMethods.map((pm) => `
    <div class="row" style="font-size:12px; margin:2px 0;">
      <span>▪ ${PAYMENT_NAMES[pm.method] || pm.method} (${pm.count} عملية)</span>
      <span class="num">${money(pm.totalAmount)} ج.م</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تقرير مبيعات وأرباح الفترة - ${esc(displayCafeName)}</title>
    <style>
      ${baseCss('80mm auto')}
      .brand-box { text-align:center; padding: 2px 0 4px; }
      .brand { font-size:22px; font-weight:900; }
      .rep-badge { display:inline-block; font-size:12px; font-weight:800; border:1.5px solid #000; padding:2px 10px; border-radius:10px; margin-top:3px; background:#fff; }
      
      .meta-box { border:1.5px solid #000; border-radius:5px; padding:6px 8px; margin:6px 0; background:#fbfbfb; }
      .meta-head { display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #000; padding-bottom:4px; margin-bottom:4px; font-weight:800; }
      
      .sec-title { font-size:13px; font-weight:900; border-bottom:1.5px solid #000; padding:3px 0 2px; margin:8px 0 4px; background:#f0f0f0; padding-inline-start:4px; }
      
      .row { display:flex; justify-content:space-between; align-items:baseline; gap:6px; font-size:12.5px; margin:2px 0; }
      .row span:first-child { font-weight:700; color:#111; }
      
      .rule { border-top:1px dashed #000; margin:6px 0; }
      .rule-double { border-top:3px double #000; margin:6px 0; }
      
      table { width:100%; border-collapse:collapse; margin-top:4px; table-layout:fixed; }
      th { font-size:12px; font-weight:900; padding:4px 2px; border-bottom:2px solid #000; background:#e5e5e5; }
      th:nth-child(1), td:nth-child(1) { width:54%; text-align:right; }
      th:nth-child(2), td:nth-child(2) { width:18%; text-align:center; }
      th:nth-child(3), td:nth-child(3) { width:28%; text-align:left; }
      td { font-size:12px; padding:4px 2px; border-bottom:1px dotted #aaa; vertical-align:top; }
      .p-name { font-weight:800; line-height:1.2; }
      .p-qty { font-weight:900; font-size:13px; }
      .p-total { font-weight:800; white-space:nowrap; }
      
      .grand-box { border:2px solid #000; border-radius:6px; padding:6px 8px; margin:8px 0; background:#f4f4f4; }
      .grand { display:flex; justify-content:space-between; align-items:center;
               font-size:16px; font-weight:900; border:2px solid #000;
               border-radius:6px; padding:6px 8px; margin-top:6px; background:#000; color:#fff; }
      .grand .num { color:#fff; font-size:17px; }
      
      .footer { text-align:center; font-size:11px; margin-top:12px; font-weight:700; line-height:1.4; }
    </style>
  </head>
  <body>
    <div class="brand-box">
      <div class="brand">✦ ${esc(displayCafeName)} ✦</div>
      <div class="rep-badge">تقرير المبيعات والأرباح الشامل</div>
    </div>

    <div class="meta-box">
      <div class="meta-head">
        <span>الفترة: <strong>${esc(periodLabel || 'فترة مخصصة')}</strong></span>
      </div>
      ${startDate && endDate ? row('من تاريخ - إلى تاريخ', `${esc(startDate)} إلى ${esc(endDate)}`) : ''}
      ${row('تاريخ ووقت الإصدار', stamp(new Date()))}
      ${row('المسؤول / المشرف', esc(user?.fullName || user?.name || user?.username || 'الإدارة'))}
    </div>

    <div class="sec-title">💰 ملخص الإيرادات والمبيعات</div>
    ${row('☕ إيرادات المشروبات (الكافيه)', `${money(totalCafeRevenue)} ج.م`)}
    ${row('🍔 إيرادات المأكولات (المطعم)', `${money(totalRestaurantRevenue)} ج.م`)}
    ${totalSnacksNet > 0 ? row('🍿 صافي السناكس والحلويات', `${money(totalSnacksNet)} ج.م`) : ''}
    <div class="row" style="font-weight:900; border-top:1px dashed #000; padding-top:2px; margin-top:2px; font-size:13px;">
      <span>إجمالي الإيرادات الكلية</span>
      <span class="num">${money(totalRevenue)} ج.م</span>
    </div>

    <div class="sec-title">💸 تفصيل المصاريف والأجور</div>
    ${row('مصاريف تشغيل الكافيه', `- ${money(totalCafeExpenses)} ج.م`)}
    ${row('مصاريف تشغيل المطعم', `- ${money(totalRestaurantExpenses)} ج.م`)}
    ${row('المصاريف العامة والمشتركة', `- ${money(totalGeneralExpenses)} ج.م`)}
    ${row('الرواتب وأجور الموظفين', `- ${money(totalWages)} ج.م`)}
    <div class="row" style="font-weight:900; border-top:1px dashed #000; padding-top:2px; margin-top:2px; font-size:13px; color:#dc2626;">
      <span>إجمالي كافة المصاريف</span>
      <span class="num">- ${money(totalExpenses)} ج.م</span>
    </div>

    <div class="grand-box">
      <div class="grand" style="background:${netProfit >= 0 ? '#000' : '#dc2626'};">
        <span>${netProfit >= 0 ? 'صافي الربح المحقق (Net Profit)' : 'صافي الخسارة (Net Loss)'}</span>
        <span class="num">${money(netProfit)} ج.م</span>
      </div>
    </div>

    <div class="sec-title">💳 تفصيل طرق الدفع المحصلة</div>
    ${payRows.length > 0 ? payRows : '<div style="font-size:11px; text-align:center; padding:4px;">لا توجد دفعات مسجلة</div>'}

    <div class="sec-title">📊 المبيعات حسب الأقسام</div>
    ${catRows.length > 0 ? catRows : '<div style="font-size:11px; text-align:center; padding:4px;">لا توجد أقسام مسجلة</div>'}

    <div class="sec-title">🏆 الأصناف الأكثر مبيعاً (${productSales.length})</div>
    <table>
      <thead>
        <tr><th>الصنف</th><th>الكمية</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>
        ${productRows.length > 0 ? productRows : '<tr><td colspan="3" style="text-align:center; padding:6px;">لا توجد مبيعات في هذه الفترة</td></tr>'}
      </tbody>
    </table>

    <div class="footer">
      توقيع الإدارة العامة: ___________________<br>
      <span style="font-size:9px; color:#555; margin-top:4px; display:inline-block;">تم إصدار التقرير بواسطة نظام Caffio POS</span>
    </div>
  </body>
</html>`;
}

/**
 * Builds standard 80mm thermal receipt HTML for an Expense / Petty Cash Advance Voucher
 */
export function buildExpenseVoucherHtml({ expense, cafeName }) {
  const user = storage.getUser() || {};
  const currentCafeName = cafeName || user.tenantName || 'Caffio Cafe';
  
  const voucherId = expense.id ? `EXP-${String(expense.id).padStart(5, '0')}` : 'EXP-DRAFT';
  const isAdvance = expense.isAdvance || expense.status === 'PENDING_SETTLEMENT';
  const isSettlement = expense.status === 'COMPLETED' && expense.advanceAmount != null && expense.actualAmount != null;
  
  let title = 'سند صرف مصروفات';
  if (isAdvance) {
    title = 'إيصال سحب عُهدة مؤقتة';
  } else if (isSettlement) {
    title = 'إيصال تسوية عُهدة مالية';
  }

  const typeLabels = {
    MATERIALS: 'خامات ومستلزمات',
    RENT: 'إيجارات وشواغر',
    SALARIES: 'رواتب وأجور موظفين',
    MAINTENANCE: 'صيانة وإصلاحات',
    INSTALLMENTS: 'أقساط والتزامات',
    DEBTS: 'مديونيات وموردين',
    GENERAL: 'مصاريف تشغيل عامة'
  };

  const typeName = typeLabels[expense.type] || expense.type || 'مصروف عام';
  const recUser = expense.recordedByUserName || user.fullName || 'الكاشير';
  const notesText = expense.notes || 'لا توجد ملاحظات إضافية';
  const drawerPaid = expense.paidFromDrawer !== false ? 'نعم (من الخزينة النقدية)' : 'لا (دفع خارجي)';

  let amountSectionHtml = '';
  if (isAdvance) {
    amountSectionHtml = `
      <div class="row" style="font-weight:900; font-size:14px; margin-top:6px; border-top:1px dashed #000; padding-top:4px;">
        <span>المبلغ المسحوب من الخزينة:</span>
        <span class="num">${money(expense.advanceAmount || expense.amount)} ج.م</span>
      </div>
      <div style="font-size:10px; color:#dc2626; font-weight:bold; margin-top:2px; text-align:center;">
        ⚠️ عُهدة مؤقتة تحت التسوية (ينبغي إرفاق فواتير الشراء والباقي)
      </div>
    `;
  } else if (isSettlement) {
    amountSectionHtml = `
      <div class="row">
        <span>مبلغ العُهدة المسحوب سابقاً:</span>
        <span class="num">${money(expense.advanceAmount)} ج.م</span>
      </div>
      <div class="row" style="font-weight:700;">
        <span>المبلغ الفعلي (حسب الفواتير):</span>
        <span class="num">${money(expense.actualAmount)} ج.م</span>
      </div>
      <div class="row" style="font-weight:900; font-size:13px; color:#16a34a; border-top:1px dashed #000; padding-top:4px; margin-top:2px;">
        <span>المبلغ المرتجع للدرج (الباقي):</span>
        <span class="num">${money(expense.returnedAmount)} ج.م</span>
      </div>
    `;
  } else {
    amountSectionHtml = `
      <div class="row" style="font-weight:900; font-size:14px; margin-top:6px; border-top:1px dashed #000; padding-top:4px;">
        <span>إجمالي المبلغ المنصرف:</span>
        <span class="num">${money(expense.amount)} ج.م</span>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8" />
    <title>إيصال مصروفات - ${voucherId}</title>
    <style>
      ${baseCss('80mm auto')}
      .title { text-align:center; font-size:20px; font-weight:900; margin-bottom:2px; }
      .subtitle { text-align:center; font-size:14px; font-weight:800; }
      .meta { border:1px solid #000; border-radius:4px; padding:4px 6px; margin:6px 0; background:#fbfbfb; }
      .row { display:flex; justify-content:space-between; align-items:baseline; margin:3px 0; }
    </style>
  </head>
  <body>
    <div class="title">${esc(currentCafeName)}</div>
    <div class="subtitle" style="font-size:13px; font-weight:bold; margin-bottom:6px; text-decoration:underline;">${title}</div>
    <div class="meta" style="font-size:10px; border-bottom:1px solid #000; padding-bottom:4px; margin-bottom:6px;">
      <b>رقم الإيصال:</b> ${voucherId}<br>
      <b>تاريخ الإخراج:</b> ${stamp(expense.expenseDate || new Date())}<br>
      <b>مُسجّل الإيصال:</b> ${esc(recUser)}<br>
      ${expense.shiftId ? `<b>رقم الشيفت:</b> #${expense.shiftId}<br>` : ''}
      ${expense.employeeName ? `<b>الموظف المستلم:</b> ${esc(expense.employeeName)}<br>` : ''}
    </div>

    <div class="row">
      <span>نوع البند المصروف:</span>
      <span><b>${esc(typeName)}</b></span>
    </div>
    <div class="row">
      <span>خصم من الخزينة النقدية:</span>
      <span>${drawerPaid}</span>
    </div>
    <div class="row" style="margin-top:2px;">
      <span>بيان وتفاصيل المصروف:</span>
    </div>
    <div style="font-size:11px; background:#f9fafb; padding:4px; border:1px solid #ddd; border-radius:4px; margin-bottom:4px; word-break:break-word;">
      ${esc(notesText)}
    </div>

    ${Array.isArray(expense.items) && expense.items.length > 0 ? `
      <div style="margin-top:6px;">
        <div style="font-weight:bold; font-size:11px; border-bottom:1px solid #000; padding-bottom:2px; margin-bottom:4px;">📋 تفاصيل وبنود المصروف:</div>
        <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:6px;">
          <thead>
            <tr style="border-bottom:1px solid #000; background:#f4f4f4;">
              <th style="text-align:right; padding:3px;">البند / البيان</th>
              <th style="text-align:left; padding:3px;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${expense.items.map(item => `
              <tr style="border-bottom:1px dotted #ccc;">
                <td style="padding:3px;">${esc(item.description || item.name || 'بند')}</td>
                <td style="padding:3px; text-align:left;" class="num">${money(item.price || item.amount || 0)} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${amountSectionHtml}

    <div class="footer" style="margin-top:16px; font-size:10px;">
      <div style="display:flex; justify-content:space-between; margin-top:12px; font-weight:bold;">
        <span>توقيع الكاشير / المسؤول:<br>.......................</span>
        <span>توقيع الموظف المستلم:<br>.......................</span>
      </div>
      <span style="font-size:8px; color:#777; margin-top:10px; display:inline-block;">تم إصدار هذا الإيصال تلقائياً عبر نظام Caffio POS</span>
    </div>
  </body>
</html>`;
}

/**
 * Print Expense Voucher using thermal printer bridge or browser print
 */
export function printExpenseVoucher(expense, cafeName) {
  const html = buildExpenseVoucherHtml({ expense, cafeName });
  printReceipt(html, { width: 80 });
}



