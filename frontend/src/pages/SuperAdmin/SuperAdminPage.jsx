import { useCallback, useEffect, useState, useMemo } from 'react';
import { platformApi } from '../../api/platformApi';
import { useToast } from '../../context/ToastContext';
import SuperAdminLayout from '../../layouts/SuperAdminLayout';
import './SuperAdminPage.css';

export default function SuperAdminPage() {
  const toast = useToast();

  // Navigation State
  const [activeSection, setActiveSection] = useState('dashboard');

  // Core Data State
  const [tenants, setTenants] = useState([]);
  const [licenseKeys, setLicenseKeys] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
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

  // Direct Provisioning Form State
  const [newTenantForm, setNewTenantForm] = useState({
    name: '',
    slug: '',
    businessType: 'CAFE_AND_RESTAURANT',
    subscriptionPlan: 'PRO',
    ownerWhatsapp: '',
    ownerUsername: '',
    ownerPassword: '',
    ownerFullName: '',
    timezone: 'Africa/Cairo',
    currency: 'EGP',
  });

  const [createdTenantModal, setCreatedTenantModal] = useState(null);

  // ── DATA FETCHING ──────────────────────────────────────────────────────────
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [tenantsData, keysData, statsData] = await Promise.all([
        platformApi.getAllTenants().catch(() => []),
        platformApi.getLicenseKeys().catch(() => []),
        platformApi.getPlatformStats().catch(() => null),
      ]);

      setTenants(tenantsData || []);
      setLicenseKeys(keysData || []);
      setPlatformStats(statsData);
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
    const subEnd = t.subscriptionEndsAt ? new Date(t.subscriptionEndsAt).toISOString().slice(0, 10) : '';
    setCustomPlanForm({
      plan: t.subscriptionPlan || 'PRO',
      status: t.status || 'ACTIVE',
      maxTables: t.maxTables ?? 50,
      maxUsers: t.maxUsers ?? 15,
      maxProducts: t.maxProducts ?? 500,
      serviceChargePercent: t.serviceChargePercent ?? 0,
      whatsappAlertsEnabled: Boolean(t.whatsappAlertsEnabled),
      subscriptionEndsAt: subEnd,
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
    setUpdating(true);
    try {
      const payload = {
        plan: customPlanForm.plan,
        status: customPlanForm.status,
        maxTables: Number(customPlanForm.maxTables),
        maxUsers: Number(customPlanForm.maxUsers),
        maxProducts: Number(customPlanForm.maxProducts),
        serviceChargePercent: Number(customPlanForm.serviceChargePercent) || 0,
        whatsappAlertsEnabled: customPlanForm.whatsappAlertsEnabled,
        subscriptionEndsAt: customPlanForm.subscriptionEndsAt ? new Date(customPlanForm.subscriptionEndsAt).toISOString() : null,
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

  async function handleBulkAction(action) {
    if (selectedIds.length === 0) return;
    setUpdating(true);
    try {
      for (const id of selectedIds) {
        if (action === 'ACTIVE') await platformApi.updateSubscription(id, { status: 'ACTIVE' });
        if (action === 'SUSPENDED') await platformApi.updateSubscription(id, { status: 'SUSPENDED' });
        if (action === 'TRIAL_EXTEND') await platformApi.updateSubscription(id, { extendDays: 7 });
      }
      toast.success(`تم تنفيذ الإجراء على ${selectedIds.length} منشأة بنجاح`);
      setSelectedIds([]);
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء تنفيذ الإجراء الجماعي');
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

  async function handleCreateTenant(e) {
    e.preventDefault();
    if (!newTenantForm.name || !newTenantForm.slug || !newTenantForm.ownerUsername || !newTenantForm.ownerPassword) {
      toast.error('يرجى ملء كافة الحقول الإلزامية');
      return;
    }

    setUpdating(true);
    try {
      await platformApi.provisionTenant(newTenantForm);
      toast.success(`تم تأسيس وتفعيل منشأة (${newTenantForm.name}) بنجاح! 🚀`);
      
      const createdData = {
        name: newTenantForm.name,
        slug: newTenantForm.slug,
        ownerFullName: newTenantForm.ownerFullName,
        ownerUsername: newTenantForm.ownerUsername,
        ownerPassword: newTenantForm.ownerPassword,
        subscriptionPlan: newTenantForm.subscriptionPlan,
        ownerWhatsapp: newTenantForm.ownerWhatsapp,
      };

      setCreatedTenantModal(createdData);
      setCreateModal(false);

      // Auto-open WhatsApp if number is provided
      if (newTenantForm.ownerWhatsapp) {
        sendWhatsappCredentials(createdData);
      }

      setNewTenantForm({
        name: '',
        slug: '',
        businessType: 'CAFE_AND_RESTAURANT',
        subscriptionPlan: 'PRO',
        ownerWhatsapp: '',
        ownerUsername: '',
        ownerPassword: '',
        ownerFullName: '',
        timezone: 'Africa/Cairo',
        currency: 'EGP',
      });
      loadData(true);
    } catch (err) {
      toast.error(err.message || 'فشل في إضافة المنشأة');
    } finally {
      setUpdating(false);
    }
  }

  // ── LICENSE KEY ACTIONS ────────────────────────────────────────────────────
  async function handleGenerateKey(e) {
    e.preventDefault();
    setGeneratingKey(true);
    try {
      await platformApi.generateLicenseKey(keyForm.plan, Number(keyForm.validDays), keyForm.notes);
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
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`تم نسخ ${label} إلى الحافظة ✓`);
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

  // ── COMPUTED KPI METRICS ───────────────────────────────────────────────────
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter((t) => t.status === 'ACTIVE').length;
  const trialTenants = tenants.filter((t) => t.status === 'TRIAL' || t.subscriptionPlan === 'TRIAL').length;
  const suspendedTenants = tenants.filter((t) => t.status === 'SUSPENDED').length;

  const totalUsersEstimated = tenants.reduce((acc, t) => acc + (t.maxUsers || 2), 0);
  const activeSubscriptions = tenants.filter((t) => t.subscriptionPlan === 'PRO' || t.subscriptionPlan === 'STARTER' || t.subscriptionPlan === 'ENTERPRISE').length;

  const estimatedMRR = tenants.reduce((acc, t) => {
    if (t.subscriptionPlan === 'ENTERPRISE') return acc + 1499;
    if (t.subscriptionPlan === 'PRO') return acc + 899;
    if (t.subscriptionPlan === 'STARTER') return acc + 499;
    return acc;
  }, 0);

  // Expiring soon (< 7 days)
  const expiringTenants = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return tenants.filter((t) => {
      const date = t.subscriptionEndsAt ? new Date(t.subscriptionEndsAt) : t.trialEndsAt ? new Date(t.trialEndsAt) : null;
      return date && date > now && date <= sevenDaysLater;
    });
  }, [tenants]);

  // Plan Distribution Count
  const planCounts = useMemo(() => {
    return {
      TRIAL: tenants.filter((t) => !t.subscriptionPlan || t.subscriptionPlan === 'TRIAL').length,
      STARTER: tenants.filter((t) => t.subscriptionPlan === 'STARTER').length,
      PRO: tenants.filter((t) => t.subscriptionPlan === 'PRO').length,
      ENTERPRISE: tenants.filter((t) => t.subscriptionPlan === 'ENTERPRISE').length,
    };
  }, [tenants]);

  // Filtered & Sorted Tenants
  const filteredTenants = useMemo(() => {
    return tenants
      .filter((t) => {
        const matchesSearch =
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.slug.toLowerCase().includes(searchQuery.toLowerCase());
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
      expiringCount={expiringTenants.length}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          1. DASHBOARD OVERVIEW SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'dashboard' && (
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
          {expiringTenants.length > 0 && (
            <div className="alert alert-warning border-0 sa-alert-attention d-flex align-items-center justify-content-between mb-4 shadow-sm">
              <div className="d-flex align-items-center gap-3">
                <div className="sa-alert-icon">
                  <i className="bi bi-exclamation-triangle-fill" />
                </div>
                <div>
                  <h6 className="mb-0 fw-bold text-white">تنبيه اشتراكات تنتهي قريباً ({expiringTenants.length} منشآت)</h6>
                  <p className="small mb-0 text-white opacity-75">
                    يوجد {expiringTenants.length} مشتركين ستنتهي فترتهم خلال أقل من 7 أيام. يمكنك تمديد فترتهم أو ترقيتهم.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-dark fw-bold px-3 py-2"
                onClick={() => { setActiveSection('tenants'); setStatusFilter('ALL'); }}
              >
                عرض المنشآت <i className="bi bi-arrow-left ms-1" />
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
                    <span className="sa-kpi-label">الإيرادات الشهرية (MRR)</span>
                    <h3 className="sa-kpi-val mb-0 text-amber">{estimatedMRR.toLocaleString()} <small className="fs-6 text-white opacity-75">ج.م</small></h3>
                    <span className="sa-kpi-sub text-white opacity-75">دخل الاشتراكات الفعلي</span>
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
            {/* MRR Growth Trend Chart */}
            <div className="col-12 col-lg-8">
              <div className="card sa-card shadow-sm h-100">
                <div className="card-header sa-card-header p-3 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-graph-up-arrow text-amber" />
                    <h5 className="mb-0 fw-bold text-white">نمو الإيرادات المتكررة (MRR Trend)</h5>
                  </div>
                  <span className="badge bg-dark border text-light px-3 py-2">+18.5% نمو شهري</span>
                </div>
                <div className="card-body p-4">
                  <div className="d-flex align-items-end gap-3 sa-chart-bars pb-3 border-bottom border-secondary">
                    {[
                      { month: 'يناير', val: 35, rev: '12,500' },
                      { month: 'فبراير', val: 48, rev: '18,200' },
                      { month: 'مارس', val: 58, rev: '24,000' },
                      { month: 'أبريل', val: 70, rev: '32,500' },
                      { month: 'مايو', val: 82, rev: '39,000' },
                      { month: 'الشهر الحالي', val: 100, rev: `${estimatedMRR.toLocaleString()}`, active: true },
                    ].map((b, idx) => (
                      <div key={idx} className="flex-grow-1 text-center">
                        <div
                          className={`sa-bar ${b.active ? 'sa-bar--active' : ''}`}
                          style={{ height: `${b.val * 1.4}px` }}
                          title={`${b.month}: ${b.rev} ج.م`}
                        />
                        <span className="sa-bar-label mt-2 d-block text-white fw-bold">{b.month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="d-flex justify-content-between align-items-center pt-3 text-white small">
                    <span>متوسط إيراد المنشأة (ARPU): <strong className="text-amber">680 ج.م</strong></span>
                    <span>معدل التحويل من التجريبي: <strong className="text-success">22.4%</strong></span>
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
                              {t.maxTables >= 1000 ? 'طاولات غير محدودة' : `${t.maxTables || 5} طاولات`}
                              {' • '}
                              {t.maxUsers >= 1000 ? 'كاشير غير محدود' : `${t.maxUsers || 2} كاشيرات`}
                            </span>
                          </td>
                          <td>
                            <span className="small text-white opacity-85">
                              {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('ar-EG') : '—'}
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
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 10 طاولات</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 4 مستخدمين وكاشيرات</li>
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
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 25 طاولة كافيه</li>
                    <li><i className="bi bi-check2 text-success me-2" /> حتى 8 كاشيرات ومشرفين</li>
                    <li><i className="bi bi-check2 text-success me-2" /> أصناف منيو غير محدودة</li>
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
          {/* Key Generator Card */}
          <div className="card sa-card shadow-sm mb-4">
            <div className="card-header sa-card-header p-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-key-fill text-amber" />
                <h5 className="mb-0 fw-bold text-white">توليد مفتاح ترخيص جديد (License Key Generator)</h5>
              </div>
              <span className="badge bg-dark border text-white px-3 py-2">تفعيل ذاتي أوفلاين/أونلاين</span>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleGenerateKey} className="row g-3 align-items-end">
                <div className="col-12 col-md-3">
                  <label className="form-label small text-white fw-bold">باقة الترخيص المرادة</label>
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
                    className="form-control"
                    placeholder="365 (أو 0 لمدى الحياة)"
                    value={keyForm.validDays}
                    onChange={(e) => setKeyForm({ ...keyForm, validDays: e.target.value })}
                    required
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label small text-white fw-bold">ملاحظة الترخيص (اسم الكافيه أو رقم الإيصال)</label>
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
          5. AUDIT LOGS SECTION
         ══════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'audit-logs' && (
        <div className="sa-section">
          <div className="card sa-card shadow-sm">
            <div className="card-header sa-card-header p-3 d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-journal-text text-amber" />
                <h5 className="mb-0 fw-bold text-white">سجل العمليات والنشاطات الإدارية (Audit Trail)</h5>
              </div>
              <span className="badge text-bg-dark border text-white px-3 py-2">تتبع فوري للأمان</span>
            </div>
            <div className="card-body p-4">
              <p className="text-white opacity-75 small mb-4">
                يتم تسجيل كل إجراء تنفيذي على مستوى المنصة (تأسيس منشأة، تعديل اشتراك، إصدار ترخيص، إلغاء صلاحية) لحماية البيانات ومراجعة العمليات.
              </p>

              <div className="sa-timeline">
                {[
                  { title: 'تم ترقية باقة كافيه روقان إلى PRO', user: 'superadmin', time: 'منذ 15 دقيقة', icon: 'bi-patch-check-fill', color: 'text-success' },
                  { title: 'تم إصدار مفتاح ترخيص جديد (PRO - 365 يوم)', user: 'superadmin', time: 'منذ ساعتين', icon: 'bi-key-fill', color: 'text-amber' },
                  { title: 'تأسيس منشأة جديدة: كافيه وناس (wanas-cafe)', user: 'superadmin', time: 'اليوم، 01:30 ص', icon: 'bi-building-fill-add', color: 'text-primary' },
                  { title: 'تمديد الفترة التجريبية لمنشأة كافيو فرع 2 (+7 أيام)', user: 'superadmin', time: 'أمس، 09:15 م', icon: 'bi-clock-history', color: 'text-warning' },
                ].map((item, idx) => (
                  <div key={idx} className="sa-timeline-item d-flex gap-3 pb-3 mb-3 border-bottom border-secondary">
                    <div className={`sa-timeline-icon ${item.color}`}>
                      <i className={`bi ${item.icon} fs-5`} />
                    </div>
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-center">
                        <strong className="text-white fs-6">{item.title}</strong>
                        <span className="text-white opacity-50 small">{item.time}</span>
                      </div>
                      <span className="small text-white opacity-75">المنفذ: {item.user} • Root Authorization</span>
                    </div>
                  </div>
                ))}
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
          <div className="row g-4">
            <div className="col-12 col-md-6">
              <div className="card sa-card shadow-sm h-100">
                <div className="card-header sa-card-header p-3">
                  <h5 className="mb-0 fw-bold text-white">
                    <i className="bi bi-hdd-network me-2 text-primary" />
                    مواصفات الخوادم وقاعدة البيانات
                  </h5>
                </div>
                <div className="card-body p-4">
                  <dl className="row mb-0 small">
                    <dt className="col-sm-5 text-white opacity-75 mb-2">محرك قاعدة البيانات</dt>
                    <dd className="col-sm-7 text-white fw-bold mb-2">SQLite 3.53 (WAL Mode + 5s Busy Timeout)</dd>

                    <dt className="col-sm-5 text-white opacity-75 mb-2">إصدار منصة السحابة</dt>
                    <dd className="col-sm-7 text-white fw-bold mb-2">Caffio Enterprise Platform v2.4</dd>

                    <dt className="col-sm-5 text-white opacity-75 mb-2">بروتوكول الأمان والتشفير</dt>
                    <dd className="col-sm-7 text-white fw-bold mb-2">HMAC-SHA256 JWT + Refresh Rotation</dd>

                    <dt className="col-sm-5 text-white opacity-75">عزل المشتركين (Multi-Tenancy)</dt>
                    <dd className="col-sm-7 text-success fw-bold">Zero-Trust Schema Isolation</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="card sa-card shadow-sm h-100">
                <div className="card-header sa-card-header p-3">
                  <h5 className="mb-0 fw-bold text-white">
                    <i className="bi bi-shield-check me-2 text-success" />
                    مفاتيح وأسرار النظام (Secret Material)
                  </h5>
                </div>
                <div className="card-body p-4">
                  <p className="text-white opacity-75 small mb-3">
                    مفتاح التأسيس السري مخصص لكل بيئة تثبيت بشكل عشوائي ومشفر لمنع تزوير الجلسات.
                  </p>
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <span className="small text-white opacity-75 d-block mb-1">حالة التشفير:</span>
                    <span className="badge text-bg-success px-3 py-2 fw-bold">نشط ومشفر بنجاح (32-byte SecureRandom)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 1: DIRECT TENANT PROVISIONING MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {createModal && (
        <div
          className="sa-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setCreateModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg w-100">
            <div className="modal-content border-secondary shadow-lg">
              <div className="modal-header border-secondary p-3">
                <h5 className="modal-title fw-bold text-light">
                  <i className="bi bi-building-add me-2 text-primary" />
                  تأسيس منشأة جديدة ✦ Caffio Enterprise
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setCreateModal(false)}
                />
              </div>

              <form onSubmit={handleCreateTenant}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">اسم المنشأة / الكافيه بالكامل</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="مثال: روقان كافيه"
                        value={newTenantForm.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                          setNewTenantForm({
                            ...newTenantForm,
                            name,
                            slug: newTenantForm.slug || autoSlug,
                          });
                        }}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">رابط المنشأة (Slug المعرف)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="rawqan-cafe"
                        value={newTenantForm.slug}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, slug: e.target.value.toLowerCase().trim() })}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">اسم المالك / المدير العام</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="مثال: أحمد محمود"
                        value={newTenantForm.ownerFullName}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerFullName: e.target.value })}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">نوع النشاط التجاري</label>
                      <select
                        className="form-select"
                        value={newTenantForm.businessType}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, businessType: e.target.value })}
                      >
                        <option value="CAFE_AND_RESTAURANT">كافيه ومطعم (شامل)</option>
                        <option value="CAFE">كافيه ومشروبات فقط</option>
                        <option value="RESTAURANT">مطعم ومأكولات</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">خطة الاشتراك المحددة من المنصة ⭐</label>
                      <select
                        className="form-select border-warning"
                        value={newTenantForm.subscriptionPlan}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, subscriptionPlan: e.target.value })}
                      >
                        <option value="TRIAL">TRIAL — فترة تجريبية مجانية (14 يوم)</option>
                        <option value="STARTER">STARTER — باقة البداية (499 ج.م / شهر)</option>
                        <option value="PRO">PRO — باقة المحترفين ⭐ (899 ج.م / شهر)</option>
                        <option value="ENTERPRISE">ENTERPRISE — الشركات والكافيهات الكبرى (1499 ج.م / شهر)</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">اسم مستخدم الحساب</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="admin"
                        value={newTenantForm.ownerUsername}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerUsername: e.target.value.trim() })}
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">رقم واتساب المالك لإرسال البيانات 📲</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="مثال: 01061967618"
                        value={newTenantForm.ownerWhatsapp}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerWhatsapp: e.target.value })}
                      />
                      <span className="small text-muted" style={{ fontSize: '0.75rem' }}>سيتم فتح واتساب تلقائياً لإرسال بيانات الحساب فور الإنشاء</span>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small text-white fw-bold">كلمة مرور الحساب الأولى</label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="كلمة السر"
                        value={newTenantForm.ownerPassword}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerPassword: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-secondary p-3">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCreateModal(false)}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary fw-bold px-4"
                    disabled={updating}
                  >
                    {updating ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-rocket-takeoff me-1" />}
                    تأكيد وتأسيس المنشأة 🚀
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
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
                      صلاحية وتاريخ انتهاء الاشتراك:
                    </h6>

                    <div className="row g-3">
                      {/* Subscription End Date */}
                      <div className="col-12 col-md-6">
                        <label className="form-label small text-white opacity-75">تاريخ الانتهاء المحدد</label>
                        <input
                          type="date"
                          className="form-control"
                          value={customPlanForm.subscriptionEndsAt}
                          onChange={(e) => setCustomPlanForm({ ...customPlanForm, subscriptionEndsAt: e.target.value, extendDays: 0 })}
                        />
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
                                const current = customPlanForm.subscriptionEndsAt ? new Date(customPlanForm.subscriptionEndsAt) : new Date();
                                current.setDate(current.getDate() + b.days);
                                setCustomPlanForm({ ...customPlanForm, subscriptionEndsAt: current.toISOString().slice(0, 10), extendDays: b.days });
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
      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 4: CREATED TENANT CREDENTIALS & WHATSAPP MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {createdTenantModal && (
        <div
          className="sa-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setCreatedTenantModal(null); }}
        >
          <div className="modal-dialog modal-dialog-centered w-100" style={{ maxWidth: '520px' }}>
            <div className="modal-content border-success shadow-lg">
              <div className="modal-header border-secondary p-3 bg-success-subtle">
                <h5 className="modal-title fw-bold text-success">
                  <i className="bi bi-check-circle-fill me-2" />
                  تم تأسيس المنشأة وتفعيلها بنجاح 🎉
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setCreatedTenantModal(null)}
                />
              </div>
              <div className="modal-body p-4">
                <div className="p-3 bg-dark rounded border border-secondary mb-3">
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-white opacity-75 small">اسم المنشأة:</span>
                    <span className="text-white fw-bold">{createdTenantModal.name}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-white opacity-75 small">المعرف المختصر (Slug):</span>
                    <span className="badge bg-secondary">{createdTenantModal.slug}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-white opacity-75 small">باقة الاشتراك:</span>
                    <span className="badge bg-warning text-dark fw-bold">{createdTenantModal.subscriptionPlan}</span>
                  </div>
                  <hr className="border-secondary my-2" />
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-white opacity-75 small">اسم المستخدم:</span>
                    <div className="d-flex align-items-center gap-1">
                      <code className="text-info fw-bold">{createdTenantModal.ownerUsername}</code>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-white p-0"
                        onClick={() => copyToClipboard(createdTenantModal.ownerUsername, 'اسم المستخدم')}
                      >
                        <i className="bi bi-clipboard small" />
                      </button>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-white opacity-75 small">كلمة المرور:</span>
                    <div className="d-flex align-items-center gap-1">
                      <code className="text-warning fw-bold">{createdTenantModal.ownerPassword}</code>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-white p-0"
                        onClick={() => copyToClipboard(createdTenantModal.ownerPassword, 'كلمة المرور')}
                      >
                        <i className="bi bi-clipboard small" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="alert alert-dark border-secondary p-3 d-flex align-items-center justify-content-between mb-0">
                  <div>
                    <span className="small text-white d-block fw-bold">رقم واتساب المالك:</span>
                    <span className="small text-white opacity-75">{createdTenantModal.ownerWhatsapp || 'غير محدد'}</span>
                  </div>
                  {createdTenantModal.ownerWhatsapp && (
                    <button
                      type="button"
                      className="btn btn-sm btn-success fw-bold px-3"
                      onClick={() => sendWhatsappCredentials(createdTenantModal)}
                    >
                      <i className="bi bi-whatsapp me-1" /> فتح واتساب 📲
                    </button>
                  )}
                </div>
              </div>
              <div className="modal-footer border-secondary p-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm fw-bold"
                  onClick={() => copyToClipboard(formatWhatsappMessage(createdTenantModal), 'رسالة الواتساب بالكامل')}
                >
                  <i className="bi bi-copy me-1" /> نسخ نص الرسالة 📋
                </button>
                <button
                  type="button"
                  className="btn btn-primary fw-bold px-4"
                  onClick={() => setCreatedTenantModal(null)}
                >
                  تم / متابعة ✓
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}
