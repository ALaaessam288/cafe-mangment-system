import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ProvisionTenantModal.css';

const INITIAL_DRAFT = {
  name: '',
  slug: '',
  businessType: 'CAFE_AND_RESTAURANT',
  subscriptionPlan: 'PRO',
  ownerWhatsapp: '',
  ownerUsername: '',
  ownerPassword: '',
  ownerFullName: '',
  timezone: 'Africa/Cairo',
  currency: 'EGP',
  templateId: 'CAFE_AND_RESTAURANT',
  defaultTables: 10,
};
const PROVISION_DRAFT_KEY = 'caffio:super-admin:provision-draft';

function loadSavedDraft() {
  try {
    const saved = window.localStorage.getItem(PROVISION_DRAFT_KEY);
    return saved ? { ...INITIAL_DRAFT, ...JSON.parse(saved) } : INITIAL_DRAFT;
  } catch {
    return INITIAL_DRAFT;
  }
}

const STEPS = [
  { id: 1, label: 'هوية المنشأة', hint: 'الاسم والنشاط', icon: 'bi-shop-window' },
  { id: 2, label: 'تجهيز التشغيل', hint: 'الباقة ونقطة البداية', icon: 'bi-sliders2' },
  { id: 3, label: 'المالك والتسليم', hint: 'الدخول والمراجعة', icon: 'bi-person-check' },
];

const BUSINESS_TYPES = [
  { value: 'CAFE', title: 'كافيه', description: 'مشروبات، باريستا، إضافات وأحجام', icon: 'bi-cup-hot', template: 'CLASSIC_CAFE', tables: 8 },
  { value: 'RESTAURANT', title: 'مطعم', description: 'مطبخ، وجبات، صالات وطاولات', icon: 'bi-fork-knife', template: 'EGYPTIAN_RESTAURANT', tables: 15 },
  { value: 'CAFE_AND_RESTAURANT', title: 'كافيه ومطعم', description: 'تشغيل متكامل للبار والمطبخ', icon: 'bi-grid-1x2', template: 'CAFE_AND_RESTAURANT', tables: 12 },
];

const PLANS = [
  { value: 'TRIAL', title: 'تجربة', price: 'مجاناً', period: '14 يوم', description: 'لبدء تجربة العميل', limits: '5 طاولات · مستخدمان · 30 منتجاً', icon: 'bi-hourglass-split' },
  { value: 'STARTER', title: 'Starter', price: '499', period: 'ج.م / شهر', description: 'للمواقع الصغيرة', limits: '20 طاولة · 5 مستخدمين · 100 منتج', icon: 'bi-lightning-charge' },
  { value: 'PRO', title: 'Pro', price: '899', period: 'ج.م / شهر', description: 'أفضل اختيار للتشغيل', limits: '50 طاولة · 15 مستخدماً · 500 منتج', icon: 'bi-stars', featured: true },
  { value: 'ENTERPRISE', title: 'Enterprise', price: '1499', period: 'ج.م / شهر', description: 'للسلاسل والفروع الكبيرة', limits: 'حدود تشغيل موسّعة', icon: 'bi-buildings' },
];

const TEMPLATES = [
  { value: '', title: 'بداية نظيفة', description: 'بدون أصناف جاهزة', icon: 'bi-file-earmark' },
  { value: 'CLASSIC_CAFE', title: 'منيو كافيه', description: 'قهوة، مشروبات وإضافات', icon: 'bi-cup-straw' },
  { value: 'EGYPTIAN_RESTAURANT', title: 'منيو مطعم', description: 'أقسام وأصناف مصرية', icon: 'bi-egg-fried' },
  { value: 'CAFE_AND_RESTAURANT', title: 'منيو متكامل', description: 'بار ومطبخ معاً', icon: 'bi-collection' },
];

const PLAN_TABLE_LIMITS = { TRIAL: 5, STARTER: 20, PRO: 50, ENTERPRISE: 9999 };

const ARABIC_LATIN = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z',
  ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
  ي: 'y', ى: 'a', ة: 'a', ء: '', ئ: 'y', ؤ: 'w', ' ': '-', ـ: '',
};

