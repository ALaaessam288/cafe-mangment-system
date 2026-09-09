import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowLeft, Building2, Database, Eye, EyeOff, Globe2, KeyRound,
  Layers3, LockKeyhole, ShieldCheck, User,
} from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import './SuperAdminLoginPage.css';

const platformResponsibilities = [
  { icon: Building2, title: 'إدارة المنشآت', copy: 'تابع حسابات العملاء وحالة كل مساحة عمل.' },
  { icon: Layers3, title: 'الاشتراكات والتراخيص', copy: 'راجع الخطط والتجديدات من مكان مركزي.' },
  { icon: Activity, title: 'المتابعة والتدقيق', copy: 'اعرف ما تغيّر ومَن نفّذ الإجراء ووقته.' },
];

const healthCopy = {
  CHECKING: 'بنطمن على الاتصال…',
  ONLINE: 'الخدمة متاحة',
  OFFLINE: 'الخدمة غير متاحة حالياً',
};

export default function SuperAdminLoginPage() {
  const { loginSuperAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [serverHealth, setServerHealth] = useState('CHECKING');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6000);

    fetch(`${API_BASE}/health`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then((response) => setServerHealth(response.ok ? 'ONLINE' : 'OFFLINE'))
      .catch(() => setServerHealth('OFFLINE'))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  function updateCapsLock(event) {
    setCapsLockOn(event.getModifierState?.('CapsLock') ?? false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanUsername = username.trim();

    if (!cleanUsername) return setError('اكتب اسم مستخدم إدارة المنصة.');
    if (!password) return setError('اكتب كلمة المرور علشان نكمّل.');

    setError('');
    const result = await loginSuperAdmin(cleanUsername, password);
    if (result.success) {
      navigate(ROUTES.SUPER_ADMIN, { replace: true });
      return;
    }
    setError(result.message || 'البيانات مش صحيحة، أو الحساب لا يملك صلاحية إدارة المنصة.');
  }

  return (
    <main className="super-login-page">
      <div className="super-login-page__glow" aria-hidden="true" />

      <div className="super-login-shell">
        <header className="super-login-topbar">
          <div className="super-login-brand">
            <img src="/caffio-logo.png" alt="Caffio" />
            <span><ShieldCheck size={15} /> PLATFORM ADMIN</span>
          </div>
          <div className={`super-login-health super-login-health--${serverHealth.toLowerCase()}`} role="status" aria-live="polite">
            <i /> <span>{healthCopy[serverHealth]}</span>
          </div>
        </header>

        <div className="super-login-stage">
          <section className="super-login-intro" aria-label="إدارة منصة Caffio">
            <div className="super-login-intro__eyebrow"><Globe2 size={16} /> مساحة إدارة Caffio</div>
            <h1>إدارة هادئة.<br /><span>رؤية أوضح.</span></h1>
            <p className="super-login-intro__copy">
              كل أدوات متابعة المنصة في مكان واحد، علشان تساعد عملاءك وتحافظ على التشغيل من غير تشتيت.
            </p>

            <div className="super-login-responsibilities">
              {platformResponsibilities.map(({ icon: Icon, title, copy }) => (
                <article key={title}>
                  <span><Icon size={19} /></span>
                  <div><strong>{title}</strong><p>{copy}</p></div>
                </article>
              ))}
            </div>

            <div className="super-login-intro__note">
              <Database size={18} />
              <span><strong>صلاحية واسعة، ومسؤولية أكبر</strong><small>استخدم حساب المنصة فقط للمهام الإدارية المركزية.</small></span>
            </div>
          </section>

          <section className="super-login-access" aria-label="دخول مدير المنصة">
            <div className="super-login-card">
              <div className="super-login-lock"><LockKeyhole size={25} /></div>
              <header className="super-login-card__header">
                <span>بوابة خاصة بإدارة المنصة</span>
                <h2>أهلاً برجوعك</h2>
                <p>ادخل ببيانات الـSuper Admin لإدارة حسابات Caffio.</p>
              </header>

              <div className="super-login-scope-note">
                <ShieldCheck size={16} />
                <span>دي مش شاشة دخول الكافيه. بيانات موظفي وإدارة المكان مش هتشتغل هنا.</span>
              </div>

              {error && (
                <div className="super-login-alert" role="alert" aria-live="assertive" id="super-login-error">
                  <span>!</span><div><strong>تعذر تسجيل الدخول</strong><p>{error}</p></div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="super-login-form">
                <div className="super-login-group">
                  <label htmlFor="super-login-username">اسم مستخدم المنصة</label>
                  <div className="super-login-input-wrap">
                    <User size={18} className="super-login-input-icon" />
                    <input
                      type="text"
                      id="super-login-username"
                      className="super-login-input"
                      placeholder="اكتب اسم المستخدم"
                      value={username}
                      onChange={(event) => { setUsername(event.target.value); setError(''); }}
                      autoFocus
                      required
                      autoComplete="username"
                      disabled={isLoading}
                      aria-describedby={error ? 'super-login-error' : undefined}
                    />
                  </div>
                </div>

                <div className="super-login-group">
                  <label htmlFor="super-login-password">كلمة المرور</label>
                  <div className="super-login-input-wrap">
                    <KeyRound size={18} className="super-login-input-icon" />
                    <input
                      id="super-login-password"
                      type={showPassword ? 'text' : 'password'}
                      className="super-login-input"
                      placeholder="اكتب كلمة المرور"
                      value={password}
                      onChange={(event) => { setPassword(event.target.value); setError(''); }}
                      onKeyDown={updateCapsLock}
                      onKeyUp={updateCapsLock}
                      onBlur={() => setCapsLockOn(false)}
                      required
                      autoComplete="current-password"
                      disabled={isLoading}
                      aria-describedby={error ? 'super-login-error' : undefined}
                    />
                    <button type="button" className="super-login-eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {capsLockOn && <small className="super-login-caps">زر Caps Lock شغّال</small>}
                </div>

                <Button type="submit" variant="primary" size="lg" loading={isLoading} disabled={isLoading || serverHealth === 'OFFLINE'} rightIcon={<ArrowLeft size={18} />} className="super-login-submit-btn">
                  دخول لوحة المنصة
                </Button>
                {serverHealth === 'OFFLINE' && <p className="super-login-offline-help">راجع اتصال الخادم وحاول مرة تانية بعد لحظات.</p>}
              </form>

              <footer className="super-login-card__footer">
                <span><ShieldCheck size={15} /> جلسة إدارية محمية</span>
                <Link to={ROUTES.LOGIN}><ArrowLeft size={15} /> رجوع لدخول الكافيه</Link>
              </footer>
            </div>
          </section>
        </div>

        <footer className="super-login-page__footer">CAFFIO PLATFORM · AUTHORIZED ACCESS ONLY</footer>
      </div>
    </main>
  );
}
