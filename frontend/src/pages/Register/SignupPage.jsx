import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Check, Coffee, Eye, EyeOff, Loader2, Lock, User, X } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { plansApi, formatLimit } from '../../api/plansApi';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import { ROUTES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import './SignupPage.css';

/*
 * Public self-service signup.
 *
 * The /register route existed but redirected straight to /login, so there was no way for a café to
 * start using Caffio without someone at the platform provisioning them by hand with an ops key.
 * This is the missing half: the customer creates their own workspace and lands inside the app on
 * the free trial, with no card asked for.
 *
 * The workspace address is checked while they type. Discovering it was taken only on submit meant
 * losing the whole form to a 409, which is a bad first impression for a product's first screen.
 */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function suggestSlug(name) {
  return name
    .toLowerCase()
    .replace(/[؀-ۿ]/g, '')       // Arabic letters can't appear in a URL slug
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { refreshEntitlements } = useAuth();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    businessType: 'CAFE',
    ownerFullName: '',
    ownerUsername: '',
    ownerPassword: '',
    ownerWhatsapp: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState({ checking: false, available: null, reason: null });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [trialPlan, setTrialPlan] = useState(null);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  /* The trial's real terms, from the catalogue — never numbers typed into this page. */
  useEffect(() => {
    plansApi
      .list()
      .then((plans) => setTrialPlan(plans.find((p) => p.selfSelectable) ?? null))
      .catch(() => setTrialPlan(null));
  }, []);

  /* Derive the workspace address from the business name until the customer edits it themselves. */
  useEffect(() => {
    if (slugTouched) return;
    setForm((prev) => ({ ...prev, slug: suggestSlug(prev.name) }));
  }, [form.name, slugTouched]);

  const debounceRef = useRef(null);
  const checkSlug = useCallback((slug) => {
    clearTimeout(debounceRef.current);
    if (!slug || !SLUG_PATTERN.test(slug)) {
      setSlugState({ checking: false, available: null, reason: slug ? 'INVALID' : null });
      return;
    }
    setSlugState({ checking: true, available: null, reason: null });
    debounceRef.current = setTimeout(() => {
      authApi
        .slugAvailable(slug)
        .then((r) => setSlugState({ checking: false, available: r.available, reason: r.reason }))
        .catch(() => setSlugState({ checking: false, available: null, reason: null }));
    }, 400);
  }, []);

  useEffect(() => {
    checkSlug(form.slug);
    return () => clearTimeout(debounceRef.current);
  }, [form.slug, checkSlug]);

  const passwordProblem = useMemo(() => {
    const p = form.ownerPassword;
    if (!p) return null;
    if (p.length < 8) return 'كلمة المرور 8 أحرف على الأقل';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'لازم تحتوي على حرف ورقم على الأقل';
    return null;
  }, [form.ownerPassword]);

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.ownerFullName.trim().length >= 2 &&
    form.ownerUsername.trim().length >= 3 &&
    !passwordProblem &&
    form.ownerPassword.length >= 8 &&
    slugState.available === true &&
    !submitting;

  const slugMessage = {
    INVALID: 'حروف إنجليزية صغيرة وأرقام وشرطات فقط',
    RESERVED: 'هذا العنوان محجوز للمنصة',
    TAKEN: 'هذا العنوان مستخدم بالفعل',
  }[slugState.reason];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await authApi.registerTrial({
        name: form.name.trim(),
        slug: form.slug,
        businessType: form.businessType,
        ownerFullName: form.ownerFullName.trim(),
        ownerUsername: form.ownerUsername.trim(),
        ownerPassword: form.ownerPassword,
        ownerWhatsapp: form.ownerWhatsapp.trim() || undefined,
        timezone: 'Africa/Cairo',
        currency: 'EGP',
        defaultTables: 5,
      });

      /*
       * Signup returns a token, so sign them straight in rather than bouncing to a login form for
       * credentials they created ten seconds ago. The session is then hydrated from the server's
       * own entitlement snapshot on the next screen.
       */
      if (result.jwtToken) {
        storage.setAccessToken(result.jwtToken);
        storage.setTenantSlug(result.slug);
        refreshEntitlements?.(null);
        window.location.assign(ROUTES.DASHBOARD);
        return;
      }
      navigate(`${ROUTES.LOGIN}?tenant=${encodeURIComponent(result.slug)}`);
    } catch (err) {
      const status = err.response?.status;
      setError(
        status === 429
          ? err.response?.data?.message || 'عدد كبير من المحاولات. حاول بعد قليل.'
          : err.response?.data?.message || 'تعذر إنشاء الحساب. راجع البيانات وحاول مرة أخرى.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <header className="signup-head">
          <span className="signup-mark"><Coffee size={22} /></span>
          <h1>ابدأ مع كافيو</h1>
          <p>
            {trialPlan
              ? `فترة تجريبية مجانية ${trialPlan.trialDays} يوم — بدون بطاقة ائتمان.`
              : 'فترة تجريبية مجانية — بدون بطاقة ائتمان.'}
          </p>
        </header>

        {trialPlan && (
          <ul className="signup-terms">
            <li><Check size={14} /> {formatLimit(trialPlan.limits.maxTables, 'طاولة')}</li>
            <li><Check size={14} /> {formatLimit(trialPlan.limits.maxUsers, 'مستخدم')}</li>
            <li><Check size={14} /> {formatLimit(trialPlan.limits.maxProducts, 'صنف')}</li>
          </ul>
        )}

        <form onSubmit={handleSubmit} className="signup-form" noValidate>
          <label className="signup-field">
            <span>اسم الكافيه أو المطعم</span>
            <div className="signup-input">
              <Building2 size={16} />
              <input value={form.name} onChange={set('name')} placeholder="كافيه ونس" autoComplete="organization" required />
            </div>
          </label>

          <label className="signup-field">
            <span>عنوان مساحة العمل</span>
            <div className={`signup-input signup-input--slug ${slugState.available === false ? 'is-invalid' : ''}`}>
              <input
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); setForm((p) => ({ ...p, slug: suggestSlug(e.target.value) })); }}
                placeholder="wanas"
                dir="ltr"
                required
              />
              <span className="signup-slug-status">
                {slugState.checking && <Loader2 size={15} className="spin" />}
                {!slugState.checking && slugState.available === true && <Check size={15} className="ok" />}
                {!slugState.checking && slugState.available === false && <X size={15} className="bad" />}
              </span>
            </div>
            <small className={slugState.available === false ? 'bad' : ''}>
              {slugMessage || 'سيستخدمه فريقك لتسجيل الدخول.'}
            </small>
          </label>

          <label className="signup-field">
            <span>نوع النشاط</span>
            <select value={form.businessType} onChange={set('businessType')} className="signup-select">
              <option value="CAFE">كافيه</option>
              <option value="RESTAURANT">مطعم</option>
              <option value="CAFE_AND_RESTAURANT">كافيه ومطعم</option>
            </select>
          </label>

          <label className="signup-field">
            <span>اسمك</span>
            <div className="signup-input">
              <User size={16} />
              <input value={form.ownerFullName} onChange={set('ownerFullName')} placeholder="علاء حرب" autoComplete="name" required />
            </div>
          </label>

          <label className="signup-field">
            <span>اسم المستخدم</span>
            <div className="signup-input">
              <User size={16} />
              <input value={form.ownerUsername} onChange={set('ownerUsername')} placeholder="owner" dir="ltr" autoComplete="username" required />
            </div>
          </label>

          <label className="signup-field">
            <span>كلمة المرور</span>
            <div className={`signup-input ${passwordProblem ? 'is-invalid' : ''}`}>
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.ownerPassword}
                onChange={set('ownerPassword')}
                autoComplete="new-password"
                required
              />
              <button type="button" className="signup-reveal" onClick={() => setShowPassword((v) => !v)} aria-label="إظهار كلمة المرور">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <small className={passwordProblem ? 'bad' : ''}>{passwordProblem || '8 أحرف على الأقل، وتحتوي على حرف ورقم.'}</small>
          </label>

          <label className="signup-field">
            <span>رقم واتساب <em>(اختياري)</em></span>
            <div className="signup-input">
              <input value={form.ownerWhatsapp} onChange={set('ownerWhatsapp')} placeholder="01xxxxxxxxx" dir="ltr" inputMode="tel" />
            </div>
            <small>نستخدمه لتنبيهك قبل انتهاء الاشتراك.</small>
          </label>

          {error && <div className="signup-error" role="alert">{error}</div>}

          <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={!canSubmit} className="signup-submit">
            إنشاء الحساب والبدء
          </Button>
        </form>

        <footer className="signup-foot">
          لديك حساب بالفعل؟ <Link to={ROUTES.LOGIN}>تسجيل الدخول</Link>
        </footer>
      </div>
    </div>
  );
}
