import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, Coffee, HelpCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import './LoginPage.css';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  // Detect tenant slug from route parameter /:tenantSlug/login or query ?tenant=slug / ?slug=slug
  const routeSlug = params.tenantSlug || searchParams.get('tenant') || searchParams.get('slug') || '';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [forgotModal, setForgotModal] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('يرجى إدخال اسم المستخدم');
      return;
    }
    if (!password) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    const cleanSlug = routeSlug ? routeSlug.trim().toLowerCase() : null;
    const result = await login(cleanSlug, trimmedUsername, password);
    if (result.success) {
      navigate(result.defaultRoute || ROUTES.POS, { replace: true });
    } else {
      setError(result.message || 'بيانات الدخول غير صحيحة');
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
        <form onSubmit={handleSubmit} className="login-form">
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
                autoFocus
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
                tabIndex={-1}
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
        </form>
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
