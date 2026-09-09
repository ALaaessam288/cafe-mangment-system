import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { platformApi } from '../../api/platformApi';
import { useToast } from '../../context/ToastContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import ProvisionTenantModal from './components/ProvisionTenantModal';
import ProvisionSuccessModal from './components/ProvisionSuccessModal';
import UpgradeInbox from './components/UpgradeInbox';
import PlanEditor from './components/PlanEditor';
import InvoiceLedger from './components/InvoiceLedger';
import './SuperAdminPage.css';
import { plansApi, UNLIMITED, formatLimit } from '../../api/plansApi';
import { upgradeAdminApi, upgradeApi } from '../../api/subscriptionApi';

/*
 * Every action SubscriptionService and friends can write to the audit log. Anything missing here
 * renders as a raw English code and cannot be picked from the filter — which is what happened to
 * the whole upgrade-request and grace/expiry vocabulary after the billing redesign.
 */
import {
  AUDIT_ACTIONS,
  SUBSCRIPTION_STATUS,
  STATUS_BADGE,
  daysUntil,
  downloadCsv,
  formatDate,
  limitText,
  statusMeta,
  tenantExpiry,
  toDateInputValue,
  toEndOfLocalDayInstant,
} from './superAdminShared';
import SectionIntro from './components/SectionIntro';

