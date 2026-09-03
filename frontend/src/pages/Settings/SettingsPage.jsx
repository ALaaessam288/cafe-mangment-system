import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../api/usersApi';
import { tenantApi } from '../../api/tenantApi';
import { storage } from '../../utils/storage';
import { removeImageBackground } from '../../utils/imageUtils';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Spinner from '../../components/Spinner/Spinner';
import { 
  Building2, User, KeyRound, Shield, RefreshCw, Sparkles, MessageCircle, 
  Upload, Trash2, Image, Key, CheckCircle, Crown, ArrowUpRight, Check,
  Wand2, ZoomIn, ZoomOut, RotateCcw, Download, Columns2, CheckCircle2
} from 'lucide-react';
import { ROLES } from '../../utils/constants';
import PrinterSettings from './PrinterSettings';
import './SettingsPage.css';

const SETTINGS_TAB_META = {
  facility: { label: 'هوية المنشأة', description: 'الشعار، بيانات الفرع، العملة وحالة إصدار النظام', index: '01', tone: 'amber' },
  subscription: { label: 'الاشتراك والسعة', description: 'الباقة الحالية، حدود الاستخدام، الترخيص وخيارات الترقية', index: '02', tone: 'violet' },
  security: { label: 'الحساب والأمان', description: 'بيانات الحساب، كلمة المرور وحماية الوصول الإداري', index: '03', tone: 'blue' },
  hardware: { label: 'الأجهزة والتكاملات', description: 'الطابعات، إعدادات الإيصالات وقنوات التنبيه', index: '04', tone: 'emerald' },
};

