import { ROUTES, ROLES } from './constants.js';

const OPEN_STATUSES = new Set(['OPEN', 'SENT', 'SERVED']);
const CLOSED_STATUSES = new Set(['CLOSED', 'PAID']);

const PRIORITY = {
  critical: 0,
  warning: 1,
  opportunity: 2,
  info: 3,
  success: 4,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function minutesSince(value, now) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now - timestamp) / 60_000));
}

function createInsight({
  id,
  severity,
  tone,
  title,
  detail,
  evidence,
  action,
  route,
  penalty = 0,
}) {
  return { id, severity, tone, title, detail, evidence, action, route, penalty };
}

/**
 * Turns the data already available to the dashboard into explainable operational decisions.
 * This intentionally stays deterministic: the same business facts always produce the same advice,
 * no customer data leaves the application, and every recommendation carries its evidence.
 */
export function buildOperationsIntelligence({
  orders = [],
  tables = [],
  products = [],
  shift = null,
  role,
  now = Date.now(),
  dataCoverage = {},
}) {
  const openOrders = orders.filter((order) => OPEN_STATUSES.has(order.status));
  const closedOrders = orders.filter((order) => CLOSED_STATUSES.has(order.status));
  const voidOrders = orders.filter((order) => order.status === 'VOIDED');
  const activeTables = tables.filter((table) => table.active !== false);
  const occupiedTables = activeTables.filter((table) =>
    openOrders.some((order) => order.tableId === table.id),
  );

  const agedOpenOrders = openOrders
    .map((order) => ({
      ...order,
      ageMinutes: minutesSince(order.createdAt || order.openedAt, now),
    }))
    .filter((order) => order.ageMinutes !== null)
    .sort((a, b) => b.ageMinutes - a.ageMinutes);

  const delayedOrders = agedOpenOrders.filter((order) => order.ageMinutes >= 15);
  const criticallyDelayedOrders = agedOpenOrders.filter((order) => order.ageMinutes >= 30);
  const trackedProducts = products.filter((product) =>
    product.stockQuantity !== null && product.stockQuantity !== undefined,
  );
  const outOfStockProducts = trackedProducts.filter((product) => Number(product.stockQuantity) <= 0);
  const lowStockProducts = trackedProducts.filter((product) => {
    const quantity = Number(product.stockQuantity);
    const threshold = Number(product.minStockThreshold ?? 5);
    return quantity > 0 && quantity <= threshold;
  });

  const occupancyRate = activeTables.length
    ? Math.round((occupiedTables.length / activeTables.length) * 100)
    : 0;
  const reviewedOrderCount = closedOrders.length + voidOrders.length;
  const voidRate = reviewedOrderCount
    ? Math.round((voidOrders.length / reviewedOrderCount) * 100)
    : 0;

  const insights = [];

  if (dataCoverage.orders !== false && criticallyDelayedOrders.length) {
    const oldest = criticallyDelayedOrders[0];
    insights.push(createInsight({
      id: 'critical-kitchen-delay',
      severity: 'critical',
      tone: 'danger',
      title: `${criticallyDelayedOrders.length} طلب متأخر أكثر من 30 دقيقة`,
      detail: 'ابدأ بالأقدم وحدد هل التعطيل من التحضير أم التسليم قبل استقبال ضغط جديد.',
      evidence: `أقدم طلب منتظر منذ ${oldest.ageMinutes} دقيقة`,
      action: 'افتح شاشة التحضير الآن',
      route: ROUTES.KDS,
      penalty: 32,
    }));
  } else if (dataCoverage.orders !== false && delayedOrders.length) {
    insights.push(createInsight({
      id: 'kitchen-delay',
      severity: 'warning',
      tone: 'warning',
      title: `${delayedOrders.length} طلب اقترب من منطقة التأخير`,
      detail: 'رتّب شاشة التحضير حسب الأقدم وحرّك الطلبات قبل تجاوز نصف ساعة.',
      evidence: `أقدم طلب منتظر منذ ${delayedOrders[0].ageMinutes} دقيقة`,
      action: 'راجع طابور التحضير',
      route: ROUTES.KDS,
      penalty: 17,
    }));
  }

  if (dataCoverage.products !== false && outOfStockProducts.length) {
    insights.push(createInsight({
      id: 'out-of-stock',
      severity: 'critical',
      tone: 'danger',
      title: `${outOfStockProducts.length} صنف رصيده منتهٍ`,
      detail: 'راجع الإتاحة فوراً حتى لا يقبل الكاشير طلباً لا يمكن تنفيذه.',
      evidence: outOfStockProducts.slice(0, 3).map((product) => product.name).join('، '),
      action: 'عالج المخزون',
      route: ROUTES.INVENTORY,
      penalty: 26,
    }));
  } else if (dataCoverage.products !== false && lowStockProducts.length) {
    insights.push(createInsight({
      id: 'low-stock',
      severity: 'warning',
      tone: 'warning',
      title: `${lowStockProducts.length} صنف يحتاج إعادة طلب قريباً`,
      detail: 'راجع الكميات قبل فترة الذروة وحوّل النواقص إلى قائمة شراء.',
      evidence: lowStockProducts.slice(0, 3).map((product) => product.name).join('، '),
      action: 'مراجعة المخزون',
      route: ROUTES.INVENTORY,
      penalty: 14,
    }));
  }

  if (!shift && dataCoverage.shift !== false) {
    const supervisor = role === ROLES.SUPERVISOR;
    insights.push(createInsight({
      id: 'no-open-shift',
      severity: supervisor ? 'warning' : 'info',
      tone: supervisor ? 'warning' : 'neutral',
      title: 'لا يوجد شيفت مفتوح الآن',
      detail: supervisor
        ? 'التشغيل والتحصيل يحتاجان فتح شيفت قبل بدء البيع.'
        : 'لا توجد حركة تحصيل مباشرة؛ راجع التقارير إن كان المكان يفترض أن يعمل الآن.',
      evidence: 'خدمة الشيفت لم ترجع جلسة تشغيل نشطة',
      action: supervisor ? 'افتح الكاشير' : 'راجع التقارير',
      route: supervisor ? ROUTES.POS : ROUTES.REPORTS,
      penalty: supervisor ? 22 : 8,
    }));
  }

  if (dataCoverage.orders !== false && reviewedOrderCount >= 5 && voidRate >= 10 && role === ROLES.ADMIN) {
    insights.push(createInsight({
      id: 'high-void-rate',
      severity: voidRate >= 20 ? 'critical' : 'warning',
      tone: voidRate >= 20 ? 'danger' : 'warning',
      title: `نسبة الإلغاء مرتفعة: ${voidRate}%`,
      detail: 'راجع أسباب الإلغاء والمستخدمين المنفذين؛ الارتفاع قد يعني خطأ تشغيل أو تسريباً مالياً.',
      evidence: `${voidOrders.length} ملغي من ${reviewedOrderCount} طلب مكتمل أو ملغي`,
      action: 'افحص الفواتير الملغاة',
      route: ROUTES.INVOICES,
      penalty: voidRate >= 20 ? 24 : 15,
    }));
  }

  if (dataCoverage.orders !== false && dataCoverage.tables !== false && occupancyRate >= 85) {
    const underPressure = delayedOrders.length > 0;
    insights.push(createInsight({
      id: 'high-occupancy',
      severity: underPressure ? 'warning' : 'opportunity',
      tone: underPressure ? 'warning' : 'info',
      title: underPressure ? 'الصالة ممتلئة والمطبخ تحت ضغط' : 'إشغال الصالة مرتفع',
      detail: underPressure
        ? 'خفف استقبال الطلبات المعقدة ووزّع الفريق على أقدم الطاولات.'
        : 'التشغيل مستقر؛ جهّز الطاولات التالية وحافظ على سرعة دورانها.',
      evidence: `${occupiedTables.length} من ${activeTables.length} طاولة مشغولة (${occupancyRate}%)`,
      action: 'شاهد الصالة',
      route: ROUTES.TABLES,
      penalty: underPressure ? 13 : 0,
    }));
  }

  const coverageEntries = ['orders', 'tables', 'shift', 'products'];
  const availableSources = coverageEntries.filter((key) => dataCoverage[key] !== false).length;
  const missingSources = coverageEntries.length - availableSources;
  if (missingSources) {
    insights.push(createInsight({
      id: 'partial-data',
      severity: 'info',
      tone: 'neutral',
      title: 'القراءة الحالية مبنية على بيانات جزئية',
      detail: 'بعض مصادر التشغيل لم تستجب، لذلك لا تعتمد على المؤشر وحده قبل التحديث.',
      evidence: `${availableSources} من ${coverageEntries.length} مصادر متاحة`,
      action: 'حدّث البيانات',
      route: null,
      penalty: 7,
    }));
  }

  if (!insights.some((insight) => insight.severity === 'critical' || insight.severity === 'warning')) {
    insights.push(createInsight({
      id: 'operations-stable',
      severity: 'success',
      tone: 'success',
      title: 'التشغيل مستقر حالياً',
      detail: 'لا توجد إشارات عاجلة في الطلبات أو المخزون أو الصالة.',
      evidence: `${openOrders.length} طلب مفتوح · ${occupancyRate}% إشغال`,
      action: 'متابعة الأداء',
      route: role === ROLES.ADMIN ? ROUTES.REPORTS : ROUTES.POS,
    }));
  }

  insights.sort((a, b) => PRIORITY[a.severity] - PRIORITY[b.severity] || b.penalty - a.penalty);

  const healthScore = clamp(
    100 - insights.reduce((total, insight) => total + insight.penalty, 0),
    0,
    100,
  );
  const status = healthScore >= 85
    ? { key: 'stable', label: 'مستقر' }
    : healthScore >= 65
      ? { key: 'watch', label: 'راقب' }
      : healthScore >= 40
        ? { key: 'attention', label: 'يحتاج تدخل' }
        : { key: 'critical', label: 'حرج' };

  return {
    healthScore,
    status,
    confidence: Math.round((availableSources / coverageEntries.length) * 100),
    insights,
    nextBestAction: insights[0],
    metrics: {
      delayedOrders: delayedOrders.length,
      criticallyDelayedOrders: criticallyDelayedOrders.length,
      lowStockProducts: lowStockProducts.length,
      outOfStockProducts: outOfStockProducts.length,
      occupancyRate,
      voidRate,
    },
  };
}
