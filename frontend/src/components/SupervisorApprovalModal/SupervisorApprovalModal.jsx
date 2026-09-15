import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, X, CheckCircle2, KeyRound } from 'lucide-react';
import { managerOverrideApi } from '../../api/managerOverrideApi';
import { useToast } from '../../context/ToastContext';
import Spinner from '../Spinner/Spinner';
import './SupervisorApprovalModal.css';

/* The server accepts 4 to 8 digits; every supervisor chooses their own length. */
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 8;

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

  /* Refs, not dependencies: re-subscribing the key listener on every digit would tear down and
     rebuild it eight times while someone types their PIN. */
  const handleNumpadRef = useRef(null);
  const handleVerifyRef = useRef(null);
  const onCloseRef = useRef(onClose);

  /* There is no text input in this dialog - the numpad is the only way in - so without this a
     till with a keyboard, or a laptop, had no way to type the PIN or press Enter. Digits, Backspace
     and Escape do what the on-screen keys do; Enter submits. */
  useEffect(() => {
    if (!isOpen) return undefined;

    function onKeyDown(e) {
      // Leave the custom-reason textarea alone.
      const el = e.target;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
        if (e.key === 'Escape') onCloseRef.current?.();
        return;
      }
      /* Claimed keys are stopped here, in the capture phase, before they reach the till's own
         window listener. Otherwise typing a PIN would also be setting the POS quantity
         multiplier behind the dialog - "3" means the third digit of a PIN here and "×3" out
         there, and both were firing. */
      const claim = () => { e.preventDefault(); e.stopPropagation(); };

      if (/^[0-9]$/.test(e.key)) { claim(); handleNumpadRef.current(e.key); }
      else if (e.key === 'Backspace') { claim(); handleNumpadRef.current('⌫'); }
      else if (e.key === 'Enter') { claim(); handleVerifyRef.current(); }
      else if (e.key === 'Escape') { claim(); onCloseRef.current?.(); }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  function handleNumpad(key) {
    if (key === 'C') {
      setPin('');
    } else if (key === '⌫') {
      setPin((prev) => prev.slice(0, -1));
    } else if (pin.length < MAX_PIN_LENGTH) {
      setPin((prev) => prev + key);
    }
  }

  const finalReason = selectedReason.startsWith('أخرى') ? customReason.trim() : selectedReason;

  async function handleVerify(e) {
    if (e) e.preventDefault();
    if (!pin || pin.length < MIN_PIN_LENGTH) {
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

  handleNumpadRef.current = handleNumpad;
  handleVerifyRef.current = handleVerify;
  onCloseRef.current = onClose;

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

            {/* One dot per digit typed, with four empty ones waiting.
                It used to draw exactly six, always. A PIN here is 4 to 8 digits and each
                supervisor picks their own, so six dots told a five-digit supervisor their code
                was one short - and a seven-digit one that they had overrun. The dots should
                report what was typed, not assert a length the system does not have. */}
            <div className="supervisor-pin-display">
              {Array.from({ length: Math.max(pin.length, MIN_PIN_LENGTH) }).map((_, idx) => (
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
            disabled={loading || pin.length < MIN_PIN_LENGTH}
          >
            {loading ? <Spinner size="sm" /> : <CheckCircle2 size={18} />}
            <span>تأكيد واعتماد المشرف</span>
          </button>
        </div>
      </div>
    </div>
  );
}