export default function SuperAdminPage() {
  const toast = useToast();
  const expiryNoticeSignatureRef = useRef('');

  // Navigation State
  const [activeSection, setActiveSection] = useState('dashboard');

  // Core Data State
  const [tenants, setTenants] = useState([]);
  const [licenseKeys, setLicenseKeys] = useState([]);
  const [platformActivityLogs, setPlatformActivityLogs] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Table Filtering, Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  // Modals & Action States
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Custom Plan Form State
  const [customPlanForm, setCustomPlanForm] = useState({
    plan: 'PRO',
    periodDays: '',
    negotiatedPrice: '',
    /* Off by default: most plan changes should simply inherit the plan's own limits. */
    useOverrides: false,
    maxTables: 50,
    maxUsers: 15,
    maxProducts: 500,
    extendDays: 0,
    note: '',
  });

  // License Generator State
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyForm, setKeyForm] = useState({
    plan: 'PRO',
    /* How much subscription redeeming the key grants. */
    validDays: 365,
    /* How long the key may be redeemed. Blank = no deadline. */
    redeemableForDays: '',
    maxActivations: 1,
    notes: '',
  });

  const [createdTenantModal, setCreatedTenantModal] = useState(null);

  /*
   * The plan catalogue, fetched rather than hardcoded. This page used to carry its own copy of
   * every plan's limits in applyPlanPreset(), which had to be kept in step by hand with a second
   * copy in FirstTimePlanModal and a third in the backend enum. It never was.
   */
  const [plans, setPlans] = useState([]);

  /* Support phone and bank details are the operator's own, and belong in configuration. */
  const [platformSettings, setPlatformSettings] = useState(null);

  /* Drives the "المدفوعات" badge so an unreviewed transfer is visible from any section. */
  const [pendingPayments, setPendingPayments] = useState(0);

  const refreshPendingPayments = useCallback(() => {
    upgradeAdminApi.list(true)
      .then((rows) => setPendingPayments(rows.length))
      .catch(() => setPendingPayments(0));
  }, []);

  useEffect(() => {
    plansApi.listAll().then(setPlans).catch(() => setPlans([]));
    upgradeApi.bankDetails().then(setPlatformSettings).catch(() => setPlatformSettings(null));
    refreshPendingPayments();
  }, [refreshPendingPayments]);

  // ── DATA FETCHING ──────────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [tenantsResult, keysResult, statsResult, logsResult] = await Promise.allSettled([
        platformApi.getAllTenants(),
        platformApi.getLicenseKeys(),
        platformApi.getPlatformStats(),
        platformApi.getPlatformActivityLog(),
      ]);

      if (tenantsResult.status === 'rejected') throw tenantsResult.reason;
      setTenants(tenantsResult.value || []);
      setLicenseKeys(keysResult.status === 'fulfilled' ? keysResult.value || [] : []);
      setPlatformStats(statsResult.status === 'fulfilled' ? statsResult.value : null);
      setPlatformActivityLogs(logsResult.status === 'fulfilled' ? logsResult.value || [] : []);
      setLastUpdatedAt(new Date());

      const optionalFailures = [keysResult, statsResult, logsResult].filter((result) => result.status === 'rejected').length;
      if (optionalFailures > 0) toast.error('تم تحميل بيانات المنشآت، لكن بعض تقارير المنصة غير متاحة حالياً');
    } catch (err) {
      toast.error(err.message || 'فشل في تحميل بيانات المنصة');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── TENANT ACTIONS ─────────────────────────────────────────────────────────
  async function handleUpdateSubscription(tenantId, plan, status, extendDays) {
    setUpdating(true);
    try {
      if (plan) await platformApi.changePlan(tenantId, { planCode: plan });
      if (status === 'SUSPENDED') await platformApi.suspendTenant(tenantId, 'إيقاف من لوحة المنصة');
      if (status === 'ACTIVE') await platformApi.resumeTenant(tenantId);
      if (extendDays) await platformApi.extendSubscription(tenantId, Number(extendDays));
      toast.success('تم تحديث بيانات الاشتراك بنجاح! 🚀');
      setEditModal(false);
      setSelectedTenant(null);
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'فشل في تحديث الخطة');
    } finally {
      setUpdating(false);
    }
  }

  const handleOpenEditModal = async (t) => {
    setSelectedTenant(t);
    const plan = plans.find((p) => p.code === t.subscriptionPlan);
    /*
     * A tenant's limits are an override only where they differ from the plan's own. Seeding the
     * switch from that comparison means reopening this dialog and saving no longer converts a
     * plain plan into a bespoke deal by accident.
     */
    const hasOverrides = !!plan && (
      t.maxTables !== plan.limits.maxTables ||
      t.maxUsers !== plan.limits.maxUsers ||
      t.maxProducts !== plan.limits.maxProducts
    );
    setCustomPlanForm({
      plan: t.subscriptionPlan || 'PRO',
      periodDays: '',
      negotiatedPrice: '',
      useOverrides: hasOverrides,
      maxTables: t.maxTables ?? plan?.limits.maxTables ?? 50,
      maxUsers: t.maxUsers ?? plan?.limits.maxUsers ?? 15,
      maxProducts: t.maxProducts ?? plan?.limits.maxProducts ?? 500,
      extendDays: 0,
      note: '',
    });
    setEditModal(true);
    setLoadingLogs(true);
    setActivityLogs([]);
    try {
      const logs = await platformApi.getTenantActivityLog(t.id);
      setActivityLogs(logs || []);
    } catch {
      setActivityLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  /** Fills the form from a plan's real limits, whatever the platform currently sells. */
  function applyPlanPreset(planCode) {
    const plan = plans.find((p) => p.code === planCode);
    if (!plan) {
      setCustomPlanForm((prev) => ({ ...prev, plan: planCode }));
      return;
    }
    setCustomPlanForm((prev) => ({
      ...prev,
      plan: plan.code,
      // A CUSTOM plan has no meaningful defaults — its limits are always the operator's to set.
      maxTables: plan.customPlan ? prev.maxTables : plan.limits.maxTables,
      maxUsers: plan.customPlan ? prev.maxUsers : plan.limits.maxUsers,
      maxProducts: plan.customPlan ? prev.maxProducts : plan.limits.maxProducts,
      useOverrides: plan.customPlan,
    }));
  }

  async function handleSaveCustomPlan(e) {
    if (e) e.preventDefault();
    if (!selectedTenant) return;

    // -1 is the server's "unlimited" sentinel; anything else must be a real positive ceiling.
    // 0 is rejected, because the old backend treated it as "no limit" — the inverse of its meaning.
    const quotas = [customPlanForm.maxTables, customPlanForm.maxUsers, customPlanForm.maxProducts].map(Number);
    if (quotas.some((v) => !Number.isInteger(v) || (v !== UNLIMITED && (v < 1 || v > 100000)))) {
      toast.error('الحدود يجب أن تكون -1 (بلا حدود) أو رقماً بين 1 و100000');
      return;
    }

    setUpdating(true);
    try {
      const usesOverrides = customPlanForm.useOverrides;
      await platformApi.changePlan(selectedTenant.id, {
        planCode: customPlanForm.plan,
        periodDays: Number(customPlanForm.periodDays) || null,
        negotiatedPrice: customPlanForm.negotiatedPrice !== '' ? Number(customPlanForm.negotiatedPrice) : null,
        // Sending no overrides is meaningful: it drops any previous bespoke deal and falls back to
        // the plan's own limits, rather than silently carrying stale numbers forward.
        maxTables: usesOverrides ? Number(customPlanForm.maxTables) : null,
        maxUsers: usesOverrides ? Number(customPlanForm.maxUsers) : null,
        maxProducts: usesOverrides ? Number(customPlanForm.maxProducts) : null,
        note: customPlanForm.note || null,
      });

      const extraDays = Number(customPlanForm.extendDays) || 0;
      if (extraDays > 0) {
        await platformApi.extendSubscription(selectedTenant.id, extraDays, false, 'تمديد يدوي من لوحة المنصة');
      }

      toast.success('تم حفظ اشتراك المنشأة بنجاح! ⚙️🚀');
      setEditModal(false);
      setSelectedTenant(null);
      loadData(true);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'فشل في حفظ الاشتراك');
    } finally {
      setUpdating(false);
    }
  }


  function handleDeleteTenant(tenantId, tenantName) {
    setConfirmModal({
      open: true,
      title: 'حذف المنشأة نهائياً ⚠️',
      message: `هل أنت متأكد من رغبتك في حذف منشأة "${tenantName}" وجميع مستخدميها وبياناتها نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`,
      onConfirm: async () => {
        setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
        setUpdating(true);
        try {
          await platformApi.deleteTenant(tenantId);
          toast.success(`تم حذف منشأة "${tenantName}" بنجاح 🗑️`);
          setEditModal(false);
          setSelectedTenant(null);
          loadData(true);
        } catch (err) {
          toast.error(err.message || 'فشل في حذف المنشأة');
        } finally {
          setUpdating(false);
        }
      }
    });
  }

  async function handleBulkAction(action, confirmed = false) {
    if (selectedIds.length === 0) return;
    if (action === 'SUSPENDED' && !confirmed) {
      setConfirmModal({
        open: true,
        title: `إيقاف ${selectedIds.length} منشأة؟`,
        message: 'سيتم منع مستخدمي المنشآت المحددة من تشغيل النظام. يمكنك إعادة تفعيلهم لاحقاً.',
        onConfirm: () => {
          setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
          handleBulkAction(action, true);
        },
      });
      return;
    }
    setUpdating(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => {
        if (action === 'ACTIVE') return platformApi.resumeTenant(id);
        if (action === 'SUSPENDED') return platformApi.suspendTenant(id, 'إيقاف جماعي من لوحة المنصة');
        return platformApi.extendSubscription(id, 7, false, 'تمديد جماعي');
      }));
      const completed = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - completed;
      if (completed > 0) toast.success(`تم تنفيذ الإجراء على ${completed} منشأة`);
      if (failed > 0) toast.error(`تعذر تنفيذ الإجراء على ${failed} منشأة؛ راجع حالتها وحاول مرة أخرى`);
      if (failed === 0) setSelectedIds([]);
      await loadData(true);
    } finally {
      setUpdating(false);
    }
  }

  /*
   * Handover message for a newly provisioned tenant.
   *
   * The password is deliberately NOT in it. This message used to carry the owner's plaintext
   * password into a wa.me URL, which puts it in the operator's browser history, in WhatsApp Web,
   * and in the customer's chat log permanently — three copies nobody can revoke. The operator
   * reads it aloud, or copies it from the handover card, over a channel of their choosing.
   */
  function formatWhatsappMessage(data) {
    const loginUrl = `${window.location.origin}/${data.slug}/login`;
    const support = platformSettings?.supportPhone;
    return [
      'مرحباً بك في منصة كافيو لإدارة الكافيهات والمطاعم ☕🚀',
      '',
      'تم تأسيس وتفعيل حساب منشأتكم بنجاح:',
      `🏪 اسم المنشأة: ${data.name}`,
      `🌐 المعرف المختصر: ${data.slug}`,
      `⭐ باقة الاشتراك: ${data.planDisplayName || data.planCode || ''}`,
      '',
      '🔐 بيانات الدخول:',
      `👤 اسم المستخدم: ${data.ownerUsername}`,
      '🔑 كلمة المرور: سنرسلها لك في رسالة منفصلة.',
      '',
      '🌐 رابط تسجيل الدخول:',
      loginUrl,
      '',
      ...(support ? ['📞 للدعم الفني:', support, ''] : []),
      'نتمنى لكم تجربة مميزة وتشغيل ناجح! ✨',
    ].join('\n');
  }

  function sendWhatsappCredentials(data) {
    if (!data || !data.ownerWhatsapp) {
      toast.error('لم يتم تحديد رقم واتساب للمنشأة');
      return;
    }

    let phone = data.ownerWhatsapp.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
      phone = '20' + phone.substring(1);
    } else if (!phone.startsWith('20') && phone.length === 10) {
      phone = '20' + phone;
    }

    const message = formatWhatsappMessage(data);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    toast.success('تم فتح واتساب برسالة الترحيب — أرسل كلمة المرور بشكل منفصل 🔐');
  }

  async function handleCreateTenant(formData) {
    const normalizedSlug = formData.slug.trim().toLowerCase();
    setUpdating(true);
    try {
      const provisioned = await platformApi.provisionTenant({ ...formData, slug: normalizedSlug });
      const createdData = {
        ...formData,
        tenantId: provisioned?.tenantId,
        slug: provisioned?.slug || normalizedSlug,
        ownerUsername: provisioned?.ownerUsername || formData.ownerUsername,
        loginUrl: `${window.location.origin}/${provisioned?.slug || normalizedSlug}/login`,
      };

      setCreatedTenantModal(createdData);
      setCreateModal(false);
      toast.success(`تم تأسيس ${formData.name} وأصبحت مساحة التشغيل جاهزة`);
      await loadData(true);
    } catch (err) {
      toast.error(err.message || 'فشل في إضافة المنشأة');
      throw err;
    } finally {
      setUpdating(false);
    }
  }

  // ── LICENSE KEY ACTIONS ────────────────────────────────────────────────────
  async function handleGenerateKey(e) {
    e.preventDefault();
    const validDays = Number(keyForm.validDays);
    if (!Number.isInteger(validDays) || validDays < 0 || validDays > 3650) {
      toast.error('مدة الترخيص يجب أن تكون من 0 إلى 3650 يوم');
      return;
    }
    setGeneratingKey(true);
    try {
      // durationDays is what the customer buys; redeemableForDays only bounds when they may
      // claim it. Collapsing the two is what used to shrink a late-redeemed annual key to weeks.
      await platformApi.generateLicenseKey({
        planCode: keyForm.plan,
        durationDays: validDays,
        redeemableForDays: Number(keyForm.redeemableForDays) || null,
        maxActivations: Number(keyForm.maxActivations) || 1,
        notes: keyForm.notes.trim(),
      });
      toast.success('تم إصدار مفتاح الترخيص بنجاح! 🔑');
      setKeyForm({ plan: 'PRO', validDays: 365, redeemableForDays: '', maxActivations: 1, notes: '' });
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'فشل في إنشاء المفتاح');
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleRevokeKey(id) {
    setConfirmModal({
      open: true,
      title: 'تأكيد إلغاء مفتاح الترخيص',
      message: 'هل أنت متأكد من رغبتك في إلغاء صلاحية هذا المفتاح نهائياً؟ لن يتمكن العميل من استخدامه بعد الآن.',
      onConfirm: async () => {
        try {
          await platformApi.revokeLicenseKey(id, 'إلغاء من لوحة المنصة');
          toast.success('تم إلغاء صلاحية المفتاح');
          loadData(true);
        } catch (err) {
          toast.error(err.message || 'فشل إلغاء المفتاح');
        } finally {
          setConfirmModal({ open: false, title: '', message: '', onConfirm: null });
        }
      },
    });
  }

  function copyToClipboard(text, label = 'النص') {
    return navigator.clipboard.writeText(text).then(() => {
      toast.success(`تم نسخ ${label} إلى الحافظة ✓`);
      return true;
    }).catch(() => {
      toast.error(`تعذر نسخ ${label}`);
      return false;
    });
  }

  // ── EXPORT DATA ────────────────────────────────────────────────────────────
  function exportTenantsToCSV() {
    const rows = [
      ['ID', 'المنشأة', 'الرابط', 'الباقة', 'حالة الاشتراك', 'الطاولات', 'المستخدمون', 'الأصناف',
       'نهاية الفترة', 'أيام متبقية'],
      ...filteredTenants.map((t) => [
        t.id,
        t.name,
        t.slug,
        t.planDisplayName || t.subscriptionPlan || '—',
        statusMeta(t).label,
        limitText(t.maxTables),
        limitText(t.maxUsers),
        limitText(t.maxProducts),
        t.perpetual ? 'مفتوح' : formatDate(tenantExpiry(t)),
        t.perpetual ? '∞' : (daysUntil(tenantExpiry(t)) ?? ''),
      ]),
    ];
    downloadCsv(`caffio_tenants_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('تم تصدير ملف المشتركين (CSV) بنجاح');
  }

  function exportPlatformReportCsv() {
    const rows = [
      ['تقرير منصة Caffio', new Date().toLocaleString('ar-EG')],
      [],
      ['المؤشر', 'القيمة'],
      ['إجمالي المنشآت', totalTenants],
      ['منشآت تدفع', payingTenants],
      ['نشطة', activeTenants],
      ['في مهلة السماح', graceTenants],
      ['تجارب', trialTenants],
      ['موقوفة', suspendedTenants],
      ['منتهية', expiredCount],
      ['تنتهي خلال 7 أيام', expiringTenants.length],
      [`MRR (${revenue.currency})`, revenue.mrr],
      [`ARR (${revenue.currency})`, revenue.arr],
      [`محصَّل آخر 30 يوماً (${revenue.currency})`, revenue.collected30],
      [`مستحق غير محصَّل (${revenue.currency})`, revenue.outstanding],
      [],
      ['المنشأة', 'الرابط', 'حالة الاشتراك', 'الباقة', 'نهاية الفترة', 'أيام متبقية'],
      ...tenants.map((tenant) => [
        tenant.name,
        tenant.slug,
        statusMeta(tenant).label,
        tenant.planDisplayName || tenant.subscriptionPlan || '—',
        tenant.perpetual ? 'مفتوح' : formatDate(tenantExpiry(tenant)),
        tenant.perpetual ? '∞' : (daysUntil(tenantExpiry(tenant)) ?? ''),
      ]),
    ];
    downloadCsv(`caffio_platform_report_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('تم تجهيز تقرير المنصة للتنزيل');
  }

  // ── COMPUTED KPI METRICS ───────────────────────────────────────────────────
  /*
   * Counters key off subscriptionStatus, the lifecycle the server actually maintains. The platform
   * also returns these figures pre-computed in /admin/tenants/stats; those are authoritative and
   * used where available, with the local tally as a fallback so the dashboard still renders when
   * the stats call is the one that failed.
   */
  const statusCounts = useMemo(() => {
    const counts = { TRIALING: 0, ACTIVE: 0, GRACE: 0, EXPIRED: 0, SUSPENDED: 0, CANCELLED: 0 };
    tenants.forEach((t) => {
      const key = t.subscriptionStatus ?? t.status;
      if (key in counts) counts[key] += 1;
    });
    return counts;
  }, [tenants]);

  const totalTenants = platformStats?.totalTenants ?? tenants.length;
  const activeTenants = platformStats?.activeTenants ?? statusCounts.ACTIVE;
  const trialTenants = platformStats?.trialTenants ?? statusCounts.TRIALING;
  const suspendedTenants = platformStats?.suspendedTenants ?? statusCounts.SUSPENDED;
  const graceTenants = platformStats?.graceTenants ?? statusCounts.GRACE;
  const expiredCount = platformStats?.expiredTenants ?? statusCounts.EXPIRED;
  /* A tenant inside its grace window is still inside a period it paid for. */
  const payingTenants = platformStats?.payingTenants ?? (statusCounts.ACTIVE + statusCounts.GRACE);

  /*
   * Licensed seats, not people. -1 is the unlimited sentinel and must not be summed: doing so made
   * every ENTERPRISE tenant subtract a user from the platform total.
   */
  const seatCapacity = useMemo(() => tenants.reduce((total, t) => {
    if (t.maxUsers === UNLIMITED) return total;
    return total + (t.maxUsers ?? 0);
  }, 0), [tenants]);
  const hasUnlimitedSeats = tenants.some((t) => t.maxUsers === UNLIMITED);

  const activeSubscriptions = payingTenants;

  /*
   * Real revenue, from issued invoices — not a price list kept in this file.
   *
   * This page used to compute MRR by multiplying a hardcoded PLAN_PRICES map by a headcount, so it
   * ignored negotiated prices, ignored tenants in grace, and reported stale numbers the moment a
   * price changed in the database. The server already computes all of this from what was actually
   * billed; there is nothing left here to get wrong.
   */
  const revenue = useMemo(() => ({
    mrr: Number(platformStats?.mrr ?? 0),
    arr: Number(platformStats?.arr ?? 0),
    collected30: Number(platformStats?.collectedLast30Days ?? 0),
    outstanding: Number(platformStats?.outstanding ?? 0),
    currency: platformStats?.currency ?? 'EGP',
    available: platformStats != null,
  }), [platformStats]);
  const estimatedMRR = revenue.mrr;

  // Expiring soon (< 7 days)
  const expiringTenants = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return tenants.filter((t) => {
      const expiry = tenantExpiry(t);
      if (!expiry) return false;
      const date = new Date(expiry);
      return !Number.isNaN(date.getTime()) && date > now && date <= sevenDaysLater;
    });
  }, [tenants]);

  const expiredTenants = useMemo(() => tenants.filter((tenant) => {
    const expiry = tenantExpiry(tenant);
    if (!expiry) return false;
    const date = new Date(expiry);
    return !Number.isNaN(date.getTime()) && date <= new Date();
  }), [tenants]);

  useEffect(() => {
    if (loading || tenants.length === 0) return;

    const signature = [
      ...expiredTenants.map((tenant) => `expired:${tenant.id}:${tenantExpiry(tenant)}`),
      ...expiringTenants.map((tenant) => `expiring:${tenant.id}:${tenantExpiry(tenant)}`),
    ].sort().join('|');

    if (!signature) {
      expiryNoticeSignatureRef.current = '';
      return;
    }
    if (expiryNoticeSignatureRef.current === signature) return;
    expiryNoticeSignatureRef.current = signature;

    if (expiredTenants.length > 0) {
      const names = expiredTenants.slice(0, 2).map((tenant) => tenant.name).join('، ');
      const more = expiredTenants.length > 2 ? ` و${expiredTenants.length - 2} أخرى` : '';
      toast.error(`انتهت باقة ${names}${more}. راجع التجديد أو أوقف الخدمة.`);
      return;
    }

    const names = expiringTenants.slice(0, 2).map((tenant) => tenant.name).join('، ');
    const more = expiringTenants.length > 2 ? ` و${expiringTenants.length - 2} أخرى` : '';
    toast.warning(`تنبيه تجديد: باقة ${names}${more} تنتهي خلال 7 أيام.`);
  }, [expiredTenants, expiringTenants, loading, tenants.length, toast]);

  const tenantById = useMemo(() => new Map(tenants.map((tenant) => [tenant.id, tenant])), [tenants]);
  const filteredActivityLogs = useMemo(() => platformActivityLogs.filter((log) => {
    const tenant = tenantById.get(log.tenantId);
    const query = auditQuery.trim().toLowerCase();
    const matchesQuery = !query || [tenant?.name, tenant?.slug, log.action, log.details, log.performedBy]
      .some((value) => String(value || '').toLowerCase().includes(query));
    return matchesQuery && (auditActionFilter === 'ALL' || log.action === auditActionFilter);
  }), [platformActivityLogs, tenantById, auditQuery, auditActionFilter]);

  const licenseMetrics = useMemo(() => {
    const now = Date.now();
    return licenseKeys.reduce((metrics, key) => {
      if (key.revoked) metrics.revoked += 1;
      // redeemableUntil, not expiresAt: the field was renamed when the key's redemption deadline
      // was split from the subscription duration it grants. Reading the old name meant this bucket
      // was permanently zero and every key rendered as "no deadline".
      else if (key.redeemableUntil && new Date(key.redeemableUntil).getTime() < now) metrics.expired += 1;
      else if ((key.activationsCount || 0) >= (key.maxActivations || 1)) metrics.used += 1;
      else metrics.available += 1;
      return metrics;
    }, { available: 0, used: 0, expired: 0, revoked: 0 });
  }, [licenseKeys]);

  /*
   * Tenants per plan, keyed by whatever the catalogue currently sells rather than four plan codes
   * written into this file — a newly created plan used to be invisible here.
   */
  const planCounts = useMemo(() => {
    const counts = {};
    plans.forEach((plan) => { counts[plan.code] = 0; });
    tenants.forEach((t) => {
      const code = t.subscriptionPlan || 'TRIAL';
      counts[code] = (counts[code] ?? 0) + 1;
    });
    return counts;
  }, [tenants, plans]);

  const activeRate = totalTenants ? Math.round((payingTenants / totalTenants) * 100) : 0;
  const renewalRiskCount = expiringTenants.length + expiredTenants.length;

  /*
   * Revenue per plan, from what each tenant is actually being billed. The subscription price is
   * frozen on the tenant at purchase, so a negotiated deal contributes its real figure and a later
   * price change does not rewrite it — neither of which was true when this multiplied a headcount
   * by a hardcoded list price.
   */
  const planRevenue = useMemo(() => {
    const rows = new Map();
    plans.filter((p) => !p.customPlan).forEach((plan) => {
      rows.set(plan.code, { code: plan.code, label: plan.displayName, count: 0, revenue: 0 });
    });
    tenants.forEach((tenant) => {
      if (!statusMeta(tenant).paying) return;
      const code = tenant.subscriptionPlan;
      if (!code) return;
      const plan = plans.find((p) => p.code === code);
      const row = rows.get(code) ?? { code, label: code, count: 0, revenue: 0 };
      const period = Math.max(1, plan?.billingPeriodDays ?? 30);
      const monthly = ((tenant.priceAtPurchase ?? plan?.price ?? 0) * 30) / period;
      row.count += 1;
      row.revenue += monthly;
      rows.set(code, row);
    });
    return [...rows.values()].filter((row) => row.count > 0 || row.revenue > 0);
  }, [tenants, plans]);

  const latestPlatformActivity = platformActivityLogs.slice(0, 4);

  // Filtered & Sorted Tenants
  const filteredTenants = useMemo(() => {
    return tenants
      .filter((t) => {
        const matchesSearch =
          String(t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(t.slug || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL'
          || (t.subscriptionStatus ?? t.status) === statusFilter;
        const matchesPlan = planFilter === 'ALL' || (t.subscriptionPlan || 'TRIAL') === planFilter;
        return matchesSearch && matchesStatus && matchesPlan;
      })
      .sort((a, b) => {
        let valA = a[sortBy] || '';
        let valB = b[sortBy] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [tenants, searchQuery, statusFilter, planFilter, sortBy, sortOrder]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredTenants.length / pageSize) || 1;

  /*
   * Clamp the page whenever the result set shrinks. Filtering down to fewer pages while sitting on
   * a high page number left the table showing nothing, with working pagination controls and no
   * indication why.
   */
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTenants.slice(start, start + pageSize);
  }, [filteredTenants, currentPage, pageSize]);

  return (
    <SuperAdminLayout
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onOpenProvisionModal={() => setCreateModal(true)}
      onRefresh={() => loadData(true)}
      refreshing={refreshing}
      totalTenants={totalTenants}
      activeTenants={activeTenants}
      expiringCount={expiringTenants.length + expiredTenants.length}
      pendingPayments={pendingPayments}
      planCount={plans.length}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          1. DASHBOARD OVERVIEW SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'dashboard' && (
        <div className="sa-section sa-control-room">
          <section className="sa-control-stage">
            <div className="sa-control-stage__story">
              <span className="sa-control-kicker"><i /> CAFFIO BUSINESS OS / LIVE</span>
              <h1>شايف المنصة كلها.<br /><em>وعارف قرارك الجاي.</em></h1>
              <p>مساحة قيادة واحدة تجمع النمو، صحة العملاء، التجديدات والتراخيص بدون أرقام مشتتة.</p>
              <div className="sa-control-stage__actions">
                <button type="button" className="sa-control-cta" onClick={() => setCreateModal(true)}>
                  <span><i className="bi bi-building-add" /></span>
                  <b>ابدأ عميل جديد<small>أنشئ المنشأة وجهّز الباقة</small></b>
                  <i className="bi bi-arrow-left" />
                </button>
                <button type="button" className="sa-control-ghost" onClick={() => setActiveSection('reports')}>
                  مركز التقارير <i className="bi bi-graph-up-arrow" />
                </button>
              </div>
              <div className="sa-control-stage__ticker">
                <span><i className="bi bi-broadcast" /> البيانات محدثة</span>
                <span><b>{activeTenants}</b> منشأة تعمل الآن</span>
                <span><b>{activeSubscriptions}</b> اشتراك مدفوع</span>
              </div>
            </div>

            <div className="sa-control-stage__radar">
              <div className="sa-health-radar" style={{ '--sa-health-angle': `${activeRate * 3.6}deg` }}>
                <div><strong>{activeRate}%</strong><span>صحة المنصة</span></div>
                <i className="sa-health-radar__satellite" />
              </div>
              <div className="sa-radar-caption">
                <span>PLATFORM PULSE</span>
                <strong>{renewalRiskCount ? `${renewalRiskCount} يحتاج تدخلك` : 'كل شيء تحت السيطرة'}</strong>
                <small>{expiredTenants.length} منتهي · {expiringTenants.length} قريب التجديد</small>
              </div>
            </div>
          </section>

          {renewalRiskCount > 0 && (
            <button type="button" className="sa-priority-signal" onClick={() => setActiveSection('reports')}>
              <span className="sa-priority-signal__icon"><i className="bi bi-exclamation-diamond" /></span>
              <span><small>أولوية اليوم</small><strong>{expiredTenants.length} اشتراك منتهي و{expiringTenants.length} يقترب من التجديد</strong></span>
              <span className="sa-priority-signal__action">افتح قائمة المتابعة <i className="bi bi-arrow-left" /></span>
            </button>
          )}

          <section className="sa-command-bento" aria-label="مؤشرات المنصة الرئيسية">
            <article className="sa-bento-tile sa-bento-tile--revenue">
              <header><span><i className="bi bi-stars" /> REVENUE ENGINE</span><button type="button" onClick={() => setActiveSection('reports')}>التفاصيل <i className="bi bi-arrow-up-left" /></button></header>
              <div className="sa-revenue-focus">
                <small>الإيراد الشهري المتوقع</small>
                <strong>{estimatedMRR.toLocaleString()} <b>ج.م</b></strong>
                <p>محسوب من أسعار الباقات النشطة، وليس تحصيلًا نقديًا.</p>
              </div>
              <div className="sa-revenue-composition" aria-label="مساهمة الباقات في الإيراد">
                {['STARTER', 'PRO', 'ENTERPRISE'].map((plan) => (
                  <i key={plan} className={`is-${plan.toLowerCase()}`} style={{ width: `${estimatedMRR ? (planRevenue[plan] / estimatedMRR) * 100 : 0}%` }} />
                ))}
              </div>
              <footer>
                {['STARTER', 'PRO', 'ENTERPRISE'].map((plan) => <span key={plan}><i className={`is-${plan.toLowerCase()}`} />{plan} <b>{planCounts[plan] ?? 0}</b></span>)}
              </footer>
            </article>

            <article className="sa-bento-tile sa-bento-tile--health">
              <header><span>CUSTOMER HEALTH</span><i className="bi bi-heart-pulse" /></header>
              <strong>{activeTenants}<small> / {totalTenants}</small></strong>
              <p>منشأة نشطة على المنصة</p>
              <div className="sa-mini-meter"><i style={{ width: `${activeRate}%` }} /></div>
              <button type="button" onClick={() => setActiveSection('tenants')}>إدارة العملاء <i className="bi bi-arrow-left" /></button>
            </article>

            <article className={`sa-bento-tile sa-bento-tile--renewals ${renewalRiskCount ? 'has-risk' : ''}`}>
              <header><span>RENEWAL RADAR</span><i className="bi bi-radar" /></header>
              <div className="sa-renewal-numbers"><strong>{renewalRiskCount}</strong><span><b>{expiredTenants.length}</b> منتهي<small><b>{expiringTenants.length}</b> خلال 7 أيام</small></span></div>
              <button type="button" onClick={() => setActiveSection('reports')}>{renewalRiskCount ? 'رتّب تواصل التجديد' : 'عرض تقرير التجديد'} <i className="bi bi-arrow-left" /></button>
            </article>

            <article className="sa-bento-tile sa-bento-tile--licenses">
              <header><span>LICENSE VAULT</span><i className="bi bi-key" /></header>
              <div className="sa-license-orbs">
                <span><strong>{licenseMetrics.available}</strong><small>جاهز</small></span>
                <span><strong>{licenseMetrics.used}</strong><small>مستخدم</small></span>
                <span><strong>{licenseMetrics.expired + licenseMetrics.revoked}</strong><small>غير صالح</small></span>
              </div>
              <button type="button" onClick={() => setActiveSection('subscriptions')}>إدارة التراخيص <i className="bi bi-arrow-left" /></button>
            </article>

            <article className="sa-bento-tile sa-bento-tile--capacity">
              <header><span>NETWORK CAPACITY</span><i className="bi bi-diagram-3" /></header>
              <strong>{seatCapacity.toLocaleString()}{hasUnlimitedSeats ? '+' : ''}</strong>
              <p>سعة مستخدمين متاحة عبر العملاء</p>
              <div className="sa-capacity-tags"><span>{trialTenants} تجريبي</span><span>{suspendedTenants} موقوف</span></div>
            </article>

            <article className="sa-bento-tile sa-bento-tile--actions">
              <header><span>QUICK COMMANDS</span><i className="bi bi-command" /></header>
              <button type="button" onClick={() => setCreateModal(true)}><i className="bi bi-plus-lg" /><span><b>منشأة جديدة</b><small>Provision account</small></span><i className="bi bi-arrow-left" /></button>
              <button type="button" onClick={() => setActiveSection('subscriptions')}><i className="bi bi-key" /><span><b>مفتاح ترخيص</b><small>Generate license</small></span><i className="bi bi-arrow-left" /></button>
              <button type="button" onClick={() => setActiveSection('plans')}><i className="bi bi-sliders" /><span><b>إدارة الباقات</b><small>Plans & limits</small></span><i className="bi bi-arrow-left" /></button>
            </article>
          </section>

          <section className="sa-command-lower">
            <article className="sa-command-journey">
              <header><span><small>OPERATING FLOW</small><strong>رحلة العميل على المنصة</strong></span><i className="bi bi-bezier2" /></header>
              <div>
                {[
                  { n: '01', title: 'تأسيس الحساب', hint: 'المنشأة والمالك', icon: 'bi-building-add', action: () => setCreateModal(true) },
                  { n: '02', title: 'اختيار القيمة', hint: 'الباقة والحدود', icon: 'bi-box-seam', action: () => setActiveSection('plans') },
                  { n: '03', title: 'التفعيل', hint: 'الترخيص والدخول', icon: 'bi-fingerprint', action: () => setActiveSection('subscriptions') },
                  { n: '04', title: 'النمو والتجديد', hint: 'متابعة العميل', icon: 'bi-graph-up-arrow', action: () => setActiveSection('reports') },
                ].map((step) => (
                  <button type="button" key={step.n} onClick={step.action}>
                    <span>{step.n}</span><i className={`bi ${step.icon}`} /><b>{step.title}<small>{step.hint}</small></b><i className="bi bi-chevron-left" />
                  </button>
                ))}
              </div>
            </article>

            <article className="sa-command-feed">
              <header><span><small>LIVE FEED</small><strong>آخر حركة على المنصة</strong></span><button type="button" onClick={() => setActiveSection('audit-logs')}>عرض الكل</button></header>
              <div>
                {latestPlatformActivity.length ? latestPlatformActivity.map((log) => (
                  <button type="button" key={log.id} onClick={() => setActiveSection('audit-logs')}>
                    <i className="bi bi-lightning-charge" />
                    <span><b>{AUDIT_ACTIONS[log.action] || log.action}</b><small>{tenantById.get(log.tenantId)?.name || 'عملية على المنصة'}</small></span>
                    <time>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'الآن'}</time>
                  </button>
                )) : <div className="sa-command-feed__empty"><i className="bi bi-inboxes" /><span>لا توجد عمليات حديثة بعد</span></div>}
              </div>
            </article>
          </section>
        </div>
      )}

      {activeSection === 'tenants' && (
        <div className="sa-section sa-tenants-section">
          {/* Header Intro Banner with Quick Actions */}
          <SectionIntro
            eyebrow="CUSTOMER OPERATIONS"
            title="المنشآت والعملاء"
            description="إدارة دورة حياة كل عميل، متابعة الحصص التشغيلية، التجديدات، وتفعيل أو إيقاف المنشآت."
            icon="bi-buildings"
          >
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className="sa-btn-primary"
                onClick={() => setCreateModal(true)}
              >
                <i className="bi bi-plus-lg me-1" />
                <span>منشأة جديدة</span>
              </button>

              <button
                type="button"
                className="sa-btn-ghost"
                onClick={exportTenantsToCSV}
                title="تصدير جدول المشتركين (CSV)"
              >
                <i className="bi bi-cloud-arrow-down me-1" />
                <span>تصدير CSV</span>
              </button>

              <button
                type="button"
                className="sa-btn-icon"
                onClick={() => loadData(true)}
                disabled={refreshing}
                title="تحديث البيانات"
              >
                <i className={`bi bi-arrow-clockwise ${refreshing ? 'sa-spin' : ''}`} />
              </button>
            </div>
          </SectionIntro>

          {/* Quick Metrics KPI Strip */}
          <div className="sa-tenant-kpis-grid">
            <div className="sa-kpi-card-v2">
              <div className="sa-kpi-card-v2__header">
                <span className="sa-kpi-card-v2__title">إجمالي المنشآت</span>
                <div className="sa-kpi-card-v2__icon sa-kpi-card-v2__icon--purple">
                  <i className="bi bi-buildings" />
                </div>
              </div>
              <div className="sa-kpi-card-v2__value">{totalTenants}</div>
              <div className="sa-kpi-card-v2__footer">
                <span className="text-muted small">كافة الحسابات المسجلة بالمنصة</span>
              </div>
            </div>

            <div className="sa-kpi-card-v2">
              <div className="sa-kpi-card-v2__header">
                <span className="sa-kpi-card-v2__title">المنشآت النشطة</span>
                <div className="sa-kpi-card-v2__icon sa-kpi-card-v2__icon--green">
                  <i className="bi bi-check-circle-fill" />
                </div>
              </div>
              <div className="sa-kpi-card-v2__value text-success">{activeTenants}</div>
              <div className="sa-kpi-card-v2__footer">
                <span className="sa-kpi-badge-pill sa-kpi-badge-pill--green">
                  <span className="sa-pulse-dot" /> {activeRate}% نسبة النشاط
                </span>
                <span className="text-muted small ms-auto">تدفع أو قيد التشغيل</span>
              </div>
            </div>

            <div className="sa-kpi-card-v2">
              <div className="sa-kpi-card-v2__header">
                <span className="sa-kpi-card-v2__title">الفترة التجريبية</span>
                <div className="sa-kpi-card-v2__icon sa-kpi-card-v2__icon--cyan">
                  <i className="bi bi-lightning-charge-fill" />
                </div>
              </div>
              <div className="sa-kpi-card-v2__value text-info">{trialTenants}</div>
              <div className="sa-kpi-card-v2__footer">
                <span className="sa-kpi-badge-pill sa-kpi-badge-pill--blue">{trialTenants} تجربة جارية</span>
                <span className="text-muted small ms-auto">14 يوم مجاناً</span>
              </div>
            </div>

            <div className="sa-kpi-card-v2">
              <div className="sa-kpi-card-v2__header">
                <span className="sa-kpi-card-v2__title">متابعة وتجديدات</span>
                <div className="sa-kpi-card-v2__icon sa-kpi-card-v2__icon--amber">
                  <i className="bi bi-clock-history" />
                </div>
              </div>
              <div className="sa-kpi-card-v2__value text-warning">
                {expiringTenants.length + graceTenants + expiredCount + suspendedTenants}
              </div>
              <div className="sa-kpi-card-v2__footer">
                {graceTenants > 0 && (
                  <span className="sa-kpi-badge-pill sa-kpi-badge-pill--amber">{graceTenants} مهلة</span>
                )}
                {suspendedTenants > 0 && (
                  <span className="sa-kpi-badge-pill sa-kpi-badge-pill--red">{suspendedTenants} موقوفة</span>
                )}
                {graceTenants === 0 && suspendedTenants === 0 && (
                  <span className="text-muted small">كافة الاشتراكات مستقرة</span>
                )}
              </div>
            </div>
          </div>

          {/* Main Card */}
          <div className="card sa-card sa-tenants-card shadow-sm">
            {/* Status Tabs Bar */}
            <div className="sa-filter-tabs-bar">
              <div className="sa-filter-tabs">
                {[
                  { id: 'ALL', label: 'الكل', count: tenants.length, icon: 'bi-grid-fill' },
                  { id: 'ACTIVE', label: 'النشطة', count: statusCounts.ACTIVE, icon: 'bi-check-circle-fill', tone: 'success' },
                  { id: 'TRIALING', label: 'التجريبية', count: statusCounts.TRIALING, icon: 'bi-lightning-fill', tone: 'info' },
                  { id: 'GRACE', label: 'مهلة سماح', count: statusCounts.GRACE, icon: 'bi-hourglass-split', tone: 'warning' },
                  { id: 'EXPIRED', label: 'المنتهية', count: statusCounts.EXPIRED, icon: 'bi-clock-history', tone: 'danger' },
                  { id: 'SUSPENDED', label: 'الموقوفة', count: statusCounts.SUSPENDED, icon: 'bi-pause-circle-fill', tone: 'danger' },
                  { id: 'CANCELLED', label: 'الملغاة', count: statusCounts.CANCELLED, icon: 'bi-x-circle-fill', tone: 'muted' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`sa-tab-btn ${statusFilter === st.id ? 'is-active' : ''} ${st.tone ? `sa-tab-btn--${st.tone}` : ''}`}
                    onClick={() => { setStatusFilter(st.id); setCurrentPage(1); }}
                  >
                    <i className={`bi ${st.icon} me-1`} />
                    <span>{st.label}</span>
                    <span className="sa-tab-count">{st.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toolbar Controls */}
            <div className="sa-toolbar-v2">
              <div className="sa-search-wrap">
                <i className="bi bi-search sa-search-icon" />
                <input
                  type="text"
                  className="form-control sa-search-input"
                  placeholder="ابحث باسم المنشأة، المعرف المختصر (Slug)..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="sa-search-clear"
                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                    title="مسح البحث"
                  >
                    <i className="bi bi-x-circle-fill" />
                  </button>
                )}
              </div>

              <div className="sa-toolbar-actions">
                <div className="sa-select-group">
                  <label className="sa-select-label">
                    <i className="bi bi-box-seam me-1 text-secondary" /> الباقة:
                  </label>
                  <select
                    className="form-select form-select-sm sa-control-select"
                    value={planFilter}
                    onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="ALL">كافة الباقات</option>
                    <option value="TRIAL">TRIAL — تجريبي</option>
                    <option value="STARTER">STARTER (499 ج.م)</option>
                    <option value="PRO">PRO (899 ج.م)</option>
                    <option value="ENTERPRISE">ENTERPRISE (1499 ج.م)</option>
                  </select>
                </div>

                <div className="sa-select-group">
                  <label className="sa-select-label">
                    <i className="bi bi-sort-down me-1 text-secondary" /> الترتيب:
                  </label>
                  <select
                    className="form-select form-select-sm sa-control-select"
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [sb, so] = e.target.value.split('-');
                      setSortBy(sb);
                      setSortOrder(so);
                    }}
                  >
                    <option value="name-asc">الاسم (أ - ي)</option>
                    <option value="name-desc">الاسم (ي - أ)</option>
                    <option value="createdAt-desc">الأحدث إضافة</option>
                    <option value="maxTables-desc">الأعلى طاولات</option>
                  </select>
                </div>

                {(searchQuery || statusFilter !== 'ALL' || planFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn btn-sm sa-reset-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('ALL');
                      setPlanFilter('ALL');
                      setCurrentPage(1);
                    }}
                    title="إلغاء جميع الفلاتر"
                  >
                    <i className="bi bi-arrow-counterclockwise me-1" />
                    <span>إعادة ضبط</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Actions Banner */}
            {selectedIds.length > 0 && (
              <div className="sa-bulk-bar d-flex align-items-center justify-content-between p-2 px-3">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-check2-circle text-primary fs-5" />
                  <span className="fw-bold text-white small">
                    تم تحديد <strong>{selectedIds.length}</strong> منشأة
                  </span>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-secondary p-0 ms-2 text-decoration-none"
                    onClick={() => setSelectedIds([])}
                  >
                    إلغاء التحديد
                  </button>
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-success fw-bold px-3"
                    onClick={() => handleBulkAction('ACTIVE')}
                    disabled={updating}
                  >
                    <i className="bi bi-play-circle me-1" /> تفعيل الكل
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger fw-bold px-3"
                    onClick={() => handleBulkAction('SUSPENDED')}
                    disabled={updating}
                  >
                    <i className="bi bi-pause-circle me-1" /> إيقاف الكل
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-dark border border-secondary px-3"
                    onClick={() => handleBulkAction('TRIAL_EXTEND')}
                    disabled={updating}
                  >
                    <i className="bi bi-plus-lg me-1" /> تمديد +7 أيام
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 sa-table sa-tenants-table">
                <thead>
                  <tr>
                    <th style={{ width: '44px' }} className="text-center">
                      <input
                        type="checkbox"
                        className="form-check-input sa-checkbox"
                        checked={selectedIds.length === paginatedTenants.length && paginatedTenants.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(paginatedTenants.map((t) => t.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                    <th>المنشأة والكافيه</th>
                    <th>المعرف والرابط (Slug)</th>
                    <th>الباقة الحالية</th>
                    <th>حالة الحساب</th>
                    <th>الحصص والموارد</th>
                    <th>تاريخ الصلاحية</th>
                    <th className="text-end" style={{ width: '130px' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5">
                        <div className="spinner-border text-primary mb-2" role="status" />
                        <div className="text-muted small">جاري تحميل بيانات المشتركين...</div>
                      </td>
                    </tr>
                  ) : paginatedTenants.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5">
                        <div className="sa-empty-state">
                          <i className="bi bi-inbox fs-1 d-block mb-3 text-secondary opacity-50" />
                          <h6 className="text-white fw-bold">لا توجد منشآت مطابقة لشروط البحث</h6>
                          <p className="text-muted small mb-3">جرّب تغيير كلمات البحث أو إعادة ضبط الفلاتر لتظهر كافة النتائج</p>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => {
                              setSearchQuery('');
                              setStatusFilter('ALL');
                              setPlanFilter('ALL');
                              setCurrentPage(1);
                            }}
                          >
                            <i className="bi bi-arrow-counterclockwise me-1" /> عرض جميع المنشآت
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTenants.map((t) => {
                      const isSelected = selectedIds.includes(t.id);
                      const planCode = (t.subscriptionPlan || 'TRIAL').toUpperCase();
                      const meta = statusMeta(t);
                      const isSuspended = (t.subscriptionStatus ?? t.status) === 'SUSPENDED';
                      const expDate = tenantExpiry(t);
                      const daysLeft = daysUntil(expDate);

                      return (
                        <tr key={t.id} className={isSelected ? 'sa-row--selected' : ''}>
                          <td className="text-center">
                            <input
                              type="checkbox"
                              className="form-check-input sa-checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds([...selectedIds, t.id]);
                                else setSelectedIds(selectedIds.filter((id) => id !== t.id));
                              }}
                            />
                          </td>

                          {/* Cafe Info */}
                          <td>
                            <div className="d-flex align-items-center gap-3">
                              <div className={`sa-cafe-avatar sa-cafe-avatar--${(t.businessType || 'CAFE').toLowerCase()}`}>
                                <i className={`bi ${t.businessType === 'RESTAURANT' ? 'bi-egg-fried' : t.businessType === 'CAFE_AND_RESTAURANT' ? 'bi-shop-window' : 'bi-cup-hot-fill'}`} />
                              </div>
                              <div>
                                <div className="sa-tenant-name fw-bold">{t.name}</div>
                                <div className="sa-tenant-sub d-flex align-items-center gap-2 mt-1">
                                  <span className="sa-badge-type">
                                    {t.businessType === 'RESTAURANT' ? 'مطعم' : t.businessType === 'CAFE_AND_RESTAURANT' ? 'كافيه ومطعم' : 'كافيه'}
                                  </span>
                                  <span className="sa-tenant-id">#{t.id}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Slug with Copy Pill */}
                          <td>
                            <div
                              className="sa-slug-pill"
                              onClick={() => copyToClipboard(t.slug, 'المعرف المختصر')}
                              title="اضغط للنسخ"
                            >
                              <code className="sa-slug-code">{t.slug}</code>
                              <i className="bi bi-copy sa-slug-copy-icon" />
                            </div>
                          </td>

                          {/* Plan Badge */}
                          <td>
                            <span className={`sa-plan-pill sa-plan-pill--${planCode.toLowerCase()}`}>
                              <i className="bi bi-stars me-1" />
                              {t.planDisplayName || t.subscriptionPlan || 'TRIAL'}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td>
                            <div className={`sa-status-indicator sa-status-indicator--${meta.tone}`}>
                              <span className="sa-status-dot" />
                              <span className="sa-status-text">{meta.short}</span>
                            </div>
                          </td>

                          {/* Quotas */}
                          <td>
                            <div className="sa-quotas-stack">
                              {/* The 9999 sentinel was retired with the billing redesign - UNLIMITED
                                  is -1 - so an unlimited tenant rendered as "-1 طاولات" here. The
                                  `|| 5` / `|| 2` fallbacks were worse: a tenant whose limits had not
                                  loaded was shown invented numbers indistinguishable from real ones. */}
                              <span className="sa-quota-item">
                                <i className="bi bi-grid-3x3-gap-fill text-muted me-1" />
                                {t.maxTables == null ? '—' : formatLimit(t.maxTables, 'طاولة')}
                              </span>
                              <span className="sa-quota-separator">•</span>
                              <span className="sa-quota-item">
                                <i className="bi bi-person-badge text-muted me-1" />
                                {t.maxUsers == null ? '—' : formatLimit(t.maxUsers, 'مستخدم')}
                              </span>
                            </div>
                          </td>

                          {/* Expiry Date */}
                          <td>
                            <div className="sa-expiry-cell">
                              <div className="sa-expiry-date">
                                {t.perpetual ? (
                                  <span className="text-info fw-bold">اشتراك مفتوح ∞</span>
                                ) : expDate ? (
                                  new Date(expDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
                                ) : (
                                  /* An active subscription with no end date is not "unspecified",
                                     it is a tenant nobody can bill. Say so instead of rendering it
                                     as ordinary missing data the eye skips over. */
                                  <span
                                    className="sa-expiry-missing"
                                    title="اشتراك نشط بدون تاريخ تجديد — راجع بيانات الاشتراك"
                                  >
                                    <i className="bi bi-exclamation-triangle-fill me-1" />
                                    بدون تاريخ
                                  </span>
                                )}
                              </div>
                              {!t.perpetual && expDate && (
                                <div className={`sa-expiry-badge ${daysLeft <= 3 ? 'is-danger' : daysLeft <= 7 ? 'is-warning' : 'is-safe'}`}>
                                  {daysLeft < 0 ? 'منتهي' : `باقي ${daysLeft} يوم`}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              <button
                                type="button"
                                className="btn btn-sm sa-quick-edit-btn"
                                onClick={() => handleOpenEditModal(t)}
                                title="إشراف وتعديل الخطة والحدود"
                              >
                                <i className="bi bi-sliders me-1" />
                                <span>إدارة</span>
                              </button>

                              <div className="dropdown">
                                <button
                                  className="btn btn-sm sa-more-btn"
                                  type="button"
                                  data-bs-toggle="dropdown"
                                  aria-expanded="false"
                                  title="خيارات إضافية"
                                >
                                  <i className="bi bi-three-dots-vertical" />
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end sa-dropdown-menu">
                                  <li>
                                    <button className="dropdown-item" type="button" onClick={() => handleOpenEditModal(t)}>
                                      <i className="bi bi-sliders me-2 text-warning" /> تفاصيل وحدود الاشتراك
                                    </button>
                                  </li>
                                  <li>
                                    <button className="dropdown-item" type="button" onClick={() => handleUpdateSubscription(t.id, null, null, 7)}>
                                      <i className="bi bi-clock-history me-2 text-info" /> تمديد الاشتراك (+7 أيام)
                                    </button>
                                  </li>
                                  {t.ownerWhatsapp && (
                                    <li>
                                      <button className="dropdown-item" type="button" onClick={() => sendWhatsappCredentials(t)}>
                                        <i className="bi bi-whatsapp me-2 text-success" /> إرسال رسالة ترحيب (واتساب)
                                      </button>
                                    </li>
                                  )}
                                  <li>
                                    <button className="dropdown-item" type="button" onClick={() => copyToClipboard(`${window.location.origin}/${t.slug}/login`, 'رابط الدخول')}>
                                      <i className="bi bi-link-45deg me-2 text-primary" /> نسخ رابط الدخول
                                    </button>
                                  </li>
                                  <li><hr className="dropdown-divider" /></li>
                                  <li>
                                    {isSuspended ? (
                                      <button className="dropdown-item text-success" type="button" onClick={() => handleUpdateSubscription(t.id, null, 'ACTIVE', null)}>
                                        <i className="bi bi-play-circle me-2" /> إعادة تفعيل المنشأة
                                      </button>
                                    ) : (
                                      <button className="dropdown-item text-danger" type="button" onClick={() => handleUpdateSubscription(t.id, null, 'SUSPENDED', null)}>
                                        <i className="bi bi-pause-circle me-2" /> إيقاف المنشأة مؤقتاً
                                      </button>
                                    )}
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="sa-table-footer">
              <div className="sa-table-footer__info">
                <span>
                  عرض <strong>{paginatedTenants.length}</strong> من إجمالي <strong>{filteredTenants.length}</strong> منشأة
                </span>
                {/* Choosing a page size is only a choice once there is more than one page of rows. */}
                {filteredTenants.length > 10 && (
                <div className="sa-page-size-selector">
                  <span className="text-muted small">عرض:</span>
                  {[10, 25, 50].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`sa-size-btn ${pageSize === size ? 'is-active' : ''}`}
                      onClick={() => { setPageSize(size); setCurrentPage(1); }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                )}
              </div>

              {/* Previous / next / "page 1 of 1" around a single row is furniture, not a control. */}
              {totalPages > 1 && (
              <div className="sa-pagination">
                <button
                  type="button"
                  className="sa-pagination-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <i className="bi bi-chevron-right me-1" /> السابق
                </button>

                <div className="sa-pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => (
                      <div key={p} className="d-flex align-items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="sa-pagination-ellipsis">...</span>}
                        <button
                          type="button"
                          className={`sa-pagination-num ${currentPage === p ? 'is-active' : ''}`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      </div>
                    ))}
                </div>

                <button
                  type="button"
                  className="sa-pagination-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  التالي <i className="bi bi-chevron-left ms-1" />
                </button>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. PLANS MATRIX SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════════════
          PAYMENTS — bank-transfer upgrade review
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'payments' && (
        <div className="sa-section">
          <SectionIntro
            eyebrow="PAYMENTS"
            title="مراجعة التحويلات والترقيات"
            description="طلبات العملاء للترقية بالتحويل البنكي. الاعتماد يفعّل الاشتراك ويصدر الفاتورة في خطوة واحدة."
            icon="bi-cash-coin"
          />
          <UpgradeInbox
            tenants={tenants}
            onReviewed={() => { refreshPendingPayments(); loadData(true); }}
          />

          {/* The ledger below is where money that has already been invoiced is tracked. The inbox
              above only covers requests waiting on a human; once approved they leave it, and until
              now they left the console entirely. */}
          <SectionIntro
            eyebrow="LEDGER"
            title="سجل الفواتير"
            description="كل فاتورة صدرت على المنصة — المستحق، المحصّل والمتأخر. تسجيل دفعة هنا يقيّد المبلغ اللي وصل فعلاً."
            icon="bi-receipt"
          />
          <InvoiceLedger onChanged={() => loadData(true)} />
        </div>
      )}

      {activeSection === 'plans' && (
        <div className="sa-section">
          <SectionIntro
            eyebrow="PRODUCT & PRICING"
            title="الباقات وحدود الاستخدام"
            description="هذه هي الباقات الفعلية التي يبيعها النظام. تعديل السعر أو الحدود هنا يسري فوراً على الاشتراكات الجديدة."
            icon="bi-stars"
          />
          <PlanEditor
            plans={plans}
            planCounts={planCounts}
            onChanged={() => { plansApi.listAll().then(setPlans).catch(() => {}); loadData(true); }}
          />
        </div>
      )}


      {activeSection === 'subscriptions' && (
        <div className="sa-section">
          <SectionIntro eyebrow="LICENSE DESK" title="التراخيص والتفعيل" description="إصدار مفاتيح أحادية الاستخدام ومتابعة حالتها وصلاحيتها." icon="bi-key" />
          <div className="sa-license-overview">
            <article><i className="bi bi-key" /><span><small>جاهزة للتفعيل</small><strong>{licenseMetrics.available}</strong></span></article>
            <article><i className="bi bi-check2-circle" /><span><small>تم استخدامها</small><strong>{licenseMetrics.used}</strong></span></article>
            <article><i className="bi bi-clock-history" /><span><small>منتهية</small><strong>{licenseMetrics.expired}</strong></span></article>
            <article><i className="bi bi-x-octagon" /><span><small>ملغاة</small><strong>{licenseMetrics.revoked}</strong></span></article>
          </div>
          {/* Key Generator Card */}
          <div className="card sa-card shadow-sm mb-4">
            <div className="card-header sa-card-header p-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-key-fill text-amber" />
                <h5 className="mb-0 fw-bold text-white">إصدار مفتاح ترخيص جديد</h5>
              </div>
              <span className="badge bg-dark border text-white px-3 py-2">يُستخدم مرة واحدة</span>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleGenerateKey} className="row g-3 align-items-end">
                <div className="col-12 col-md-3">
                  <label className="form-label small text-white fw-bold">الباقة</label>
                  <select
                    className="form-select"
                    value={keyForm.plan}
                    onChange={(e) => setKeyForm({ ...keyForm, plan: e.target.value })}
                  >
                    <option value="STARTER">STARTER — باقة أساسية (499 ج.م)</option>
                    <option value="PRO">PRO — باقة احترافية (899 ج.م)</option>
                    <option value="ENTERPRISE">ENTERPRISE — باقة شاملة (1499 ج.م)</option>
                    <option value="TRIAL">TRIAL — باقة تجريبية</option>
                  </select>
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label small text-white fw-bold">مدة الصلاحية (بالأيام)</label>
                  <input
                    type="number"
                    min="0"
                    max="3650"
                    className="form-control"
                    placeholder="365 (أو 0 لمدى الحياة)"
                    value={keyForm.validDays}
                    onChange={(e) => setKeyForm({ ...keyForm, validDays: e.target.value })}
                    required
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small text-white fw-bold">مرجع داخلي (اختياري)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="مثال: اشتراك سنوي كافيه روقان"
                    value={keyForm.notes}
                    onChange={(e) => setKeyForm({ ...keyForm, notes: e.target.value })}
                  />
                </div>

                <div className="col-12 col-md-2">
                  <button
                    type="submit"
                    className="btn btn-primary w-100 fw-bold py-2"
                    disabled={generatingKey}
                  >
                    {generatingKey ? (
                      <span className="spinner-border spinner-border-sm me-1" />
                    ) : (
                      <i className="bi bi-plus-lg me-1" />
                    )}
                    إصدار المفتاح
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* License Keys Table */}
          <div className="card sa-card shadow-sm">
            <div className="card-header sa-card-header p-3 d-flex align-items-center justify-content-between">
              <h5 className="mb-0 fw-bold text-white">سجل مفاتيح التراخيص الصادرة ({licenseKeys.length})</h5>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary text-white"
                onClick={() => loadData(true)}
              >
                <i className="bi bi-arrow-clockwise me-1" /> تحديث السجل
              </button>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 sa-table">
                <thead>
                  <tr>
                    <th>كود المفتاح (License Key)</th>
                    <th>الباقة</th>
                    <th>حالة المفتاح</th>
                    <th>الصلاحية</th>
                    <th>تاريخ الانتهاء</th>
                    <th>المنشأة المفعلة</th>
                    <th>ملاحظات</th>
                    <th className="text-end">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {licenseKeys.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5 text-white opacity-75">
                        لم يتم إصدار أي مفاتيح ترخيص حتى الآن
                      </td>
                    </tr>
                  ) : (
                    licenseKeys.map((lk) => {
                      const isExpired = lk.redeemableUntil && new Date(lk.redeemableUntil) < new Date();
                      const isRevoked = lk.revoked;
                      const isUsed = lk.activationsCount >= (lk.maxActivations || 1);

                      return (
                        <tr key={lk.id}>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <code className="text-amber fw-bold fs-6 bg-dark px-2 py-1 rounded border border-secondary">
                                {lk.key}
                              </code>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary py-0 px-2"
                                onClick={() => copyToClipboard(lk.key, 'كود المفتاح')}
                                title="نسخ الكود"
                              >
                                <i className="bi bi-clipboard" />
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className="badge text-bg-dark border text-light fw-bold px-2 py-1">{lk.plan}</span>
                          </td>
                          <td>
                            {isRevoked ? (
                              <span className="badge bg-danger-subtle text-danger border px-2 py-1">ملغي ✕</span>
                            ) : isUsed ? (
                              <span className="badge bg-warning-subtle text-warning border px-2 py-1">مستخدم 🔒</span>
                            ) : isExpired ? (
                              <span className="badge bg-danger-subtle text-danger border px-2 py-1">منتهي الصلاحية</span>
                            ) : (
                              <span className="badge bg-success-subtle text-success border px-2 py-1">جاهز للاستخدام ✓</span>
                            )}
                          </td>
                          <td className="text-white fw-bold">{lk.validDays ? `${lk.validDays} يوم` : 'مدى الحياة'}</td>
                          <td>
                            <span className="small text-white opacity-85">
                              {lk.redeemableUntil ? new Date(lk.redeemableUntil).toLocaleDateString('ar-EG') : 'بلا حد ♾'}
                            </span>
                          </td>
                          <td>
                            {lk.activatedByTenantId ? (
                              <span className="badge text-bg-dark border text-info">Tenant #{lk.activatedByTenantId}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="small text-white opacity-75">{lk.notes || '—'}</td>
                          <td className="text-end">
                            {!isRevoked && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRevokeKey(lk.id)}
                                title="إلغاء هذا المفتاح"
                              >
                                <i className="bi bi-trash3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. PLATFORM REPORTS — calculated from live tenant data
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'reports' && (
        <div className="sa-section sa-reports">
          <div className="sa-report-hero">
            <div>
              <span className="sa-report-hero__tag"><i className="bi bi-broadcast" /> تقرير مباشر</span>
              <h2>صورة واضحة لأداء المنصة</h2>
              <p>كل الأرقام أدناه محسوبة من المنشآت والاشتراكات الحالية، بدون بيانات تجريبية أو نسب افتراضية.</p>
            </div>
            <div className="sa-report-hero__actions">
              <span>آخر تحديث {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              <button type="button" onClick={exportPlatformReportCsv}><i className="bi bi-download" /> تنزيل CSV</button>
            </div>
          </div>

          <div className="sa-report-metric-grid">
            <article><span>MRR المتوقع</span><strong>{estimatedMRR.toLocaleString()} <small>ج.م</small></strong><p>من {activeSubscriptions} اشتراك مدفوع نشط</p></article>
            <article><span>معدل نشاط العملاء</span><strong>{totalTenants ? Math.round((activeTenants / totalTenants) * 100) : 0}<small>%</small></strong><p>{activeTenants} من إجمالي {totalTenants}</p></article>
            <article className={expiringTenants.length ? 'is-warning' : ''}><span>تجديد خلال 7 أيام</span><strong>{expiringTenants.length}</strong><p>تحتاج تواصل ومتابعة</p></article>
            <article className={expiredTenants.length ? 'is-danger' : ''}><span>اشتراكات منتهية</span><strong>{expiredTenants.length}</strong><p>تحتاج تجديد أو إيقاف</p></article>
          </div>

          <div className="sa-report-grid">
            <section className="sa-report-panel">
              <header><div><span>Revenue mix</span><h3>توزيع الإيراد حسب الباقة</h3></div><i className="bi bi-pie-chart" /></header>
              <div className="sa-revenue-stack" aria-label="توزيع الإيراد الشهري المتوقع">
                {planRevenue.length === 0 && (
                  <p className="text-muted small mb-0">لا توجد اشتراكات مدفوعة نشطة بعد.</p>
                )}
                {planRevenue.map((row) => (
                  <div key={row.code} className={`sa-revenue-row sa-revenue-row--${row.code.toLowerCase()}`}>
                    <span><b>{row.label}</b><small>{row.count} منشأة تدفع</small></span>
                    <div><i style={{ width: `${estimatedMRR ? Math.min(100, (row.revenue / estimatedMRR) * 100) : 0}%` }} /></div>
                    <strong>{Math.round(row.revenue).toLocaleString()} {revenue.currency}</strong>
                  </div>
                ))}
              </div>
              <footer>
                محسوبة من الأسعار المثبَّتة على الاشتراكات الفعلية. المحصَّل آخر 30 يوماً:{' '}
                <b>{revenue.collected30.toLocaleString()} {revenue.currency}</b> · مستحق:{' '}
                <b>{revenue.outstanding.toLocaleString()} {revenue.currency}</b>
              </footer>
            </section>

            <section className="sa-report-panel">
              <header><div><span>Renewal queue</span><h3>أولوية التجديد والمتابعة</h3></div><i className="bi bi-calendar2-week" /></header>
              <div className="sa-renewal-list">
                {[...expiredTenants, ...expiringTenants]
                  .sort((a, b) => new Date(tenantExpiry(a)) - new Date(tenantExpiry(b)))
                  .slice(0, 8)
                  .map((tenant) => {
                    const days = daysUntil(tenantExpiry(tenant));
                    return (
                      <button type="button" key={tenant.id} onClick={() => handleOpenEditModal(tenant)}>
                        <span className="sa-renewal-list__avatar">{tenant.name?.trim()?.charAt(0) || 'C'}</span>
                        <span><strong>{tenant.name}</strong><small>{tenant.subscriptionPlan} · {tenant.slug}</small></span>
                        <b className={days < 0 ? 'is-expired' : ''}>{days < 0 ? `منتهي من ${Math.abs(days)} يوم` : `متبقي ${days} يوم`}</b>
                      </button>
                    );
                  })}
                {expiredTenants.length + expiringTenants.length === 0 && <div className="sa-report-empty"><i className="bi bi-check2-circle" /> لا توجد تجديدات حرجة خلال 7 أيام</div>}
              </div>
            </section>
          </div>

          <div className="sa-report-grid sa-report-grid--secondary">
            <section className="sa-report-panel">
              <header><div><span>Customer health</span><h3>حالة قاعدة العملاء</h3></div><i className="bi bi-heart-pulse" /></header>
              <div className="sa-health-matrix">
                <button type="button" onClick={() => { setActiveSection('tenants'); setStatusFilter('ACTIVE'); }}><i className="bi bi-check-circle" /><span><b>{activeTenants}</b> نشطة</span></button>
                <button type="button" onClick={() => { setActiveSection('tenants'); setStatusFilter('TRIAL'); }}><i className="bi bi-hourglass-split" /><span><b>{trialTenants}</b> تجريبية</span></button>
                <button type="button" onClick={() => { setActiveSection('tenants'); setStatusFilter('SUSPENDED'); }}><i className="bi bi-pause-circle" /><span><b>{suspendedTenants}</b> موقوفة</span></button>
                <button type="button" onClick={() => setActiveSection('subscriptions')}><i className="bi bi-key" /><span><b>{licenseMetrics.available}</b> ترخيص متاح</span></button>
              </div>
            </section>
            <section className="sa-report-panel">
              <header><div><span>Data quality</span><h3>جودة بيانات التشغيل</h3></div><i className="bi bi-shield-check" /></header>
              <div className="sa-quality-list">
                <span><i className={tenants.every((tenant) => tenant.slug && tenant.name) ? 'is-good' : 'is-warning'} /> بيانات المنشآت الأساسية <b>{tenants.filter((tenant) => tenant.slug && tenant.name).length}/{totalTenants}</b></span>
                <span><i className={tenants.every((tenant) => tenantExpiry(tenant)) ? 'is-good' : 'is-warning'} /> تاريخ انتهاء محدد <b>{tenants.filter((tenant) => tenantExpiry(tenant)).length}/{totalTenants}</b></span>
                <span><i className={platformActivityLogs.length ? 'is-good' : 'is-warning'} /> سجل تدقيق متاح <b>{platformActivityLogs.length} حدث</b></span>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. AUDIT LOGS SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'audit-logs' && (
        <div className="sa-section">
          <SectionIntro eyebrow="GOVERNANCE" title="الحوكمة وسجل التغييرات" description="كل تغيير حقيقي على المنشآت مع المنفذ والتوقيت والتفاصيل." icon="bi-shield-check" />
          <div className="card sa-card shadow-sm">
            <div className="card-header sa-card-header p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-journal-text text-amber" />
                <div><h5 className="mb-0 fw-bold text-white">سجل نشاط المنصة</h5><small className="text-white opacity-50">آخر {platformActivityLogs.length} عملية مسجلة فعليًا</small></div>
              </div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadData(true)}><i className="bi bi-arrow-clockwise me-1" /> تحديث</button>
            </div>
            <div className="card-body p-4">
              <div className="sa-audit-toolbar">
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-search" /></span>
                  <input className="form-control" value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="ابحث باسم المنشأة، الرابط، المنفذ أو تفاصيل العملية..." />
                </div>
                <select className="form-select" value={auditActionFilter} onChange={(event) => setAuditActionFilter(event.target.value)}>
                  <option value="ALL">كل العمليات</option>
                  {[...new Set(platformActivityLogs.map((log) => log.action))].map((action) => <option value={action} key={action}>{AUDIT_ACTIONS[action] || action}</option>)}
                </select>
              </div>

              <div className="sa-timeline sa-timeline--real">
                {filteredActivityLogs.map((log) => {
                  const tenant = tenantById.get(log.tenantId);
                  return (
                  <div key={log.id} className="sa-timeline-item">
                    <div className="sa-timeline-icon">
                      <i className={`bi ${log.action === 'SUSPENDED' ? 'bi-pause-circle' : log.action?.includes('LICENSE') ? 'bi-key' : log.action === 'CREATED' ? 'bi-building-add' : 'bi-arrow-repeat'}`} />
                    </div>
                    <div className="sa-timeline-content">
                      <div>
                        <strong>{AUDIT_ACTIONS[log.action] || log.action}</strong>
                        <span>{tenant?.name || `منشأة #${log.tenantId}`} <small>{tenant?.slug || ''}</small></span>
                      </div>
                      <p>{log.details || 'بدون تفاصيل إضافية'}</p>
                      <footer><span><i className="bi bi-person" /> {log.performedBy || 'SYSTEM'}</span><time>{log.createdAt ? new Date(log.createdAt).toLocaleString('ar-EG') : '—'}</time></footer>
                    </div>
                  </div>
                  );
                })}
                {filteredActivityLogs.length === 0 && <div className="sa-report-empty"><i className="bi bi-inbox" /> لا توجد عمليات مطابقة للبحث الحالي</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. SYSTEM SETTINGS SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'settings' && (
        <div className="sa-section">
          <SectionIntro eyebrow="PLATFORM HEALTH" title="حالة المنصة والحماية" description="ملخص تشغيلي واضح بدون عرض أسرار أو معلومات حساسة داخل الواجهة." icon="bi-activity" />
          <div className="row g-4">
            <div className="col-12 col-md-6">
              <div className="card sa-card shadow-sm h-100">
                <div className="card-header sa-card-header p-3">
                  <h5 className="mb-0 fw-bold text-white">
                    <i className="bi bi-hdd-network me-2 text-primary" />
                    حالة تشغيل المنصة
                  </h5>
                </div>
                <div className="card-body p-4">
                  <dl className="row mb-0 small">
                    <dt className="col-sm-5 text-white opacity-75 mb-2">اتصال البيانات</dt>
                    <dd className="col-sm-7 text-success fw-bold mb-2"><i className="bi bi-circle-fill me-1" style={{ fontSize: '6px' }} /> متصل</dd>

                    <dt className="col-sm-5 text-white opacity-75 mb-2">المنشآت المحملة</dt>
                    <dd className="col-sm-7 text-white fw-bold mb-2">{platformStats?.totalTenants ?? totalTenants} منشأة</dd>

                    <dt className="col-sm-5 text-white opacity-75 mb-2">آخر مزامنة للوحة</dt>
                    <dd className="col-sm-7 text-white fw-bold mb-2">{lastUpdatedAt ? lastUpdatedAt.toLocaleString('ar-EG') : 'جاري التحميل'}</dd>

                    <dt className="col-sm-5 text-white opacity-75">عزل بيانات العملاء</dt>
                    <dd className="col-sm-7 text-success fw-bold">Tenant ID + صلاحيات مستقلة</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="card sa-card shadow-sm h-100">
                <div className="card-header sa-card-header p-3">
                  <h5 className="mb-0 fw-bold text-white">
                    <i className="bi bi-shield-check me-2 text-success" />
                    الحماية والحوكمة
                  </h5>
                </div>
                <div className="card-body p-4">
                  <p className="text-white opacity-75 small mb-3">
                    العمليات الحساسة مقيدة بصلاحية Super Admin، وتغييرات الباقات والإيقاف والتفعيل تُحفظ في سجل النشاط.
                  </p>
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <span className="small text-white opacity-75 d-block mb-2">ضوابط مفعلة:</span>
                    <div className="d-flex flex-wrap gap-2"><span className="badge text-bg-success px-3 py-2 fw-bold">JWT Sessions</span><span className="badge text-bg-success px-3 py-2 fw-bold">Role Guard</span><span className="badge text-bg-success px-3 py-2 fw-bold">Audit Log</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {createModal && (
        <ProvisionTenantModal
          plans={plans}
          tenants={tenants}
          updating={updating}
          onClose={() => setCreateModal(false)}
          onProvision={handleCreateTenant}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 2: FULL PLAN CUSTOMIZATION & TENANT CONTROLS MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {editModal && selectedTenant && (
        <div
          className="sa-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setEditModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg w-100">
            <div className="modal-content border-secondary shadow-lg">
              <div className="modal-header border-secondary p-3 bg-dark">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-sliders2-vertical text-warning fs-5" />
                  <div>
                    <h5 className="modal-title fw-bold text-light mb-0">
                      تخصيص الخطة والاشتراك: {selectedTenant.name}
                    </h5>
                    <span className="small text-muted font-monospace">{selectedTenant.slug}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setEditModal(false)}
                />
              </div>

              <form onSubmit={handleSaveCustomPlan}>
                <div className="modal-body p-4 d-flex flex-column gap-3" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                  {/* 1. Select Base Plan or Custom */}
                  <div>
                    <label className="form-label small text-white fw-bold d-flex justify-content-between">
                      <span>اختر باقة الاشتراك المعتمدة أو باقة مخصصة:</span>
                      <span className="text-warning small">تطبيق الإعدادات المسبقة</span>
                    </label>
                    <div className="row g-2">
                      {plans.map((p) => (
                        <div key={p.code} className="col">
                          <button
                            type="button"
                            className={`btn w-100 py-2 fw-bold text-nowrap ${
                              customPlanForm.plan === p.code ? 'btn-warning text-dark' : 'btn-outline-light'
                            }`}
                            onClick={() => applyPlanPreset(p.code)}
                            title={`${formatLimit(p.limits.maxTables, 'طاولة')} · ${formatLimit(p.limits.maxUsers, 'مستخدم')} · ${formatLimit(p.limits.maxProducts, 'صنف')}`}
                          >
                            {p.code}
                            <span className="d-block small opacity-75 fw-normal">{p.displayName}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Quotas — plan defaults unless the operator opts into a bespoke deal */}
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <h6 className="fw-bold text-white small mb-0">
                        <i className="bi bi-gear-wide-connected text-warning me-2" />
                        حدود المنشأة (Quotas)
                      </h6>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="useOverridesSwitch"
                          checked={customPlanForm.useOverrides}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, useOverrides: e.target.checked })}
                        />
                        <label className="form-check-label text-white small" htmlFor="useOverridesSwitch">
                          حدود مخصصة لهذه المنشأة
                        </label>
                      </div>
                    </div>

                    <p className="small text-muted mb-3">
                      {customPlanForm.useOverrides
                        ? 'استخدم -1 لجعل الحد بلا حدود. هذه الحدود تُلغى تلقائياً عند تغيير الباقة مرة أخرى.'
                        : 'ستُطبَّق حدود الباقة المختارة كما هي، وسيتم إلغاء أي حدود مخصصة سابقة.'}
                    </p>

                    <div className="row g-3">
                      {[
                        { key: 'maxTables', label: 'الحد الأقصى للطاولات 🪑' },
                        { key: 'maxUsers', label: 'الحد الأقصى للمستخدمين 👥' },
                        { key: 'maxProducts', label: 'الحد الأقصى للأصناف ☕' },
                      ].map((field) => (
                        <div className="col-12 col-md-4" key={field.key}>
                          <label className="form-label small text-white opacity-75">{field.label}</label>
                          <input
                            type="number"
                            className="form-control"
                            min="-1"
                            max="100000"
                            disabled={!customPlanForm.useOverrides}
                            value={customPlanForm[field.key]}
                            onChange={(e) => setCustomPlanForm({ ...customPlanForm, [field.key]: e.target.value })}
                          />
                          <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                            {formatLimit(Number(customPlanForm[field.key]))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Commercial terms for the new period */}
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <h6 className="fw-bold text-white small mb-3">
                      <i className="bi bi-calendar-check text-info me-2" />
                      شروط الفترة الجديدة
                    </h6>

                    <div className="row g-3">
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-white opacity-75">مدة الفترة (يوم)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="3650"
                          placeholder="حسب الباقة"
                          value={customPlanForm.periodDays}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, periodDays: e.target.value })}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label small text-white opacity-75">سعر متفق عليه (ج.م)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          step="0.01"
                          placeholder="سعر الباقة"
                          value={customPlanForm.negotiatedPrice}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, negotiatedPrice: e.target.value })}
                        />
                        <span className="small text-muted" style={{ fontSize: '0.72rem' }}>
                          يُثبَّت على الاشتراك والفاتورة ولا يتأثر بتغيير سعر الباقة لاحقاً.
                        </span>
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label small text-white opacity-75">تمديد إضافي (يوم)</label>
                        <div className="d-flex gap-2">
                          {[30, 90, 365].map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={`btn btn-sm flex-grow-1 ${
                                Number(customPlanForm.extendDays) === d ? 'btn-info' : 'btn-outline-info'
                              }`}
                              onClick={() =>
                                setCustomPlanForm({
                                  ...customPlanForm,
                                  extendDays: Number(customPlanForm.extendDays) === d ? 0 : d,
                                })
                              }
                            >
                              +{d}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="col-12">
                        <label className="form-label small text-white opacity-75">ملاحظة (تظهر في سجل النشاط)</label>
                        <input
                          type="text"
                          className="form-control"
                          maxLength={500}
                          value={customPlanForm.note}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, note: e.target.value })}
                        />
                      </div>
                    </div>

                    <p className="small text-muted mt-3 mb-0">
                      لإيقاف أو إعادة تفعيل الحساب استخدم أزرار الحالة في قائمة المنشآت — الإيقاف
                      إجراء إداري منفصل عن شروط الاشتراك.
                    </p>
                  </div>

                  {/* 4. Activity Logs */}
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <h6 className="small fw-bold text-white mb-2">سجل نشاطات وتعديلات المنشأة:</h6>
                    <div style={{ maxHeight: '110px', overflowY: 'auto' }}>
                      {loadingLogs ? (
                        <div className="text-center py-2"><span className="spinner-border spinner-border-sm text-secondary" /></div>
                      ) : activityLogs.length === 0 ? (
                        <div className="text-center text-white opacity-50 small py-1">لا توجد نشاطات مسجلة</div>
                      ) : (
                        <ul className="list-unstyled mb-0 small">
                          {activityLogs.map((log, i) => (
                            <li key={i} className="d-flex justify-content-between py-1 border-bottom border-secondary text-white">
                              <span>{log.action}: {log.details || ''}</span>
                              <span className="text-white opacity-50">{new Date(log.createdAt).toLocaleDateString('ar-EG')}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-secondary p-3 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm fw-bold"
                    onClick={() => handleDeleteTenant(selectedTenant.id, selectedTenant.name)}
                    disabled={updating}
                  >
                    <i className="bi bi-trash3 me-1" />
                    حذف المنشأة نهائياً 🗑️
                  </button>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditModal(false)}
                      disabled={updating}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="btn btn-warning fw-bold px-4 text-dark"
                      disabled={updating}
                    >
                      {updating ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-check2-circle me-1" />}
                      حفظ وتطبيق الخطة المخصصة 💾
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 3: CONFIRMATION ACTION DIALOG
         ══════════════════════════════════════════════════════════════════════ */}
      {confirmModal.open && (
        <div
          className="sa-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmModal({ open: false, title: '', message: '', onConfirm: null }); }}
        >
          <div className="modal-dialog modal-dialog-centered w-100" style={{ maxWidth: '440px' }}>
            <div className="modal-content border-danger shadow-lg">
              <div className="modal-header border-secondary p-3">
                <h5 className="modal-title fw-bold text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-2" />
                  {confirmModal.title}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: null })}
                />
              </div>
              <div className="modal-body p-4">
                <p className="mb-0 text-white fs-6">{confirmModal.message}</p>
              </div>
              <div className="modal-footer border-secondary p-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: null })}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  className="btn btn-danger fw-bold"
                  onClick={confirmModal.onConfirm}
                >
                  تأكيد الإجراء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {createdTenantModal && (
        <ProvisionSuccessModal
          data={createdTenantModal}
          onClose={() => setCreatedTenantModal(null)}
          onViewTenants={() => {
            setCreatedTenantModal(null);
            setActiveSection('tenants');
          }}
          onCopy={copyToClipboard}
          onWhatsapp={sendWhatsappCredentials}
          formatMessage={formatWhatsappMessage}
        />
      )}
    </SuperAdminLayout>
  );
}
