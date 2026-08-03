import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import { ROUTES } from '../../utils/constants';
import { authApi } from '../../api/authApi';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import './LoginPage.css';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    tenantSlug: storage.getTenantSlug() || 'wanas',
    username:   '',
    password:   '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    authApi.getTenants()
      .then((data) => {
        setTenants(data);
        if (data.length > 0 && !form.tenantSlug) {
          setForm((prev) => ({ ...prev, tenantSlug: data[0].slug }));
        }
      })
      .catch((err) => {
        console.error('Failed to load tenants:', err);
      })
      .finally(() => {
        setLoadingTenants(false);
      });
  }, []);

  function handleChange(e) {
    setError('');
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.tenantSlug.trim() || !form.username.trim() || !form.password.trim()) {
      setError('لو سمحت املأ كل البيانات.');
      return;
    }

    const result = await login(form.tenantSlug.trim(), form.username.trim(), form.password);
    if (result.success) {
      navigate(result.defaultRoute, { replace: true });
    } else {
      setError(result.message || 'تسجيل الدخول فشل. اتأكد من بياناتك.');
    }
  }

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
          <h1 className="login__brand-name">كافيه ونس</h1>
          <p className="login__brand-tagline">سيستم الكاشير</p>

          <div className="login__features">
            {['إدارة سريعة للأوردرات', 'متابعة الترابيزات لحظة بلحظة', 'التحكم في الشيفتات والمصاريف', 'صلاحيات مختلفة للمستخدمين'].map((f) => (
              <div key={f} className="login__feature">
                <span className="login__feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="login__panel">
        <div className="login__form-wrap animate-fade-in-up">
          <div className="login__header">
            <h2 className="login__title">أهلاً بيك تاني</h2>
            <p className="login__subtitle">سجل دخول على حسابك</p>
          </div>

          <form className="login__form" onSubmit={handleSubmit} noValidate>
            <div className="field-select">
              <label className="field-select__label" htmlFor="tenantSlug">مساحة العمل (الكافيه)</label>
              <select
                className="field-select__control"
                name="tenantSlug"
                id="tenantSlug"
                value={form.tenantSlug}
                onChange={handleChange}
                disabled={loadingTenants}
                required
              >
                <option value="" disabled>اختار الكافيه بتاعك...</option>
                {tenants.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="اسم المستخدم"
              name="username"
              id="username"
              value={form.username}
              onChange={handleChange}
              placeholder="دخل اسم المستخدم"
              autoComplete="username"
              rightIcon={<User size={15} />}
              required
            />

            <Input
              label="كلمة السر"
              name="password"
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={handleChange}
              placeholder="دخل كلمة السر"
              autoComplete="current-password"
              rightIcon={<Lock size={15} />}
              leftIcon={
                <span
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'اخفي كلمة السر' : 'اظهر كلمة السر'}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </span>
              }
              required
            />

            {error && (
              <div className="login__error" role="alert">
                <span>⚠</span> {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              loading={isLoading}
              className="login__submit"
            >
              {isLoading ? 'بيسجل دخول...' : 'تسجيل الدخول'}
            </Button>
          </form>

          <div className="login-footer" style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            معندكش مساحة عمل؟ <Link to={ROUTES.REGISTER} style={{ color: 'var(--accent)', fontWeight: 'var(--fw-medium)', textDecoration: 'none' }}>اعمل واحدة دلوقتي</Link>
          </div>

          <p className="login__footer-note">
            سيستم كافيه ونس · v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
