import { useState, useEffect } from 'react';
import {
  Vault,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  History,
  X,
  PlusCircle,
  AlertTriangle,
  Clock,
  UserCheck
} from 'lucide-react';
import { cashMovementApi } from '../../api/cashMovementApi';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Spinner from '../Spinner/Spinner';
import './CashDrawerModal.css';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export default function CashDrawerModal({ isOpen, onClose, currentShift }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('ACTION'); // ACTION | HISTORY
  const [movementType, setMovementType] = useState('SAFE_DROP'); // SAFE_DROP | CASH_IN | CASH_OUT
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentShift?.id) {
      fetchSummary();
    }
  }, [isOpen, currentShift?.id]);

  async function fetchSummary() {
    setLoading(true);
    try {
      const data = await cashMovementApi.getSummary(currentShift.id);
      setSummary(data);
    } catch (err) {
      toast.error(err.message || 'فشل جلب بيانات الخزينة والدرج');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.warning('يرجى كتابة مبلغ صحيح');
      return;
    }
    if (!reason.trim()) {
      toast.warning('يرجى كتابة سبب الحركة النقدية');
      return;
    }

    setSubmitting(true);
    try {
      await cashMovementApi.record({
        shiftId: currentShift.id,
        type: movementType,
        amount: parsedAmount,
        reason: reason.trim()
      });

      toast.success(
        movementType === 'SAFE_DROP'
          ? `تم ترحيل ${formatCurrency(parsedAmount)} إلى الخزينة الرئيسية بنجاح`
          : movementType === 'CASH_IN'
          ? `تم إيداع ${formatCurrency(parsedAmount)} في الدرج بنجاح`
          : `تم تسجيل سحب ${formatCurrency(parsedAmount)} بنجاح`
      );

      setAmount('');
      setReason('');
      await fetchSummary();
      setActiveTab('HISTORY');
    } catch (err) {
      toast.error(err.message || 'فشل تسجيل الحركة النقدية', 'خطأ في العملية');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="cash-drawer-overlay" onClick={onClose} dir="rtl">
      <div className="cash-drawer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cash-drawer-modal__header">
          <div className="cash-drawer-modal__title-row">
            <div className="cash-drawer-modal__icon">
              <Vault size={24} className="text-accent" />
            </div>
            <div>
              <h3>الرقابة على الخزينة ودرج النقدية (Cash Drawer Controls)</h3>
              <p>تسجيل الإيداعات والسحوبات وترحيل النقدية الزائدة للخزنة الرئيسية</p>
            </div>
          </div>
          <button className="cash-drawer-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Live Drawer Balance Stats Card */}
        <div className="cash-drawer-balance-banner">
          <div className="cash-drawer-balance-main">
            <span className="balance-label">النقدية المتوقعة في الدرج حالياً:</span>
            <span className="balance-value">
              {loading && !summary ? <Spinner size="sm" /> : formatCurrency(summary?.expectedCashInDrawer || 0)}
            </span>
          </div>

          <div className="cash-drawer-metrics-grid">
            <div className="drawer-metric-item">
              <span>عهدة البداية (Float)</span>
              <strong>{formatCurrency(summary?.openingFloat || currentShift?.openingFloat || 0)}</strong>
            </div>
            <div className="drawer-metric-item drawer-metric-item--green">
              <span>مبيعات كاش (+)</span>
              <strong>{formatCurrency(summary?.cashSales || 0)}</strong>
            </div>
            <div className="drawer-metric-item drawer-metric-item--blue">
              <span>إيداعات إضافية (+)</span>
              <strong>{formatCurrency(summary?.cashIn || 0)}</strong>
            </div>
            <div className="drawer-metric-item drawer-metric-item--purple">
              <span>مسحوب للخزنة (-)</span>
              <strong>{formatCurrency(summary?.safeDrops || 0)}</strong>
            </div>
            <div className="drawer-metric-item drawer-metric-item--red">
              <span>مصروفات الدرج (-)</span>
              <strong>{formatCurrency(summary?.cashExpenses || 0)}</strong>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="cash-drawer-tabs">
          <button
            type="button"
            className={`cash-drawer-tab ${activeTab === 'ACTION' ? 'cash-drawer-tab--active' : ''}`}
            onClick={() => setActiveTab('ACTION')}
          >
            <PlusCircle size={16} />
            <span>تسجيل حركة جديدة</span>
          </button>
          <button
            type="button"
            className={`cash-drawer-tab ${activeTab === 'HISTORY' ? 'cash-drawer-tab--active' : ''}`}
            onClick={() => setActiveTab('HISTORY')}
          >
            <History size={16} />
            <span>سجل حركات الشيفت ({summary?.recentMovements?.length || 0})</span>
          </button>
        </div>

        <div className="cash-drawer-modal__body">
          {activeTab === 'ACTION' ? (
            <form onSubmit={handleSubmit} className="cash-drawer-form">
              {/* Movement Type Selector */}
              <div className="movement-type-selector">
                <button
                  type="button"
                  className={`movement-type-btn ${movementType === 'SAFE_DROP' ? 'movement-type-btn--active safe-drop' : ''}`}
                  onClick={() => setMovementType('SAFE_DROP')}
                >
                  <ArrowUpRight size={20} />
                  <div>
                    <strong>سحب للخزينة (Safe Drop)</strong>
                    <small>ترحيل مبالغ زائدة للخزنة الرئيسية</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={`movement-type-btn ${movementType === 'CASH_IN' ? 'movement-type-btn--active cash-in' : ''}`}
                  onClick={() => setMovementType('CASH_IN')}
                >
                  <ArrowDownLeft size={20} />
                  <div>
                    <strong>إيداع نقدي (Cash In)</strong>
                    <small>إضافة فكة أو رصيد نقدي بالدرج</small>
                  </div>
                </button>

                <button
                  type="button"
                  className={`movement-type-btn ${movementType === 'CASH_OUT' ? 'movement-type-btn--active cash-out' : ''}`}
                  onClick={() => setMovementType('CASH_OUT')}
                >
                  <Receipt size={20} />
                  <div>
                    <strong>سحب مصروف (Cash Out)</strong>
                    <small>سحب مصروف تشغيلي مباشر</small>
                  </div>
                </button>
              </div>

              {/* Amount Input & Presets */}
              <div className="cash-drawer-input-group">
                <label className="cash-drawer-label">المبلغ المطلوب (ج.م):</label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  placeholder="0.00"
                  className="cash-drawer-amount-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  required
                />

                <div className="quick-amount-pills">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="quick-amount-pill"
                      onClick={() => setAmount(amt.toString())}
                    >
                      +{amt} ج.م
                    </button>
                  ))}
                  <button
                    type="button"
                    className="quick-amount-pill quick-amount-pill--max"
                    onClick={() => setAmount(Math.max(0, Math.floor(summary?.expectedCashInDrawer || 0)).toString())}
                  >
                    كامل الكاش بالدرج
                  </button>
                </div>
              </div>

              {/* Reason Field */}
              <div className="cash-drawer-input-group">
                <label className="cash-drawer-label">سبب وتفاصيل الحركة:</label>
                <input
                  type="text"
                  placeholder={
                    movementType === 'SAFE_DROP'
                      ? 'مثال: ترحيل الكاش الزائد إلى خزينة الإدارة الرئيسية'
                      : movementType === 'CASH_IN'
                      ? 'مثال: إيداع فكة فئات صغيرة 5 و 10 و 20 جنيه'
                      : 'مثال: شراء مياه معدنية أو مستلزمات نظافة طارئة'
                  }
                  className="cash-drawer-text-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="cash-drawer-action-row">
                <button
                  type="submit"
                  className="btn btn--primary cash-drawer-submit-btn"
                  disabled={submitting || !amount || !reason}
                >
                  {submitting ? <Spinner size="sm" /> : <Vault size={18} />}
                  <span>تأكيد وتسجيل حركة النقدية</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="cash-drawer-history-view">
              {!summary?.recentMovements || summary.recentMovements.length === 0 ? (
                <div className="cash-drawer-empty-history">
                  <Clock size={36} className="text-muted" />
                  <p>لم يتم تسجيل أي حركات سحب أو إيداع نقدية في هذا الشيفت حتى الآن.</p>
                </div>
              ) : (
                <div className="movements-list">
                  {summary.recentMovements.map((m) => (
                    <div key={m.id} className="movement-row">
                      <div className="movement-row__icon-wrap">
                        {m.type === 'CASH_IN' ? (
                          <span className="movement-badge movement-badge--in">
                            <ArrowDownLeft size={16} /> إيداع
                          </span>
                        ) : m.type === 'SAFE_DROP' ? (
                          <span className="movement-badge movement-badge--drop">
                            <ArrowUpRight size={16} /> ترحيل خزنة
                          </span>
                        ) : (
                          <span className="movement-badge movement-badge--out">
                            <Receipt size={16} /> سحب مصروف
                          </span>
                        )}
                      </div>

                      <div className="movement-row__info">
                        <div className="movement-row__reason">{m.reason || 'حركة نقدية'}</div>
                        <div className="movement-row__meta">
                          <span>{formatDateTime(m.performedAt)}</span>
                          {m.performedByName && (
                            <span className="cashier-tag">
                              <UserCheck size={12} /> {m.performedByName}
                            </span>
                          )}
                          {m.receiptNumber && <span className="receipt-tag">{m.receiptNumber}</span>}
                        </div>
                      </div>

                      <div className={`movement-row__amount ${m.type === 'CASH_IN' ? 'amount-plus' : 'amount-minus'}`}>
                        {m.type === 'CASH_IN' ? '+' : '-'} {formatCurrency(m.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}