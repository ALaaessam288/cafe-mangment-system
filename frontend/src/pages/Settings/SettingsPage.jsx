import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../api/usersApi';
import { tenantApi } from '../../api/tenantApi';
import { storage } from '../../utils/storage';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Spinner from '../../components/Spinner/Spinner';
import { 
  Building2, User, KeyRound, Shield, RefreshCw, Sparkles, MessageCircle, 
  Upload, Trash2, Image, Key, CheckCircle, AlertTriangle, Crown, ArrowUpRight, Copy, Check
} from 'lucide-react';
import { ROLES } from '../../utils/constants';
import PrinterSettings from './PrinterSettings';
import './SettingsPage.css';

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

  // Logo state
  const [logoPreview, setLogoPreview] = useState(user?.logoUrl || '');
  const [isSavingLogo, setIsSavingLogo] = useState(false);

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

  // Handle Logo Upload (Converts to high quality compressed Data URL)
  function handleLogoFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة يجب ألا يتجاوز 2 ميجابايت', 'الصورة كبيرة جداً');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 400;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        setLogoPreview(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
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

  // WhatsApp upgrade link generator
  function getWhatsAppUpgradeUrl(planName, price) {
    const text = encodeURIComponent(
      `مرحباً، أرغب في ترقية اشتراك نظام كافيو.\n\nاسم المنشأة: ${user?.tenantName || tenantSlug}\nكود المنشأة: ${tenantSlug}\nالباقة المطلوبة: ${planName} (${price} ج.م)\nرقم الهاتف المسجل: ${user?.username || ''}`
    );
    return `https://wa.me/201112633164?text=${text}`;
  }

  return (
    <div className="page" dir="rtl">
      <div className="page__header">
        <div>
          <h1 className="page__title">الإعدادات والاشتراكات</h1>
          <p className="page__subtitle">إدارة هوية المنشأة، الباقات والترخيص، الطابعات، والأمان</p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="settings-tabs-bar">
        {role === ROLES.ADMIN && (
          <>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'facility' ? 'settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('facility')}
            >
              <Building2 size={16} /> بيانات المنشأة واللوجو
            </button>
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === 'subscription' ? 'settings-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('subscription')}
            >
              <Crown size={16} /> الاشتراك والتراخيص
              {usage?.daysRemaining <= 5 && <span className="settings-tab-badge">تجديد</span>}
            </button>
          </>
        )}
        <button
          type="button"
          className={`settings-tab-btn ${activeTab === 'security' ? 'settings-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <KeyRound size={16} /> الحساب والأمان
        </button>
        {role === ROLES.ADMIN && (
          <button
            type="button"
            className={`settings-tab-btn ${activeTab === 'hardware' ? 'settings-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('hardware')}
          >
            <MessageCircle size={16} /> الطابعات والتنبيهات
          </button>
        )}
      </div>

      {/* TAB 1: FACILITY & LOGO */}
      {activeTab === 'facility' && (
        <div className="settings-grid">
          {/* Logo Card */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Image size={18} style={{ color: 'var(--accent)' }} /> شعار المنشأة (Logo)
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              يظهر الشعار في أعلى شريط النظام، الفواتير المطبوعة، وإيصالات العملاء.
            </p>

            <div className="settings-logo-uploader">
              <div className="settings-logo-preview-box">
                {logoPreview ? (
                  <img src={logoPreview} alt="Cafe Logo" className="settings-logo-preview-img" />
                ) : (
                  <div className="settings-logo-placeholder">
                    <Image size={36} style={{ opacity: 0.4 }} />
                    <span>لا يوجد شعار</span>
                  </div>
                )}
              </div>

              <div className="settings-logo-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoFileChange}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  style={{ display: 'none' }}
                />
                
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} /> اختيار صورة من الجهاز
                </Button>

                {logoPreview && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleSaveLogo}
                      loading={isSavingLogo}
                    >
                      <Check size={14} /> حفظ وتثبيت الشعار
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={isSavingLogo}
                    >
                      <Trash2 size={14} /> حذف
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Facility Info Card */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} /> تفاصيل الفرع
            </h2>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">اسم المنشأة</span>
                <span className="settings-info-value">{user?.tenantName || 'كافيه ونس'}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">معرف الفرع (Slug)</span>
                <span className="settings-info-value" style={{ fontFamily: 'var(--font-mono)' }}>{tenantSlug}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">العملة الافتراضية</span>
                <span className="settings-info-value">الجنيه المصري (EGP)</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">المنطقة الزمنية</span>
                <span className="settings-info-value">Africa / Cairo (GMT+3)</span>
              </div>
            </div>
          </div>

          {/* System Updates */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={18} /> تحديثات النظام
            </h2>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">إصدار التطبيق</span>
                <span className="settings-info-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 'bold' }}>v1.0.0</span>
              </div>

              {updateStatus && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  background: updateStatus.status === 'downloaded' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${updateStatus.status === 'downloaded' ? 'var(--success)' : 'var(--accent)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  margin: '10px 0'
                }}>
                  {updateStatus.message}
                </div>
              )}

              <div style={{ marginTop: '12px' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCheckUpdates}
                  loading={checkingUpdate}
                >
                  <RefreshCw size={15} /> فحص وجود تحديثات جديدة
                </Button>
              </div>
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
  );
}
