import { useCallback, useEffect, useMemo, useState } from 'react';
import { upgradeAdminApi } from '../../../api/subscriptionApi';
import { useToast } from '../../../context/ToastContext';
import './UpgradeInbox.css';

/*
 * Review queue for bank-transfer upgrade requests.
 *
 * The backend for this has existed since the billing rework — submit, approve, reject — but nothing
 * in the console ever called it. Customers could raise an upgrade request from their settings page
 * and it went into a table no human being could see, so the only payment path that does not involve
 * a licence key could never complete. This is that missing screen.
 *
 * Approving is the moment money becomes a subscription, so the form asks for what actually landed
 * rather than assuming the quote was paid in full — a short transfer is recorded as short.
 */

const STATUS = {
  PENDING:   { label: 'قيد المراجعة', tone: 'pending' },
  APPROVED:  { label: 'تم الاعتماد',  tone: 'ok' },
  REJECTED:  { label: 'مرفوض',        tone: 'bad' },
  CANCELLED: { label: 'ملغي',         tone: 'muted' },
};

const money = (value, currency) => `${Number(value ?? 0).toLocaleString()} ${currency || 'EGP'}`;

const when = (value) => (value ? new Date(value).toLocaleString('ar-EG', {
  dateStyle: 'medium', timeStyle: 'short',
}) : '—');

