import { format, isToday, isYesterday, parseISO, formatDistanceToNow } from 'date-fns';
import { arEG } from 'date-fns/locale';

/* ── Currency ── */
export function formatCurrency(amount, currency = 'EGP') {
  if (amount == null) return '—';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatNumber(amount) {
  if (amount == null) return '—';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(2);
}

/* ── Dates ── */
export function formatDate(dateStr, fmt = 'dd MMM yyyy') {
  if (!dateStr) return '—';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return format(date, fmt, { locale: arEG });
  } catch {
    return '—';
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (isToday(date)) {
      return 'النهاردة، ' + format(date, 'hh:mm a', { locale: arEG });
    }
    if (isYesterday(date)) {
      return 'امبارح، ' + format(date, 'hh:mm a', { locale: arEG });
    }
    return format(date, 'dd MMM yyyy، hh:mm a', { locale: arEG });
  } catch {
    return '—';
  }
}

export function formatTime(dateStr) {
  return formatDate(dateStr, 'hh:mm a');
}

export function formatRelative(dateStr) {
  if (!dateStr) return '—';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return formatDistanceToNow(date, { addSuffix: true, locale: arEG });
  } catch {
    return '—';
  }
}

/* ── Status Labels ── */
export function orderStatusLabel(status) {
  const map = {
    OPEN:   'مفتوح',
    SENT:   'في المطبخ',
    CLOSED: 'مغلق',
    VOID:   'ملغي',
  };
  return map[status] || status;
}

export function itemStatusLabel(status) {
  const map = {
    PENDING:   'قيد الانتظار',
    SENT:      'تم الإرسال',
    CANCELLED: 'ملغي',
  };
  return map[status] || status;
}

export function paymentMethodLabel(method) {
  const map = {
    CASH:  'كاش',
    CARD:  'فيزا',
    MIXED: 'مختلط',
  };
  return map[method] || method;
}

export function roleLabel(role) {
  const map = {
    ADMIN:      'أدمن',
    SUPERVISOR: 'مشرف',
    CASHIER:    'كاشير',
  };
  return map[role] || role;
}

/* ── Text ── */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function truncate(str, maxLen = 30) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
