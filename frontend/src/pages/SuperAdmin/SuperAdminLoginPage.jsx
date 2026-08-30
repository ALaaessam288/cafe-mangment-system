import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Activity, ArrowRight, Building2, Database, Eye, EyeOff, Globe2, KeyRound,
  Layers3, LockKeyhole, Radar, Server, ShieldCheck, User, Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import './SuperAdminLoginPage.css';

export default function SuperAdminLoginPage() {
  const { loginSuperAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const passwordRef = useRef(null);

  const [username, setUsername] = useState('');
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
      <div className="super-login-scanline" />

      <div className="super-login-shell">
        <div className="super-login-topbar">
          <div className="super-login-badge">
            <ShieldCheck size={14} />
            <span>CAFFIO · PLATFORM CONTROL</span>
          </div>
          <div className="super-login-health">
            <span className={`super-login-health-dot super-login-health-dot--${serverHealth.toLowerCase()}`} />
            <span>الشبكة المركزية: {serverHealth === 'ONLINE' ? 'متصلة' : serverHealth}</span>
          </div>
        </div>

        <div className="super-login-stage">
          <section className="super-login-intel" aria-label="مركز قيادة المنصة">
            <div className="super-login-intel-brand"><img src="/caffio-logo.png" alt="Caffio" /><span>CONTROL DECK / 02</span></div>
            <p className="super-login-intel-kicker"><Globe2 size={15} /> المستوى الأعلى لإدارة المنصة</p>
            <h1>كل الفروع.<br /><span>قرار واحد.</span></h1>
            <p className="super-login-intel-copy">راقب المستأجرين، الاشتراكات وصحة المنصة من مركز قيادة واحد مؤمّن.</p>

            <div className="super-login-radar" aria-hidden="true">
              <i className="super-login-radar-ring super-login-radar-ring--one" />
              <i className="super-login-radar-ring super-login-radar-ring--two" />
              <i className="super-login-radar-sweep" />
              <span className="super-login-radar-core"><Radar size={28} /></span>
              <span className="super-login-node super-login-node--one"><Building2 size={13} /></span>
              <span className="super-login-node super-login-node--two"><Database size={13} /></span>
              <span className="super-login-node super-login-node--three"><Server size={13} /></span>
            </div>

            <div className="super-login-stats">
              <article><Layers3 size={16} /><span><small>عزل المؤسسات</small><strong>Multi-tenant</strong></span></article>
              <article><Activity size={16} /><span><small>المراقبة</small><strong>Real-time</strong></span></article>
              <article><Zap size={16} /><span><small>الاستجابة</small><strong>Instant</strong></span></article>
            </div>
          </section>

          <section className="super-login-card" aria-label="دخول مالك المنصة">
            <div className="super-login-card-code"><span>ROOT ACCESS</span><i />02</div>
            <div className="super-login-header">
              <span className="super-login-lock"><LockKeyhole size={24} /></span>
              <div><small>منطقة صلاحيات حساسة</small><h2>بوابة مالك المنصة</h2><p>الهوية الرئيسية مطلوبة للمتابعة.</p></div>
            </div>

            {error && (
              <div className="super-login-alert animate-shake" role="alert" id="super-login-error">
                <span>!</span><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="super-login-form">
              <div className="super-login-group">
                <label className="super-login-label" htmlFor="super-login-username">هوية مالك المنصة</label>
                <div className="super-login-input-wrap">
                  <User size={17} className="super-login-input-icon" />
                  <input type="text" id="super-login-username" className="super-login-input" placeholder="Master username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required autoComplete="username" aria-describedby={error ? 'super-login-error' : undefined} />
                  <span className="super-login-input-tag">ID</span>
                </div>
              </div>

              <div className="super-login-group">
                <label className="super-login-label" htmlFor="super-login-password">مفتاح الأمان الرئيسي</label>
                <div className="super-login-input-wrap">
                  <KeyRound size={17} className="super-login-input-icon" />
                  <input ref={passwordRef} id="super-login-password" type={showPassword ? 'text' : 'password'} className="super-login-input" placeholder="Master security key" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" aria-describedby={error ? 'super-login-error' : undefined} />
                  <button type="button" className="super-login-eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>

              <Button type="submit" variant="primary" loading={isLoading} className="super-login-submit-btn">فتح مركز القيادة <ArrowRight size={17} /></Button>
            </form>

            <div className="super-login-card-footer">
              <span><ShieldCheck size={14} /> وصول مراقب ومسجّل</span>
              <Link to={ROUTES.LOGIN} className="super-login-back-link"><ArrowRight size={14} /><span>دخول فريق الكافيه</span></Link>
            </div>
          </section>
        </div>

        <div className="super-login-footer-info">
          <span>CAFFIO PLATFORM ARCHITECTURE</span><i /><span>ZERO-TRUST TENANT ISOLATION</span>
        </div>
      </div>
    </div>
  );
}
