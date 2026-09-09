import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, Package, Search, TrendingDown } from 'lucide-react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { auditApi } from '../../api/auditApi';
import { useToast } from '../../context/ToastContext';
import './ShiftAuditModal.css';

/*
 * Shift stocktake — counting the raw materials at the start and end of a shift.
 *
 * The single most important change here is that the count fields start EMPTY.
 *
 * They used to be prefilled with the system's own `stockQuantity`, which quietly destroys the
 * point of the exercise. A stocktake exists to discover the gap between what the system believes
 * and what is physically on the shelf; showing the cashier the expected answer turns it into a
 * confirmation dialog. They press submit, every variance is zero, and the waste report — the thing
 * this whole feature is for — reports that nothing was ever wasted. A blind count is the only kind
 * worth taking.
 *
 * Everything else follows from treating this as data entry someone does standing up, at speed,
 * possibly on 40 items: one field focused at a time, Enter moves to the next, progress is always
 * visible, and the expected figure is revealed only after a number has been entered.
 */

const MAX_QUANTITY = 1_000_000;

const fmt = (value) => {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? n.toLocaleString('ar-EG') : n.toFixed(2);
};

export default function ShiftAuditModal({ isOpen, onClose, shiftId, mode = 'OPENING', onComplete }) {
  const toast = useToast();
  const isClosing = mode === 'CLOSING';

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [touched, setTouched] = useState({});
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasteRecords, setWasteRecords] = useState(null);
  const inputRefs = useRef({});

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;

    setIsLoading(true);
    setCounts({});
    setTouched({});
    setSearch('');
    setWasteRecords(null);

    auditApi.getAuditItems()
      .then((data) => {
        if (cancelled) return;
        setItems((data || []).filter((i) => i.requiresAudit && i.active !== false));
      })
      .catch((err) => {
        if (!cancelled) toast.error('فشل في تحميل خامات الجرد: ' + (err.message || ''));
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [isOpen, mode, toast]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => i.name?.toLowerCase().includes(needle));
  }, [items, search]);

  const countedIds = useMemo(
    () => items.filter((i) => String(counts[i.id] ?? '').trim() !== '').map((i) => i.id),
    [items, counts],
  );
  const remaining = items.length - countedIds.length;
  const progress = items.length ? Math.round((countedIds.length / items.length) * 100) : 0;

  function problemWith(raw) {
    if (String(raw ?? '').trim() === '') return 'مطلوب';
    const value = Number(raw);
    if (!Number.isFinite(value)) return 'رقم غير صالح';
    if (value < 0) return 'لا يمكن أن تكون سالبة';
    if (value > MAX_QUANTITY) return `الحد الأقصى ${MAX_QUANTITY.toLocaleString('ar-EG')}`;
    return null;
  }

  /* Enter behaves like Tab: counting 40 items should never require reaching for the mouse. */
  function handleKeyDown(event, index) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const next = visible[index + 1];
    if (next) inputRefs.current[next.id]?.focus();
    else event.currentTarget.blur();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!shiftId) return;

    const firstBad = items.find((i) => problemWith(counts[i.id]));
    if (firstBad) {
      setTouched((prev) => ({ ...prev, [firstBad.id]: true }));
      setSearch('');
      // Put the cursor on the offending field rather than describing it in a toast.
      requestAnimationFrame(() => inputRefs.current[firstBad.id]?.focus());
      toast.error(`راجع كمية «${firstBad.name}»`);
      return;
    }

    const payload = {};
    items.forEach((i) => { payload[i.id] = Number(counts[i.id]); });

    setIsSubmitting(true);
    try {
      if (isClosing) {
        const records = await auditApi.recordShiftClosing(shiftId, payload);
        setWasteRecords(records || []);
        onComplete?.(records);
      } else {
        await auditApi.recordShiftOpening(shiftId, payload);
        toast.success('تم تسجيل جرد بداية الشيفت 🚀');
        onComplete?.();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'فشل في حفظ الجرد');
    } finally {
      setIsSubmitting(false);
    }
  }

  const wasteSummary = useMemo(() => {
    if (!wasteRecords) return null;
    const withVariance = wasteRecords.filter((r) => (r.varianceCount ?? 0) > 0);
    const worst = [...withVariance].sort((a, b) => (b.wastePercentage ?? 0) - (a.wastePercentage ?? 0))[0];
    return { total: wasteRecords.length, flagged: withVariance.length, worst };
  }, [wasteRecords]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isClosing ? 'جرد إغلاق الشيفت' : 'جرد بداية الشيفت'}
      subtitle={isClosing
        ? 'اعدّ الكميات المتبقية فعلياً على الرف — سنقارنها بالمنصرف المحسوب'
        : 'اعدّ الكميات الموجودة فعلياً قبل بدء البيع'}
      size="lg"
    >
      {wasteRecords ? (
        /* ── Result: variance report ── */
        <div className="audit-report">
          <div className={`audit-report__verdict ${wasteSummary.flagged ? 'has-variance' : 'is-clean'}`}>
            {wasteSummary.flagged ? <TrendingDown size={22} /> : <Check size={22} />}
            <div>
              <strong>
                {wasteSummary.flagged
                  ? `${wasteSummary.flagged} من ${wasteSummary.total} خامة بها فرق`
                  : 'كل الخامات مطابقة'}
              </strong>
              <small>
                {wasteSummary.flagged
                  ? `الأعلى: ${wasteSummary.worst?.auditItemName} بفارق ${fmt(wasteSummary.worst?.varianceCount)} ${wasteSummary.worst?.auditItemUnit}`
                  : 'المنصرف الفعلي يطابق المخصوم من الأوردرات'}
              </small>
            </div>
          </div>

          <div className="audit-report__table" role="table">
            <div className="audit-report__row audit-report__row--head" role="row">
              <span>الخامة</span>
              <span>الفتح</span>
              <span>المباع</span>
              <span>المتوقع</span>
              <span>الفعلي</span>
              <span>الفرق</span>
            </div>
            {wasteRecords.map((r) => {
              const variance = r.varianceCount ?? 0;
              const flagged = variance > 0;
              return (
                <div key={r.id} className={`audit-report__row ${flagged ? 'is-flagged' : ''}`} role="row">
                  <span className="audit-report__name">
                    {r.auditItemName}<small>{r.auditItemUnit}</small>
                  </span>
                  <span>{fmt(r.openingCount)}</span>
                  <span>{fmt(r.soldDeductionCount)}</span>
                  <span>{fmt(r.expectedClosingCount)}</span>
                  <span className="audit-report__actual">{fmt(r.actualClosingCount)}</span>
                  <span className={flagged ? 'audit-report__variance' : 'audit-report__match'}>
                    {flagged ? `−${fmt(variance)}` : 'مطابق'}
                    {flagged && r.wastePercentage != null && (
                      <small>{r.wastePercentage.toFixed(1)}%</small>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <footer className="audit-actions">
            <Button onClick={() => { setWasteRecords(null); onClose(); }}>إنهاء</Button>
          </footer>
        </div>
      ) : (
        /* ── Counting ── */
        <form onSubmit={handleSubmit} className="audit-count">
          {isLoading ? (
            <p className="audit-empty">جاري تحميل الخامات…</p>
          ) : items.length === 0 ? (
            <div className="audit-empty audit-empty--none">
              <Package size={30} />
              <strong>لا توجد خامات مُعدّة للجرد</strong>
              <span>أضف الخامات من صفحة «الجرد والوصفات» لتفعيل تقرير الهدر.</span>
            </div>
          ) : (
            <>
              <div className="audit-toolbar">
                <div className="audit-progress">
                  <div className="audit-progress__bar">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <span>
                    <b>{countedIds.length}</b> من {items.length}
                    {remaining > 0 && <em>باقي {remaining}</em>}
                  </span>
                </div>
                {items.length > 6 && (
                  <label className="audit-search">
                    <Search size={15} />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ابحث عن خامة…"
                    />
                  </label>
                )}
              </div>

              <ul className="audit-list">
                {visible.map((item, index) => {
                  const raw = counts[item.id] ?? '';
                  const entered = String(raw).trim() !== '';
                  const problem = touched[item.id] ? problemWith(raw) : null;
                  /*
                   * The system's figure is revealed only once a number has been entered, so it can
                   * never anchor the count. Before that it is deliberately hidden.
                   */
                  const expected = item.stockQuantity ?? 0;
                  const diff = entered ? Number(raw) - expected : null;

                  return (
                    <li key={item.id} className={`audit-row ${entered ? 'is-counted' : ''} ${problem ? 'has-error' : ''}`}>
                      <div className="audit-row__label">
                        <span className="audit-row__name">{item.name}</span>
                        <span className="audit-row__unit">{item.unit}</span>
                      </div>

                      <div className="audit-row__entry">
                        <input
                          ref={(el) => { inputRefs.current[item.id] = el; }}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          max={MAX_QUANTITY}
                          value={raw}
                          placeholder="الكمية"
                          aria-label={`كمية ${item.name} بالـ${item.unit}`}
                          aria-invalid={Boolean(problem)}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => setTouched((prev) => ({ ...prev, [item.id]: true }))}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                        />
                        {entered && <Check size={15} className="audit-row__tick" />}
                      </div>

                      <div className="audit-row__hint">
                        {problem ? (
                          <span className="audit-row__error">{problem}</span>
                        ) : entered ? (
                          <span className={diff === 0 ? 'is-match' : diff < 0 ? 'is-short' : 'is-over'}>
                            {diff === 0
                              ? 'مطابق للنظام'
                              : `${diff < 0 ? 'ناقص' : 'زائد'} ${fmt(Math.abs(diff))} عن ${fmt(expected)}`}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {visible.length === 0 && (
                <p className="audit-empty">لا توجد خامة بهذا الاسم.</p>
              )}
            </>
          )}

          <footer className="audit-actions">
            {remaining > 0 && items.length > 0 && (
              <span className="audit-actions__note">
                <AlertTriangle size={14} /> باقي {remaining} خامة
              </span>
            )}
            <Button variant="secondary" type="button" onClick={onClose}>إلغاء</Button>
            <Button type="submit" loading={isSubmitting} disabled={items.length === 0}>
              {isClosing ? 'احسب الهدر وأغلق' : 'ابدأ الشيفت'}
              <ArrowLeft size={15} />
            </Button>
          </footer>
        </form>
      )}
    </Modal>
  );
}