export default function SettingsPage() {
  const { user, role, updateTenantInfo } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const tenantSlug = storage.getTenantSlug();
  const fileInputRef = useRef(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState(() => {
    if (role !== ROLES.ADMIN) return 'security';
    return location.state?.tab || 'facility';
  });

  // Logo & AI Background Removal State
  const [logoPreview, setLogoPreview] = useState(user?.logoUrl || '');
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [isBgRemoverOpen, setIsBgRemoverOpen] = useState(false);
  const [rawUploadedImage, setRawUploadedImage] = useState(null);
  const [bgRemovalMode, setBgRemovalMode] = useState('auto'); // 'auto' | 'white' | 'black' | 'original'
  const [bgTolerance, setBgTolerance] = useState(38);
  const [bgFeather, setBgFeather] = useState(18);
  const [bgFloodFill, setBgFloodFill] = useState(true);
  const [bgAutoTrim, setBgAutoTrim] = useState(true);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [processedDataUrl, setProcessedDataUrl] = useState('');
  const [previewBgTheme, setPreviewBgTheme] = useState('checkerboard'); // 'checkerboard' | 'dark' | 'receipt'
  const [logoPreviewMode, setLogoPreviewMode] = useState('after'); // 'before' | 'after'
  const [logoPreviewZoom, setLogoPreviewZoom] = useState(100);

  // Usage & Subscription state
  const [usage, setUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivatingLicense, setIsActivatingLicense] = useState(false);

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // PIN state
  const [pinForm, setPinForm] = useState({
    newPin: '',
    confirmPin: '',
  });
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Update state
  const [updateStatus, setUpdateStatus] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Load tenant usage
  const loadUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const data = await tenantApi.getUsage();
      setUsage(data);
      if (data.logoUrl && data.logoUrl !== logoPreview) {
        setLogoPreview(data.logoUrl);
      }
    } catch (err) {
      console.error('Failed to load usage:', err);
    } finally {
      setLoadingUsage(false);
    }
  }, [logoPreview]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    if (user?.logoUrl) {
      setLogoPreview(user.logoUrl);
    }
  }, [user?.logoUrl]);

  // Execute Background Removal Algorithm
  const runBackgroundRemoval = useCallback(async (sourceImg, mode, tol, feat, flood, trim) => {
    if (!sourceImg) return;
    setIsProcessingBg(true);
    try {
      if (mode === 'original') {
        setProcessedDataUrl(sourceImg);
        return;
      }
      const result = await removeImageBackground(sourceImg, {
        mode,
        tolerance: Number(tol),
        feather: Number(feat),
        floodFillOnly: flood,
        autoTrim: trim,
      });
      setProcessedDataUrl(result.dataUrl);
    } catch (err) {
      console.error('Error removing background:', err);
      toast.error(err.message, 'فشل تفريغ خلفية الصورة');
    } finally {
      setIsProcessingBg(false);
    }
  }, [toast]);

  // Handle Logo File Selection
  function handleLogoFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت', 'الصورة كبيرة جداً');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target.result;
      setRawUploadedImage(rawUrl);
      setBgRemovalMode('auto');
      setBgTolerance(38);
      setBgFeather(18);
      setBgFloodFill(true);
      setBgAutoTrim(true);
      setIsBgRemoverOpen(true);
      runBackgroundRemoval(rawUrl, 'auto', 38, 18, true, true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Apply Processed Logo from Modal
  async function handleApplyProcessedLogo() {
    if (!processedDataUrl) return;
    setLogoPreview(processedDataUrl);
    setIsBgRemoverOpen(false);

    // Automatically save to database
    setIsSavingLogo(true);
    try {
      const res = await tenantApi.updateLogo(processedDataUrl);
      updateTenantInfo({ logoUrl: res.logoUrl });
      toast.success('تم حفظ وتثبيت الشعار الشفاف (PNG) بنجاح! 🪄✨');
    } catch (err) {
      toast.error(err.message, 'فشل حفظ الشعار');
    } finally {
      setIsSavingLogo(false);
    }
  }

  function handleResetLogoStudio() {
    setBgRemovalMode('auto');
    setBgTolerance(38);
    setBgFeather(18);
    setBgFloodFill(true);
    setBgAutoTrim(true);
    setLogoPreviewMode('after');
    setLogoPreviewZoom(100);
    runBackgroundRemoval(rawUploadedImage, 'auto', 38, 18, true, true);
  }

  function handleDownloadProcessedLogo() {
    if (!processedDataUrl) return;
    const link = document.createElement('a');
    link.href = processedDataUrl;
    link.download = `caffio-logo-${tenantSlug || 'brand'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تنزيل نسخة PNG من الشعار');
  }

  async function handleSaveLogo() {
    setIsSavingLogo(true);
    try {
      const res = await tenantApi.updateLogo(logoPreview);
      updateTenantInfo({ logoUrl: res.logoUrl });
      toast.success('تم حفظ وتحديث لوجو الكافيه بنجاح! 🎨');
    } catch (err) {
      toast.error(err.message, 'فشل حفظ اللوجو');
    } finally {
      setIsSavingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    if (!window.confirm('هل أنت متأكد من حذف لوجو الكافيه؟')) return;
    setIsSavingLogo(true);
    try {
      await tenantApi.updateLogo(null);
      setLogoPreview('');
      updateTenantInfo({ logoUrl: null });
      toast.success('تم حذف اللوجو');
    } catch (err) {
      toast.error(err.message, 'فشل حذف اللوجو');
    } finally {
      setIsSavingLogo(false);
    }
  }

  // Handle License Activation
  async function handleActivateLicense(e) {
    e.preventDefault();
    const key = licenseKeyInput.trim().toUpperCase();
    if (!key) {
      toast.warning('يرجى إدخال مفتاح الترخيص');
      return;
    }

    setIsActivatingLicense(true);
    try {
      const res = await tenantApi.activateLicense(key);
      updateTenantInfo({
        subscriptionPlan: res.subscriptionPlan,
        planDisplayName: res.planDisplayName,
        subscriptionEndsAt: res.subscriptionEndsAt,
        maxTables: res.maxTables,
        maxUsers: res.maxUsers,
        maxProducts: res.maxProducts,
        includesKds: res.includesKds,
        includesExpenses: res.includesExpenses,
      });
      toast.success(`تم تفعيل الترخيص بنجاح! باقتك الحالية الآن: ${res.planDisplayName} 🚀`);
      setLicenseKeyInput('');
      loadUsage();
    } catch (err) {
      toast.error(err.message, 'فشل تفعيل الترخيص');
    } finally {
      setIsActivatingLicense(false);
    }
  }

  // Handle Updates
  useEffect(() => {
    if (window.api && window.api.onUpdateStatus) {
      window.api.onUpdateStatus((data) => {
        setUpdateStatus(data);
        if (data.status === 'downloaded') {
          toast.success(data.message);
        }
      });
    }
  }, [toast]);

  async function handleCheckUpdates() {
    setCheckingUpdate(true);
    setUpdateStatus({ status: 'checking', message: 'جاري الاتصال بالسيرفر لفحص وجود تحديثات جديدة...' });
    try {
      if (window.api && window.api.checkForUpdates) {
        await window.api.checkForUpdates();
      } else {
        setTimeout(() => {
          setUpdateStatus({ status: 'not-available', message: 'أنت تعمل على أحدث إصدار متاح حالياً v1.0.0 ✓' });
          setCheckingUpdate(false);
        }, 1200);
      }
    } catch (err) {
      setUpdateStatus({ status: 'error', message: 'فشل الفحص: ' + err.message });
    } finally {
      setCheckingUpdate(false);
    }
  }

  // Password change
  async function handlePasswordChange(e) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.warning('كلمات المرور الجديدة غير متطابقة');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.warning('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setIsSavingPassword(true);
    try {
      await usersApi.changePassword(user.id, { newPassword: passwordForm.newPassword });
      toast.success('تم تغيير كلمة المرور بنجاح');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message, 'فشل تغيير كلمة المرور');
    } finally {
      setIsSavingPassword(false);
    }
  }

  // PIN change
  async function handlePinChange(e) {
    e.preventDefault();
    if (pinForm.newPin !== pinForm.confirmPin) {
      toast.warning('رمز PIN غير متطابق');
      return;
    }
    if (pinForm.newPin.length < 4) {
      toast.warning('رمز PIN يجب أن يكون من 4 إلى 8 أرقام');
      return;
    }

    setIsSavingPin(true);
    try {
      await usersApi.update(user.id, {
        fullName: user.fullName || user.username,
        username: user.username,
        role: user.role,
        pin: pinForm.newPin.trim(),
      });
      toast.success('تم تعيين رمز PIN بنجاح! يمكنك استخدامه في شاشة الدخول السريع 🚀');
      setPinForm({ newPin: '', confirmPin: '' });
    } catch (err) {
      toast.error(err.message, 'فشل تعيين رمز PIN');
    } finally {
      setIsSavingPin(false);
    }
  }

  // WhatsApp upgrade link generator
  function getWhatsAppUpgradeUrl(planName, price) {
    const text = encodeURIComponent(
      `مرحباً، أرغب في ترقية اشتراك نظام كافيو.\n\nاسم المنشأة: ${user?.tenantName || tenantSlug}\nكود المنشأة: ${tenantSlug}\nالباقة المطلوبة: ${planName} (${price} ج.م)\nرقم الهاتف المسجل: ${user?.username || ''}`
    );
    return `https://wa.me/201112633164?text=${text}`;
  }

  return (
    <div className="page settings-page settings-creative" dir="rtl">
      {/* ── Executive Hero Header ── */}
      <div className="page__header settings-header">
        <div className="settings-header__info">
          <div className="settings-header__icon-box">
            <Building2 size={24} className="text-accent" />
          </div>
          <div>
            <div className="settings-header__title-row">
              <h1 className="page__title">إعدادات النظام والاشتراكات</h1>
              <span className="settings-slug-badge">{tenantSlug}</span>
            </div>
            <p className="page__subtitle">إدارة هوية المنشأة والشعار الشفاف، الباقات والترخيص، الطابعات، والأمان</p>
          </div>
        </div>

        <div className="settings-header__visual">
          <div className="settings-header__orbit"><span /><i /><b><Building2 size={18} /></b></div>
          <div className="settings-header__visual-copy">
            <span>مساحة التشغيل</span>
            <strong>{user?.tenantName || 'كافيو'}</strong>
            <small>{usage?.planDisplayName || user?.planDisplayName || 'فترة تجريبية'} · {tenantSlug}</small>
          </div>
        </div>
      </div>

      {/* ── Glass Tabs Navigation Bar ── */}
      <div className="settings-workspace">
      <aside className="settings-tabs-bar">
        <div className="settings-tabs-bar__label"><span>SETTINGS</span><strong>مركز الإعدادات</strong><small>اختر مساحة للعمل عليها</small></div>
        {role === ROLES.ADMIN && (
          <>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'facility' ? 'settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('facility')}
            >
              <span className="settings-tab-btn__icon"><Building2 size={16} /></span>
              <span className="settings-tab-btn__copy"><strong>هوية المنشأة</strong><small>الشعار وبيانات الفرع</small></span>
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'subscription' ? 'settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('subscription')}
            >
              <span className="settings-tab-btn__icon"><Crown size={16} /></span>
              <span className="settings-tab-btn__copy"><strong>الاشتراك والسعة</strong><small>الباقة وحدود الاستخدام</small></span>
              {usage?.daysRemaining <= 5 && <span className="settings-tab-badge">تجديد</span>}
            </button>
          </>
        )}
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'security' ? 'settings-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <span className="settings-tab-btn__icon"><KeyRound size={16} /></span>
          <span className="settings-tab-btn__copy"><strong>الحساب والأمان</strong><small>الدخول وكلمة المرور</small></span>
        </button>
        {role === ROLES.ADMIN && (
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'hardware' ? 'settings-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('hardware')}
          >
            <span className="settings-tab-btn__icon"><MessageCircle size={16} /></span>
            <span className="settings-tab-btn__copy"><strong>الأجهزة والتكاملات</strong><small>الطباعة والتنبيهات</small></span>
          </button>
        )}
      </aside>

      <div className="settings-workspace__main">

      <section className={`settings-context-panel is-${SETTINGS_TAB_META[activeTab]?.tone || 'amber'}`}>
        <div className="settings-context-panel__index">{SETTINGS_TAB_META[activeTab]?.index}</div>
        <div className="settings-context-panel__copy">
          <span>CONFIGURATION WORKSPACE</span>
          <h2>{SETTINGS_TAB_META[activeTab]?.label}</h2>
          <p>{SETTINGS_TAB_META[activeTab]?.description}</p>
        </div>
        <div className="settings-context-panel__health">
          <span className="settings-context-panel__health-dot" />
          <div><strong>النظام يعمل بشكل طبيعي</strong><small>آخر مزامنة: الآن</small></div>
        </div>
        {role === ROLES.ADMIN && (
          <div className="settings-context-panel__account">
            <span>الباقة الحالية</span><strong>{loadingUsage ? 'جاري التحقق…' : (usage?.planDisplayName || user?.planDisplayName || 'تجريبية')}</strong><small>{usage?.daysRemaining ?? 14} يوم متبقي</small>
          </div>
        )}
      </section>

      {/* ── TAB 1: FACILITY & LOGO ── */}
      {activeTab === 'facility' && (
        <div className="settings-grid settings-grid--facility">
          {/* ── Card 1: Logo & Visual Identity ── */}
          <div className="section-card settings-logo-card">
            <div className="section-card__header">
              <div className="section-card__icon-wrap">
                <Image size={18} className="text-accent" />
              </div>
              <div>
                <h2 className="section-card__title">شعار المنشأة والهوية البصرية</h2>
                <p className="section-card__subtitle">تفريغ الخلفية تلقائياً ليظهر الشعار كـ PNG شفاف في الفواتير والسيستم</p>
              </div>
            </div>

            <div className="settings-logo-body">
              <div className="settings-logo-preview-frame checkerboard-bg">
                {logoPreview ? (
                  <img src={logoPreview} alt="Cafe Logo" className="settings-logo-preview-img" />
                ) : (
                  <div className="settings-logo-placeholder">
                    <Image size={40} style={{ opacity: 0.35 }} />
                    <span>لا يوجد شعار</span>
                  </div>
                )}
                {logoPreview && (
                  <span className="logo-floating-tag">PNG شفاف ✨</span>
                )}
              </div>

              <div className="settings-logo-controls">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  style={{ display: 'none' }}
                />

                <div className="settings-logo-btn-stack">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                    rightIcon={<Upload size={16} />}
                    className="settings-logo-action settings-logo-action--upload"
                  >
                    رفع شعار جديد
                  </Button>

                  {logoPreview && (
                    <Button
                      type="button"
                      variant="secondary"
                      rightIcon={<Wand2 size={16} />}
                      onClick={() => {
                        setRawUploadedImage(logoPreview);
                        setBgRemovalMode('auto');
                        setBgTolerance(38);
                        setBgFeather(18);
                        setIsBgRemoverOpen(true);
                        runBackgroundRemoval(logoPreview, 'auto', 38, 18, true, true);
                      }}
                      className="settings-logo-action settings-logo-action--studio"
                    >
                      تحسين الشعار
                    </Button>
                  )}
                </div>

                {logoPreview && (
                  <div className="settings-logo-footer-actions">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      rightIcon={<Check size={15} />}
                      onClick={handleSaveLogo}
                      loading={isSavingLogo}
                      className="settings-logo-save"
                    >
                      حفظ الشعار
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={isSavingLogo}
                      rightIcon={<Trash2 size={14} />}
                      className="settings-logo-delete"
                      title="حذف الشعار الحالي"
                    >
                      حذف
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Card 2: Branch Operational Details ── */}
          <div className="section-card">
            <div className="section-card__header">
              <div className="section-card__icon-wrap">
                <Building2 size={18} className="text-accent" />
              </div>
              <div>
                <h2 className="section-card__title">تفاصيل وبيانات الفرع</h2>
                <p className="section-card__subtitle">البيانات الأساسية المسجلة للفرع والعملة التشغيلية</p>
              </div>
            </div>

            <div className="settings-tiles-grid">
              <div className="settings-tile-item">
                <span className="settings-tile-item__label">اسم المنشأة</span>
                <strong className="settings-tile-item__val">{user?.tenantName || 'كافيه ونس'}</strong>
              </div>
              <div className="settings-tile-item">
                <span className="settings-tile-item__label">معرف الفرع (Slug)</span>
                <strong className="settings-tile-item__val font-mono text-accent">{tenantSlug}</strong>
              </div>
              <div className="settings-tile-item">
                <span className="settings-tile-item__label">العملة الافتراضية</span>
                <strong className="settings-tile-item__val">الجنيه المصري (EGP)</strong>
              </div>
              <div className="settings-tile-item">
                <span className="settings-tile-item__label">المنطقة الزمنية</span>
                <strong className="settings-tile-item__val">Africa / Cairo (GMT+3)</strong>
              </div>
            </div>
          </div>

          {/* ── Card 3: System Engine & Updates ── */}
          <div className="section-card">
            <div className="section-card__header">
              <div className="section-card__icon-wrap">
                <RefreshCw size={18} className="text-accent" />
              </div>
              <div>
                <h2 className="section-card__title">محرك النظام والتحديثات</h2>
                <p className="section-card__subtitle">حالة الإصدار الحالي ومزامنة التحديثات السحابية</p>
              </div>
            </div>

            <div className="settings-version-box">
              <div className="settings-version-row">
                <span className="settings-version-label">الإصدار الحالي:</span>
                <span className="settings-version-badge">v1.0.0 Stable ✓</span>
              </div>

              {updateStatus ? (
                <div className="settings-update-alert">
                  {updateStatus.message}
                </div>
              ) : (
                <p className="text-xs text-muted">أنت تعمل على النسخة الرسمية المستقرة مع كافة ميزات الكاشير السحابي.</p>
              )}

              <Button
                type="button"
                variant="secondary"
                onClick={handleCheckUpdates}
                loading={checkingUpdate}
                className="w-full justify-center mt-2"
              >
                <RefreshCw size={15} /> فحص وجود تحديثات جديدة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIPTION & LICENSES */}
      {activeTab === 'subscription' && (
        <div className="settings-sub-wrapper">
          {/* Active Plan Overview Banner */}
          <div className="settings-plan-overview-card">
            <div className="settings-plan-overview-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="settings-plan-icon-wrap">
                  <Crown size={28} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="settings-plan-name">{usage?.planDisplayName || user?.planDisplayName || 'فترة تجريبية'}</h3>
                    <span className={`badge ${usage?.status === 'ACTIVE' ? 'badge--success' : usage?.status === 'TRIAL' ? 'badge--warning' : 'badge--danger'}`}>
                      {usage?.status === 'ACTIVE' ? 'اشتراك نشط ✓' : usage?.status === 'TRIAL' ? 'فترة تجريبية' : 'منتهي'}
                    </span>
                  </div>
                  <p className="settings-plan-subtext">
                    المتبقي في الاشتراك الحالي: <strong style={{ color: 'var(--accent)' }}>{usage?.daysRemaining ?? 14} يوم</strong>
                  </p>
                </div>
              </div>

              <a
                href={getWhatsAppUpgradeUrl('تجديد أو ترقية الاشتراك', 'مخصص')}
                target="_blank"
                rel="noopener noreferrer"
                className="settings-upgrade-wa-btn"
              >
                <MessageCircle size={16} /> تواصل لتجديد أو ترقية الاشتراك
              </a>
            </div>

            {/* Live Quota Gauges */}
            <div className="settings-quotas-grid">
              {/* Tables Quota */}
              <div className="settings-quota-box">
                <div className="settings-quota-header">
                  <span>الطاولات</span>
                  <strong>{usage?.tablesUsed ?? 0} / {usage?.maxTables === 9999 ? 'غير محدود' : (usage?.maxTables ?? 5)}</strong>
                </div>
                <div className="settings-quota-bar">
                  <div
                    className="settings-quota-fill"
                    style={{
                      width: `${Math.min(100, Math.round(((usage?.tablesUsed ?? 0) / (usage?.maxTables || 5)) * 100))}%`,
                      background: (usage?.tablesUsed ?? 0) >= (usage?.maxTables || 5) ? 'var(--danger)' : 'var(--accent)'
                    }}
                  />
                </div>
              </div>

              {/* Users Quota */}
              <div className="settings-quota-box">
                <div className="settings-quota-header">
                  <span>المستخدمين والموظفين</span>
                  <strong>{usage?.usersUsed ?? 0} / {usage?.maxUsers === 9999 ? 'غير محدود' : (usage?.maxUsers ?? 2)}</strong>
                </div>
                <div className="settings-quota-bar">
                  <div
                    className="settings-quota-fill"
                    style={{
                      width: `${Math.min(100, Math.round(((usage?.usersUsed ?? 0) / (usage?.maxUsers || 2)) * 100))}%`,
                      background: (usage?.usersUsed ?? 0) >= (usage?.maxUsers || 2) ? 'var(--danger)' : '#10b981'
                    }}
                  />
                </div>
              </div>

              {/* Products Quota */}
              <div className="settings-quota-box">
                <div className="settings-quota-header">
                  <span>أصناف المنيو</span>
                  <strong>{usage?.productsUsed ?? 0} / {usage?.maxProducts === 9999 ? 'غير محدود' : (usage?.maxProducts ?? 30)}</strong>
                </div>
                <div className="settings-quota-bar">
                  <div
                    className="settings-quota-fill"
                    style={{
                      width: `${Math.min(100, Math.round(((usage?.productsUsed ?? 0) / (usage?.maxProducts || 30)) * 100))}%`,
                      background: (usage?.productsUsed ?? 0) >= (usage?.maxProducts || 30) ? 'var(--danger)' : '#3b82f6'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* License Key Self-Service Activation Card */}
          <div className="section-card" style={{ marginTop: '20px' }}>
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key size={18} style={{ color: 'var(--accent)' }} /> تفعيل مفتاح الترخيص (License Key)
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              إذا كان لديك كود ترخيص أو تجديد من إدارة النظام، أدخله هنا لتفعيل وترقية باقتك فوراً.
            </p>

            <form onSubmit={handleActivateLicense} className="settings-license-form">
              <input
                type="text"
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
                placeholder="CAFF-XXXX-XXXX-XXXX"
                className="settings-license-input"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '2px', textTransform: 'uppercase' }}
              />
              <Button type="submit" variant="primary" loading={isActivatingLicense}>
                <Sparkles size={15} /> تفعيل الترخيص الآن
              </Button>
            </form>
          </div>

          {/* Plan Comparison Matrix */}
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '28px 0 16px', color: 'var(--text-primary)' }}>
            باقات الاشتراك السحابية والمحلية
          </h3>

          <div className="settings-plans-grid">
            {/* Starter Plan */}
            <div className="settings-plan-card">
              <div className="settings-plan-card-header">
                <h4>باقة الكافيه الأساسية</h4>
                <div className="settings-plan-price">499 <span>ج.م / شهرياً</span></div>
              </div>
              <ul className="settings-plan-features">
                <li><CheckCircle size={14} color="#10b981" /> حتى 20 طاولة</li>
                <li><CheckCircle size={14} color="#10b981" /> حتى 5 مستخدمين / كاشيرات</li>
                <li><CheckCircle size={14} color="#10b981" /> حتى 100 صنف منيو</li>
                <li><CheckCircle size={14} color="#10b981" /> إدارة المصاريف والعهد</li>
                <li className="disabled">✕ شاشة تحضير المطبخ KDS</li>
                <li className="disabled">✕ دعم الفروع المتعددة</li>
              </ul>
              <a
                href={getWhatsAppUpgradeUrl('باقة الكافيه الأساسية', 499)}
                target="_blank"
                rel="noopener noreferrer"
                className="settings-plan-btn"
              >
                طلب الباقة الأساسية <ArrowUpRight size={14} />
              </a>
            </div>

            {/* Pro Plan */}
            <div className="settings-plan-card settings-plan-card--featured">
              <div className="settings-plan-badge">الأكثر طلباً ⭐</div>
              <div className="settings-plan-card-header">
                <h4>الباقة الاحترافية (PRO)</h4>
                <div className="settings-plan-price">899 <span>ج.م / شهرياً</span></div>
              </div>
              <ul className="settings-plan-features">
                <li><CheckCircle size={14} color="#10b981" /> حتى 50 طاولة</li>
                <li><CheckCircle size={14} color="#10b981" /> حتى 15 مستخدم</li>
                <li><CheckCircle size={14} color="#10b981" /> حتى 500 صنف منيو</li>
                <li><CheckCircle size={14} color="#10b981" /> شاشة تحضير المطبخ KDS</li>
                <li><CheckCircle size={14} color="#10b981" /> تعدد الخزائن وتعدد الكاشيرات</li>
                <li><CheckCircle size={14} color="#10b981" /> تنبيهات واتساب اليومية</li>
              </ul>
              <a
                href={getWhatsAppUpgradeUrl('الباقة الاحترافية (PRO)', 899)}
                target="_blank"
                rel="noopener noreferrer"
                className="settings-plan-btn settings-plan-btn--featured"
              >
                ترقية إلى الباقة الاحترافية <ArrowUpRight size={14} />
              </a>
            </div>

            {/* Enterprise Plan */}
            <div className="settings-plan-card">
              <div className="settings-plan-card-header">
                <h4>الباقة الشاملة (ENTERPRISE)</h4>
                <div className="settings-plan-price">1499 <span>ج.م / شهرياً</span></div>
              </div>
              <ul className="settings-plan-features">
                <li><CheckCircle size={14} color="#10b981" /> طاولات غير محدودة ♾</li>
                <li><CheckCircle size={14} color="#10b981" /> مستخدمين غير محدودين ♾</li>
                <li><CheckCircle size={14} color="#10b981" /> أصناف منيو غير محدودة ♾</li>
                <li><CheckCircle size={14} color="#10b981" /> كافة الميزات الاحترافية</li>
                <li><CheckCircle size={14} color="#10b981" /> ترخيص دائم متاح (Lifetime)</li>
                <li><CheckCircle size={14} color="#10b981" /> أولوية في الدعم الفني 24/7</li>
              </ul>
              <a
                href={getWhatsAppUpgradeUrl('الباقة الشاملة (ENTERPRISE)', 1499)}
                target="_blank"
                rel="noopener noreferrer"
                className="settings-plan-btn"
              >
                طلب الباقة الشاملة <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & ACCOUNT */}
      {activeTab === 'security' && (
        <div className="settings-grid">
          {/* User Profile */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} /> بيانات الحساب
            </h2>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">الاسم بالكامل</span>
                <span className="settings-info-value">{user?.fullName}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">اسم المستخدم</span>
                <span className="settings-info-value">{user?.username}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">الصلاحية</span>
                <span className="settings-info-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} style={{ color: 'var(--accent)' }} /> {role}
                </span>
              </div>
            </div>
          </div>

          {/* Change Password Form */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} /> تغيير كلمة المرور
            </h2>
            <form onSubmit={handlePasswordChange} className="form-grid">
              <Input
                label="كلمة المرور الحالية"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
              <Input
                label="كلمة المرور الجديدة"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                hint="على الأقل 6 حروف أو أرقام"
              />
              <Input
                label="تأكيد كلمة المرور الجديدة"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />
              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button type="submit" loading={isSavingPassword}>تحديث كلمة المرور</Button>
              </div>
            </form>
          </div>

          {/* Change PIN Form */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
              <Key size={18} /> تعيين / تغيير رمز PIN للدخول السريع
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              رمز PIN يتيح لك ولطاقم العمل تسجيل الدخول السريع بضغطة زر واحدة دون الحاجة لكتابة اسم المستخدم وكلمة المرور كل مرة.
            </p>
            <form onSubmit={handlePinChange} className="form-grid">
              <Input
                label="رمز PIN الجديد (4 - 8 أرقام)"
                type="password"
                value={pinForm.newPin}
                onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
                placeholder="مثال: 1234"
                maxLength={8}
                required
              />
              <Input
                label="تأكيد رمز PIN"
                type="password"
                value={pinForm.confirmPin}
                onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value })}
                placeholder="أعد كتابة نفس الرمز"
                maxLength={8}
                required
              />
              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button type="submit" variant="primary" loading={isSavingPin}>حفظ وتفعيل رمز PIN</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: HARDWARE & WHATSAPP */}
      {activeTab === 'hardware' && (
        <div className="settings-grid">
          <PrinterSettings />

          {/* WhatsApp Alerts Card */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25d366' }}>
              <MessageCircle size={18} /> تنبيهات وتقارير واتساب
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              قم بتفعيل استلام التنبيهات والتقارير الهامة مباشرة على رقم واتساب الخاص بالمالك أو المشرف.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); toast.success('تم حفظ إعدادات واتساب بنجاح'); }} className="form-grid">
              <Input
                label="رقم هاتف المالك (مع رمز الدولة)"
                placeholder="مثال: +201112633164"
                defaultValue={user?.phone || ''}
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#25d366', width: '16px', height: '16px' }} />
                  تقرير إغلاق الوردية والملخص المالي
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#25d366', width: '16px', height: '16px' }} />
                  تنبيه عند نفاذ المنتجات من المخزن
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" style={{ accentColor: '#25d366', width: '16px', height: '16px' }} />
                  تنبيه الفواتير المرتجعة أو الملغاة
                </label>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button type="submit" variant="primary" style={{ background: '#25d366', color: '#fff', border: 'none' }}>
                  حفظ إعدادات واتساب
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
      </div>

      {/* ── AI Logo Background Removal Modal ── */}
      <Modal
        isOpen={isBgRemoverOpen}
        onClose={() => setIsBgRemoverOpen(false)}
        title="تفريغ وتحويل الشعار إلى PNG شفاف 🪄"
        icon="🪄"
        subtitle="إزالة الخلفية البيضاء أو الملونة وتنعيم الحواف ليظهر الشعار باحترافية في السيستم والفواتير"
        size="lg"
      >
        <div className="bg-remover-modal-body">
          <div className="logo-studio-toolbar">
            <div className="logo-studio-compare" aria-label="المقارنة بين الصورة الأصلية والنتيجة">
              <button type="button" className={logoPreviewMode === 'before' ? 'active' : ''} onClick={() => setLogoPreviewMode('before')}><Columns2 size={13} /> قبل</button>
              <button type="button" className={logoPreviewMode === 'after' ? 'active' : ''} onClick={() => setLogoPreviewMode('after')}><CheckCircle2 size={13} /> بعد</button>
            </div>
            <div className="logo-studio-tools">
              <button type="button" onClick={() => setLogoPreviewZoom(value => Math.max(60, value - 10))} title="تصغير"><ZoomOut size={14} /></button>
              <span>{logoPreviewZoom}%</span>
              <button type="button" onClick={() => setLogoPreviewZoom(value => Math.min(180, value + 10))} title="تكبير"><ZoomIn size={14} /></button>
              <i />
              <button type="button" onClick={handleResetLogoStudio} title="إعادة الضبط"><RotateCcw size={14} /></button>
              <button type="button" onClick={handleDownloadProcessedLogo} disabled={!processedDataUrl || isProcessingBg} title="تنزيل PNG"><Download size={14} /></button>
            </div>
          </div>

          {/* Preview Box with Mode Switcher */}
          <div className="bg-remover-preview-section">
            <div className="bg-remover-preview-tabs">
              <button
                type="button"
                className={`preview-tab-btn ${previewBgTheme === 'checkerboard' ? 'active' : ''}`}
                onClick={() => setPreviewBgTheme('checkerboard')}
              >
                🏁 شبكة الشفافية (PNG)
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${previewBgTheme === 'dark' ? 'active' : ''}`}
                onClick={() => setPreviewBgTheme('dark')}
              >
                🌙 شريط النظام الداكن
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${previewBgTheme === 'receipt' ? 'active' : ''}`}
                onClick={() => setPreviewBgTheme('receipt')}
              >
                🧾 الفاتورة المطبوعة (80mm)
              </button>
            </div>

            <div className={`bg-remover-preview-frame bg-remover-preview-frame--${previewBgTheme}`}>
              {isProcessingBg ? (
                <div className="bg-remover-spinner-wrap">
                  <Spinner />
                  <span>جاري إزالة الخلفية وتنعيم الحواف...</span>
                </div>
              ) : (logoPreviewMode === 'before' ? rawUploadedImage : processedDataUrl) ? (
                <img
                  src={logoPreviewMode === 'before' ? rawUploadedImage : processedDataUrl}
                  alt={logoPreviewMode === 'before' ? 'Original logo preview' : 'Transparent logo preview'}
                  className="bg-remover-result-img"
                  style={{ transform: `scale(${logoPreviewZoom / 100})` }}
                />
              ) : (
                <span className="text-muted">جاري المعالجة...</span>
              )}
            </div>
          </div>

          {/* Controls & Sliders */}
          <div className="bg-remover-controls-section">
            <div className="logo-studio-quality">
              <div className="logo-studio-quality__score"><CheckCircle2 size={15} /><span><strong>جاهز للاستخدام</strong><small>PNG شفاف مناسب للنظام والطباعة</small></span></div>
              <div className="logo-studio-quality__chips"><span>حواف ناعمة</span><span>{bgAutoTrim ? 'متمركز تلقائياً' : 'الحجم الأصلي'}</span><span>{bgFloodFill ? 'التفاصيل محمية' : 'تفريغ شامل'}</span></div>
            </div>
            <div className="control-group">
              <label className="control-group__label">نمط التفريغ:</label>
              <div className="bg-mode-pills">
                <button
                  type="button"
                  className={`mode-pill ${bgRemovalMode === 'auto' ? 'mode-pill--active' : ''}`}
                  onClick={() => {
                    setBgRemovalMode('auto');
                    runBackgroundRemoval(rawUploadedImage, 'auto', bgTolerance, bgFeather, bgFloodFill, bgAutoTrim);
                  }}
                >
                  <Wand2 size={13} />
                  <span>تلقائي ذكي (Auto)</span>
                </button>
                <button
                  type="button"
                  className={`mode-pill ${bgRemovalMode === 'white' ? 'mode-pill--active' : ''}`}
                  onClick={() => {
                    setBgRemovalMode('white');
                    runBackgroundRemoval(rawUploadedImage, 'white', bgTolerance, bgFeather, bgFloodFill, bgAutoTrim);
                  }}
                >
                  <span>⚪ خلفية بيضاء</span>
                </button>
                <button
                  type="button"
                  className={`mode-pill ${bgRemovalMode === 'black' ? 'mode-pill--active' : ''}`}
                  onClick={() => {
                    setBgRemovalMode('black');
                    runBackgroundRemoval(rawUploadedImage, 'black', bgTolerance, bgFeather, bgFloodFill, bgAutoTrim);
                  }}
                >
                  <span>⚫ خلفية سوداء</span>
                </button>
                <button
                  type="button"
                  className={`mode-pill ${bgRemovalMode === 'original' ? 'mode-pill--active' : ''}`}
                  onClick={() => {
                    setBgRemovalMode('original');
                    runBackgroundRemoval(rawUploadedImage, 'original', bgTolerance, bgFeather, bgFloodFill, bgAutoTrim);
                  }}
                >
                  <span>🖼️ الأصلية</span>
                </button>
              </div>
            </div>

            {bgRemovalMode !== 'original' && (
              <>
                <div className="control-slider-box">
                  <div className="slider-header">
                    <span>حساسية التسامح (Tolerance):</span>
                    <strong className="font-mono text-accent">{bgTolerance}%</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="90"
                    value={bgTolerance}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBgTolerance(val);
                      runBackgroundRemoval(rawUploadedImage, bgRemovalMode, val, bgFeather, bgFloodFill, bgAutoTrim);
                    }}
                    className="bg-range-slider"
                  />
                  <span className="slider-hint">زيادة الحساسية تزيل درجات الألوان القريبة من الخلفية</span>
                </div>

                <div className="control-slider-box">
                  <div className="slider-header">
                    <span>تنعيم الحواف (Feathering):</span>
                    <strong className="font-mono text-accent">{bgFeather}px</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    value={bgFeather}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBgFeather(val);
                      runBackgroundRemoval(rawUploadedImage, bgRemovalMode, bgTolerance, val, bgFloodFill, bgAutoTrim);
                    }}
                    className="bg-range-slider"
                  />
                  <span className="slider-hint">لتجنب الحواف الخشنة وجعل الشعار ناعماً ومتدرجاً</span>
                </div>

                <div className="control-toggles-row">
                  <label className="toggle-checkbox-label">
                    <input
                      type="checkbox"
                      checked={bgFloodFill}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setBgFloodFill(val);
                        runBackgroundRemoval(rawUploadedImage, bgRemovalMode, bgTolerance, bgFeather, val, bgAutoTrim);
                      }}
                    />
                    <span>حماية التفاصيل الداخلية (تفريغ الحواف الخارجية فقط)</span>
                  </label>

                  <label className="toggle-checkbox-label">
                    <input
                      type="checkbox"
                      checked={bgAutoTrim}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setBgAutoTrim(val);
                        runBackgroundRemoval(rawUploadedImage, bgRemovalMode, bgTolerance, bgFeather, bgFloodFill, val);
                      }}
                    />
                    <span>قص الحواف الفارغة وتوسيط اللوجو</span>
                  </label>
                </div>
              </>
            )}

            <div className="logo-studio-actions">
              <button type="button" className="logo-studio-download" onClick={handleDownloadProcessedLogo} disabled={!processedDataUrl || isProcessingBg}><Download size={15} /><span><strong>تنزيل نسخة</strong><small>PNG للاحتفاظ بها</small></span></button>
              <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsBgRemoverOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleApplyProcessedLogo}
                loading={isSavingLogo}
                rightIcon={<Check size={16} />}
              >
                اعتماد الشعار
              </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
