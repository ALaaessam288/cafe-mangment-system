import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, Clock, Copy, X } from 'lucide-react';
import { plansApi, formatLimit } from '../../api/plansApi';
import { upgradeApi } from '../../api/subscriptionApi';
import { useToast } from '../../context/ToastContext';
import Button from '../Button/Button';
import './UpgradeRequestCard.css';

/*
 * Upgrading by bank transfer, end to end.
 *
 * Previously the only way to upgrade was a WhatsApp link — "تواصل لتجديد أو ترقية الاشتراك" —
 * which meant the request existed nowhere in the system. The customer could not see whether it had
 * been received, the platform could not see what was outstanding, and the transfer reference lived
 * in someone's chat history.
 *
 * The customer now picks a plan, sees the exact amount and where to send it, and submits a request
 * that both sides can track.
 */

const STATUS = {
  PENDING: { label: 'قيد المراجعة', tone: 'pending', icon: Clock },
  APPROVED: { label: 'تم التفعيل', tone: 'ok', icon: Check },
  REJECTED: { label: 'مرفوض', tone: 'bad', icon: X },
  CANCELLED: { label: 'ملغي', tone: 'muted', icon: X },
};

export default function UpgradeRequestCard({ currentPlanCode, onUpgraded }) {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [bank, setBank] = useState(null);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = () =>
    upgradeApi
      .mine()
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res?.content)
          ? res.content
          : Array.isArray(res?.data)
          ? res.data
          : [];
        setRequests(list);
      })
      .catch(() => setRequests([]));

  useEffect(() => {
    plansApi
      .list()
      .then((all) => {
        const list = Array.isArray(all)
          ? all
          : Array.isArray(all?.content)
          ? all.content
          : Array.isArray(all?.data)
          ? all.data
          : [];
        const payable = list.filter((p) => p && !p.selfSelectable && p.price > 0);
        setPlans(payable);
        setSelected((prev) => prev ?? payable.find((p) => p.code !== currentPlanCode)?.code ?? null);
      })
      .catch(() => setPlans([]));
    upgradeApi.bankDetails().then(setBank).catch(() => setBank(null));
    reload();
  }, [currentPlanCode]);

  const requestList = Array.isArray(requests) ? requests : [];
  const planList = Array.isArray(plans) ? plans : [];
  const open = useMemo(() => requestList.find((r) => r && r.status === 'PENDING') ?? null, [requestList]);
  const plan = useMemo(() => planList.find((p) => p && p.code === selected) ?? null, [planList, selected]);

  async function submit(e) {
    e.preventDefault();
    if (!plan) return;
    setSubmitting(true);
    try {
      await upgradeApi.submit({
        planCode: plan.code,
        transferReference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });
      setReference('');
      setNote('');
      await reload();
      toast.success('تم إرسال طلب الترقية. سنؤكد التفعيل بعد وصول التحويل.');
      onUpgraded?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  }

  async function withdraw(id) {
    try {
      await upgradeApi.withdraw(id);
      await reload();
      toast.success('تم سحب الطلب');
    } catch (err) {
      toast.error(err.response?.data?.message || 'تعذر سحب الطلب');
    }
  }

  function copy(value, label) {
    navigator.clipboard?.writeText(value)
      .then(() => toast.success(`تم نسخ ${label}`))
      .catch(() => {});
  }

  return (
    <div className="upgrade-card">
      <h2 className="upgrade-card__title">
        <Banknote size={18} /> ترقية الاشتراك بالتحويل البنكي
      </h2>

      {open ? (
        <div className="upgrade-open">
          <p className="upgrade-open__lead">
            طلبك لباقة <strong>{open.requestedPlanCode}</strong> بمبلغ{' '}
            <strong>{open.quotedAmount} {open.currency}</strong> قيد المراجعة.
          </p>
          <p className="upgrade-open__hint">
            سيتم التفعيل فور تأكيد وصول التحويل. لو حوّلت بالفعل ونسيت إضافة رقم العملية، تواصل معنا.
          </p>
          <Button variant="secondary" onClick={() => withdraw(open.id)}>سحب الطلب</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="upgrade-form">
          <div className="upgrade-plans">
            {planList.map((p) => (
              <button
                type="button"
                key={p.code}
                className={`upgrade-plan ${selected === p.code ? 'is-selected' : ''}`}
                onClick={() => setSelected(p.code)}
                aria-pressed={selected === p.code}
              >
                <span className="upgrade-plan__name">{p.displayName}</span>
                <span className="upgrade-plan__price">{p.price} {p.currency}<small> / {p.billingPeriodDays} يوم</small></span>
                <span className="upgrade-plan__limits">
                  {formatLimit(p.limits?.maxTables, 'طاولة')} · {formatLimit(p.limits?.maxUsers, 'مستخدم')} · {formatLimit(p.limits?.maxProducts, 'صنف')}
                </span>
                {p.code === currentPlanCode && <span className="upgrade-plan__current">باقتك الحالية</span>}
              </button>
            ))}
          </div>

          {bank?.configured ? (
            <div className="upgrade-bank">
              <h3>حوِّل المبلغ إلى</h3>
              <dl>
                {bank.bankName && <><dt>البنك</dt><dd>{bank.bankName}</dd></>}
                {bank.accountName && <><dt>اسم الحساب</dt><dd>{bank.accountName}</dd></>}
                {bank.accountNumber && (
                  <><dt>رقم الحساب</dt>
                    <dd>
                      <span dir="ltr">{bank.accountNumber}</span>
                      <button type="button" onClick={() => copy(bank.accountNumber, 'رقم الحساب')} aria-label="نسخ"><Copy size={13} /></button>
                    </dd></>
                )}
                {bank.iban && (
                  <><dt>IBAN</dt>
                    <dd>
                      <span dir="ltr">{bank.iban}</span>
                      <button type="button" onClick={() => copy(bank.iban, 'الآيبان')} aria-label="نسخ"><Copy size={13} /></button>
                    </dd></>
                )}
                {bank.wallet && (
                  <><dt>محفظة إلكترونية</dt>
                    <dd>
                      <span dir="ltr">{bank.wallet}</span>
                      <button type="button" onClick={() => copy(bank.wallet, 'رقم المحفظة')} aria-label="نسخ"><Copy size={13} /></button>
                    </dd></>
                )}
                {plan && <><dt>المبلغ</dt><dd><strong>{plan.price} {plan.currency}</strong></dd></>}
              </dl>
              {bank.instructions && <p className="upgrade-bank__note">{bank.instructions}</p>}
            </div>
          ) : (
            <p className="upgrade-bank upgrade-bank--missing">
              لم يتم ضبط بيانات التحويل بعد. أرسل الطلب وسنتواصل معك ببيانات الدفع
              {bank?.supportPhone ? ` أو اتصل بنا على ${bank.supportPhone}` : ''}.
            </p>
          )}

          <label className="upgrade-field">
            <span>رقم عملية التحويل <em>(اختياري)</em></span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} dir="ltr" maxLength={120} />
            <small>يساعدنا في مطابقة التحويل وتفعيل الاشتراك أسرع.</small>
          </label>

          <label className="upgrade-field">
            <span>ملاحظة <em>(اختياري)</em></span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </label>

          <Button type="submit" variant="primary" loading={submitting} disabled={!plan || submitting}>
            إرسال طلب الترقية
          </Button>
        </form>
      )}

      {requestList.length > 0 && (
        <div className="upgrade-history">
          <h3>سجل الطلبات</h3>
          <ul>
            {requestList.map((r) => {
              const meta = STATUS[r.status] ?? STATUS.CANCELLED;
              const Icon = meta.icon;
              return (
                <li key={r.id} className={`upgrade-history__row upgrade-history__row--${meta.tone}`}>
                  <Icon size={14} />
                  <span>{r.requestedPlanCode}</span>
                  <span>{r.quotedAmount} {r.currency}</span>
                  <span className="upgrade-history__status">{meta.label}</span>
                  {r.reviewNote && <span className="upgrade-history__note">{r.reviewNote}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
