import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Crown, Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, Activity, Terminal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import './SuperAdminLoginPage.css';

export default function SuperAdminLoginPage() {
  const { loginSuperAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const passwordRef = useRef(null);

  const [username, setUsername] = useState('alaaHarb');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [serverHealth, setServerHealth] = useState('CHECKING');

  useEffect(() => {
    fetch('/api/auth/tenants')
      .then(r => r.ok ? setServerHealth('ONLINE') : setServerHealth('ERROR'))
      .catch(() => setServerHealth('OFFLINE'));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setError('');
    const result = await loginSuperAdmin(username.trim(), password);
    if (result.success) {
      navigate(ROUTES.SUPER_ADMIN, { replace: true });
    } else {
      setError(result.message || 'بيانات الدخول غير صحيحة أو ليس لديك صلاحية المالك');
    }
  }

  return (
    <div className="super-login-page">
      <div className="super-login-ambient-grid" />
      <div className="super-login-glow" />

      <div className="super-login-shell">
        {/* Top bar with security status */}
        <div className="super-login-topbar">
          <div className="super-login-badge">
            <ShieldCheck size={14} className="super-login-badge-icon" />
            <span>بوابة التحكم المركزية (Master Control)</span>
          </div>
          <div className="super-login-health">
            <span className={`super-login-health-dot super-login-health-dot--${serverHealth.toLowerCase()}`} />
            <span>خوادم السحابة: {serverHealth === 'ONLINE' ? 'متصلة 100%' : serverHealth}</span>
          </div>
        </div>

        {/* Master Login Card */}
        <div className="super-login-card">
          <div className="super-login-header">
            <div className="super-login-logo">
              <img src="/caffio-logo.png" alt="Caffio Logo" className="super-login-logo-img" />
            </div>
            <h1 className="super-login-title">Caffio Cloud Master</h1>
            <p className="super-login-subtitle">CAFÉ BUSINESS SIMPLIFIED • بوابة الإشراف المركزية</p>
          </div>

          {error && (
            <div className="super-login-alert animate-shake">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="super-login-form">
            <div className="super-login-group">
              <label className="super-login-label">اسم مستخدم مالك المنصة</label>
              <div className="super-login-input-wrap">
                <User size={16} className="super-login-input-icon" />
                <input
                  type="text"
                  className="super-login-input"
                  placeholder="Root / Master Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="super-login-group">
              <label className="super-login-label">مفتاح المرور الرئيسي (Master Password)</label>
              <div className="super-login-input-wrap">
                <Lock size={16} className="super-login-input-icon" />
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  className="super-login-input"
                  placeholder="Master Security Key"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="super-login-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              className="super-login-submit-btn"
            >
              دخول لوحة التحكم المركزية ⚡
            </Button>
          </form>

          <div className="super-login-card-footer">
            <Link to={ROUTES.LOGIN} className="super-login-back-link">
              <ArrowRight size={14} />
              <span>الرجوع لتسجيل دخول الكافيهات العادية</span>
            </Link>
          </div>
        </div>

        {/* Security watermark footer */}
        <div className="super-login-footer-info">
          <span>Caffio Platform Architecture v2.4</span>
          <span>•</span>
          <span>Zero-Trust End-to-End Tenant Isolation</span>
        </div>
      </div>
    </div>
  );
}
