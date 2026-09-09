import { useEffect, useMemo, useState } from 'react';
import { plansApi, UNLIMITED } from '../../../api/plansApi';
import { useToast } from '../../../context/ToastContext';
import './PlanEditor.css';

/*
 * The plan catalogue, editable.
 *
 * This tab used to be four hand-written cards with prices and limits typed into the JSX — so the
 * whole point of moving plans into the database (change a price without a release) was lost the
 * moment an operator looked at the console. plansApi.create/update/retire have existed all along.
 *
 * Editing a plan changes what is sold next. It never rewrites an existing subscription: the price
 * a tenant pays is frozen on their subscription row at purchase, and their invoices snapshot it.
 */

const BLANK = {
  code: '',
  displayName: '',
  displayNameEn: '',
  description: '',
  price: 0,
  currency: 'EGP',
  billingPeriodDays: 30,
  trialDays: 0,
  maxTables: 10,
  maxUsers: 3,
  maxProducts: 50,
  features: [],
  sortOrder: 0,
  active: true,
  selfSelectable: false,
  customPlan: false,
};

const toForm = (plan) => ({
  code: plan.code,
  displayName: plan.displayName ?? '',
  displayNameEn: plan.displayNameEn ?? '',
  description: plan.description ?? '',
  price: plan.price ?? 0,
  currency: plan.currency ?? 'EGP',
  billingPeriodDays: plan.billingPeriodDays ?? 30,
  trialDays: plan.trialDays ?? 0,
  maxTables: plan.limits.maxTables,
  maxUsers: plan.limits.maxUsers,
  maxProducts: plan.limits.maxProducts,
  features: plan.features.map((f) => f.code),
  sortOrder: plan.sortOrder ?? 0,
  active: plan.active,
  selfSelectable: plan.selfSelectable,
  customPlan: plan.customPlan,
});

function LimitInput({ label, value, onChange }) {
  const unlimited = Number(value) === UNLIMITED;
  return (
    <label className="pe-field">
      <span>{label}</span>
      <div className="pe-limit">
        <input
          type="number"
          min="1"
          max="100000"
          disabled={unlimited}
          value={unlimited ? '' : value}
          placeholder={unlimited ? 'بلا حدود' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="pe-unlimited">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => onChange(e.target.checked ? UNLIMITED : 10)}
          />
          بلا حدود
        </label>
      </div>
    </label>
  );
}

