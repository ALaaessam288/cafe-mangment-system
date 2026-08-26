import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Check, Coffee, ShieldCheck, Zap, Layers } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import { ROUTES } from '../../utils/constants';
import { authApi } from '../../api/authApi';
import { sounds } from '../../utils/soundEffects';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import './LoginPage.css';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const passwordInputRef = useRef(null);

  const [tenantSlug, setTenantSlug] = useState(() => storage.getTenantSlug() || '');
  const [tenants, setTenants] = useState([]);
  const [tenantUsers, setTenantUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [showAdvancedUsername, setShowAdvancedUsername] = useState(false);
  const [customUsername, setCustomUsername] = useState('');

  // Load tenants
  useEffect(() => {
    authApi.getTenants()
      .then((data) => {
        setTenants(data);
        setTenantSlug((prev) => {
          const stillValid = data.some((t) => t.slug === prev);
          if (stillValid) return prev;
          return data[0]?.slug || '';
        });
      })
      .catch((err) => {
        console.error('Failed to load tenants:', err);
      })
      .finally(() => {
        setLoadingTenants(false);
      });
  }, []);

  // Load active users when tenantSlug changes
  useEffect(() => {
    if (!tenantSlug) return;
    authApi.getTenantUsers(tenantSlug)
      .then((users) => {
        setTenantUsers(users || []);
      })
      .catch(() => {
        setTenantUsers([]);
      });
  }, [tenantSlug]);

  // Focus password input
  useEffect(() => {
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [selectedUser, showAdvancedUsername]);

  function handleNumpadKey(key) {
    sounds.playTap();
    setError('');
    if (key === 'clear') {
      setPassword('');
    } else if (key === 'backspace') {
      setPassword((prev) => prev.slice(0, -1));
    } else {
      setPassword((prev) => prev + key);
    }
    if (passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }

  function handleSelectUser(u) {
    sounds.playTap();
    setError('');
    if (selectedUser?.id === u?.id) {
      setSelectedUser(null);
    } else {
      setSelectedUser(u);
    }
    setPassword('');
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');

    if (!tenantSlug.trim()) {
      setError('يرجى اختيار مساحة العمل (الكافيه).');
      return;
    }

    if (!password.trim()) {
      sounds.playError();
      setError('يرجى إدخال كلمة السر.');
      if (passwordInputRef.current) passwordInputRef.current.focus();
      return;
    }

    const usernameToSend = showAdvancedUsername
      ? customUsername.trim()
      : selectedUser?.username;

    const result = await login(tenantSlug.trim(), usernameToSend, password);
    if (result.success) {
      sounds.playPaymentSuccess();
      navigate(result.defaultRoute, { replace: true });
    } else {
      sounds.playError();
      setError(result.message || 'كلمة السر غير صحيحة.');
      setPassword('');
      if (passwordInputRef.current) passwordInputRef.current.focus();
    }
  }

  const currentTenant = tenants.find((t) => t.slug === tenantSlug);

  return (
    <div className="login-page">
      {/* Background Ambient Glows */}
      <div className="login-bg-glow login-bg-glow--top" />
      <div className="login-bg-glow login-bg-glow--bottom" />

      <div className="login-container">
        {/* Right Hero Panel — Sleek Branding */}
        <div className="login-hero">
          <div className="login-hero__overlay" />
          <div className="login-hero__content">
            <div className="login-logo-halo">
              <div className="login-logo-box">
                <Coffee size={36} className="login-logo-icon" />
              </div>
            </div>

            <h1 className="login-hero__title">
              {currentTenant?.name || 'كافيو · Caffio'}
            </h1>
            <p className="login-hero__subtitle">
              نظام إدارة الكافيهات والمطاعم ونقاط البيع الذكي
            </p>

            <div className="login-hero__features">
              <div className="login-feature-card">
                <Zap size={18} className="login-feature-icon" />
                <span>تسجيل دخول فوري وسريع برمز PIN</span>
              </div>
              <div className="login-feature-card">
                <Coffee size={18} className="login-feature-icon" />
                <span>إدارة متكاملة للأوردرات والترابيزات</span>
              </div>
              <div className="login-feature-card">
                <Layers size={18} className="login-feature-icon" />
                <span>طباعة صامتة لمطبخ والبار والبونات</span>
              </div>
              <div className="login-feature-card">
                <ShieldCheck size={18} className="login-feature-icon" />
                <span>صلاحيات دقيقة وتأمين حسابات الشيفت</span>
              </div>
            </div>

            <div className="login-hero__badge">
              <span>اصدار الديسك توب والمباني v1.0.0</span>
            </div>
          </div>
        </div>

        {/* Left Form Panel — Interactive Form & Numpad */}
        <div className="login-form-section">
          <div className="login-card">
            
            {/* Header */}
            <div className="login-card__header">
              <h2 className="login-card__title">
                تسجيل الدخول السريع ⚡
              </h2>
              <p className="login-card__subtitle">
                {selectedUser
                  ? `مرحباً بك، ${selectedUser.fullName || selectedUser.username} 👋 أدخل كلمة السر للبدء`
                  : 'اختر حسابك وأدخل كلمة السر للبدء في العمل'}
              </p>
            </div>

            {/* Tenant Selector (If multiple tenants exist) */}
            {tenants.length > 1 && (
              <div className="login-tenant-select-wrap">
                <label htmlFor="tenantSlug" className="login-tenant-label">مساحة العمل / الكافيه:</label>
                <select
                  id="tenantSlug"
                  className="login-tenant-select"
                  value={tenantSlug}
                  onChange={(e) => { setTenantSlug(e.target.value); setSelectedUser(null); }}
                  disabled={loadingTenants}
                >
                  {tenants.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Staff Accounts Selector */}
            {!showAdvancedUsername && tenantUsers.length > 0 && (
              <div className="login-staff-section">
                <span className="login-section-label">حسابات الكافيه النشطة:</span>
                <div className="login-staff-grid">
                  {tenantUsers.map((u) => {
                    const isSelected = selectedUser?.id === u.id;
                    const isRoleAdmin = u.role === 'ADMIN';
                    const isRoleSupervisor = u.role === 'SUPERVISOR';
                    
                    const roleTag = isRoleAdmin ? 'مالك المنشأة' : isRoleSupervisor ? 'مشرف العمليات' : 'كاشير';
                    const badgeClass = isRoleAdmin ? 'badge-admin' : isRoleSupervisor ? 'badge-supervisor' : 'badge-cashier';

                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`login-user-card ${isSelected ? 'login-user-card--selected' : ''}`}
                        onClick={() => handleSelectUser(u)}
                      >
                        <div className="login-user-avatar">
                          {(u.fullName || u.username)?.[0]?.toUpperCase()}
                        </div>
                        <div className="login-user-details">
                          <span className="login-user-name">{u.fullName || u.username}</span>
                          <span className={`login-user-badge ${badgeClass}`}>{roleTag}</span>
                        </div>
                        {isSelected && <Check size={16} className="login-user-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="login-error-alert" role="alert">
                <span className="login-error-icon">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form & Inputs */}
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              
              {/* Optional Custom Username for Advanced Login */}
              {showAdvancedUsername && (
                <Input
                  label="اسم المستخدم"
                  name="username"
                  id="username"
                  value={customUsername}
                  onChange={(e) => { setError(''); setCustomUsername(e.target.value); }}
                  placeholder="أدخل اسم المستخدم الحساب"
                  autoComplete="username"
                  rightIcon={<User size={16} />}
                  required
                />
              )}

              {/* Password Field */}
              <div className="login-password-input-wrap">
                <Input
                  ref={passwordInputRef}
                  label="كلمة السر أو الرقم السري (PIN)"
                  name="password"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setError(''); setPassword(e.target.value); }}
                  placeholder="أدخل كلمة السر هنا..."
                  autoComplete="current-password"
                  rightIcon={<Lock size={18} />}
                  leftIcon={
                    <span
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                      role="button"
                      tabIndex={0}
                      className="login-eye-btn"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </span>
                  }
                  required
                />
              </div>

              {/* Touch Numeric Keypad */}
              <div className="login-numpad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => handleNumpadKey(n.toString())}
                    className="login-numpad-key"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleNumpadKey('clear')}
                  className="login-numpad-key login-numpad-key--danger"
                  title="مسح الكود"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpadKey('0')}
                  className="login-numpad-key"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleNumpadKey('backspace')}
                  className="login-numpad-key login-numpad-key--action"
                  title="حذف الرقم الأخير"
                >
                  ⌫
                </button>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                size="lg"
                loading={isLoading}
                className="login-submit-btn"
                disabled={password.length === 0}
              >
                {isLoading ? 'جاري التحقق والدخول...' : 'تسجيل الدخول وإطلاق الشيفت 🚀'}
              </Button>

              {/* Advanced Mode Toggle */}
              <button
                type="button"
                className="login-advanced-toggle"
                onClick={() => {
                  setShowAdvancedUsername((prev) => !prev);
                  setSelectedUser(null);
                  setError('');
                }}
              >
                {showAdvancedUsername ? '⚡ الرجوع للدخول السريع بالحسابات' : '⚙️ دخول باسم مستخدم مخصص (متقدم)'}
              </button>
            </form>

            <div className="login-card-footer">
              معندكش كافيه مسجل؟ <Link to={ROUTES.REGISTER}>افتح حساب كافيه جديد مجاناً</Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