function slugifyName(value) {
  return [...value.trim()]
    .map((character) => ARABIC_LATIN[character] ?? character)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function generatePassword() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  const values = new Uint32Array(12);
  window.crypto.getRandomValues(values);
  return [...values].map((value) => characters[value % characters.length]).join('');
}

function passwordScore(password) {
  return [password.length >= 8, /[a-z]/i.test(password), /\d/.test(password), /[^a-z0-9]/i.test(password), password.length >= 12]
    .filter(Boolean).length;
}

function validateStep(step, draft, tenants) {
  const errors = {};
  const slug = draft.slug.trim().toLowerCase();

  if (step === 1) {
    if (draft.name.trim().length < 2) errors.name = 'اكتب اسماً واضحاً للمنشأة.';
    if (!slug) errors.slug = 'أنشئ رابطاً مختصراً للمنشأة.';
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.slug = 'استخدم حروفاً إنجليزية وأرقاماً وشرطات بين الكلمات.';
    else if (tenants.some((tenant) => tenant.slug?.toLowerCase() === slug)) errors.slug = 'هذا الرابط مستخدم بالفعل. جرّب اسماً مختلفاً.';
  }

  if (step === 2) {
    const tables = Number(draft.defaultTables);
    const limit = PLAN_TABLE_LIMITS[draft.subscriptionPlan] || 50;
    if (!Number.isInteger(tables) || tables < 0) errors.defaultTables = 'عدد الطاولات يجب أن يكون رقماً صحيحاً يبدأ من صفر.';
    else if (tables > limit) errors.defaultTables = `هذه الباقة تسمح بحد أقصى ${limit === 9999 ? 'غير محدود عملياً' : `${limit} طاولة`}.`;
  }

  if (step === 3) {
    if (draft.ownerFullName.trim().length < 2) errors.ownerFullName = 'اكتب اسم المالك أو المدير المسؤول.';
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(draft.ownerUsername)) errors.ownerUsername = 'من 3 إلى 32 حرفاً إنجليزياً، ويمكن استخدام النقطة أو الشرطة.';
    if (draft.ownerPassword.length < 8 || !/[a-z]/i.test(draft.ownerPassword) || !/\d/.test(draft.ownerPassword)) errors.ownerPassword = 'استخدم 8 أحرف على الأقل وتأكد من وجود حرف ورقم.';
    const phone = draft.ownerWhatsapp.replace(/\D/g, '');
    if (phone && (phone.length < 10 || phone.length > 15)) errors.ownerWhatsapp = 'راجع رقم واتساب، أو اترك الحقل فارغاً.';
  }

  return errors;
}

function FieldError({ message }) {
  return message ? <span className="sa-pv-field-error"><i className="bi bi-exclamation-circle" />{message}</span> : null;
}

