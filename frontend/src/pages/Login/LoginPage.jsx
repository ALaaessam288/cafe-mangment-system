import { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, CheckCircle2, ChefHat, Clock3, Coffee, Eye,
  EyeOff, Hash, Headphones, HelpCircle, KeyRound, Lock, ShieldCheck, User, X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
import { storage } from '../../utils/storage';
import Button from '../../components/Button/Button';
import './LoginPage.css';

const workspaceBenefits = [
  { icon: Clock3, title: 'ابدأ الشيفت بسرعة', copy: 'ادخل وكمّل من آخر نقطة من غير خطوات معقدة.' },
  { icon: ChefHat, title: 'الطلبات واضحة للفريق', copy: 'الكاشير والمطبخ شايفين نفس الصورة في الوقت المناسب.' },
  { icon: CheckCircle2, title: 'اقفل يومك وأنت مطمّن', copy: 'المبيعات والمصروفات وحركة الدرج قدامك بشكل مرتب.' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'صباح الخير';
  if (hour < 18) return 'أهلاً بيك';
  return 'مساء الخير';
}

export default function LoginPage() {
  const { login, loginPin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const routeSlug = params.tenantSlug || searchParams.get('tenant') || searchParams.get('slug') || '';
  const [tenantSlug, setTenantSlug] = useState(() => routeSlug || storage.getLastTenantSlug() || '');
  const [tenantSelected, setTenantSelected] = useState(() => Boolean(routeSlug || storage.getLastTenantSlug()));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [forgotModal, setForgotModal] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  function switchMode(usePin) {
    setPinMode(usePin);
    setError('');
    setCapsLockOn(false);
    if (usePin) setPassword('');
    else setPin('');
  }

  function updateCapsLock(event) {
    setCapsLockOn(event.getModifierState?.('CapsLock') ?? false);
  }

  function changeTenant() {
    storage.removeLastTenantSlug();
    setTenantSlug('');
    setTenantSelected(false);
    setError('');
    if (routeSlug) navigate(ROUTES.LOGIN, { replace: true });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const cleanSlug = (routeSlug || tenantSlug).trim().toLowerCase();
    const trimmedUsername = username.trim();

    if (!cleanSlug) return setError('اكتب كود المكان علشان نوصلك لمساحة العمل الصحيحة.');
    if (!trimmedUsername) return setError('اكتب اسم المستخدم الخاص بك.');
    if (!password) return setError('اكتب كلمة المرور علشان نكمّل.');

    const result = await login(cleanSlug, trimmedUsername, password);
    if (result.success) {
      navigate(location.state?.from?.pathname || result.defaultRoute || ROUTES.POS, { replace: true });
      return;
    }
    setError(result.message || 'البيانات مش مطابقة. راجعها وجرب مرة تانية.');
  }

  async function handlePinSubmit(event) {
    event.preventDefault();
    setError('');
    const cleanSlug = (routeSlug || tenantSlug).trim().toLowerCase();

    if (!cleanSlug) return setError('اكتب كود المكان علشان نوصلك لمساحة العمل الصحيحة.');
    if (pin.length < 4) return setError('رمز PIN لازم يكون من 4 إلى 8 أرقام.');

    setPinLoading(true);
    try {
      const result = await loginPin(cleanSlug, pin);
      if (result.success) {
        navigate(location.state?.from?.pathname || result.defaultRoute || ROUTES.POS, { replace: true });
        return;
      }
      setError(result.message || 'رمز PIN مش صحيح. راجعه أو استخدم كلمة المرور.');
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'تعذر تسجيل الدخول بالـPIN حالياً.');
    } finally {
      setPinLoading(false);
    }
  }

  const activeTenant = (routeSlug || tenantSlug).trim();
  const supportMessage = `مرحباً فريق Caffio، أحتاج مساعدة في تسجيل الدخول${username ? ` لحساب ${username.trim()}` : ''}${activeTenant ? ` في مساحة ${activeTenant}` : ''}.`;

  return (
    <main className="login-page">
      <div className="login-page__glow login-page__glow--warm" aria-hidden="true" />
      <div className="login-page__glow login-page__glow--mint" aria-hidden="true" />

      <section className="login-welcome" aria-label="مرحباً بك في Caffio">
        <div className="login-brand">
          <img src="/caffio-logo.png" alt="Caffio" />
          <span>مساحة تشغيل مكانك</span>
        </div>

        <div className="login-welcome__content">
          <p className="login-welcome__eyebrow"><Coffee size={17} /> {getGreeting()}، نورت مكانك</p>
          <h1>كل حاجة جاهزة<br /><span>علشان تبدأ يومك.</span></h1>
          <p className="login-welcome__lead">
            Caffio بيجمع الطلبات، المطبخ، المخزون والشيفت في مساحة واحدة بسيطة لفريقك.
          </p>

          <div className="login-benefits">
            {workspaceBenefits.map(({ icon: Icon, title, copy }) => (
              <article key={title}>
                <span><Icon size={19} /></span>
                <div><strong>{title}</strong><p>{copy}</p></div>
              </article>
            ))}
          </div>
        </div>

        <div className="login-welcome__footer">
          <span><ShieldCheck size={16} /> دخول آمن لكل فرد في الفريق</span>
          <span>CAFFIO BUSINESS OS</span>
        </div>
      </section>

      <section className="login-access" aria-label="تسجيل الدخول">
        <div className="login-access__mobile-brand"><img src="/caffio-logo.png" alt="Caffio" /></div>

        <div className="login-card">
          <header className="login-card__header">
            <span className="login-card__hello">أهلاً برجوعك 👋</span>
            <h2>سجّل دخولك</h2>
            <p>اختار الطريقة الأسهل ليك، وهنفتح مساحة العمل فوراً.</p>
          </header>

          {tenantSelected && activeTenant && (
            <div className="login-tenant-badge">
              <span className="login-tenant-badge__icon"><Building2 size={19} /></span>
              <span><small>مساحة العمل المحفوظة على الجهاز</small><strong>{activeTenant}</strong></span>
              <button type="button" className="login-tenant-badge__ready" onClick={changeTenant} aria-label="تغيير مساحة العمل"><X size={13} /> تغيير</button>
            </div>
          )}

          <div className="login-mode-switch" role="tablist" aria-label="طريقة تسجيل الدخول">
            <button type="button" role="tab" aria-selected={!pinMode} className={!pinMode ? 'is-active' : ''} onClick={() => switchMode(false)}>
              <KeyRound size={17} /> كلمة المرور
            </button>
            <button type="button" role="tab" aria-selected={pinMode} className={pinMode ? 'is-active' : ''} onClick={() => switchMode(true)}>
              <Hash size={17} /> دخول سريع بالـPIN
            </button>
          </div>

          {error && (
            <div className="login-card__error" role="alert" aria-live="assertive">
              <span>!</span><div><strong>مقدرناش نسجّل دخولك</strong><p>{error}</p></div>
            </div>
          )}

          {!pinMode ? (
            <form onSubmit={handleSubmit} className="login-form">
              {!tenantSelected && (
                <LoginField
                  id="login-tenant"
                  label="كود المكان"
                  icon={Building2}
                  placeholder="مثال: wanas"
                  value={tenantSlug}
                  onChange={(value) => { setTenantSlug(value); setError(''); }}
                  autoComplete="organization"
                  autoFocus
                  disabled={isLoading}
                  hint="هتلاقي الكود عند مدير المكان."
                />
              )}

              <LoginField
                id="login-username"
                label="اسم المستخدم"
                icon={User}
                placeholder="اكتب اسم المستخدم"
                value={username}
                onChange={(value) => { setUsername(value); setError(''); }}
                autoComplete="username"
                autoFocus={tenantSelected}
                disabled={isLoading}
              />

              <div className="login-field">
                <div className="login-field__label-row">
                  <label htmlFor="login-password">كلمة المرور</label>
                  <button type="button" onClick={() => setForgotModal(true)}>محتاج مساعدة؟</button>
                </div>
                <div className="login-field__control">
                  <Lock size={18} className="login-field__icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="اكتب كلمة المرور"
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); setError(''); }}
                    onKeyDown={updateCapsLock}
                    onKeyUp={updateCapsLock}
                    onBlur={() => setCapsLockOn(false)}
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button type="button" className="login-field__password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {capsLockOn && <small className="login-field__caps">زر Caps Lock شغّال</small>}
              </div>

              <Button type="submit" variant="primary" size="lg" className="login-submit-btn" loading={isLoading} disabled={isLoading} rightIcon={<ArrowLeft size={19} />}>
                دخول إلى مساحة العمل
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} className="login-form login-form--pin">
              {!tenantSelected && (
                <LoginField
                  id="pin-tenant"
                  label="كود المكان"
                  icon={Building2}
                  placeholder="مثال: wanas"
                  value={tenantSlug}
                  onChange={(value) => { setTenantSlug(value); setError(''); }}
                  autoComplete="organization"
                  disabled={pinLoading}
                />
              )}

              <div className="login-field">
                <label htmlFor="login-pin">رمز الدخول السريع</label>
                <div className="login-field__control login-field__control--pin">
                  <Hash size={19} className="login-field__icon" />
                  <input
                    id="login-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    minLength={4}
                    maxLength={8}
                    placeholder="••••"
                    value={pin}
                    onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setError(''); }}
                    autoFocus
                    autoComplete="one-time-code"
                    disabled={pinLoading}
                    aria-describedby="pin-help"
                  />
                </div>
                <small className="login-field__hint" id="pin-help">من 4 إلى 8 أرقام، وبيحدده مدير المكان.</small>
              </div>

              <Button type="submit" variant="primary" size="lg" className="login-submit-btn" loading={pinLoading} disabled={pinLoading} rightIcon={<ArrowLeft size={19} />}>
                دخول سريع
              </Button>
              <button type="button" className="login-use-password" onClick={() => switchMode(false)}>مش فاكر الـPIN؟ استخدم كلمة المرور</button>
            </form>
          )}

          <div className="login-card__reassurance">
            <ShieldCheck size={17} />
            <span><strong>بياناتك في أمان</strong><small>كل شخص بيدخل بصلاحياته الخاصة.</small></span>
          </div>

          {/* The platform-owner entrance is deliberately not advertised here.
              This screen is shown to every café's staff, and a visible "Super Admin" door tells
              them an account exists above their own and where to knock. The route still works —
              platform staff go straight to ROUTES.SUPER_ADMIN_LOGIN — it just is not linked from
              a tenant's login page. Removing the link is not access control on its own; the
              endpoint is still guarded by the SUPER_ADMIN role. */}
        </div>

        <p className="login-access__support"><Headphones size={17} /> في حاجة موقفاك؟ <button type="button" onClick={() => setForgotModal(true)}>خلّينا نساعدك</button></p>
      </section>

      {forgotModal && (
        <div className="login-modal" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setForgotModal(false); }}>
          <section className="login-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="support-title">
            <header>
              <span><HelpCircle size={22} /></span>
              <div><h3 id="support-title">هنرجّعك لحسابك</h3><p>اختار أسرع طريقة مناسبة لحالتك.</p></div>
              <button type="button" onClick={() => setForgotModal(false)} aria-label="إغلاق"><X size={20} /></button>
            </header>
            <div className="login-modal__body">
              <article><User size={20} /><div><strong>لو أنت موظف أو كاشير</strong><p>مدير المكان يقدر يعيد تعيين كلمة المرور أو رمز PIN من شاشة المستخدمين.</p></div></article>
              <article><Building2 size={20} /><div><strong>لو أنت مالك المكان</strong><p>فريق الدعم هيتأكد من بيانات المؤسسة ويساعدك تستعيد الحساب بأمان.</p></div></article>
              <button type="button" className="login-modal__whatsapp" onClick={() => window.open(`https://wa.me/201061967618?text=${encodeURIComponent(supportMessage)}`, '_blank', 'noopener,noreferrer')}>
                <Headphones size={18} /> كلّم دعم Caffio على واتساب
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function LoginField({ id, label, icon: Icon, hint, onChange, ...inputProps }) {
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      <div className="login-field__control">
        <Icon size={18} className="login-field__icon" />
        <input id={id} onChange={(event) => onChange(event.target.value)} {...inputProps} />
      </div>
      {hint && <small className="login-field__hint">{hint}</small>}
    </div>
  );
}
