import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, Utensils, Store, Eye, EyeOff, CheckCircle } from 'lucide-react';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import { tenantApi } from '../../api/tenantApi';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import './SetupWizard.css';

export default function SetupWizard() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    tenantName: '',
    tenantSlug: '',
    businessType: 'CAFE', // CAFE, RESTAURANT, BOTH
    whatsapp: '',
    ownerName: '',
    username: '',
    password: '',
    confirmPassword: '',
    tablesCount: 5,
    menuTemplate: 'CLASSIC_CAFE', // CLASSIC_CAFE, EGYPTIAN_RESTO, BOTH, EMPTY
  });

  const [showPassword, setShowPassword] = useState(false);

  const handleNext = () => {
    if (step < 5) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    // basic auto-slug: lower case, replace spaces with hyphen, remove non-alphanumeric
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    setFormData({
      ...formData,
      tenantName: val,
      tenantSlug: slug,
      username: slug ? `admin_${slug}`.substring(0, 15) : ''
    });
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const bType =
        formData.businessType === 'BOTH'
          ? 'CAFE_AND_RESTAURANT'
          : formData.businessType === 'RESTAURANT'
          ? 'RESTAURANT'
          : 'CAFE';

      const tpl =
        formData.menuTemplate === 'BOTH'
          ? 'CAFE_AND_RESTAURANT'
          : formData.menuTemplate === 'EGYPTIAN_RESTO'
          ? 'EGYPTIAN_RESTAURANT'
          : formData.menuTemplate === 'EMPTY'
          ? null
          : 'CLASSIC_CAFE';

      const payload = {
        name: formData.tenantName.trim(),
        slug: formData.tenantSlug.trim(),
        businessType: bType,
        ownerUsername: formData.username.trim(),
        ownerPassword: formData.password,
        ownerFullName: formData.ownerName ? formData.ownerName.trim() : formData.username.trim(),
        timezone: 'Africa/Cairo',
        currency: 'EGP',
        templateId: tpl,
        defaultTables: Number(formData.tablesCount) || 5,
      };

      await tenantApi.provision(payload);

      // auto-login with username and password
      const result = await login(payload.slug, payload.ownerUsername, payload.ownerPassword);
      if (result.success) {
        navigate(result.defaultRoute || ROUTES.POS);
      } else {
        setError(result.message || 'تم التأسيس بنجاح ولكن فشل تسجيل الدخول التلقائي');
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'حدث خطأ أثناء تأسيس المنشأة';
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="wizard-step animate-slide-in">
      <h2>عن كافيهك</h2>
      <p className="wizard-desc">خلينا نبدأ بالمعلومات الأساسية لمشروعك</p>

      <div className="wizard-form">
        <Input
          label="اسم الكافيه/المطعم"
          value={formData.tenantName}
          onChange={handleNameChange}
          placeholder="مثال: ستاربكس"
          required
        />
        <Input
          label="المعرف (Slug)"
          value={formData.tenantSlug}
          onChange={(e) => setFormData({ ...formData, tenantSlug: e.target.value.toLowerCase() })}
          hint="هيكون ده رابط الدخول الخاص بيك"
          dir="ltr"
          required
        />
        <Input
          label="رقم الواتساب"
          value={formData.whatsapp}
          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
          placeholder="01xxxxxxxxx"
          dir="ltr"
        />

        <div className="wizard-type-selector">
          <label className="field__label">نوع النشاط</label>
          <div className="type-cards">
            <button
              type="button"
              className={`type-card ${formData.businessType === 'CAFE' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, businessType: 'CAFE' })}
            >
              <Coffee size={32} />
              <span>كافيه</span>
            </button>
            <button
              type="button"
              className={`type-card ${formData.businessType === 'RESTAURANT' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, businessType: 'RESTAURANT' })}
            >
              <Utensils size={32} />
              <span>مطعم</span>
            </button>
            <button
              type="button"
              className={`type-card ${formData.businessType === 'BOTH' ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, businessType: 'BOTH' })}
            >
              <Store size={32} />
              <span>كافيه ومطعم</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="wizard-step animate-slide-in">
      <h2>حساب المدير</h2>
      <p className="wizard-desc">بيانات الحساب الرئيسي للتحكم في النظام</p>

      <div className="wizard-form">
        <Input
          label="الاسم بالكامل"
          value={formData.ownerName}
          onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
          required
        />
        <Input
          label="اسم المستخدم"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          dir="ltr"
          required
        />
        <Input
          label="كلمة المرور"
          type={showPassword ? 'text' : 'password'}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          rightIcon={
            <button
              type="button"
              className="pwd-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          dir="ltr"
          required
        />
        <Input
          label="تأكيد كلمة المرور"
          type={showPassword ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          error={formData.password !== formData.confirmPassword && formData.confirmPassword ? 'كلمة المرور غير متطابقة' : ''}
          dir="ltr"
          required
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="wizard-step animate-slide-in">
      <h2>طاولات كافيهك</h2>
      <p className="wizard-desc">حدد عدد الطاولات المتاحة عندك</p>

      <div className="wizard-form">
        <div className="table-presets">
          {[5, 10, 15].map(num => (
            <button
              key={num}
              type="button"
              className={`preset-btn ${formData.tablesCount === num ? 'active' : ''}`}
              onClick={() => setFormData({ ...formData, tablesCount: num })}
            >
              {num} طاولات
            </button>
          ))}
          <button
            type="button"
            className={`preset-btn ${![5, 10, 15].includes(formData.tablesCount) ? 'active' : ''}`}
            onClick={() => setFormData({ ...formData, tablesCount: 20 })}
          >
            مخصص
          </button>
        </div>

        {![5, 10, 15].includes(formData.tablesCount) && (
          <Input
            type="number"
            min="1"
            max="100"
            label="عدد الطاولات"
            value={formData.tablesCount}
            onChange={(e) => setFormData({ ...formData, tablesCount: parseInt(e.target.value) || 0 })}
          />
        )}

        <div className="tables-preview" aria-hidden>
          {Array.from({ length: Math.min(formData.tablesCount, 24) }).map((_, i) => (
            <div key={i} className="mini-table">T{i + 1}</div>
          ))}
          {formData.tablesCount > 24 && <div className="mini-table more">+{formData.tablesCount - 24}</div>}
        </div>

        <button type="button" className="skip-link" onClick={handleNext}>
          هضيفهم بعدين
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="wizard-step animate-slide-in">
      <h2>قائمة المنتجات</h2>
      <p className="wizard-desc">اختار القالب الأقرب لشغلك عشان نبدأ بيه</p>

      <div className="template-grid">
        {[
          { id: 'CLASSIC_CAFE', icon: '☕', title: 'كافيه كلاسيك', desc: 'مشروبات ساخنة، باردة، وحلويات', count: 25 },
          { id: 'EGYPTIAN_RESTO', icon: '🍽️', title: 'مطعم مصري', desc: 'مشويات، طواجن، ووجبات', count: 40 },
          { id: 'BOTH', icon: '🏪', title: 'كافيه ومطعم', desc: 'قائمة شاملة للكل', count: 60 },
          { id: 'EMPTY', icon: '📝', title: 'فاضي', desc: 'هبدأ من الصفر وأضيف منتجاتي', count: 0 },
        ].map(tpl => (
          <button
            key={tpl.id}
            type="button"
            className={`template-card ${formData.menuTemplate === tpl.id ? 'active' : ''}`}
            onClick={() => setFormData({ ...formData, menuTemplate: tpl.id })}
          >
            <span className="tpl-icon">{tpl.icon}</span>
            <h3>{tpl.title}</h3>
            <p>{tpl.desc}</p>
            <span className="tpl-count">{tpl.count} منتج</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="wizard-step animate-slide-in text-center">
      <div className="confetti-bg">
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
      </div>
      
      <div className="success-icon">
        <CheckCircle size={64} />
      </div>
      <h2>جاهز! 🎉</h2>
      <p className="wizard-desc">إعداداتك اتحفظت وحسابك جاهز للاستخدام</p>

      <div className="summary-box">
        <div className="summary-item">
          <span>اسم المكان</span>
          <strong>{formData.tenantName}</strong>
        </div>
        <div className="summary-item">
          <span>عدد الطاولات</span>
          <strong>{formData.tablesCount}</strong>
        </div>
        <div className="summary-item">
          <span>حساب المدير</span>
          <strong>{formData.username}</strong>
        </div>
      </div>

      <div className="trial-badge">
        فترتك التجريبية المجانية: 14 يوم
      </div>

      {error && <div className="setup-error">{error}</div>}

      <div className="final-actions">
        <Button size="lg" onClick={handleFinish} loading={isSubmitting} className="w-full">
          افتح أول شيفت وابدأ! 🚀
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => {}} disabled={isSubmitting}>
          اتعرف على النظام الأول
        </Button>
      </div>
    </div>
  );

  const isStepValid = () => {
    if (step === 1) return formData.tenantName && formData.tenantSlug;
    if (step === 2) return formData.ownerName && formData.username && formData.password && formData.password.length >= 8 && formData.password === formData.confirmPassword;
    return true;
  };

  return (
    <main className="setup-page">
      <div className="setup-container">
        {/* Brand Logo Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
          <img src="/caffio-logo.png" alt="Caffio" style={{ width: 44, height: 44, objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(245, 158, 11, 0.45))' }} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>Caffio Setup</span>
        </div>

        {/* Progress Bar */}
        <div className="setup-progress">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`progress-segment ${step > i ? 'active' : ''}`} />
          ))}
        </div>

        <div className="setup-content">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
          {step === 5 && renderStep5()}
        </div>

        {step < 5 && (
          <div className="setup-footer">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 1}
            >
              السابق
            </Button>
            <Button
              onClick={handleNext}
              disabled={!isStepValid()}
            >
              التالي
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
