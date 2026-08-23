import { useCallback, useEffect, useState } from 'react';
import { Wallet, Receipt, TrendingUp, Utensils, Coffee, Lock, Printer, FileText } from 'lucide-react';
import { shiftsApi } from '../../api/shiftsApi';
import { formatCurrency } from '../../utils/formatters';
import DailyReportModal from '../../components/DailyReportModal/DailyReportModal';

/**
 * Live read-out of the shift the cashier is standing in: what's been sold, how
 * many orders, the average ticket, and what the drawer should hold right now.
 */
export default function ShiftStrip({ shift, refreshKey, onCloseShift }) {
  const [report, setReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const load = useCallback(async () => {
    if (!shift?.id) return;
    try {
      setReport(await shiftsApi.getReport(shift.id));
    } catch {
      // A failed refresh should never interrupt order taking.
    }
  }, [shift?.id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const revenue = Number(report?.totalRevenue ?? 0);
  const cash = Number(report?.totalCash ?? 0);
  const opening = Number(shift?.openingFloat ?? 0);
  const food = Number(report?.foodRevenue ?? 0);
  const buffet = Number(report?.buffetRevenue ?? 0);

  return (
    <>
      <div className="shift-strip">
        <span className="shift-strip__cell">
          <TrendingUp size={13} />
          <span className="shift-strip__label">مبيعات الشيفت</span>
          <strong>{formatCurrency(revenue)}</strong>
        </span>

        <span className="shift-strip__cell">
          <Utensils size={13} />
          <span className="shift-strip__label">مطعم</span>
          <strong>{formatCurrency(food)}</strong>
        </span>

        <span className="shift-strip__cell">
          <Coffee size={13} />
          <span className="shift-strip__label">بوفيه</span>
          <strong>{formatCurrency(buffet)}</strong>
        </span>

        <span className="shift-strip__cell shift-strip__cell--drawer" title="العهدة الافتتاحية + الكاش المحصَّل">
          <Wallet size={13} />
          <span className="shift-strip__label">المفروض في الدرج</span>
          <strong>{formatCurrency(opening + cash)}</strong>
        </span>

        {shift?.openedAt && (
          <span className="shift-strip__cell shift-strip__cell--muted">
            <Receipt size={13} />
            <span className="shift-strip__label">بدأ</span>
            <strong>{new Date(shift.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>
          </span>
        )}

        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ padding: '3px 8px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => setShowReportModal(true)}
          title="عرض وطباعة تقرير اليومية الشامل"
        >
          <FileText size={13} /> تقرير اليومية 📊
        </button>

        <button type="button" className="shift-strip__close" onClick={onCloseShift}>
          <Lock size={13} /> قفل الشيفت
        </button>
      </div>

      {showReportModal && shift?.id && (
        <DailyReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          shiftId={shift.id}
        />
      )}
    </>
  );
}

