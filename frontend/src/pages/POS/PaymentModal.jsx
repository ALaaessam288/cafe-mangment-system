import { useState } from 'react';
import { X, CreditCard, DollarSign, Banknote, Smartphone, Zap } from 'lucide-react';
import { ordersApi } from '../../api/ordersApi';
import { useToast }  from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import Spinner from '../../components/Spinner/Spinner';
import './PaymentModal.css';

const METHODS = [
  { id: 'CASH', label: 'كاش',  icon: Banknote },
  { id: 'INSTAPAY', label: 'انستاباي',  icon: Zap },
  { id: 'WALLET', label: 'محفظة',  icon: Smartphone },
];

export default function PaymentModal({ order, onClose, onSuccess }) {
  const toast = useToast();
  const [method,  setMethod]  = useState('CASH');
  const [amount,  setAmount]  = useState(order.balanceDue?.toString() ?? order.total?.toString() ?? '0');
  const [loading, setLoading] = useState(false);

  const balanceDue = parseFloat(order.balanceDue ?? order.total ?? 0);
  const amountNum  = parseFloat(amount) || 0;
  const change     = amountNum - balanceDue;

  async function handlePay() {
    if (amountNum <= 0) {
      toast.warning('اكتب مبلغ صحيح.');
      return;
    }
    setLoading(true);
    try {
      const paymentAmount = Math.min(balanceDue, amountNum);
      const isFullPayment = paymentAmount >= balanceDue;
      const payload = { method, amount: paymentAmount };
      if (method === 'CASH') {
        payload.received = amountNum;
      }
      let updatedOrder = await ordersApi.recordPayment(order.id, payload);

      if (isFullPayment) {
        // Only close once the order is actually fully paid - closing on a partial payment
        // always threw 409 here, which used to get swallowed by the catch below and shown
        // as a generic "فشل الدفع" even though the (partial) payment had already gone through,
        // leaving the invoice stuck at its pre-payment status with no visible explanation.
        updatedOrder = await ordersApi.close(order.id);
        onSuccess(updatedOrder, true);
      } else {
        const remaining = balanceDue - paymentAmount;
        toast.success(`تم تسجيل دفعة جزئية بمقدار ${formatCurrency(paymentAmount)}. الباقي: ${formatCurrency(remaining)}`, 'دفعة جزئية');
        onSuccess(updatedOrder, false);
      }
    } catch (err) {
      toast.error(err.message, 'فشل الدفع');
    } finally {
      setLoading(false);
    }
  }

  /* Numpad */
  function handleNumpad(key) {
    setAmount((prev) => {
      if (key === 'C') return '0';
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.' && prev.includes('.')) return prev;
      if (prev === '0' && key !== '.') return key;
      return prev + key;
    });
  }

  const numpadKeys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];

  return (
    <div className="payment-overlay" onClick={onClose}>
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="payment-modal__header">
          <h3>الدفع — ترابيزة {order.tableNumber}</h3>
          <button className="payment-modal__close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="payment-modal__body">
          {/* Summary */}
          <div className="payment-summary">
            <div className="payment-summary__row">
              <span>الإجمالي</span>
              <span className="payment-summary__amount">{formatCurrency(order.total)}</span>
            </div>
            {parseFloat(order.amountPaid) > 0 && (
              <div className="payment-summary__row">
                <span>المدفوع</span>
                <span>{formatCurrency(order.amountPaid)}</span>
              </div>
            )}
            <div className="payment-summary__row payment-summary__row--due">
              <span>الباقي</span>
              <span>{formatCurrency(balanceDue)}</span>
            </div>
          </div>

          {/* Method */}
          <div className="payment-methods">
            {METHODS.map((m) => (
              <button
                key={m.id}
                className={`payment-method ${method === m.id ? 'payment-method--active' : ''}`}
                onClick={() => setMethod(m.id)}
              >
                <m.icon size={18} />
                {m.label}
              </button>
            ))}
          </div>

          {/* Amount display */}
          <div className="payment-amount-display">
            <div className="payment-amount-display__label">المبلغ المستلم</div>
            <div className="payment-amount-display__value">
              EGP {parseFloat(amount).toFixed(2)}
            </div>
          </div>

          {/* Numpad */}
          <div className="payment-numpad">
            {numpadKeys.map((k) => (
              <button
                key={k}
                className={`numpad-key ${k === 'C' ? 'numpad-key--clear' : ''} ${k === '⌫' ? 'numpad-key--back' : ''}`}
                onClick={() => handleNumpad(k)}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Quick amount presets */}
          <div className="payment-presets">
            {[50, 100, 200, 500].map((preset) => (
              <button
                key={preset}
                className="payment-preset"
                onClick={() => setAmount(String(preset))}
              >
                {preset}
              </button>
            ))}
            <button className="payment-preset payment-preset--exact" onClick={() => setAmount(String(balanceDue.toFixed(2)))}>
              بالظبط
            </button>
          </div>

          {/* Change */}
          {change > 0 && (
            <div className="payment-change">
              الباقي للعميل: <strong>{formatCurrency(change)}</strong>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="payment-modal__footer" style={{ flexWrap: 'wrap' }}>
          {order.customerPhone && (
            <button
              className="btn btn--outline btn--md"
              style={{ borderColor: '#25d366', color: '#25d366', width: '100%', marginBottom: '8px' }}
              onClick={() => {
                const text = `أهلاً بك! شكراً لزيارتك.
فاتورة رقم: #${order.receiptNumber || order.id.toString().slice(-4)}
الإجمالي: ${formatCurrency(order.total)}

نتمنى رؤيتك مرة أخرى!`;
                const url = `https://wa.me/${order.customerPhone}?text=${encodeURIComponent(text)}`;
                if (window.api && window.api.openExternal) {
                  window.api.openExternal(url);
                } else {
                  window.open(url, '_blank');
                }
              }}
            >
              <Smartphone size={16} /> إرسال الفاتورة عبر واتساب
            </button>
          )}
          <div style={{ display: 'flex', width: '100%', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost btn--sm" onClick={onClose}>إلغاء</button>
            <button className="btn btn--primary btn--md" onClick={handlePay} disabled={loading} style={{ flex: 1 }}>
              {loading ? <Spinner size="sm" color="white" /> : <><DollarSign size={15} /> تأكيد الدفع</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
