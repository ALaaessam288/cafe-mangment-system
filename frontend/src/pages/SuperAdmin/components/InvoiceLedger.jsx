import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { billingApi } from '../../../api/subscriptionApi';
import { useToast } from '../../../context/ToastContext';
import './InvoiceLedger.css';

/*
 * The platform's invoice ledger.
 *
 * Invoices have been issued since the billing rework, and the only way to look at one was to ask
 * for a single tenant's list by id. Nothing on the console could answer the question an operator
 * actually has — "who owes me money, and how much is late" — so `outstanding` appeared as a number
 * on the dashboard with no way to drill into it. This is that screen.
 *
 * Recording a payment here books what actually arrived, not what was billed: a short transfer
 * leaves the invoice PARTIALLY_PAID with a real balance rather than being rounded to settled.
 */

const STATUS = {
  ISSUED:         { label: 'مستحقة',      tone: 'due' },
  PARTIALLY_PAID: { label: 'مدفوعة جزئياً', tone: 'partial' },
  PAID:           { label: 'مدفوعة',      tone: 'ok' },
  VOID:           { label: 'ملغاة',       tone: 'muted' },
};

const FILTERS = [
  { id: '',               label: 'الكل' },
  { id: 'ISSUED',         label: 'مستحقة' },
  { id: 'PARTIALLY_PAID', label: 'مدفوعة جزئياً' },
  { id: 'PAID',           label: 'مدفوعة' },
  { id: 'VOID',           label: 'ملغاة' },
];

const METHODS = [
  { id: 'BANK_TRANSFER', label: 'تحويل بنكي' },
  { id: 'CASH',          label: 'نقدي' },
  { id: 'WALLET',        label: 'محفظة إلكترونية' },
  { id: 'CARD',          label: 'بطاقة' },
  { id: 'OTHER',         label: 'أخرى' },
];

const money = (value, currency) => `${Number(value ?? 0).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})} ${currency || 'EGP'}`;

const day = (value) => (value
  ? new Date(value).toLocaleDateString('ar-EG', { dateStyle: 'medium' })
  : '—');