export default function PlanEditor({ plans, planCounts, onChanged }) {
  const toast = useToast();
  const [features, setFeatures] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    plansApi.features().then(setFeatures).catch(() => setFeatures([]));
  }, []);

  const sorted = useMemo(
    () => [...plans].sort((a, b) => a.sortOrder - b.sortOrder),
    [plans],
  );

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function startCreate() {
    setForm(BLANK);
    setEditing('new');
  }

  function startEdit(plan) {
    setForm(toForm(plan));
    setEditing(plan.id);
  }

  function toggleFeature(code) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(code)
        ? prev.features.filter((f) => f !== code)
        : [...prev.features, code],
    }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      price: Number(form.price),
      billingPeriodDays: Number(form.billingPeriodDays),
      trialDays: Number(form.trialDays),
      maxTables: Number(form.maxTables),
      maxUsers: Number(form.maxUsers),
      maxProducts: Number(form.maxProducts),
      sortOrder: Number(form.sortOrder),
    };
    try {
      if (editing === 'new') {
        await plansApi.create(payload);
        toast.success('تم إنشاء الباقة');
      } else {
        await plansApi.update(editing, payload);
        toast.success('تم حفظ الباقة. تُطبَّق على الاشتراكات الجديدة فقط.');
      }
      setEditing(null);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'تعذر حفظ الباقة');
    } finally {
      setSaving(false);
    }
  }

  async function retire(plan) {
    const subscribers = planCounts?.[plan.code] ?? 0;
    const message = subscribers > 0
      ? `${subscribers} منشأة على هذه الباقة. إيقافها يمنع بيعها للعملاء الجدد فقط، ولن يؤثر على المشتركين الحاليين. متابعة؟`
      : 'إيقاف بيع هذه الباقة؟';
    if (!window.confirm(message)) return;
    try {
      await plansApi.retire(plan.id);
      toast.success('تم إيقاف بيع الباقة');
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر إيقاف الباقة');
    }
  }

  return (
    <div className="pe">
      <div className="pe-grid">
        {sorted.map((plan) => (
          <article key={plan.id} className={`pe-card ${plan.active ? '' : 'is-retired'}`}>
            <header>
              <div>
                <h4>{plan.displayName}</h4>
                <code>{plan.code}</code>
              </div>
              <strong>
                {plan.price > 0 ? plan.price.toLocaleString() : 'مجاناً'}
                <small>{plan.price > 0 ? `${plan.currency}/${plan.billingPeriodDays}ي` : `${plan.trialDays} يوم`}</small>
              </strong>
            </header>

            <ul className="pe-limits">
              <li><span>طاولات</span><b>{plan.limits.tablesUnlimited ? '∞' : plan.limits.maxTables}</b></li>
              <li><span>مستخدمون</span><b>{plan.limits.usersUnlimited ? '∞' : plan.limits.maxUsers}</b></li>
              <li><span>أصناف</span><b>{plan.limits.productsUnlimited ? '∞' : plan.limits.maxProducts}</b></li>
            </ul>

            <div className="pe-features">
              {plan.features.slice(0, 6).map((f) => <span key={f.code}>{f.displayName}</span>)}
              {plan.features.length > 6 && <span className="pe-more">+{plan.features.length - 6}</span>}
            </div>

            <footer>
              <span className="pe-subs">{planCounts?.[plan.code] ?? 0} منشأة</span>
              <div>
                {!plan.active && <em>موقوفة عن البيع</em>}
                {plan.selfSelectable && <em className="pe-self">تسجيل ذاتي</em>}
                {plan.customPlan && <em className="pe-custom">مخصصة</em>}
                <button type="button" onClick={() => startEdit(plan)}>تعديل</button>
                {plan.active && <button type="button" className="pe-retire" onClick={() => retire(plan)}>إيقاف</button>}
              </div>
            </footer>
          </article>
        ))}

        <button type="button" className="pe-add" onClick={startCreate}>
          <i className="bi bi-plus-lg" />
          <span>باقة جديدة</span>
        </button>
      </div>

      {editing !== null && (
        <div className="pe-modal" role="dialog" aria-modal="true">
          <form className="pe-form" onSubmit={save}>
            <header>
              <h3>{editing === 'new' ? 'باقة جديدة' : `تعديل ${form.displayName}`}</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="إغلاق"><i className="bi bi-x-lg" /></button>
            </header>

            <p className="pe-note">
              <i className="bi bi-info-circle" />
              التعديل يسري على الاشتراكات الجديدة فقط. الأسعار المثبَّتة على الاشتراكات القائمة وفواتيرها لا تتغير.
            </p>

            <div className="pe-row">
              <label className="pe-field">
                <span>الكود</span>
                <input dir="ltr" value={form.code} onChange={set('code')} disabled={editing !== 'new'} required />
              </label>
              <label className="pe-field">
                <span>الاسم بالعربية</span>
                <input value={form.displayName} onChange={set('displayName')} required />
              </label>
              <label className="pe-field">
                <span>الاسم بالإنجليزية</span>
                <input dir="ltr" value={form.displayNameEn} onChange={set('displayNameEn')} />
              </label>
            </div>

            <div className="pe-row">
              <label className="pe-field">
                <span>السعر</span>
                <input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
              </label>
              <label className="pe-field">
                <span>العملة</span>
                <input dir="ltr" maxLength={8} value={form.currency} onChange={set('currency')} />
              </label>
              <label className="pe-field">
                <span>مدة الدورة (يوم)</span>
                <input type="number" min="1" value={form.billingPeriodDays} onChange={set('billingPeriodDays')} />
              </label>
              <label className="pe-field">
                <span>أيام التجربة</span>
                <input type="number" min="0" value={form.trialDays} onChange={set('trialDays')} />
              </label>
            </div>

            <div className="pe-row">
              <LimitInput label="الطاولات" value={form.maxTables} onChange={(v) => setForm((p) => ({ ...p, maxTables: v }))} />
              <LimitInput label="المستخدمون" value={form.maxUsers} onChange={(v) => setForm((p) => ({ ...p, maxUsers: v }))} />
              <LimitInput label="الأصناف" value={form.maxProducts} onChange={(v) => setForm((p) => ({ ...p, maxProducts: v }))} />
            </div>

            <fieldset className="pe-featureset">
              <legend>المزايا المشمولة</legend>
              <div>
                {features.map((feature) => (
                  <label key={feature.code} className={form.features.includes(feature.code) ? 'is-on' : ''}>
                    <input
                      type="checkbox"
                      checked={form.features.includes(feature.code)}
                      onChange={() => toggleFeature(feature.code)}
                    />
                    {feature.displayName}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="pe-row pe-row--flags">
              <label className="pe-check">
                <input type="checkbox" checked={form.active} onChange={set('active')} />
                معروضة للبيع
              </label>
              <label className="pe-check">
                <input type="checkbox" checked={form.selfSelectable} onChange={set('selfSelectable')} />
                يمكن اختيارها ذاتياً عند التسجيل
              </label>
              <label className="pe-check">
                <input type="checkbox" checked={form.customPlan} onChange={set('customPlan')} />
                باقة مخصصة (حدودها تُضبط لكل عميل)
              </label>
              <label className="pe-field pe-field--narrow">
                <span>الترتيب</span>
                <input type="number" value={form.sortOrder} onChange={set('sortOrder')} />
              </label>
            </div>

            <footer>
              <button type="button" onClick={() => setEditing(null)}>إلغاء</button>
              <button type="submit" className="pe-save" disabled={saving}>
                {saving ? 'جاري الحفظ…' : 'حفظ الباقة'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
