import { UNLIMITED } from '../../api/plansApi';

/*
 * Vocabulary and pure helpers shared across the platform console.
 *
 * These used to sit at the top of SuperAdminPage.jsx alongside 1,900 lines of markup, which made
 * them invisible: the status map in particular is the single place that decides how a subscription
 * state is named, coloured and counted, and it belongs somewhere a reader can find it.
 */

export const AUDIT_ACTIONS = {
  CREATED: 'تأسيس منشأة',
  TRIAL_STARTED: 'بدء الفترة التجريبية',
  PLAN_SELECTED: 'اختيار الباقة',
  PLAN_CHANGED: 'تغيير الباقة',
  PLAN_UPGRADED: 'ترقية الباقة',
  PLAN_CUSTOMIZED: 'تخصيص الباقة',
  QUOTAS_OVERRIDDEN: 'تعديل الحدود',
  GRACE_UPDATED: 'تعديل مهلة السماح',
  SUBSCRIPTION_EXTENDED: 'تمديد الاشتراك',
  TRIAL_EXTENDED: 'تمديد التجربة',
  SUBSCRIPTION_GRACE: 'دخول مهلة السماح',
  SUBSCRIPTION_EXPIRED: 'انتهاء الاشتراك',
  SUBSCRIPTION_CANCELLED: 'إلغاء الاشتراك',
  LICENSE_ACTIVATED: 'تفعيل ترخيص',
  UPGRADE_REQUESTED: 'طلب ترقية',
  UPGRADE_APPROVED: 'اعتماد ترقية',
  UPGRADE_REJECTED: 'رفض ترقية',
  SUSPENDED: 'إيقاف منشأة',
  RESUMED: 'إعادة تفعيل',
  SETTINGS_UPDATED: 'تحديث الإعدادات',
  LOGO_UPDATED: 'تحديث الشعار',
  UPDATED: 'تحديث بيانات',
};

/*
 * The subscription lifecycle, as the server reports it on TenantResponse.subscriptionStatus.
 *
 * This page previously knew only ACTIVE / TRIAL / SUSPENDED, so a tenant in GRACE or EXPIRED
 * appeared in no counter, could not be selected in the status filter, and rendered in the table
 * with the trial badge — a customer who had stopped paying looked like one who had never started.
 */
export const SUBSCRIPTION_STATUS = {
  TRIALING:  { label: 'تجريبي',        short: 'تجريبي ⏳',   tone: 'info',    paying: false },
  ACTIVE:    { label: 'نشط',           short: 'نشط ✓',      tone: 'success', paying: true },
  GRACE:     { label: 'مهلة سماح',     short: 'مهلة ⚠',     tone: 'warning', paying: true },
  EXPIRED:   { label: 'منتهي',         short: 'منتهي ✕',    tone: 'danger',  paying: false },
  SUSPENDED: { label: 'موقوف',         short: 'موقوف ⛔',   tone: 'danger',  paying: false },
  CANCELLED: { label: 'ملغي',          short: 'ملغي',       tone: 'muted',   paying: false },
};

/* Bootstrap classes per tone, so a new status never falls through to "looks like a trial". */
export const STATUS_BADGE = {
  success: 'bg-success-subtle text-success',
  info:    'bg-info-subtle text-info',
  warning: 'bg-warning-subtle text-warning',
  danger:  'bg-danger-subtle text-danger',
  muted:   'bg-secondary-subtle text-secondary',
};

export const statusMeta = (tenant) =>
  SUBSCRIPTION_STATUS[tenant?.subscriptionStatus] ?? SUBSCRIPTION_STATUS[tenant?.status] ?? {
    label: '—', short: '—', tone: 'muted', paying: false,
  };

/*
 * When write access actually ends.
 *
 * The old helper read trialEndsAt / subscriptionEndsAt, both removed in the billing redesign, so it
 * returned undefined for every tenant — and with it the entire renewals workflow went quiet: no
 * expiring list, no expired list, no risk banner, no sidebar badge, no CSV dates.
 *
 * A perpetual subscription (a lifetime licence) genuinely has no end date, which is different from
 * not knowing one.
 */
export const tenantExpiry = (tenant) => {
  if (!tenant || tenant.perpetual) return null;
  return tenant.graceEndsAt || tenant.periodEnd || null;
};

export const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const toEndOfLocalDayInstant = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const limitText = (limit) => (limit === UNLIMITED ? 'بلا حدود' : (limit ?? '—'));

export const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

export const daysUntil = (date) => date
  ? Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  : null;

/*
 * CSV cell encoder, used by BOTH exports.
 *
 * Two problems it fixes. The tenant export did no escaping at all, so a quote in a café's name
 * broke the file. And neither export neutralised a leading = + - @, which spreadsheets treat as a
 * formula — a tenant controls its own name, so it could put one there and have it execute on the
 * operator's machine when the export was opened.
 */
export const csvCell = (value) => {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const csvRows = (rows) => '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\n');

export function downloadCsv(filename, rows) {
  const url = URL.createObjectURL(new Blob([csvRows(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