export default function InvoiceLedger({ onChanged }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [draft, setDraft] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await billingApi.allInvoices({ status: status || null, page, size: 25 });
      setRows(data?.content || []);
      setTotalPages(Math.max(1, data?.totalPages ?? 1));
      setTotalRows(data?.totalElements ?? 0);
    } catch (err) {
      toast.error(err.message, 'تعذّر تحميل الفواتير');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, page, toast]);

  useEffect(() => { load(); }, [load]);

  // Changing the filter must not leave the reader on page 4 of a shorter result set.
  useEffect(() => { setPage(0); }, [status]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    billed: acc.billed + Number(r.amount || 0),
    collected: acc.collected + Number(r.amountPaid || 0),
    outstanding: acc.outstanding + (r.status === 'VOID' ? 0 : Number(r.balanceDue || 0)),
    overdue: acc.overdue + (r.overdue ? 1 : 0),
  }), { billed: 0, collected: 0, outstanding: 0, overdue: 0 }), [rows]);

  function openRow(row) {
    if (openId === row.id) { setOpenId(null); return; }
    setOpenId(row.id);
    setDraft({
      // Default to the balance, which is what a normal settlement pays.
      amount: String(row.balanceDue ?? ''),
      method: 'BANK_TRANSFER',
      reference: '',
      notes: '',
    });
  }

  async function submitPayment(row) {
    const amount = parseFloat(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.warning('اكتب المبلغ اللي وصل فعلاً');
      return;
    }
    if (amount > Number(row.balanceDue) + 0.001) {
      toast.warning('المبلغ أكبر من المتبقي على الفاتورة');
      return;
    }
    setBusyId(row.id);
    try {
      await billingApi.recordPayment(row.id, {
        amount,
        method: draft.method,
        reference: draft.reference?.trim() || null,
        notes: draft.notes?.trim() || null,
      });
      toast.success(`تم تسجيل ${money(amount, row.currency)} على فاتورة ${row.invoiceNumber}`);
      setOpenId(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message, 'تعذّر تسجيل الدفعة');
    } finally {
      setBusyId(null);
    }
  }

  async function voidInvoice(row) {
    const reason = window.prompt(
      `إلغاء الفاتورة ${row.invoiceNumber} بقيمة ${money(row.amount, row.currency)}.\nاكتب السبب:`
    );
    if (reason === null) return;
    if (!reason.trim()) { toast.warning('السبب مطلوب لإلغاء فاتورة'); return; }
    setBusyId(row.id);
    try {
      await billingApi.voidInvoice(row.id, reason.trim());
      toast.success(`تم إلغاء الفاتورة ${row.invoiceNumber}`);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err.message, 'تعذّر إلغاء الفاتورة');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="inv-ledger">
      <div className="inv-ledger__head">
        <div className="inv-ledger__filters" role="tablist" aria-label="تصفية الفواتير">
          {FILTERS.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              role="tab"
              aria-selected={status === f.id}
              className={`inv-chip ${status === f.id ? 'inv-chip--on' : ''}`}
              onClick={() => setStatus(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className="inv-refresh" onClick={load} disabled={loading}>
          <i className="bi bi-arrow-clockwise" /> تحديث
        </button>
      </div>

      {/* Totals describe the page on screen, and say so — a figure labelled as a grand total
          that only sums 25 rows is worse than no figure at all. */}
      <div className="inv-ledger__totals">
        <div><span>مفوتر (هذه الصفحة)</span><strong>{money(totals.billed)}</strong></div>
        <div><span>محصّل</span><strong className="is-ok">{money(totals.collected)}</strong></div>
        <div><span>متبقٍ</span><strong className="is-due">{money(totals.outstanding)}</strong></div>
        <div><span>متأخرة</span><strong className={totals.overdue ? 'is-bad' : ''}>{totals.overdue}</strong></div>
      </div>

      {loading ? (
        <div className="inv-ledger__empty">جاري التحميل…</div>
      ) : rows.length === 0 ? (
        <div className="inv-ledger__empty">
          {status ? 'مفيش فواتير بالحالة دي.' : 'مفيش فواتير لسه.'}
        </div>
      ) : (
        <div className="inv-ledger__table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>الفاتورة</th>
                <th>العميل</th>
                <th>الباقة</th>
                <th>الحالة</th>
                <th>صدرت</th>
                <th>الاستحقاق</th>
                <th className="num">القيمة</th>
                <th className="num">المحصّل</th>
                <th className="num">المتبقي</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = STATUS[row.status] || { label: row.status, tone: 'muted' };
                const settleable = row.status === 'ISSUED' || row.status === 'PARTIALLY_PAID';
                return (
                  <Fragment key={row.id}>
                    <tr className={row.overdue ? 'is-overdue' : ''}>
                      <td className="mono">{row.invoiceNumber}</td>
                      <td>{row.tenantName}</td>
                      <td>{row.planName || row.planCode || '—'}</td>
                      <td>
                        <span className={`inv-badge inv-badge--${meta.tone}`}>{meta.label}</span>
                        {row.overdue && <span className="inv-badge inv-badge--bad">متأخرة</span>}
                      </td>
                      <td>{day(row.issuedAt)}</td>
                      <td>{day(row.dueAt)}</td>
                      <td className="num">{money(row.amount, row.currency)}</td>
                      <td className="num is-ok">{money(row.amountPaid, row.currency)}</td>
                      <td className="num is-due">{money(row.balanceDue, row.currency)}</td>
                      <td className="actions">
                        {settleable && (
                          <>
                            <button type="button" onClick={() => openRow(row)} disabled={busyId === row.id}>
                              {openId === row.id ? 'إغلاق' : 'تسجيل دفعة'}
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => voidInvoice(row)}
                              disabled={busyId === row.id}
                            >
                              إلغاء
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {openId === row.id && (
                      <tr className="inv-form-row">
                        <td colSpan={10}>
                          <div className="inv-form">
                            <label>
                              <span>المبلغ اللي وصل</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={row.balanceDue}
                                value={draft.amount}
                                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                                autoFocus
                              />
                              <small>المتبقي: {money(row.balanceDue, row.currency)}</small>
                            </label>
                            <label>
                              <span>الطريقة</span>
                              <select
                                value={draft.method}
                                onChange={(e) => setDraft({ ...draft, method: e.target.value })}
                              >
                                {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>رقم العملية / المرجع</span>
                              <input
                                type="text"
                                value={draft.reference}
                                onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                                placeholder="رقم التحويل"
                              />
                            </label>
                            <label className="wide">
                              <span>ملاحظات</span>
                              <input
                                type="text"
                                value={draft.notes}
                                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                              />
                            </label>
                            <div className="inv-form__actions">
                              <button type="button" className="is-ghost" onClick={() => setOpenId(null)}>
                                إلغاء
                              </button>
                              <button
                                type="button"
                                className="is-primary"
                                onClick={() => submitPayment(row)}
                                disabled={busyId === row.id}
                              >
                                {busyId === row.id ? 'جاري التسجيل…' : 'تسجيل الدفعة'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="inv-ledger__pager">
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>
            السابق
          </button>
          <span>صفحة {page + 1} من {totalPages} · {totalRows} فاتورة</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
