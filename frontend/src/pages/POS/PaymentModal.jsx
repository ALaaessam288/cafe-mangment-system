import { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  DollarSign,
  Banknote,
  Smartphone,
  Zap,
  Users,
  CheckCircle2,
  Receipt,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Printer
} from 'lucide-react';
import { ordersApi } from '../../api/ordersApi';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import Spinner from '../../components/Spinner/Spinner';
import './PaymentModal.css';

const METHODS = [
  { id: 'CASH', label: 'كاش', icon: Banknote, color: '#10b981' },
  { id: 'CARD', label: 'فيزا / بطاقة', icon: CreditCard, color: '#38bdf8' },
  { id: 'INSTAPAY', label: 'انستاباي', icon: Zap, color: '#f59e0b' },
  { id: 'WALLET', label: 'محفظة', icon: Smartphone, color: '#a855f7' },
];

export default function PaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [checkoutMode, setCheckoutMode] = useState('STANDARD'); // STANDARD | SPLIT_EQUAL | PARTIAL
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [activeGuestIndex, setActiveGuestIndex] = useState(0);

  const total = parseFloat(order?.total ?? 0);
  const initialBalanceDue = parseFloat(order?.balanceDue ?? order?.total ?? 0);
  const [currentBalanceDue, setCurrentBalanceDue] = useState(initialBalanceDue);

  useEffect(() => {
    setAmount(currentBalanceDue.toString());
  }, [currentBalanceDue]);

  // Per-person share for split equal
  const perPersonShare = guestCount > 0 ? +(currentBalanceDue / guestCount).toFixed(2) : currentBalanceDue;

  const amountNum = parseFloat(amount) || 0;
  const change = method === 'CASH' && amountNum > currentBalanceDue ? amountNum - currentBalanceDue : 0;

  /* Standard or Partial Payment */
  async function handleProcessPayment(customPayAmount, noteLabel) {
    const payAmt = customPayAmount ?? Math.min(currentBalanceDue, amountNum);
    if (payAmt <= 0) {
      toast.warning('يرجى تحديد مبلغ دفع صحيح أكبر من صفر');
      return;
    }

    setLoading(true);
    try {
      const isFullPayment = payAmt >= currentBalanceDue;
      const payload = {
        method,
        amount: payAmt,
        note: noteLabel || (checkoutMode === 'SPLIT_EQUAL' ? `تقسيم ضيف (${activeGuestIndex + 1}/${guestCount})` : undefined)
      };

      if (method === 'CASH') {
        payload.received = Math.max(payAmt, amountNum);
      }

      let updatedOrder = await ordersApi.recordPayment(order.id, payload);
      const remaining = Math.max(0, currentBalanceDue - payAmt);
      setCurrentBalanceDue(remaining);

      // Record in local payments history
      setPaymentsHistory((prev) => [
        ...prev,
        {
          id: Date.now(),
          method,
          amount: payAmt,
          received: payload.received,
          change: payload.received ? payload.received - payAmt : 0,
          note: payload.note,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (isFullPayment || remaining <= 0.05) {
        updatedOrder = await ordersApi.close(order.id);
        toast.success(`تم سداد وإغلاق الفاتورة بنجاح! الإجمالي: ${formatCurrency(total)}`, 'تم الدفع بالكامل 🎉');
        onSuccess(updatedOrder, true);
      } else {
        toast.success(`تم تسجيل دفعة بمقدار ${formatCurrency(payAmt)}. المتبقي: ${formatCurrency(remaining)}`, 'دفعة مسجلة');
        if (checkoutMode === 'SPLIT_EQUAL') {
          setActiveGuestIndex((prev) => Math.min(guestCount - 1, prev + 1));
          setAmount(perPersonShare.toString());
        } else {
          setAmount(remaining.toString());
        }
      }
    } catch (err) {
      toast.error(err.message || 'فشل تسجيل الدفعة', 'خطأ في التحصيل');
    } finally {
      setLoading(false);
    }
  }

  /* Numpad input */
  function handleNumpad(key) {
    setAmount((prev) => {
      if (key === 'C') return '0';
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.' && prev.includes('.')) return prev;
      if (prev === '0' && key !== '.') return key;
      return prev + key;
    });
  }

  const numpadKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'];

  return (
    <div className="payment-overlay" onClick={onClose} dir="rtl">
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="payment-modal__header">
          <div className="payment-modal__title-wrap">
            <div className="payment-terminal-badge">
              <Sparkles size={13} />
              <span>CASHIER CHECKOUT TERMINAL</span>
            </div>
            <h3>تحصيل الفاتورة وحركات الدفع</h3>
            <p>
              {order.tableNumber ? `طاولة صالة ${order.tableNumber}` : `طلب سفري #${order.orderNumber || order.id}`}
              {' · '}
              <span className="order-total-tag">الإجمالي: {formatCurrency(total)}</span>
            </p>
          </div>
          <button className="payment-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Checkout Mode Selector Tabs */}
        <div className="checkout-mode-tabs">
          <button
            type="button"
            className={`checkout-mode-tab ${checkoutMode === 'STANDARD' ? 'checkout-mode-tab--active' : ''}`}
            onClick={() => {
              setCheckoutMode('STANDARD');
              setAmount(currentBalanceDue.toString());
            }}
          >
            <Banknote size={15} />
            <span>سداد عادي / كامل</span>
          </button>

          <button
            type="button"
            className={`checkout-mode-tab ${checkoutMode === 'SPLIT_EQUAL' ? 'checkout-mode-tab--active' : ''}`}
            onClick={() => {
              setCheckoutMode('SPLIT_EQUAL');
              setAmount(perPersonShare.toString());
            }}
          >
            <Users size={15} />
            <span>تقسيم الشيك بالتساوي (Split)</span>
          </button>
        </div>

        <div className="payment-modal__body">
          {/* Top Balance Due Gauge */}
          <div className="payment-balance-gauge">
            <div className="gauge-item">
              <span className="gauge-label">إجمالي الفاتورة</span>
              <strong className="gauge-val">{formatCurrency(total)}</strong>
            </div>
            <div className="gauge-item">
              <span className="gauge-label">المدفوع حتى الآن</span>
              <strong className="gauge-val gauge-val--paid">
                {formatCurrency(total - currentBalanceDue)}
              </strong>
            </div>
            <div className="gauge-item gauge-item--due">
              <span className="gauge-label">المتبقي للتحصيل</span>
              <strong className="gauge-val gauge-val--due">
                {formatCurrency(currentBalanceDue)}
              </strong>
            </div>
          </div>

          {/* SPLIT EQUAL UI */}
          {checkoutMode === 'SPLIT_EQUAL' && (
            <div className="split-equal-container">
              <div className="split-guests-selector">
                <span className="split-label">عدد الضيوف للتقسيم:</span>
                <div className="guest-pills-row">
                  {[2, 3, 4, 5, 6].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`guest-pill ${guestCount === count ? 'guest-pill--active' : ''}`}
                      onClick={() => {
                        setGuestCount(count);
                        const newShare = +(currentBalanceDue / count).toFixed(2);
                        setAmount(newShare.toString());
                      }}
                    >
                      <Users size={12} />
                      {count} ضيوف
                    </button>
                  ))}
                </div>
              </div>

              <div className="split-share-card">
                <div className="split-share-info">
                  <span>نصيب كل ضيف:</span>
                  <strong>{formatCurrency(perPersonShare)}</strong>
                </div>
                <div className="split-progress-hint">
                  سداد الضيف ({activeGuestIndex + 1} من {guestCount})
                </div>
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="payment-methods-grid">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`payment-method-tile ${method === m.id ? 'payment-method-tile--active' : ''}`}
                style={{ '--method-color': m.color }}
                onClick={() => setMethod(m.id)}
              >
                <m.icon size={20} />
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Amount Display and Fast Numpad */}
          <div className="payment-input-section">
            <div className="payment-amount-display">
              <div className="payment-amount-display__label">
                {method === 'CASH' ? 'المبلغ المستلم من العميل' : 'مبلغ الخصم / السداد'}
              </div>
              <div className="payment-amount-display__value">
                {formatCurrency(parseFloat(amount) || 0)}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="payment-presets">
              {[50, 100, 200, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="payment-preset"
                  onClick={() => setAmount(preset.toString())}
                >
                  +{preset}
                </button>
              ))}
              <button
                type="button"
                className="payment-preset payment-preset--exact"
                onClick={() => {
                  if (checkoutMode === 'SPLIT_EQUAL') {
                    setAmount(perPersonShare.toString());
                  } else {
                    setAmount(currentBalanceDue.toString());
                  }
                }}
              >
                المبلغ بالظبط
              </button>
            </div>

            {/* Numpad */}
            <div className="payment-numpad">
              {numpadKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`numpad-key ${k === 'C' ? 'numpad-key--clear' : k === '⌫' ? 'numpad-key--back' : ''}`}
                  onClick={() => handleNumpad(k)}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Change Alert */}
            {change > 0 && (
              <div className="payment-change-alert">
                <span>المتبقي للعميل (الفكة):</span>
                <strong>{formatCurrency(change)}</strong>
              </div>
            )}
          </div>

          {/* Payments breakdown history if any partial payments occurred */}
          {paymentsHistory.length > 0 && (
            <div className="payments-history-box">
              <div className="history-header">
                <Receipt size={14} />
                <span>دفعات تمت على هذه الفاتورة:</span>
              </div>
              <div className="history-list">
                {paymentsHistory.map((p, idx) => (
                  <div key={idx} className="history-item">
                    <span>
                      {p.note || `دفعة ${p.method}`} · <small>{p.timestamp}</small>
                    </span>
                    <strong>{formatCurrency(p.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="payment-modal__footer">
          {order.customerPhone && (
            <button
              type="button"
              className="btn btn--outline btn-whatsapp-receipt"
              onClick={() => {
                const text = `أهلاً بك في كافيو! شكراً لزيارتك.\nفاتورة رقم: #${order.receiptNumber || order.id.toString().slice(-4)}\nالإجمالي: ${formatCurrency(order.total)}\nالمدفوع: ${formatCurrency(total - currentBalanceDue)}\nالمتبقي: ${formatCurrency(currentBalanceDue)}\nنتمنى لكم يوماً سعيداً! ✨`;
                const url = `https://wa.me/${order.customerPhone}?text=${encodeURIComponent(text)}`;
                if (window.api && window.api.openExternal) {
                  window.api.openExternal(url);
                } else {
                  window.open(url, '_blank');
                }
              }}
            >
              <Smartphone size={16} />
              <span>إرسال إيصال واتساب للعميل</span>
            </button>
          )}

          <div className="footer-btns-row">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={loading}>
              إلغاء
            </button>
            <button
              type="button"
              className="btn btn--primary payment-submit-btn"
              onClick={() => handleProcessPayment()}
              disabled={loading || amountNum <= 0}
            >
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>
                    {checkoutMode === 'SPLIT_EQUAL'
                      ? `سداد نصيب الضيف (${formatCurrency(Math.min(currentBalanceDue, amountNum))})`
                      : amountNum >= currentBalanceDue
                      ? `سداد الفاتورة بالكامل (${formatCurrency(currentBalanceDue)})`
                      : `تسجيل دفعة جزئية (${formatCurrency(amountNum)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}