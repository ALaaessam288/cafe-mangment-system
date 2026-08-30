import { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity, ArrowLeft, Boxes, Building2, CheckCircle2, CircleDollarSign, Clock3,
  Coffee, Eye, EyeOff, Hash, Headphones, HelpCircle, KeyRound, Lock, PackageCheck,
  Radio, ReceiptText, ShieldCheck, Sparkles, TrendingUp, User, X,
} from 'lucide-react';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import './LoginPage.css';

const operationalCards = [
  { icon: CircleDollarSign, label: 'مبيعات اليوم', value: '24,680', unit: 'ج.م', meta: '+18%', tone: 'gold' },
  { icon: ReceiptText, label: 'طلبات نشطة', value: '18', unit: 'طلب', meta: '6 بالمطبخ', tone: 'blue' },
  { icon: Boxes, label: 'حالة المخزون', value: '94', unit: '%', meta: 'مستقر', tone: 'mint' },
];

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
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

  function switchMode(usePin) {
    setPinMode(usePin);
    setError('');
    if (usePin) setPassword(''); else setPin('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const cleanSlug = (routeSlug || tenantSlug).trim().toLowerCase();
    const trimmedUsername = username.trim();
    if (!cleanSlug) return setError('يرجى إدخال كود الكافيه');
    if (!trimmedUsername) return setError('يرجى إدخال اسم المستخدم');
    if (!password) return setError('يرجى إدخال كلمة المرور');
    const result = await login(cleanSlug, trimmedUsername, password);
    if (result.success) {
      navigate(location.state?.from?.pathname || result.defaultRoute || ROUTES.POS, { replace: true });
    } else {
      setError(result.message || 'بيانات الدخول غير صحيحة');
    }
  }

  async function handlePinSubmit(e) {
    e.preventDefault();
    setError('');
    const cleanSlug = (routeSlug || tenantSlug).trim().toLowerCase();
    if (!cleanSlug) return setError('يرجى إدخال كود الكافيه');
    if (!pin || pin.length < 4) return setError('يرجى إدخال رمز PIN من 4 أرقام على الأقل');
    setPinLoading(true);
    try {
      const result = await authApi.loginPin(cleanSlug, pin);
      if (result?.token) {
        localStorage.setItem('authToken', result.token);
        if (result.refreshToken) localStorage.setItem('refreshToken', result.refreshToken);
        window.location.replace(location.state?.from?.pathname || '/pos');
      } else setError('رمز PIN غير صحيح أو انتهت صلاحيته');
    } catch (err) {
      setError(err?.response?.data?.message || 'رمز PIN غير صحيح');
    } finally {
      setPinLoading(false);
    }
  }

  const supportMessage = `مرحباً إدارة كافيو، أحتاج مساعدة في استعادة كلمة المرور لحسابي${username ? ` (اسم المستخدم: ${username.trim()})` : ''}${routeSlug ? ` في كافيه: ${routeSlug}` : ''}.`;

  return (
    <main className="login-page">
      <div className="login-page__orb login-page__orb--one" />
      <div className="login-page__orb login-page__orb--two" />
      <div className="login-page__rings" aria-hidden="true"><i /><i /><i /></div>

      <section className="login-showcase" aria-label="مميزات منصة كافيو">
        <div className="login-showcase__brandline">
          <img src="/caffio-logo.png" alt="Caffio" />
          <span>OPERATIONS OS</span>
        </div>
        <div className="login-showcase__topline"><Radio size={14} /> مصمم للتشغيل لحظة بلحظة <i /></div>
        <h1>مش مجرد كاشير.<br /><span>دي غرفة التحكم.</span></h1>
        <p className="login-showcase__lead">كل نبضة في مكانك — من أول الأوردر لآخر جرام مخزون — قدامك لحظة بلحظة.</p>

        <div className="login-command" aria-label="نموذج توضيحي لغرفة التحكم">
          <div className="login-command__head">
            <div><Activity size={17} /><span>لمحة من غرفة التحكم</span></div>
            <small><span /> نموذج توضيحي</small>
          </div>
          <div className="login-command__metrics">
            {operationalCards.map(({ icon: Icon, label, value, unit, meta, tone }) => (
              <article className={`login-metric login-metric--${tone}`} key={label}>
                <span className="login-metric__icon"><Icon size={18} /></span>
                <small>{label}</small>
                <strong>{value} <em>{unit}</em></strong>
                <span className="login-metric__meta">{tone === 'gold' && <TrendingUp size={12} />}{meta}</span>
              </article>
            ))}
          </div>
          <div className="login-command__flow">
            <span><ReceiptText size={15} /> أوردر جديد</span><i />
            <span><Coffee size={15} /> تحت التحضير</span><i />
            <span><PackageCheck size={15} /> خصم المخزون</span>
          </div>
          <div className="login-command__shift"><span><Clock3 size={15} /> شيفت المساء</span><strong>04:26:18</strong><small>يعمل الآن</small></div>
        </div>
        <div className="login-showcase__trust">
          <span><ShieldCheck size={17} /> صلاحيات دقيقة</span>
          <span><CheckCircle2 size={17} /> بيانات لحظية</span>
          <span><Sparkles size={17} /> تجربة أسرع</span>
        </div>
      </section>

      <section className="login-access" aria-label="تسجيل الدخول">
        <div className="login-access__mobile-brand"><img src="/caffio-logo.png" alt="Caffio" /></div>
        <div className="login-access__eyebrow"><span>01</span><i /> بوابة الفريق</div>
        <div className="login-card">
          <header className="login-card__header">
            <span>جاهز للشيفت؟</span><h2>ادخل.. وخلي التشغيل علينا.</h2><p>بياناتك هي مفتاح غرفة التحكم الخاصة بمكانك.</p>
          </header>

          {routeSlug && (
            <div className="login-tenant-badge">
              <span className="login-tenant-badge__icon"><Coffee size={18} /></span>
              <span><small>تسجيل الدخول إلى</small><strong>{routeSlug}</strong></span>
              <CheckCircle2 size={18} className="login-tenant-badge__check" />
            </div>
          )}

          <div className="login-mode-switch" role="tablist" aria-label="طريقة تسجيل الدخول">
            <button type="button" role="tab" aria-selected={!pinMode} className={!pinMode ? 'is-active' : ''} onClick={() => switchMode(false)}><KeyRound size={17} /> كلمة المرور</button>
            <button type="button" role="tab" aria-selected={pinMode} className={pinMode ? 'is-active' : ''} onClick={() => switchMode(true)}><Hash size={17} /> رمز PIN</button>
          </div>

          {error && <div className="login-card__error" role="alert"><span>!</span><p>{error}</p></div>}

          {!pinMode ? (
            <form onSubmit={handleSubmit} className="login-form">
              {!routeSlug && <LoginField id="login-tenant" label="كود الكافيه" icon={Building2} placeholder="مثال: wanas" value={tenantSlug} onChange={(value) => { setTenantSlug(value); setError(''); }} autoComplete="organization" autoFocus disabled={isLoading} hint="الكود الخاص بفرعك أو مؤسستك" />}
              <LoginField id="login-username" label="اسم المستخدم" icon={User} placeholder="اكتب اسم المستخدم" value={username} onChange={(value) => { setUsername(value); setError(''); }} autoComplete="username" autoFocus={Boolean(routeSlug)} disabled={isLoading} />
              <div className="login-field">
                <div className="login-field__label-row"><label htmlFor="login-password">كلمة المرور</label><button type="button" onClick={() => setForgotModal(true)}>نسيت كلمة المرور؟</button></div>
                <div className="login-field__control">
                  <Lock size={18} className="login-field__icon" />
                  <input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="أدخل كلمة المرور" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} autoComplete="current-password" disabled={isLoading} />
                  <button type="button" className="login-field__password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <Button type="submit" variant="primary" size="lg" className="login-submit-btn" loading={isLoading} disabled={isLoading} rightIcon={<ArrowLeft size={19} />}>دخول إلى مساحة العمل</Button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} className="login-form login-form--pin">
              {!routeSlug && <LoginField id="pin-tenant" label="كود الكافيه" icon={Building2} placeholder="مثال: wanas" value={tenantSlug} onChange={(value) => { setTenantSlug(value); setError(''); }} autoComplete="organization" disabled={pinLoading} />}
              <div className="login-field">
                <label htmlFor="login-pin">رمز الدخول السريع</label>
                <div className="login-field__control login-field__control--pin"><Hash size={19} className="login-field__icon" /><input id="login-pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={8} placeholder="••••" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }} autoFocus autoComplete="one-time-code" disabled={pinLoading} /></div>
                <small className="login-field__hint">رمز من 4 إلى 8 أرقام يحدده مدير المكان.</small>
              </div>
              <Button type="submit" variant="primary" size="lg" className="login-submit-btn" loading={pinLoading} disabled={pinLoading} rightIcon={<ArrowLeft size={19} />}>دخول سريع</Button>
            </form>
          )}

          <footer className="login-card__footer">
            <span><ShieldCheck size={15} /> جلسة محمية ومشفّرة</span>
            <button type="button" onClick={() => navigate(ROUTES.SUPER_ADMIN_LOGIN)}>مسؤول المنصة؟ <strong>دخول Super Admin</strong></button>
          </footer>
        </div>
        <p className="login-access__support"><Headphones size={16} /> محتاج مساعدة؟ <button type="button" onClick={() => setForgotModal(true)}>تواصل مع الدعم</button></p>
      </section>

      {forgotModal && (
        <div className="login-modal" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setForgotModal(false); }}>
          <section className="login-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="support-title">
            <header><span><HelpCircle size={22} /></span><div><h3 id="support-title">مساعدة تسجيل الدخول</h3><p>هنساعدك ترجع لحسابك بأمان.</p></div><button type="button" onClick={() => setForgotModal(false)} aria-label="إغلاق"><X size={20} /></button></header>
            <div className="login-modal__body">
              <article><User size={20} /><div><strong>للموظفين والكاشيرات</strong><p>اطلب من مدير الكافيه إعادة تعيين كلمة المرور أو رمز PIN من إدارة المستخدمين.</p></div></article>
              <article><Building2 size={20} /><div><strong>للمالك أو المدير</strong><p>تواصل مع دعم Caffio لتأكيد بيانات المؤسسة واستعادة الحساب.</p></div></article>
              <button type="button" className="login-modal__whatsapp" onClick={() => window.open(`https://wa.me/201061967618?text=${encodeURIComponent(supportMessage)}`, '_blank')}><Headphones size={18} /> مراسلة الدعم عبر واتساب</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function LoginField({ id, label, icon: Icon, hint, onChange, ...inputProps }) {
  return <div className="login-field"><label htmlFor={id}>{label}</label><div className="login-field__control"><Icon size={18} className="login-field__icon" /><input id={id} onChange={(e) => onChange(e.target.value)} {...inputProps} /></div>{hint && <small className="login-field__hint">{hint}</small>}</div>;
}
