import { useState } from 'react';
import { ShieldAlert, X, CheckCircle2, KeyRound } from 'lucide-react';
import { managerOverrideApi } from '../../api/managerOverrideApi';
import { useToast } from '../../context/ToastContext';
import Spinner from '../Spinner/Spinner';
import './SupervisorApprovalModal.css';

const DEFAULT_REASONS = [
  'خطأ في إدخال الطلب',
  'صنف تالف / هالك بالمطبخ',
  'طلب العميل الإلغاء قبل التجهيز',
  'ضيافة إدارة / مجاني',
  'تأخر تسليم الأوردر للعميل',
  'أخرى (تحديد سبب مخصص)'
];

export default function SupervisorApprovalModal({
  isOpen,
  onClose,
  onApproved,
  actionType = 'VOID_ITEM',
  title = 'موافقة المشرف مطلوبة',
  description = 'هذه العملية حساسة وتتطلب إدخال رمز PIN الخاص بمدير الوردية أو المشرف.',
  amount = null,
  orderId = null,
  shiftId = null
}) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [selectedReason, setSelectedReason] = useState(DEFAULT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  function handleNumpad(key) {
    if (key === 'C') {
      setPin('');
    } else if (key === '⌫') {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < 8) {
      setPin((prev) => prev + key);
    }
  }

  const finalReason = selectedReason.startsWith('أخرى') ? customReason.trim() : selectedReason;

  async function handleVerify(e) {
    if (e) e.preventDefault();
    if (!pin || pin.length < 4) {
      toast.warning('يرجى إدخال رمز PIN للمشرف المكون من 4 إلى 8 أرقام');
      return;
    }
    if (!finalReason) {
      toast.warning('يرجى تحديد أو كتابة سبب الإلغاء / الاعتماد');
      return;
    }

    setLoading(true);
    try {
      const response = await managerOverrideApi.verifyOverride({
        supervisorPin: pin,
        actionType,
        reason: finalReason,
        orderId,
        shiftId,
        amount,
        details: `تم الاعتماد من خلال شاشة الكاشير السريعة`
      });

      toast.success(`تم الاعتماد بنجاح بواسطة المشرف: ${response.supervisorName || 'المشرف'}`);
      setPin('');
      setCustomReason('');
      onApproved(response, finalReason);
    } catch (err) {
      toast.error(err.message || 'رمز المشرف PIN غير صحيح أو ليس لديك الصلاحية', 'فشل الاعتماد');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="supervisor-overlay" onClick={onClose} dir="rtl">
      <div className="supervisor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="supervisor-modal__header">
          <div className="supervisor-modal__icon-wrap">
            <ShieldAlert size={22} className="text-warning" />
          </div>
          <div className="supervisor-modal__title-box">
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button className="supervisor-modal__close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="supervisor-modal__body">
          {/* Reason Selection */}
          <div className="supervisor-form-group">
            <label className="supervisor-label">سبب العملية (إلزامي للتدقيق والرقابة):</label>
            <div className="supervisor-reasons-grid">
              {DEFAULT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`supervisor-reason-pill ${selectedReason === r ? 'supervisor-reason-pill--active' : ''}`}
                  onClick={() => setSelectedReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            {selectedReason.startsWith('أخرى') && (
              <textarea
                className="supervisor-textarea"
                rows={2}
                placeholder="اكتب السبب التفصيلي هنا..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                autoFocus
              />
            )}
          </div>

          {/* PIN Display & Keypad */}
          <div className="supervisor-pin-section">
            <label className="supervisor-label">
              <KeyRound size={14} style={{ display: 'inline', marginInlineEnd: 6 }} />
              رمز المشرف السري (Supervisor PIN):
            </label>

            <div className="supervisor-pin-display">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  className={`supervisor-pin-dot ${idx < pin.length ? 'supervisor-pin-dot--filled' : ''}`}
                />
              ))}
            </div>

            <div className="supervisor-numpad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`supervisor-num-btn ${key === 'C' ? 'supervisor-num-btn--clear' : key === '⌫' ? 'supervisor-num-btn--back' : ''}`}
                  onClick={() => handleNumpad(key)}
                  disabled={loading}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="supervisor-modal__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
            disabled={loading}
          >
            إلغاء وتراجع
          </button>
          <button
            type="button"
            className="btn btn--primary supervisor-submit-btn"
            onClick={handleVerify}
            disabled={loading || pin.length < 4}
          >
            {loading ? <Spinner size="sm" /> : <CheckCircle2 size={18} />}
            <span>تأكيد واعتماد المشرف</span>
          </button>
        </div>
      </div>
    </div>
  );
}