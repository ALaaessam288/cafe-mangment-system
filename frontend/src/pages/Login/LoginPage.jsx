import { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, Lock, User, Eye, EyeOff, Coffee, HelpCircle, Hash } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import './LoginPage.css';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();

  // Detect tenant slug from route parameter /:tenantSlug/login or query ?tenant=slug / ?slug=slug
  const routeSlug = params.tenantSlug || searchParams.get('tenant') || searchParams.get('slug') || '';
  const [tenantSlug, setTenantSlug] = useState(routeSlug);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [forgotModal, setForgotModal] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const cleanSlug = (routeSlug || tenantSlug).trim().toLowerCase();
    const trimmedUsername = username.trim();
    if (!cleanSlug) {
      setError('يرجى إدخال كود الكافيه');
      return;
    }
    if (!trimmedUsername) {
      setError('يرجى إدخال اسم المستخدم');
      return;
    }
    if (!password) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    const result = await login(cleanSlug, trimmedUsername, password);
    if (result.success) {
      const requestedPath = location.state?.from?.pathname;
      navigate(requestedPath || result.defaultRoute || ROUTES.POS, { replace: true });
    } else {
      setError(result.message || 'بيانات الدخول غير صحيحة');
    }
  }

  async function handlePinSubmit(e) {
    e.preventDefault();
    setError('');
    const cleanSlug = (routeSlug || tenantSlug).trim().toLowerCase();
    if (!cleanSlug) { setError('يرجى إدخال كود الكافيه'); return; }
    if (!pin || pin.length < 4) { setError('يرجى إدخال رمز PIN (4 أرقام على الأقل)'); return; }
    setPinLoading(true);
    try {
      const result = await authApi.loginPin(cleanSlug, pin);
      if (result?.token) {
        // Store token via existing auth context – call login with token payload
        // authApi.loginPin returns the token; we rely on AuthContext login to handle it
        // Since AuthContext.login expects (slug, user, pass), we do manual token store
        localStorage.setItem('authToken', result.token);
        if (result.refreshToken) localStorage.setItem('refreshToken', result.refreshToken);
        window.location.replace(location.state?.from?.pathname || '/pos');
      } else {
        setError('رمز PIN غير صحيح أو انتهت صلاحيته');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'رمز PIN غير صحيح');
    } finally {
      setPinLoading(false);
    }
  }


  return (
    <div className="login-page">
      {/* Background Pattern Elements */}
      <div className="login-page__bg-glow" />

      <div className="login-card">
        {/* Brand Header */}
        <div className="login-card__brand">
          <div className="login-card__logo-wrapper mb-2">
            <img src="/caffio-logo.png" alt="Caffio - Café Business Simplified" className="login-card__logo-img" />
          </div>
          <p className="login-card__subtitle">نظام إدارة نقاط البيع والعمليات السحابية</p>
        </div>


        {/* Mode toggle */}
        <div className="d-flex gap-2 mb-3">
          <button
            type="button"
            className={`btn btn-sm flex-fill ${!pinMode ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary text-white opacity-75'}`}
            onClick={() => { setPinMode(false); setError(''); setPin(''); }}
          >
            <User size={14} className="me-1" /> دخول بكلمة مرور
          </button>
          <button
            type="button"
            className={`btn btn-sm flex-fill ${pinMode ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary text-white opacity-75'}`}
            onClick={() => { setPinMode(true); setError(''); setPassword(''); }}
          >
            <Hash size={14} className="me-1" /> دخول برمز PIN
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="login-card__error" role="alert">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
          </div>
        )}

        {/* Tenant Scope Badge (Only shown if visiting a tenant-specific URL) */}
        {routeSlug && (
          <div className="d-flex align-items-center justify-content-center gap-2 p-2 mb-3 bg-dark border border-secondary rounded">
            <Coffee size={16} className="text-warning" />
            <span className="small text-white opacity-75">كافيه:</span>
            <span className="badge bg-warning text-dark fw-bold">{routeSlug}</span>
          </div>
        )}

        {/* Login Form */}
        {!pinMode && <form onSubmit={handleSubmit} className="login-form">
          {!routeSlug && (
            <div className="form-group">
              <label className="form-label" htmlFor="login-tenant">كود الكافيه</label>
              <div className="input-wrapper">
                <span className="input-icon"><Building2 size={18} /></span>
                <input
                  id="login-tenant"
                  type="text"
                  className="form-input"
                  placeholder="مثال: caffio-downtown"
                  value={tenantSlug}
                  onChange={(e) => { setTenantSlug(e.target.value); setError(''); }}
                  autoComplete="organization"
                  autoFocus
                  disabled={isLoading}
                />
              </div>
            </div>
          )}
          {/* Username Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">اسم المستخدم</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <User size={18} />
              </span>
              <input
                id="login-username"
                type="text"
                className="form-input"
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                autoComplete="username"
                autoFocus={Boolean(routeSlug)}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">كلمة المرور</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <Lock size={18} />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="d-flex justify-content-end mb-3">
            <button
              type="button"
              className="btn btn-sm btn-link text-white opacity-75 p-0 text-decoration-none small"
              onClick={() => setForgotModal(true)}
              style={{ fontSize: '0.85rem' }}
            >
              نسيت كلمة المرور؟
            </button>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="login-submit-btn"
            loading={isLoading}
            disabled={isLoading}
          >
            تسجيل الدخول
          </Button>
        </form>}

        {/* PIN Form */}
        {pinMode && (
          <form onSubmit={handlePinSubmit} className="login-form">
            {!routeSlug && (
              <div className="form-group">
                <label className="form-label" htmlFor="pin-tenant">كود الكافيه</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Building2 size={18} /></span>
                  <input
                    id="pin-tenant"
                    type="text"
                    className="form-input"
                    placeholder="مثال: caffio-downtown"
                    value={tenantSlug}
                    onChange={(e) => { setTenantSlug(e.target.value); setError(''); }}
                    autoComplete="organization"
                    disabled={pinLoading}
                  />
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="login-pin">رمز PIN</label>
              <div className="input-wrapper">
                <span className="input-icon"><Hash size={18} /></span>
                <input
                  id="login-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  className="form-input"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                  autoFocus
                  autoComplete="one-time-code"
                  disabled={pinLoading}
                  style={{ letterSpacing: '0.4em', fontSize: '1.4rem', textAlign: 'center' }}
                />
              </div>
              <p className="small text-white opacity-50 mt-1 mb-0" style={{ fontSize: '0.78rem' }}>
                رمز PIN مكوّن من 4-8 أرقام يُحدده المشرف من إدارة المستخدمين.
              </p>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="login-submit-btn"
              loading={pinLoading}
              disabled={pinLoading}
            >
              دخول برمز PIN
            </Button>
          </form>
        )}
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {forgotModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1050 }}
          onClick={(e) => { if (e.target === e.currentTarget) setForgotModal(false); }}
        >
          <div className="modal-dialog modal-dialog-centered w-100" style={{ maxWidth: '480px' }}>
            <div className="modal-content border-secondary shadow-lg bg-dark text-white">
              <div className="modal-header border-secondary p-3">
                <h5 className="modal-title fw-bold text-warning d-flex align-items-center gap-2">
                  <HelpCircle size={20} />
                  استعادة كلمة المرور والدعم الفني
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setForgotModal(false)}
                />
              </div>

              <div className="modal-body p-4">
                <div className="p-3 bg-black rounded border border-secondary mb-3">
                  <h6 className="fw-bold text-white mb-2">👤 للموظفين والكاشيرات:</h6>
                  <p className="small text-white opacity-75 mb-0">
                    يرجى التوجه إلى مدير الكافيه / المشرف المسؤول لإعادة تعيين كلمة المرور أو رمز الـ PIN الخاص بك من شاشة إدارة المستخدمين.
                  </p>
                </div>

                <div className="p-3 bg-black rounded border border-secondary">
                  <h6 className="fw-bold text-warning mb-2">🏢 لمالكي الكافيهات والمديرين:</h6>
                  <p className="small text-white opacity-75 mb-3">
                    يمكنك التواصل المباشر مع إدارة المنصة والدعم الفني عبر واتساب لاستعادة الحساب وتعيين كلمة مرور جديدة فوراً.
                  </p>
                  <button
                    type="button"
                    className="btn btn-success w-100 fw-bold d-flex align-items-center justify-content-center gap-2 py-2"
                    onClick={() => {
                      const msg = `مرحباً إدارة كافيو، أحتاج مساعدة في استعادة كلمة المرور لحسابي${username ? ` (اسم المستخدم: ${username.trim()})` : ''}${routeSlug ? ` في كافيه: ${routeSlug}` : ''}.`;
                      window.open(`https://wa.me/201061967618?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                  >
                    <i className="bi bi-whatsapp fs-5" />
                    مراسلة الدعم الفني عبر واتساب 📲
                  </button>
                </div>
              </div>

              <div className="modal-footer border-secondary p-3">
                <button
                  type="button"
                  className="btn btn-secondary w-100"
                  onClick={() => setForgotModal(false)}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