export default function ProvisionTenantModal({ tenants, updating, onClose, onProvision }) {
  const [draft, setDraft] = useState(loadSavedDraft);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [slugEdited, setSlugEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [restoredDraft] = useState(() => Boolean(window.localStorage.getItem(PROVISION_DRAFT_KEY)));
  const firstInputRef = useRef(null);

  const selectedPlan = useMemo(() => PLANS.find((plan) => plan.value === draft.subscriptionPlan) || PLANS[2], [draft.subscriptionPlan]);
  const selectedBusiness = useMemo(() => BUSINESS_TYPES.find((business) => business.value === draft.businessType) || BUSINESS_TYPES[2], [draft.businessType]);
  const strength = passwordScore(draft.ownerPassword);
  const completedSignals = [draft.name, draft.slug, draft.subscriptionPlan, draft.ownerFullName, draft.ownerUsername, draft.ownerPassword].filter(Boolean).length;
  const loginUrl = `${window.location.origin}/${draft.slug || 'your-cafe'}/login`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstInputRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setConfirmExit(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handleNameChange(name) {
    setDraft((current) => ({ ...current, name, slug: slugEdited ? current.slug : slugifyName(name) }));
    setErrors((current) => ({ ...current, name: undefined, slug: undefined }));
  }

  function handleSlugChange(value) {
    setSlugEdited(true);
    setField('slug', value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-'));
  }

  function selectBusiness(business) {
    setDraft((current) => ({ ...current, businessType: business.value, templateId: business.template, defaultTables: business.tables }));
    setErrors((current) => ({ ...current, businessType: undefined, defaultTables: undefined }));
  }

  function continueFlow() {
    const nextErrors = validateStep(step, draft, tenants);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setStep((current) => Math.min(3, current + 1));
  }

  function navigateTo(targetStep) {
    if (targetStep < step) {
      setErrors({});
      setStep(targetStep);
    }
  }

  async function submitProvision(event) {
    event.preventDefault();
    const allErrors = { ...validateStep(1, draft, tenants), ...validateStep(2, draft, tenants), ...validateStep(3, draft, tenants) };
    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      if (allErrors.name || allErrors.slug) setStep(1);
      else if (allErrors.defaultTables) setStep(2);
      else setStep(3);
      return;
    }
    if (!confirmed) return;
    try {
      await onProvision({ ...draft, slug: draft.slug.trim().toLowerCase(), defaultTables: Number(draft.defaultTables) });
      window.localStorage.removeItem(PROVISION_DRAFT_KEY);
    } catch {
      // The parent reports the server error; keep this draft available for correction.
    }
  }

  function saveDraftAndClose() {
    window.localStorage.setItem(PROVISION_DRAFT_KEY, JSON.stringify(draft));
    onClose();
  }

  return createPortal(
    <div className="sa-modal-backdrop sa-pv-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmExit(true); }}>
      <div className="sa-pv-dialog" role="dialog" aria-modal="true" aria-labelledby="provision-title">
        <header className="sa-pv-header">
          <div className="sa-pv-header__identity">
            <span className="sa-pv-header__mark"><img src="/caffio-logo-mark.png" alt="" /></span>
            <div><small>CAFFIO · CONTROL CENTER</small><h2 id="provision-title">تأسيس منشأة جديدة</h2><p>حوّل بيانات العميل إلى مساحة تشغيل جاهزة خلال دقائق.</p></div>
          </div>
          <div className="sa-pv-header__meta">{restoredDraft && <span className="is-restored"><i className="bi bi-cloud-check" /> تمت استعادة المسودة</span>}<span><i className="bi bi-shield-check" /> إنشاء آمن</span><span><i className="bi bi-stopwatch" /> نحو 3 دقائق</span></div>
          <button type="button" className="sa-pv-close" onClick={() => setConfirmExit(true)} aria-label="إغلاق"><i className="bi bi-x-lg" /></button>
        </header>

        <nav className="sa-pv-steps" aria-label="مراحل تأسيس المنشأة">
          {STEPS.map((item, index) => (
            <div className="sa-pv-step-wrap" key={item.id}>
              <button type="button" className={`sa-pv-step ${step === item.id ? 'is-current' : ''} ${step > item.id ? 'is-complete' : ''}`} onClick={() => navigateTo(item.id)} disabled={item.id > step}>
                <span>{step > item.id ? <i className="bi bi-check-lg" /> : item.id}</span>
                <i className={`bi ${item.icon}`} />
                <b>{item.label}<small>{item.hint}</small></b>
              </button>
              {index < STEPS.length - 1 && <em className={step > item.id ? 'is-complete' : ''} />}
            </div>
          ))}
        </nav>

        <form className="sa-pv-form" onSubmit={submitProvision} noValidate>
          <main className="sa-pv-main">
            <section className="sa-pv-canvas">
              {step === 1 && (
                <div className="sa-pv-stage" key="identity">
                  <div className="sa-pv-stage__intro"><span>01</span><div><h3>ابدأ بهوية واضحة</h3><p>هذه البيانات ستظهر للمالك والفريق داخل مساحة العمل.</p></div></div>

                  <div className="sa-pv-field sa-pv-field--wide">
                    <label htmlFor="pv-name">اسم المنشأة <b>إلزامي</b></label>
                    <div className={`sa-pv-control ${errors.name ? 'has-error' : ''}`}><i className="bi bi-shop" /><input ref={firstInputRef} id="pv-name" value={draft.name} onChange={(event) => handleNameChange(event.target.value)} placeholder="مثال: روقان كافيه — فرع المعادي" /><span>{draft.name.length}/80</span></div>
                    <FieldError message={errors.name} />
                  </div>

                  <div className="sa-pv-field sa-pv-field--wide">
                    <label htmlFor="pv-slug">رابط مساحة العمل <b>إلزامي</b></label>
                    <div className={`sa-pv-slug ${errors.slug ? 'has-error' : ''}`} dir="ltr"><span>{window.location.host}/</span><input id="pv-slug" value={draft.slug} onChange={(event) => handleSlugChange(event.target.value)} placeholder="rawqan-cafe" /><span>/login</span></div>
                    <div className="sa-pv-field-meta"><small>سننشئ اقتراحاً تلقائياً، ويمكنك تعديله.</small>{draft.slug && !errors.slug && <strong><i className="bi bi-check-circle-fill" /> متاح محلياً</strong>}</div>
                    <FieldError message={errors.slug} />
                  </div>

                  <fieldset className="sa-pv-choice-block">
                    <legend>نموذج التشغيل</legend>
                    <div className="sa-pv-business-grid">
                      {BUSINESS_TYPES.map((business) => (
                        <button type="button" key={business.value} className={draft.businessType === business.value ? 'is-selected' : ''} onClick={() => selectBusiness(business)}>
                          <span><i className={`bi ${business.icon}`} /></span><b>{business.title}<small>{business.description}</small></b><i className="bi bi-check-circle-fill" />
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}

              {step === 2 && (
                <div className="sa-pv-stage" key="operations">
                  <div className="sa-pv-stage__intro"><span>02</span><div><h3>جهّز نقطة البداية</h3><p>اختر القيمة المناسبة ثم قرّر ما الذي يجده العميل عند أول تسجيل دخول.</p></div></div>

                  <fieldset className="sa-pv-choice-block">
                    <legend>باقة الاشتراك</legend>
                    <div className="sa-pv-plan-grid">
                      {PLANS.map((plan) => (
                        <button type="button" key={plan.value} className={`${draft.subscriptionPlan === plan.value ? 'is-selected' : ''} ${plan.featured ? 'is-featured' : ''}`} onClick={() => { setField('subscriptionPlan', plan.value); const limit = PLAN_TABLE_LIMITS[plan.value]; if (draft.defaultTables > limit) setField('defaultTables', limit); }}>
                          {plan.featured && <em>موصى بها</em>}<span><i className={`bi ${plan.icon}`} /></span><b>{plan.title}<small>{plan.description}</small></b><strong>{plan.price}<small>{plan.period}</small></strong><footer>{plan.limits}</footer>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div className="sa-pv-launch-grid">
                    <fieldset className="sa-pv-choice-block">
                      <legend>محتوى البداية</legend>
                      <div className="sa-pv-template-grid">
                        {TEMPLATES.map((template) => <button type="button" key={template.value || 'EMPTY'} className={draft.templateId === template.value ? 'is-selected' : ''} onClick={() => setField('templateId', template.value)}><i className={`bi ${template.icon}`} /><b>{template.title}<small>{template.description}</small></b><span className="bi bi-check-lg" /></button>)}
                      </div>
                    </fieldset>

                    <div className="sa-pv-setup-fields">
                      <div className="sa-pv-field">
                        <label htmlFor="pv-tables">طاولات جاهزة عند التشغيل</label>
                        <div className={`sa-pv-number ${errors.defaultTables ? 'has-error' : ''}`}><button type="button" onClick={() => setField('defaultTables', Math.max(0, Number(draft.defaultTables) - 1))}>−</button><input id="pv-tables" type="number" min="0" max={PLAN_TABLE_LIMITS[draft.subscriptionPlan]} value={draft.defaultTables} onChange={(event) => setField('defaultTables', event.target.value)} /><button type="button" onClick={() => setField('defaultTables', Math.min(PLAN_TABLE_LIMITS[draft.subscriptionPlan], Number(draft.defaultTables) + 1))}>+</button></div>
                        <FieldError message={errors.defaultTables} />
                      </div>
                      <div className="sa-pv-field"><label htmlFor="pv-timezone">المنطقة الزمنية</label><div className="sa-pv-select"><i className="bi bi-clock" /><select id="pv-timezone" value={draft.timezone} onChange={(event) => setField('timezone', event.target.value)}><option value="Africa/Cairo">القاهرة (UTC+2/+3)</option><option value="Asia/Riyadh">الرياض (UTC+3)</option><option value="Asia/Dubai">دبي (UTC+4)</option><option value="UTC">UTC</option></select></div></div>
                      <div className="sa-pv-field"><label htmlFor="pv-currency">العملة الأساسية</label><div className="sa-pv-select"><i className="bi bi-cash-stack" /><select id="pv-currency" value={draft.currency} onChange={(event) => setField('currency', event.target.value)}><option value="EGP">جنيه مصري · EGP</option><option value="SAR">ريال سعودي · SAR</option><option value="AED">درهم إماراتي · AED</option><option value="USD">دولار أمريكي · USD</option></select></div></div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="sa-pv-stage" key="owner">
                  <div className="sa-pv-stage__intro"><span>03</span><div><h3>سلّم الحساب بثقة</h3><p>أنشئ حساب المالك وراجع كل قرار قبل تنفيذ التأسيس.</p></div></div>

                  <div className="sa-pv-owner-grid">
                    <div className="sa-pv-field"><label htmlFor="pv-owner">اسم المالك أو المدير <b>إلزامي</b></label><div className={`sa-pv-control ${errors.ownerFullName ? 'has-error' : ''}`}><i className="bi bi-person" /><input id="pv-owner" value={draft.ownerFullName} onChange={(event) => setField('ownerFullName', event.target.value)} placeholder="مثال: أحمد محمود" /></div><FieldError message={errors.ownerFullName} /></div>
                    <div className="sa-pv-field"><label htmlFor="pv-whatsapp">واتساب التسليم <small>اختياري</small></label><div className={`sa-pv-control ${errors.ownerWhatsapp ? 'has-error' : ''}`} dir="ltr"><i className="bi bi-whatsapp" /><input id="pv-whatsapp" inputMode="tel" value={draft.ownerWhatsapp} onChange={(event) => setField('ownerWhatsapp', event.target.value)} placeholder="010 0000 0000" /></div><FieldError message={errors.ownerWhatsapp} /></div>
                    <div className="sa-pv-field"><label htmlFor="pv-username">اسم المستخدم <b>إلزامي</b></label><div className={`sa-pv-control ${errors.ownerUsername ? 'has-error' : ''}`} dir="ltr"><i className="bi bi-at" /><input id="pv-username" autoComplete="off" value={draft.ownerUsername} onChange={(event) => setField('ownerUsername', event.target.value.trim())} placeholder="admin.rawqan" /></div><FieldError message={errors.ownerUsername} /></div>
                    <div className="sa-pv-field"><label htmlFor="pv-password">كلمة المرور الأولى <b>إلزامي</b></label><div className={`sa-pv-control sa-pv-control--password ${errors.ownerPassword ? 'has-error' : ''}`} dir="ltr"><i className="bi bi-key" /><input id="pv-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={draft.ownerPassword} onChange={(event) => setField('ownerPassword', event.target.value)} placeholder="8 أحرف على الأقل" /><button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}><i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} /></button><button type="button" onClick={() => { setField('ownerPassword', generatePassword()); setShowPassword(true); }}><i className="bi bi-magic" /> توليد</button></div><div className="sa-pv-strength"><span><i style={{ width: `${Math.max(8, strength * 20)}%` }} /></span><small>{strength <= 2 ? 'ضعيفة' : strength <= 4 ? 'جيدة' : 'قوية جداً'}</small></div><FieldError message={errors.ownerPassword} /></div>
                  </div>

                  <section className="sa-pv-review">
                    <header><div><i className="bi bi-clipboard2-check" /><span><strong>ملخص أمر التأسيس</strong><small>راجع الإعدادات التي ستُنفذ الآن</small></span></div><b>{selectedPlan.title}</b></header>
                    <div className="sa-pv-review__grid"><span><small>المنشأة</small><strong>{draft.name}</strong></span><span><small>نموذج التشغيل</small><strong>{selectedBusiness.title}</strong></span><span><small>محتوى البداية</small><strong>{TEMPLATES.find((item) => item.value === draft.templateId)?.title}</strong></span><span><small>الطاولات</small><strong>{draft.defaultTables} طاولة</strong></span></div>
                    <div className="sa-pv-review__url" dir="ltr"><i className="bi bi-link-45deg" /><span>{loginUrl}</span><button type="button" onClick={() => navigator.clipboard?.writeText(loginUrl)}><i className="bi bi-copy" /></button></div>
                  </section>

                  <label className={`sa-pv-confirm ${confirmed ? 'is-confirmed' : ''}`}><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><i className="bi bi-check-lg" /></span><b>راجعت بيانات المنشأة والمالك وأوافق على تنفيذ التأسيس.<small>سيتم إنشاء المنشأة وحساب المدير والمنيو والطاولات في عملية واحدة.</small></b></label>
                </div>
              )}
            </section>

            <aside className="sa-pv-brief">
              <div className="sa-pv-brief__pulse"><span><i className={`bi ${STEPS[step - 1].icon}`} /></span><em>المرحلة {step} من 3</em></div>
              <h3>{step === 1 ? 'هوية قابلة للتوسع' : step === 2 ? 'تشغيل جاهز من اليوم الأول' : 'تسليم واضح وآمن'}</h3>
              <p>{step === 1 ? 'اختر رابطاً قصيراً؛ سيُستخدم في الدخول والروابط التشغيلية.' : step === 2 ? 'القالب والطاولات يختصران وقت إعداد العميل بعد البيع.' : 'لن نفتح واتساب تلقائياً؛ تختار طريقة التسليم بعد نجاح الإنشاء.'}</p>
              <div className="sa-pv-brief__meter"><span><i style={{ width: `${(completedSignals / 6) * 100}%` }} /></span><small>{completedSignals}/6 بيانات أساسية مكتملة</small></div>
              <dl><div><dt>المنشأة</dt><dd>{draft.name || 'بانتظار الاسم'}</dd></div><div><dt>الرابط</dt><dd dir="ltr">/{draft.slug || '—'}</dd></div><div><dt>الباقة</dt><dd>{selectedPlan.title}</dd></div><div><dt>قيمة البداية</dt><dd>{draft.templateId ? 'منيو جاهز' : 'مساحة نظيفة'} · {draft.defaultTables} طاولة</dd></div></dl>
              <footer><i className="bi bi-shield-lock" /><span><strong>بيانات الدخول حساسة</strong><small>ستظهر مرة واحدة في بطاقة التسليم بعد الإنشاء.</small></span></footer>
            </aside>
          </main>

          <footer className="sa-pv-footer">
            <button type="button" className="sa-pv-btn sa-pv-btn--ghost" onClick={saveDraftAndClose}><i className="bi bi-cloud-arrow-up" /> حفظ المسودة والخروج</button>
            <span>لن يتم إنشاء أي شيء قبل التأكيد النهائي.</span>
            <div>{step > 1 && <button type="button" className="sa-pv-btn sa-pv-btn--back" onClick={() => { setErrors({}); setStep((current) => current - 1); }}><i className="bi bi-arrow-right" /> السابق</button>}{step < 3 ? <button type="button" className="sa-pv-btn sa-pv-btn--primary" onClick={continueFlow}>التالي <i className="bi bi-arrow-left" /></button> : <button type="submit" className="sa-pv-btn sa-pv-btn--launch" disabled={updating || !confirmed}>{updating ? <><span className="spinner-border spinner-border-sm" /> جاري التأسيس…</> : <>تأسيس المنشأة <i className="bi bi-rocket-takeoff" /></>}</button>}</div>
          </footer>
        </form>

        {confirmExit && (
          <div className="sa-pv-exit" role="alertdialog" aria-modal="true"><div><span><i className="bi bi-box-arrow-right" /></span><h3>الخروج من التأسيس؟</h3><p>يمكنك الاحتفاظ بالبيانات كمسودة والعودة إليها من أي زر «منشأة جديدة».</p><footer><button type="button" onClick={() => setConfirmExit(false)}>متابعة التعديل</button><button type="button" onClick={saveDraftAndClose}>حفظ وخروج</button><button type="button" onClick={() => { window.localStorage.removeItem(PROVISION_DRAFT_KEY); onClose(); }}>خروج بدون حفظ</button></footer></div></div>
        )}
      </div>
    </div>,
    document.body
  );
}
