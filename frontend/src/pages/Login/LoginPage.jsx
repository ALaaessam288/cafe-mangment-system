import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Building2, Sparkles, Check, ChevronDown } from 'lucide-react';
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
  const [selectedUser, setSelectedUser] = useState(null); // null = direct password login for any user
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
    <div className="login">
      {/* Left Panel — Brand */}
      <div className="login__brand">
        <div className="login__brand-content">
          <div className="login__logo">
            <svg viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="#f59e0b" opacity="0.12" />
              <circle cx="32" cy="32" r="24" fill="#f59e0b" opacity="0.18" />
              <path
                d="M20 28c0-6.627 5.373-12 12-12s12 5.373 12 12c0 4.418-2.4 8.28-5.96 10.37L38 44H26l-.04-5.63C22.4 36.28 20 32.42 20 28z"
                fill="#f59e0b"
              />
              <rect x="26" y="44" width="12" height="4" rx="2" fill="#f59e0b" opacity="0.8" />
              <path d="M29 32 L31 30 L33 34 L35 28" stroke="#0b0d13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="login__brand-name">{currentTenant?.name || 'كافيو'}</h1>
          <p className="login__brand-tagline">نظام الكاشير ونقطة البيع</p>

          <div className="login__features">
            {['تسجيل دخول فوري بكلمة السر', 'إدارة سريعة للأوردرات والترابيزات', 'دعم شاشات اللمس والمؤثرات الصوتية', 'صلاحيات متعددة للكاشير والإدارة'].map((f) => (
              <div key={f} className="login__feature">
                <span className="login__feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Fast Password Form */}
      <div className="login__panel">
        <div className="login__form-wrap animate-fade-in-up">
          
          {/* Header */}
          <div className="login__header">
            <h2 className="login__title">تسجيل الدخول السريع ⚡</h2>
            <p className="login__subtitle">
              {selectedUser
                ? `أهلاً، ${selectedUser.fullName || selectedUser.username} 👋 دخل كلمة السر للبدء`
                : 'أدخل كلمة السر الخاصة بك للدخول فوراً'}
            </p>
          </div>

          {/* Tenant Selector (if multiple tenants exist) */}
          {tenants.length > 1 && (
            <div className="login__tenant-bar">
              <label htmlFor="tenantSlug" className="login__tenant-label">الكافيه / الفرع:</label>
              <select
                id="tenantSlug"
                className="login__tenant-select"
                value={tenantSlug}
                onChange={(e) => { setTenantSlug(e.target.value); setSelectedUser(null); }}
                disabled={loadingTenants}
              >
                {tenants.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Staff Avatars Grid */}
          {!showAdvancedUsername && tenantUsers.length > 0 && (
            <div className="login__staff-section">
              <div className="login__staff-label">المستخدمين:</div>
              <div className="login__staff-grid">
                {tenantUsers.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  const roleArabic = u.role === 'ADMIN' ? 'صلاحيات المشاهدة (أدمن)' : u.role === 'SUPERVISOR' ? 'مشرف' : 'كاشير';
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={`login__staff-card ${isSelected ? 'login__staff-card--active' : ''}`}
                      onClick={() => handleSelectUser(u)}
                    >
                      <div className="login__staff-avatar">
                        {(u.fullName || u.username)?.[0]?.toUpperCase()}
                      </div>
                      <div className="login__staff-info">
                        <span className="login__staff-name">{u.fullName || u.username}</span>
                        <span className="login__staff-role">{roleArabic}</span>
                      </div>
                      {isSelected && <Check size={14} className="login__staff-check" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="login__error" role="alert">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Main Login Form */}
          <form className="login__form" onSubmit={handleSubmit} noValidate>
            
            {/* Optional Manual Username Input in Advanced Mode */}
            {showAdvancedUsername && (
              <Input
                label="اسم المستخدم"
                name="username"
                id="username"
                value={customUsername}
                onChange={(e) => { setError(''); setCustomUsername(e.target.value); }}
                placeholder="دخل اسم المستخدم"
                autoComplete="username"
                rightIcon={<User size={15} />}
                required
              />
            )}

            {/* Prominent Password Field */}
            <div className="login__password-wrap">
              <Input
                ref={passwordInputRef}
                label="كلمة السر أو الرقم السري"
                name="password"
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setError(''); setPassword(e.target.value); }}
                placeholder="أدخل كلمة السر هنا..."
                autoComplete="current-password"
                rightIcon={<Lock size={16} />}
                leftIcon={
                  <span
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </span>
                }
                required
              />
            </div>

            {/* Quick Touch Numpad for Screen/Touchpad */}
            <div className="login__numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => handleNumpadKey(n.toString())}
                  className="login__numpad-btn"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNumpadKey('clear')}
                className="login__numpad-btn login__numpad-btn--action"
                title="مسح"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleNumpadKey('0')}
                className="login__numpad-btn"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleNumpadKey('backspace')}
                className="login__numpad-btn login__numpad-btn--action"
                title="حذف آخر رقم"
              >
                ⌫
              </button>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              loading={isLoading}
              className="login__submit"
              disabled={password.length === 0}
            >
              {isLoading ? 'جاري التحقق والدخول...' : 'تسجيل الدخول 🚀'}
            </Button>

            {/* Advanced Toggle */}
            <button
              type="button"
              className="login__toggle-advanced"
              onClick={() => {
                setShowAdvancedUsername((prev) => !prev);
                setSelectedUser(null);
                setError('');
              }}
            >
              {showAdvancedUsername ? 'الرجوع للدخول السريع بالباسورد ⚡' : 'دخول باسم مستخدم مخصص (متقدم) ⚙️'}
            </button>
          </form>

          <div className="login-footer">
            معندكش مساحة عمل؟ <Link to={ROUTES.REGISTER}>اعمل واحدة دلوقتي</Link>
          </div>

          <p className="login__footer-note">
            نظام كافيو لإدارة الكافيهات · v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
