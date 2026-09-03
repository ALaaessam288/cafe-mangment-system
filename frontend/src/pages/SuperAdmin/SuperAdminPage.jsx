import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { platformApi } from '../../api/platformApi';
import { useToast } from '../../context/ToastContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import ProvisionTenantModal from './components/ProvisionTenantModal';
import ProvisionSuccessModal from './components/ProvisionSuccessModal';
import './SuperAdminPage.css';

const PLAN_PRICES = { TRIAL: 0, STARTER: 499, PRO: 899, ENTERPRISE: 1499, CUSTOM: 0 };
const AUDIT_ACTIONS = {
  CREATED: 'تأسيس منشأة',
  PLAN_UPGRADED: 'تغيير الباقة',
  PLAN_CUSTOMIZED: 'تخصيص الباقة',
  SUSPENDED: 'إيقاف منشأة',
  TRIAL_EXTENDED: 'تمديد التجربة',
  SUBSCRIPTION_EXTENDED: 'تمديد الاشتراك',
  LICENSE_ACTIVATED: 'تفعيل ترخيص',
  LOGO_UPDATED: 'تحديث الشعار',
  UPDATED: 'تحديث بيانات',
};

const tenantExpiry = (tenant) => tenant?.status === 'TRIAL' || tenant?.subscriptionPlan === 'TRIAL'
  ? tenant?.trialEndsAt
  : tenant?.subscriptionEndsAt;

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toEndOfLocalDayInstant = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const daysUntil = (date) => date
  ? Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
  : null;

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function SectionIntro({ eyebrow, title, description, icon, children }) {
  return (
    <div className="sa-section-intro">
      <div className="sa-section-intro__icon"><i className={`bi ${icon}`} /></div>
      <div className="sa-section-intro__copy"><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
      {children && <div className="sa-section-intro__actions">{children}</div>}
    </div>
  );
}

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
    status: 'ACTIVE',
    maxTables: 50,
    maxUsers: 15,
    maxProducts: 500,
    serviceChargePercent: 0,
    whatsappAlertsEnabled: false,
    subscriptionEndsAt: '',
    extendDays: 0,
  });

  // License Generator State
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyForm, setKeyForm] = useState({ plan: 'PRO', validDays: 365, notes: '' });

  const [createdTenantModal, setCreatedTenantModal] = useState(null);

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
      await platformApi.updateSubscription(tenantId, { plan, status, extendDays });
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
    const effectiveEnd = toDateInputValue(tenantExpiry(t));
    setCustomPlanForm({
      plan: t.subscriptionPlan || 'PRO',
      status: t.status || 'ACTIVE',
      maxTables: t.maxTables ?? 50,
      maxUsers: t.maxUsers ?? 15,
      maxProducts: t.maxProducts ?? 500,
      serviceChargePercent: t.serviceChargePercent ?? 0,
      whatsappAlertsEnabled: Boolean(t.whatsappAlertsEnabled),
      subscriptionEndsAt: effectiveEnd,
      extendDays: 0,
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

  function applyPlanPreset(planName) {
    if (planName === 'TRIAL') {
      setCustomPlanForm(prev => ({
        ...prev,
        plan: 'TRIAL',
        status: 'TRIAL',
        maxTables: 5,
        maxUsers: 2,
        maxProducts: 30,
      }));
    } else if (planName === 'STARTER') {
      setCustomPlanForm(prev => ({
        ...prev,
        plan: 'STARTER',
        status: 'ACTIVE',
        maxTables: 20,
        maxUsers: 5,
        maxProducts: 100,
      }));
    } else if (planName === 'PRO') {
      setCustomPlanForm(prev => ({
        ...prev,
        plan: 'PRO',
        status: 'ACTIVE',
        maxTables: 50,
        maxUsers: 15,
        maxProducts: 500,
      }));
    } else if (planName === 'ENTERPRISE') {
      setCustomPlanForm(prev => ({
        ...prev,
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
        maxTables: 9999,
        maxUsers: 9999,
        maxProducts: 9999,
      }));
    } else if (planName === 'CUSTOM') {
      setCustomPlanForm(prev => ({
        ...prev,
        plan: 'CUSTOM',
      }));
    }
  }

  async function handleSaveCustomPlan(e) {
    if (e) e.preventDefault();
    if (!selectedTenant) return;
    const quotas = [customPlanForm.maxTables, customPlanForm.maxUsers, customPlanForm.maxProducts].map(Number);
    if (quotas.some((value) => !Number.isInteger(value) || value < 1 || value > 9999)) {
      toast.error('حدود الطاولات والمستخدمين والأصناف يجب أن تكون بين 1 و9999');
      return;
    }
    const servicePercent = Number(customPlanForm.serviceChargePercent);
    if (!Number.isFinite(servicePercent) || servicePercent < 0 || servicePercent > 100) {
      toast.error('نسبة الخدمة يجب أن تكون بين 0 و100');
      return;
    }
    setUpdating(true);
    try {
      const isTrial = customPlanForm.status === 'TRIAL' || customPlanForm.plan === 'TRIAL';
      const effectiveExpiry = toEndOfLocalDayInstant(customPlanForm.subscriptionEndsAt);
      const payload = {
        plan: customPlanForm.plan,
        status: customPlanForm.status,
        maxTables: Number(customPlanForm.maxTables),
        maxUsers: Number(customPlanForm.maxUsers),
        maxProducts: Number(customPlanForm.maxProducts),
        serviceChargePercent: Number(customPlanForm.serviceChargePercent) || 0,
        whatsappAlertsEnabled: customPlanForm.whatsappAlertsEnabled,
        subscriptionEndsAt: isTrial ? null : effectiveExpiry,
        trialEndsAt: isTrial ? effectiveExpiry : null,
        extendDays: Number(customPlanForm.extendDays) || null,
      };
      await platformApi.customizeTenantPlan(selectedTenant.id, payload);
      toast.success('تم حفظ وتخصيص باقة المنشأة بنجاح! ⚙️🚀');
      setEditModal(false);
      setSelectedTenant(null);
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'فشل في حفظ وتخصيص الخطة');
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
        if (action === 'ACTIVE') return platformApi.updateSubscription(id, { status: 'ACTIVE' });
        if (action === 'SUSPENDED') return platformApi.updateSubscription(id, { status: 'SUSPENDED' });
        return platformApi.updateSubscription(id, { extendDays: 7 });
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

  function formatWhatsappMessage(data) {
    const loginUrl = `${window.location.origin}/${data.slug}/login`;
    return `مرحباً بك في منصة كافيو لإدارة الكافيهات والمطاعم ☕🚀\n\nتم تأسيس وتفعيل حساب منشأتكم بنجاح:\n🏪 اسم المنشأة: ${data.name}\n🌐 المعرف المختصر (Slug): ${data.slug}\n⭐ باقة الاشتراك: ${data.subscriptionPlan}\n\n🔐 بيانات الدخول لحساب الإدارة:\n👤 اسم المستخدم: ${data.ownerUsername}\n🔑 كلمة المرور: ${data.ownerPassword}\n\n🌐 رابط تسجيل الدخول المباشر لمنشأتكم:\n${loginUrl}\n\n📞 للتواصل مع إدارة المنصة والدعم الفني:\n01061967618\n\nنتمنى لكم تجربة مميزة وتشغيل ناجح! ✨`;
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
    toast.success('تم فتح تطبيق واتساب لإرسال بيانات الحساب 📲');
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
      await platformApi.generateLicenseKey(keyForm.plan, validDays, keyForm.notes.trim());
      toast.success('تم إصدار مفتاح الترخيص بنجاح! 🔑');
      setKeyForm({ plan: 'PRO', validDays: 365, notes: '' });
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
          await platformApi.revokeLicenseKey(id);
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
    const headers = ['ID', 'Name', 'Slug', 'Plan', 'Status', 'Max Tables', 'Max Users', 'Trial End Date'];
    const rows = filteredTenants.map((t) => [
      t.id,
      `"${t.name}"`,
      t.slug,
      t.subscriptionPlan || 'TRIAL',
      t.status,
      t.maxTables,
      t.maxUsers,
      t.trialEndsAt || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,﻿' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `caffio_tenants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير ملف المشتركين (CSV) بنجاح');
  }

  function exportPlatformReportCsv() {
    const rows = [
      ['تقرير منصة Caffio', new Date().toLocaleString('ar-EG')],
      [],
      ['المؤشر', 'القيمة'],
      ['إجمالي المنشآت', totalTenants],
      ['المنشآت النشطة', activeTenants],
      ['التجارب', trialTenants],
      ['الموقوفة', suspendedTenants],
      ['المنتهية', expiredTenants.length],
      ['تنتهي خلال 7 أيام', expiringTenants.length],
      ['MRR تقديري', estimatedMRR],
      [],
      ['المنشأة', 'الرابط', 'الحالة', 'الباقة', 'تاريخ الانتهاء', 'أيام متبقية', 'قيمة شهرية تقديرية'],
      ...tenants.map((tenant) => [
        tenant.name,
        tenant.slug,
        tenant.status,
        tenant.subscriptionPlan,
        tenantExpiry(tenant) || '',
        daysUntil(tenantExpiry(tenant)) ?? '',
        tenant.status === 'ACTIVE' ? PLAN_PRICES[tenant.subscriptionPlan] || 0 : 0,
      ]),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `caffio_platform_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('تم تجهيز تقرير المنصة الحقيقي للتنزيل');
  }

  // ── COMPUTED KPI METRICS ───────────────────────────────────────────────────
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === 'ACTIVE').length;
  const trialTenants = tenants.filter((t) => t.status === 'TRIAL' || t.subscriptionPlan === 'TRIAL').length;
  const suspendedTenants = tenants.filter((t) => t.status === 'SUSPENDED').length;

  const totalUsersEstimated = tenants.reduce((acc, t) => acc + (t.maxUsers || 2), 0);
  const activeSubscriptions = tenants.filter((t) => t.status === 'ACTIVE' && ['PRO', 'STARTER', 'ENTERPRISE'].includes(t.subscriptionPlan)).length;

  const estimatedMRR = tenants.reduce((acc, t) => {
    if (t.status !== 'ACTIVE') return acc;
    return acc + (PLAN_PRICES[t.subscriptionPlan] || 0);
  }, 0);

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
      else if (key.expiresAt && new Date(key.expiresAt).getTime() < now) metrics.expired += 1;
      else if ((key.activationsCount || 0) >= (key.maxActivations || 1)) metrics.used += 1;
      else metrics.available += 1;
      return metrics;
    }, { available: 0, used: 0, expired: 0, revoked: 0 });
  }, [licenseKeys]);

  // Plan Distribution Count
  const planCounts = useMemo(() => {
    return {
      TRIAL: tenants.filter((t) => !t.subscriptionPlan || t.subscriptionPlan === 'TRIAL').length,
      STARTER: tenants.filter((t) => t.subscriptionPlan === 'STARTER').length,
      PRO: tenants.filter((t) => t.subscriptionPlan === 'PRO').length,
      ENTERPRISE: tenants.filter((t) => t.subscriptionPlan === 'ENTERPRISE').length,
    };
  }, [tenants]);

  const activeRate = totalTenants ? Math.round((activeTenants / totalTenants) * 100) : 0;
  const renewalRiskCount = expiringTenants.length + expiredTenants.length;
  const activePlanCounts = tenants.reduce((counts, tenant) => {
    if (tenant.status === 'ACTIVE' && Object.prototype.hasOwnProperty.call(counts, tenant.subscriptionPlan)) {
      counts[tenant.subscriptionPlan] += 1;
    }
    return counts;
  }, { STARTER: 0, PRO: 0, ENTERPRISE: 0 });
  const planRevenue = {
    STARTER: activePlanCounts.STARTER * PLAN_PRICES.STARTER,
    PRO: activePlanCounts.PRO * PLAN_PRICES.PRO,
    ENTERPRISE: activePlanCounts.ENTERPRISE * PLAN_PRICES.ENTERPRISE,
  };
  const latestPlatformActivity = platformActivityLogs.slice(0, 4);

  // Filtered & Sorted Tenants
  const filteredTenants = useMemo(() => {
    return tenants
      .filter((t) => {
        const matchesSearch =
          String(t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(t.slug || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
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
                {['STARTER', 'PRO', 'ENTERPRISE'].map((plan) => <span key={plan}><i className={`is-${plan.toLowerCase()}`} />{plan} <b>{activePlanCounts[plan]}</b></span>)}
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
              <strong>{totalUsersEstimated.toLocaleString()}</strong>
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

      {activeSection === 'dashboard-legacy' && (
        <div className="sa-section">
          <section className="sa-command-hero">
            <div className="sa-command-hero__copy">
              <span className="sa-command-hero__live"><i /> بث مباشر للمنصة</span>
              <h1>مساء الخير، جاهز تدير نمو كافيو؟</h1>
              <p>ابدأ بما يحتاج تدخلك، ثم تابع الاشتراكات والنمو من نفس مساحة التحكم.</p>
              <div className="sa-command-hero__actions">
                <button type="button" className="sa-command-primary" onClick={() => setCreateModal(true)}>
                  <i className="bi bi-building-add" />
                  <span><strong>تأسيس منشأة</strong><small>حساب، باقة ومالك في خطوة واحدة</small></span>
                  <i className="bi bi-arrow-left" />
                </button>
                <button type="button" className="sa-command-secondary" onClick={() => setActiveSection('tenants')}>
                  إدارة العملاء <i className="bi bi-people" />
                </button>
              </div>
            </div>

            <div className="sa-command-hero__pulse" aria-label="ملخص صحة المنصة">
              <div className="sa-pulse-orbit"><span>{totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0}%</span><small>نشاط المنصة</small></div>
              <div className="sa-pulse-stats">
                <span><b>{activeTenants}</b> منشأة تعمل</span>
                <span className={expiringTenants.length ? 'is-warning' : ''}><b>{expiringTenants.length}</b> تحتاج متابعة</span>
                <span><b>{estimatedMRR.toLocaleString()}</b> ج.م MRR</span>
              </div>
            </div>
          </section>

          <section className="sa-workflow-rail" aria-label="دورة إدارة العميل">
            <div className="sa-workflow-rail__intro"><span>مسار العميل</span><strong>من Lead إلى عميل نشط</strong></div>
            {[
              { n: '01', title: 'تأسيس', hint: 'بيانات المنشأة والمالك', icon: 'bi-building-add', action: () => setCreateModal(true) },
              { n: '02', title: 'اختيار الباقة', hint: 'حدود وسعر مناسب', icon: 'bi-stars', action: () => setActiveSection('plans') },
              { n: '03', title: 'تفعيل', hint: 'ترخيص ودخول آمن', icon: 'bi-key', action: () => setActiveSection('subscriptions') },
              { n: '04', title: 'متابعة', hint: 'استخدام وتجديد ودعم', icon: 'bi-activity', action: () => setActiveSection('tenants') },
            ].map((step, index) => (
              <button type="button" key={step.n} className="sa-workflow-step" onClick={step.action}>
                <span className="sa-workflow-step__number">{step.n}</span>
                <i className={`bi ${step.icon}`} />
                <span><strong>{step.title}</strong><small>{step.hint}</small></span>
                {index < 3 && <i className="bi bi-chevron-left sa-workflow-step__arrow" />}
              </button>
            ))}
          </section>

          {/* Attention Banner */}
          {expiringTenants.length + expiredTenants.length > 0 && (
            <div className="alert alert-warning border-0 sa-alert-attention d-flex align-items-center justify-content-between mb-4 shadow-sm">
              <div className="d-flex align-items-center gap-3">
                <div className="sa-alert-icon">
                  <i className="bi bi-exclamation-triangle-fill" />
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-white">قائمة متابعة التجديد ({expiringTenants.length + expiredTenants.length} منشأة)</h6>
                  <p className="small mb-0 text-white opacity-75">
                    {expiredTenants.length} منتهية بالفعل، و{expiringTenants.length} تنتهي خلال 7 أيام. رتّب التواصل قبل توقف الخدمة.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-dark fw-bold px-3 py-2"
                onClick={() => setActiveSection('reports')}
              >
                فتح تقرير التجديد <i className="bi bi-arrow-left ms-1" />
              </button>
            </div>
          )}

          {/* KPI Cards Grid (8 Cards) */}
          <div className="row g-3 mb-4">
            {/* Card 1: Total Tenants */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">إجمالي المشتركين</span>
                    <h3 className="sa-kpi-val mb-0">{totalTenants}</h3>
                    <span className="sa-kpi-sub text-white opacity-75">كافة المنشآت المسجلة</span>
                  </div>
                  <div className="sa-kpi-icon bg-primary-subtle">
                    <i className="bi bi-buildings" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Active Tenants */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">المنشآت النشطة</span>
                    <h3 className="sa-kpi-val mb-0 text-success">{activeTenants}</h3>
                    <span className="sa-kpi-sub text-success">
                      <i className="bi bi-arrow-up-right me-1" />
                      {totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0}% معدل النشاط
                    </span>
                  </div>
                  <div className="sa-kpi-icon bg-success-subtle">
                    <i className="bi bi-patch-check-fill" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Trial Tenants */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">الفترات التجريبية</span>
                    <h3 className="sa-kpi-val mb-0 text-amber">{trialTenants}</h3>
                    <span className="sa-kpi-sub text-amber">تجربة مجانية 14 يوم</span>
                  </div>
                  <div className="sa-kpi-icon bg-warning-subtle">
                    <i className="bi bi-clock-history" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Suspended Tenants */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">المنشآت الموقوفة</span>
                    <h3 className="sa-kpi-val mb-0 text-danger">{suspendedTenants}</h3>
                    <span className="sa-kpi-sub text-danger opacity-75">حسابات متوقفة</span>
                  </div>
                  <div className="sa-kpi-icon bg-danger-subtle">
                    <i className="bi bi-slash-circle-fill" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Estimated MRR */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">الإيراد الشهري المتوقع (MRR)</span>
                    <h3 className="sa-kpi-val mb-0 text-amber">{estimatedMRR.toLocaleString()} <small className="fs-6 text-white opacity-75">ج.م</small></h3>
                    <span className="sa-kpi-sub text-white opacity-75">بحسب أسعار الباقات النشطة</span>
                  </div>
                  <div className="sa-kpi-icon bg-amber-subtle">
                    <i className="bi bi-cash-coin" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 6: Active Subscriptions */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">الاشتراكات المدفوعة</span>
                    <h3 className="sa-kpi-val mb-0 text-info">{activeSubscriptions}</h3>
                    <span className="sa-kpi-sub text-white opacity-75">باقات مدفوعة نشطة</span>
                  </div>
                  <div className="sa-kpi-icon bg-info-subtle">
                    <i className="bi bi-credit-card-2-front-fill" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 7: Total Users Capacity */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">سعة المستخدمين الكلية</span>
                    <h3 className="sa-kpi-val mb-0">{totalUsersEstimated}</h3>
                    <span className="sa-kpi-sub text-white opacity-75">حسابات كاشير ومديرين</span>
                  </div>
                  <div className="sa-kpi-icon bg-purple-subtle">
                    <i className="bi bi-people-fill" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 8: Active License Keys */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card sa-kpi-card shadow-sm h-100">
                <div className="card-body d-flex align-items-center justify-content-between p-3">
                  <div>
                    <span className="sa-kpi-label">مفاتيح التراخيص الصادرة</span>
                    <h3 className="sa-kpi-val mb-0">{licenseKeys.length}</h3>
                    <span className="sa-kpi-sub text-white opacity-75">أكواد تفعيل ذاتي</span>
                  </div>
                  <div className="sa-kpi-icon bg-teal-subtle">
                    <i className="bi bi-key-fill" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Analytics & Insights Row */}
          <div className="row g-4 mb-4">
            {/* Real subscription distribution — no fabricated historical data. */}
            <div className="col-12 col-lg-8">
              <div className="card sa-card shadow-sm h-100">
                <div className="card-header sa-card-header p-3 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-pie-chart-fill text-amber" />
                    <h5 className="mb-0 fw-bold text-white">توزيع الاشتراكات الحالي</h5>
                  </div>
                  <span className="badge bg-dark border text-light px-3 py-2">بيانات فعلية الآن</span>
                </div>
                <div className="card-body p-4">
                  <div className="sa-plan-distribution">
                    {[
                      { id: 'TRIAL', label: 'تجريبي', color: '#94a3b8' },
                      { id: 'STARTER', label: 'Starter', color: '#38bdf8' },
                      { id: 'PRO', label: 'Pro', color: '#f59e0b' },
                      { id: 'ENTERPRISE', label: 'Enterprise', color: '#10b981' },
                    ].map((plan) => (
                      <div className="sa-plan-distribution__row" key={plan.id}>
                        <span>{plan.label}</span>
                        <div><i style={{ width: `${totalTenants ? (planCounts[plan.id] / totalTenants) * 100 : 0}%`, background: plan.color }} /></div>
                        <strong>{planCounts[plan.id]}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="sa-report-facts">
                    <span>متوسط الإيراد لكل اشتراك مدفوع <strong>{activeSubscriptions ? Math.round(estimatedMRR / activeSubscriptions).toLocaleString() : 0} ج.م</strong></span>
                    <span>معدل النشاط <strong>{totalTenants ? Math.round((activeTenants / totalTenants) * 100) : 0}%</strong></span>
                    <button type="button" onClick={() => setActiveSection('reports')}>فتح التقارير <i className="bi bi-arrow-left" /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="col-12 col-lg-4">
              <div className="card sa-card shadow-sm h-100">
                <div className="card-header sa-card-header p-3">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-lightning-charge-fill text-amber" />
                    <h5 className="mb-0 fw-bold text-white">إجراءات سريعة للمنصة</h5>
                  </div>
                </div>
                <div className="card-body p-3 d-flex flex-column gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-light sa-quick-btn d-flex align-items-center gap-3 p-3 text-end"
                    onClick={() => setCreateModal(true)}
                  >
                    <div className="sa-quick-btn-icon bg-primary-subtle">
                      <i className="bi bi-plus-circle-fill" />
                    </div>
                    <div>
                      <div className="fw-bold text-white fs-6">تأسيس منشأة جديدة</div>
                      <small className="text-white opacity-75">إنشاء حساب كافيه واختيار الباقة فوراً</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-light sa-quick-btn d-flex align-items-center gap-3 p-3 text-end"
                    onClick={() => setActiveSection('subscriptions')}
                  >
                    <div className="sa-quick-btn-icon bg-amber-subtle">
                      <i className="bi bi-key-fill" />
                    </div>
                    <div>
                      <div className="fw-bold text-white fs-6">توليد مفتاح ترخيص</div>
                      <small className="text-white opacity-75">إصدار كود تفعيل لتطبيق العميل</small>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-light sa-quick-btn d-flex align-items-center gap-3 p-3 text-end"
                    onClick={() => setActiveSection('plans')}
                  >
                    <div className="sa-quick-btn-icon bg-success-subtle">
                      <i className="bi bi-tags-fill" />
                    </div>
                    <div>
                      <div className="fw-bold text-white fs-6">مصفوفة الباقات والأسعار</div>
                      <small className="text-white opacity-75">متابعة الخطط والحدود القصوى</small>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. TENANTS MANAGEMENT SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'tenants' && (
        <div className="sa-section">
          <SectionIntro eyebrow="CUSTOMER OPERATIONS" title="المنشآت والعملاء" description="إدارة دورة حياة كل عميل من التجربة حتى التجديد أو الإيقاف." icon="bi-buildings">
            <button type="button" onClick={() => setCreateModal(true)}><i className="bi bi-plus-lg" /> منشأة جديدة</button>
          </SectionIntro>
          <div className="card sa-card shadow-sm">
            {/* Toolbar Header */}
            <div className="card-header sa-card-header p-3">
              <div className="row g-2 align-items-center">
                {/* Search Bar */}
                <div className="col-12 col-md-4">
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="bi bi-search" />
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="بحث باسم المنشأة أو الرابط (Slug)..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    />
                  </div>
                </div>

                {/* Status Filter Buttons */}
                <div className="col-12 col-md-4 d-flex gap-1 flex-wrap">
                  {[
                    { id: 'ALL', label: 'الكل' },
                    { id: 'ACTIVE', label: 'النشطة' },
                    { id: 'TRIAL', label: 'التجريبية' },
                    { id: 'SUSPENDED', label: 'الموقوفة' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      className={`btn btn-sm ${statusFilter === st.id ? 'btn-primary fw-bold px-3' : 'btn-outline-secondary'}`}
                      onClick={() => { setStatusFilter(st.id); setCurrentPage(1); }}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Plan Dropdown & Export */}
                <div className="col-12 col-md-4 d-flex justify-content-md-end gap-2">
                  <select
                    className="form-select form-select-sm w-auto"
                    value={planFilter}
                    onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="ALL">كافة الباقات</option>
                    <option value="TRIAL">TRIAL — تجريبي</option>
                    <option value="STARTER">STARTER (499 ج.م)</option>
                    <option value="PRO">PRO (899 ج.م)</option>
                    <option value="ENTERPRISE">ENTERPRISE (1499 ج.م)</option>
                  </select>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary fw-bold"
                    onClick={exportTenantsToCSV}
                    title="تصدير جدول المشتركين (CSV)"
                  >
                    <i className="bi bi-download me-1" />
                    تصدير CSV
                  </button>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              {selectedIds.length > 0 && (
                <div className="alert alert-primary border-0 d-flex align-items-center justify-content-between p-2 mt-3 mb-0">
                  <span className="small fw-bold text-white">
                    <i className="bi bi-check2-circle me-1" />
                    تم تحديد {selectedIds.length} منشأة
                  </span>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-success fw-bold"
                      onClick={() => handleBulkAction('ACTIVE')}
                      disabled={updating}
                    >
                      <i className="bi bi-play-circle me-1" /> تفعيل الكل
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger fw-bold"
                      onClick={() => handleBulkAction('SUSPENDED')}
                      disabled={updating}
                    >
                      <i className="bi bi-pause-circle me-1" /> إيقاف الكل
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-dark"
                      onClick={() => handleBulkAction('TRIAL_EXTEND')}
                      disabled={updating}
                    >
                      <i className="bi bi-plus-lg me-1" /> تمديد +7 أيام
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Table Body */}
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 sa-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedIds.length === paginatedTenants.length && paginatedTenants.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(paginatedTenants.map((t) => t.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                    <th>المنشأة والكافيه</th>
                    <th>الرابط والمعرف</th>
                    <th>الباقة الحالية</th>
                    <th>حالة الحساب</th>
                    <th>الحصص (طاولات / كاشيرات)</th>
                    <th>تاريخ التجديد / الصلاحية</th>
                    <th className="text-end">العمليات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">جاري التحميل...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedTenants.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-5 text-white opacity-75">
                        <i className="bi bi-inbox fs-1 d-block mb-2 text-muted" />
                        لا توجد منشآت مطابقة لشروط البحث الحالية
                      </td>
                    </tr>
                  ) : (
                    paginatedTenants.map((t) => {
                      const isSelected = selectedIds.includes(t.id);
                      const isEnterprise = t.subscriptionPlan === 'ENTERPRISE';
                      const isPro = t.subscriptionPlan === 'PRO';
                      const isStarter = t.subscriptionPlan === 'STARTER';
                      const isActive = t.status === 'ACTIVE';
                      const isSuspended = t.status === 'SUSPENDED';

                      return (
                        <tr key={t.id} className={isSelected ? 'table-active' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds([...selectedIds, t.id]);
                                else setSelectedIds(selectedIds.filter((id) => id !== t.id));
                              }}
                            />
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="sa-tenant-avatar">
                                <i className="bi bi-building" />
                              </div>
                              <div>
                                <div className="fw-bold text-white fs-6">{t.name}</div>
                                <div className="small text-white opacity-75">{t.businessType || 'CAFE'}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <code className="text-amber fw-bold bg-dark px-2 py-1 rounded border border-secondary">{t.slug}</code>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                isEnterprise
                                  ? 'text-bg-success'
                                  : isPro
                                  ? 'text-bg-warning text-dark'
                                  : isStarter
                                  ? 'text-bg-info text-dark'
                                  : 'text-bg-secondary'
                              } fw-bold px-2 py-1`}
                            >
                              {t.planDisplayName || t.subscriptionPlan || 'TRIAL'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                isActive
                                  ? 'bg-success-subtle text-success'
                                  : isSuspended
                                  ? 'bg-danger-subtle text-danger'
                                  : 'bg-warning-subtle text-warning'
                              } border px-2 py-1`}
                            >
                              {t.status === 'ACTIVE' ? 'نشط ✓' : t.status === 'SUSPENDED' ? 'موقوف ✕' : 'تجريبي ⏳'}
                            </span>
                          </td>
                          <td>
                            <span className="small text-white fw-bold">
                              {t.maxTables >= 9999 ? 'طاولات غير محدودة' : `${t.maxTables || 5} طاولات`}
                              {' • '}
                              {t.maxUsers >= 9999 ? 'كاشير غير محدود' : `${t.maxUsers || 2} كاشيرات`}
                            </span>
                          </td>
                          <td>
                            <span className="small text-white opacity-85">
                              {tenantExpiry(t) ? new Date(tenantExpiry(t)).toLocaleDateString('ar-EG') : 'غير محدد'}
                            </span>
                          </td>
                          <td className="text-end">
                            <div className="dropdown">
                              <button
                                className="btn btn-sm btn-outline-secondary dropdown-toggle sa-action-dropdown-btn"
                                type="button"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                              >
                                <i className="bi bi-three-dots-vertical" />
                              </button>
                              <ul className="dropdown-menu dropdown-menu-end sa-dropdown-menu">
                                <li>
                                  <button
                                    className="dropdown-item"
                                    type="button"
                                    onClick={() => handleOpenEditModal(t)}
                                  >
                                    <i className="bi bi-sliders me-2 text-warning" /> إشراف وتعديل الخطة
                                  </button>
                                </li>
                                <li>
                                  <button
                                    className="dropdown-item"
                                    type="button"
                                    onClick={() => handleUpdateSubscription(t.id, null, null, 7)}
                                  >
                                    <i className="bi bi-clock-history me-2 text-info" /> تمديد التجربة +7 أيام
                                  </button>
                                </li>
                                <li><hr className="dropdown-divider" /></li>
                                <li>
                                  {t.status === 'SUSPENDED' ? (
                                    <button
                                      className="dropdown-item text-success"
                                      type="button"
                                      onClick={() => handleUpdateSubscription(t.id, null, 'ACTIVE', null)}
                                    >
                                      <i className="bi bi-play-circle me-2" /> إعادة التفعيل
                                    </button>
                                  ) : (
                                    <button
                                      className="dropdown-item text-danger"
                                      type="button"
                                      onClick={() => handleUpdateSubscription(t.id, null, 'SUSPENDED', null)}
                                    >
                                      <i className="bi bi-pause-circle me-2" /> إيقاف الحساب
                                    </button>
                                  )}
                                </li>
                              </ul>
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
            <div className="card-footer sa-card-footer d-flex align-items-center justify-content-between p-3 flex-wrap gap-2">
              <div className="small text-white opacity-75">
                عرض {paginatedTenants.length} من إجمالي {filteredTenants.length} منشأة
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <i className="bi bi-chevron-right me-1" /> السابق
                </button>

                <span className="small text-white px-2 fw-bold">
                  صفحة {currentPage} من {totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  التالي <i className="bi bi-chevron-left ms-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. PLANS MATRIX SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'plans' && (
        <div className="sa-section">
          <SectionIntro eyebrow="PRODUCT & PRICING" title="الباقات وحدود الاستخدام" description="الحدود المعروضة هنا مطابقة لقواعد الاشتراك الفعلية في النظام." icon="bi-stars" />
          <div className="row g-4">
            {/* Plan 1: TRIAL */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card sa-card sa-plan-card h-100 shadow-sm border-secondary">
                <div className="card-header bg-dark text-center py-3 border-secondary">
                  <span className="badge text-bg-secondary mb-2 px-3 py-1 fw-bold">خطة البداية</span>
                  <h4 className="fw-bold text-white mb-1">TRIAL</h4>
                  <div className="fs-3 fw-bold text-white">مجاناً <small className="fs-6 text-white opacity-75">/ 14 يوم</small></div>
                </div>
                <div className="card-body p-4 d-flex flex-column">
                  <div className="text-center text-white opacity-75 small mb-3 fw-bold">
                    {planCounts.TRIAL} منشأة مشتركة حالياً
                  </div>
                  <ul className="list-unstyled d-flex flex-column gap-2 mb-4">
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 5 طاولات كافيه</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 2 مستخدمين (كاشير/مشرف)</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 30 صنف بالمنيو</li>
                    <li><i className="bi bi-check2 text-success me-2" /> نظام الكاشير ونقاط البيع</li>
                    <li className="text-muted"><i className="bi bi-x text-danger me-2" /> شاشة المطبخ (KDS)</li>
                    <li className="text-muted"><i className="bi bi-x text-danger me-2" /> تسجيل المصاريف والمديونيات</li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-outline-secondary mt-auto w-100 fw-bold py-2"
                    onClick={() => { setActiveSection('tenants'); setPlanFilter('TRIAL'); }}
                  >
                    عرض المشتركين
                  </button>
                </div>
              </div>
            </div>

            {/* Plan 2: STARTER */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card sa-card sa-plan-card h-100 shadow-sm border-info">
                <div className="card-header bg-dark text-center py-3 border-info">
                  <span className="badge text-bg-info mb-2 text-dark px-3 py-1 fw-bold">كافيه أساسي</span>
                  <h4 className="fw-bold text-white mb-1">STARTER</h4>
                  <div className="fs-3 fw-bold text-info">499 <small className="fs-6 text-white opacity-75">ج.م / شهرياً</small></div>
                </div>
                <div className="card-body p-4 d-flex flex-column">
                  <div className="text-center text-white opacity-75 small mb-3 fw-bold">
                    {planCounts.STARTER} منشأة مشتركة حالياً
                  </div>
                  <ul className="list-unstyled d-flex flex-column gap-2 mb-4">
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 20 طاولة</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 5 مستخدمين وكاشيرات</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 100 صنف بالمنيو</li>
                    <li><i className="bi bi-check2 text-success me-2" /> طباعة فواتير حرارية</li>
                    <li><i className="bi bi-check2 text-success me-2" /> تسجيل المصاريف ونثريات الشيفت</li>
                    <li className="text-muted"><i className="bi bi-x text-danger me-2" /> شاشة تحضير المطبخ KDS</li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-outline-info mt-auto w-100 fw-bold py-2"
                    onClick={() => { setActiveSection('tenants'); setPlanFilter('STARTER'); }}
                  >
                    عرض المشتركين
                  </button>
                </div>
              </div>
            </div>

            {/* Plan 3: PRO (Featured) */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card sa-card sa-plan-card sa-plan-card--featured h-100 shadow border-warning">
                <div className="card-header bg-dark text-center py-3 border-warning position-relative">
                  <span className="badge text-bg-warning mb-2 text-dark fw-bold px-3 py-1">الأكثر طلباً ⭐</span>
                  <h4 className="fw-bold text-amber mb-1">PRO</h4>
                  <div className="fs-3 fw-bold text-amber">899 <small className="fs-6 text-white opacity-75">ج.م / شهرياً</small></div>
                </div>
                <div className="card-body p-4 d-flex flex-column">
                  <div className="text-center text-white opacity-75 small mb-3 fw-bold">
                    {planCounts.PRO} منشأة مشتركة حالياً
                  </div>
                  <ul className="list-unstyled d-flex flex-column gap-2 mb-4">
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 50 طاولة كافيه</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 15 كاشير ومشرف</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 500 صنف بالمنيو</li>
                    <li><i className="bi bi-check2 text-success me-2" /> شاشة تحضير المطبخ والبار (KDS)</li>
                    <li><i className="bi bi-check2 text-success me-2" /> سجل الديون والآجل ومسحوبات الموظفين</li>
                    <li><i className="bi bi-check2 text-success me-2" /> تقارير وإحصائيات متقدمة</li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-warning mt-auto w-100 fw-bold text-dark py-2"
                    onClick={() => { setActiveSection('tenants'); setPlanFilter('PRO'); }}
                  >
                    عرض المشتركين
                  </button>
                </div>
              </div>
            </div>

            {/* Plan 4: ENTERPRISE */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="card sa-card sa-plan-card h-100 shadow-sm border-success">
                <div className="card-header bg-dark text-center py-3 border-success">
                  <span className="badge text-bg-success mb-2 px-3 py-1 fw-bold">شامل غير محدود 🚀</span>
                  <h4 className="fw-bold text-success mb-1">ENTERPRISE</h4>
                  <div className="fs-3 fw-bold text-success">1,499 <small className="fs-6 text-white opacity-75">ج.م / شهرياً</small></div>
                </div>
                <div className="card-body p-4 d-flex flex-column">
                  <div className="text-center text-white opacity-75 small mb-3 fw-bold">
                    {planCounts.ENTERPRISE} منشأة مشتركة حالياً
                  </div>
                  <ul className="list-unstyled d-flex flex-column gap-2 mb-4">
                    <li><i className="bi bi-check2 text-success me-2" /> طاولات غير محدودة ♾</li>
                    <li><i className="bi bi-check2 text-success me-2" /> كاشيرات وموظفين بلا حدود</li>
                    <li><i className="bi bi-check2 text-success me-2" /> منتجات ومخزون بلا حدود</li>
                    <li><i className="bi bi-check2 text-success me-2" /> لوحة إدارة متكاملة + دعم فني VIP</li>
                    <li><i className="bi bi-check2 text-success me-2" /> شعار وهوية مخصصة للعلامة التجارية</li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-outline-success mt-auto w-100 fw-bold py-2"
                    onClick={() => { setActiveSection('tenants'); setPlanFilter('ENTERPRISE'); }}
                  >
                    عرض المشتركين
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. SUBSCRIPTIONS & LICENSES SECTION
         ══════════════════════════════════════════════════════════════════════ */}
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
                      const isExpired = lk.expiresAt && new Date(lk.expiresAt) < new Date();
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
                              {lk.expiresAt ? new Date(lk.expiresAt).toLocaleDateString('ar-EG') : 'بلا حد ♾'}
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
                {['STARTER', 'PRO', 'ENTERPRISE'].map((plan) => {
                  const count = tenants.filter((tenant) => tenant.status === 'ACTIVE' && tenant.subscriptionPlan === plan).length;
                  const revenue = count * PLAN_PRICES[plan];
                  return (
                    <div key={plan} className={`sa-revenue-row sa-revenue-row--${plan.toLowerCase()}`}>
                      <span><b>{plan}</b><small>{count} منشأة نشطة</small></span>
                      <div><i style={{ width: `${estimatedMRR ? (revenue / estimatedMRR) * 100 : 0}%` }} /></div>
                      <strong>{revenue.toLocaleString()} ج.م</strong>
                    </div>
                  );
                })}
              </div>
              <footer>MRR قيمة تقديرية مبنية على السعر القياسي لكل باقة، وليست كشف تحصيل مالي.</footer>
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
                      {[
                        { id: 'TRIAL', label: 'TRIAL (تجريبي)', color: 'btn-outline-secondary' },
                        { id: 'STARTER', label: 'STARTER (أساسي)', color: 'btn-outline-info' },
                        { id: 'PRO', label: 'PRO (احترافي)', color: 'btn-outline-warning' },
                        { id: 'ENTERPRISE', label: 'ENTERPRISE (شامل)', color: 'btn-outline-success' },
                        { id: 'CUSTOM', label: '✨ CUSTOM (مخصصة)', color: 'btn-outline-light' },
                      ].map((p) => (
                        <div key={p.id} className="col">
                          <button
                            type="button"
                            className={`btn w-100 py-2 fw-bold text-nowrap ${customPlanForm.plan === p.id ? 'btn-warning text-dark' : p.color}`}
                            onClick={() => applyPlanPreset(p.id)}
                          >
                            {p.label}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Custom Quotas Section */}
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <h6 className="fw-bold text-white small mb-3">
                      <i className="bi bi-gear-wide-connected text-warning me-2" />
                      تعديل وتخصيص حدود المنشأة (Quotas Customization):
                    </h6>

                    <div className="row g-3">
                      {/* Max Tables */}
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-white opacity-75">
                          الحد الأقصى للطاولات 🪑
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="9999"
                          value={customPlanForm.maxTables}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, maxTables: e.target.value })}
                          required
                        />
                        <span className="small text-muted" style={{ fontSize: '0.75rem' }}>9999 = غير محدود</span>
                      </div>

                      {/* Max Users */}
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-white opacity-75">
                          الحد الأقصى للمستخدمين 👥
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="9999"
                          value={customPlanForm.maxUsers}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, maxUsers: e.target.value })}
                          required
                        />
                        <span className="small text-muted" style={{ fontSize: '0.75rem' }}>كاشيرات ومشرفين</span>
                      </div>

                      {/* Max Products */}
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-white opacity-75">
                          الحد الأقصى للأصناف ☕
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="9999"
                          value={customPlanForm.maxProducts}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, maxProducts: e.target.value })}
                          required
                        />
                        <span className="small text-muted" style={{ fontSize: '0.75rem' }}>أصناف المنيو</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Subscription Validity & Status */}
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <h6 className="fw-bold text-white small mb-3">
                      <i className="bi bi-calendar-check text-info me-2" />
                      صلاحية وتاريخ انتهاء الباقة:
                    </h6>

                    <div className="row g-3">
                      {/* Subscription End Date */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small text-white opacity-75">
                          {customPlanForm.status === 'TRIAL' || customPlanForm.plan === 'TRIAL'
                            ? 'تاريخ انتهاء الفترة التجريبية'
                            : 'تاريخ انتهاء الاشتراك'}
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={customPlanForm.subscriptionEndsAt}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, subscriptionEndsAt: e.target.value, extendDays: 0 })}
                        />
                        <span className="small text-muted" style={{ fontSize: '0.75rem' }}>تظل الباقة فعّالة حتى نهاية اليوم المحدد.</span>
                      </div>

                      {/* Quick Extend Buttons */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small text-white opacity-75">تمديد سريع بالأيام</label>
                        <div className="d-flex gap-2">
                          {[
                            { label: '+30 يوم', days: 30 },
                            { label: '+90 يوم', days: 90 },
                            { label: '+365 يوم', days: 365 },
                          ].map((b) => (
                            <button
                              key={b.days}
                              type="button"
                              className="btn btn-sm btn-outline-info flex-grow-1"
                              onClick={() => {
                                const now = new Date();
                                const selectedEnd = customPlanForm.subscriptionEndsAt ? new Date(customPlanForm.subscriptionEndsAt) : now;
                                const current = selectedEnd > now ? selectedEnd : now;
                                current.setDate(current.getDate() + b.days);
                                setCustomPlanForm({ ...customPlanForm, subscriptionEndsAt: current.toISOString().slice(0, 10), extendDays: 0 });
                              }}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Account Status */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small text-white opacity-75">حالة الحساب</label>
                        <select
                          className="form-select"
                          value={customPlanForm.status}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, status: e.target.value })}
                        >
                          <option value="ACTIVE">🟢 نشط (ACTIVE)</option>
                          <option value="TRIAL">🟡 تجريبي (TRIAL)</option>
                          <option value="SUSPENDED">🔴 معلق / موقوف (SUSPENDED)</option>
                        </select>
                      </div>

                      {/* Service Charge % */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small text-white opacity-75">نسبة خدمة الصالة الافتراضية (%)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          max="100"
                          value={customPlanForm.serviceChargePercent}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, serviceChargePercent: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* WhatsApp Alerts Toggle */}
                    <div className="form-check form-switch mt-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="whatsappAlertsSwitch"
                        checked={customPlanForm.whatsappAlertsEnabled}
                        onChange={(e) => setCustomPlanForm({ ...customPlanForm, whatsappAlertsEnabled: e.target.checked })}
                      />
                      <label className="form-check-label text-white small fw-bold" htmlFor="whatsappAlertsSwitch">
                        تفعيل إرسال التقارير اليومية والإشعارات التلقائية عبر واتساب 📲
                      </label>
                    </div>
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