export default function UpgradeInbox({ tenants, onReviewed }) {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [draft, setDraft] = useState({});

  const tenantById = useMemo(
    () => new Map((tenants || []).map((t) => [t.id, t])),
    [tenants],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await upgradeAdminApi.list(false));
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => requests.filter((r) => r.status === 'PENDING'), [requests]);
  const visible = showAll ? requests : pending;

  const draftFor = (request) => draft[request.id] ?? {
    amountReceived: request.quotedAmount,
    reference: request.transferReference || '',
    note: '',
  };

  const setDraftField = (id, field, value) =>
    setDraft((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), [field]: value } }));

  async function approve(request) {
    const values = draftFor(request);
    const amount = Number(values.amountReceived);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('أدخل المبلغ المستلم فعلياً');
      return;
    }
    setBusyId(request.id);
    try {
      await upgradeAdminApi.approve(request.id, {
        amountReceived: amount,
        reference: values.reference?.trim() || null,
        note: values.note?.trim() || null,
      });
      toast.success('تم اعتماد التحويل وتفعيل الاشتراك 🚀');
      await load();
      onReviewed?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'تعذر اعتماد الطلب');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(request) {
    const reason = draftFor(request).note?.trim();
    setBusyId(request.id);
    try {
      await upgradeAdminApi.reject(request.id, reason || 'لم يصل التحويل');
      toast.success('تم رفض الطلب');
      await load();
      onReviewed?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'تعذر رفض الطلب');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="sa-inbox">
      <header className="sa-inbox__head">
        <div>
          <span>PAYMENTS</span>
          <h3>طلبات الترقية بالتحويل البنكي</h3>
          <p>راجع التحويل، أكّد المبلغ المستلم، ويُفعَّل الاشتراك وتُصدر الفاتورة تلقائياً.</p>
        </div>
        <div className="sa-inbox__head-actions">
          <span className={`sa-inbox__count ${pending.length ? 'is-hot' : ''}`}>
            {pending.length} بانتظار المراجعة
          </span>
          <button type="button" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'المعلّقة فقط' : 'عرض الكل'}
          </button>
          <button type="button" onClick={load} disabled={loading}>
            <i className="bi bi-arrow-clockwise" /> تحديث
          </button>
        </div>
      </header>

      {loading && <p className="sa-inbox__empty">جاري التحميل…</p>}

      {!loading && visible.length === 0 && (
        <p className="sa-inbox__empty">
          {showAll ? 'لا توجد طلبات ترقية بعد.' : 'لا توجد طلبات بانتظار المراجعة ✓'}
        </p>
      )}

      <ul className="sa-inbox__list">
        {visible.map((request) => {
          const tenant = tenantById.get(request.tenantId);
          const meta = STATUS[request.status] ?? STATUS.CANCELLED;
          const values = draftFor(request);
          const isBusy = busyId === request.id;

          return (
            <li key={request.id} className={`sa-inbox__row sa-inbox__row--${meta.tone}`}>
              <div className="sa-inbox__summary">
                <div className="sa-inbox__who">
                  <strong>{tenant?.name || `منشأة #${request.tenantId}`}</strong>
                  <small dir="ltr">{tenant?.slug || ''}</small>
                </div>
                <div className="sa-inbox__what">
                  <span className="sa-inbox__plan">{request.requestedPlanCode}</span>
                  <span className="sa-inbox__amount">{money(request.quotedAmount, request.currency)}</span>
                  <small>{request.requestedPeriodDays} يوم</small>
                </div>
                <div className="sa-inbox__meta">
                  <span className={`sa-inbox__status sa-inbox__status--${meta.tone}`}>{meta.label}</span>
                  <small>{when(request.createdAt)}</small>
                </div>
              </div>

              <dl className="sa-inbox__detail">
                {request.contactName && (<><dt>جهة الاتصال</dt><dd>{request.contactName}</dd></>)}
                {request.contactPhone && (<><dt>الهاتف</dt><dd dir="ltr">{request.contactPhone}</dd></>)}
                {request.transferReference && (<><dt>رقم العملية</dt><dd dir="ltr">{request.transferReference}</dd></>)}
                {request.customerNote && (<><dt>ملاحظة العميل</dt><dd>{request.customerNote}</dd></>)}
                {request.status !== 'PENDING' && (
                  <>
                    <dt>روجع بواسطة</dt><dd>{request.reviewedBy || '—'} · {when(request.reviewedAt)}</dd>
                    {request.settledAmount != null && (
                      <><dt>المبلغ المستلم</dt><dd>{money(request.settledAmount, request.currency)}</dd></>
                    )}
                    {request.reviewNote && (<><dt>سبب / ملاحظة</dt><dd>{request.reviewNote}</dd></>)}
                  </>
                )}
              </dl>

              {request.status === 'PENDING' && (
                <div className="sa-inbox__review">
                  <label>
                    <span>المبلغ المستلم فعلياً</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values.amountReceived}
                      onChange={(e) => setDraftField(request.id, 'amountReceived', e.target.value)}
                    />
                  </label>
                  <label>
                    <span>رقم العملية</span>
                    <input
                      type="text"
                      dir="ltr"
                      value={values.reference}
                      onChange={(e) => setDraftField(request.id, 'reference', e.target.value)}
                    />
                  </label>
                  <label className="sa-inbox__note">
                    <span>ملاحظة المراجعة</span>
                    <input
                      type="text"
                      value={values.note}
                      onChange={(e) => setDraftField(request.id, 'note', e.target.value)}
                      placeholder="اختياري — يظهر للعميل عند الرفض"
                    />
                  </label>
                  <div className="sa-inbox__actions">
                    <button
                      type="button"
                      className="sa-inbox__approve"
                      onClick={() => approve(request)}
                      disabled={isBusy}
                    >
                      {isBusy ? '…' : <><i className="bi bi-check-lg" /> اعتماد وتفعيل</>}
                    </button>
                    <button
                      type="button"
                      className="sa-inbox__reject"
                      onClick={() => reject(request)}
                      disabled={isBusy}
                    >
                      <i className="bi bi-x-lg" /> رفض
                    </button>
                  </div>
                  {Number(values.amountReceived) !== Number(request.quotedAmount) && (
                    <p className="sa-inbox__warn">
                      <i className="bi bi-exclamation-triangle" />
                      المبلغ يختلف عن المطلوب ({money(request.quotedAmount, request.currency)}) — سيُسجَّل كما هو.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
