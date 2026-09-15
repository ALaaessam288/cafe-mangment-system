import { useEffect, useRef } from 'react';
import { AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import Spinner from '../Spinner/Spinner';
import './ConfirmVoidModal.css';

/**
 * One tap to confirm a void. No PIN, no reason grid.
 *
 * <p>This replaced the supervisor-PIN dialog on both void paths. That gate was the right idea and
 * the wrong cost: on a real till the cashier IS the person who noticed the mistake, and making
 * them fetch a supervisor for every wrong tap turned a five-second correction into a queue. What
 * survives is the one thing a misplaced finger cannot get past - a dialog that says, in numbers,
 * exactly what is about to be voided, so cancelling is a decision and not an accident.
 *
 * <p>What was given up is worth naming: there is no longer a second person's approval on a void,
 * and the reason the cashier chose is no longer recorded. Who voided what, and when, still is -
 * the order carries it. If a café ever needs the stronger gate back, it belongs behind a per-tenant
 * setting rather than as a rule for everyone.
 */
export default function ConfirmVoidModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  title,
  description,
  detail = null,
  confirmLabel = 'أيوه، الغي',
}) {
  const onCloseRef = useRef(onClose);
  const onConfirmRef = useRef(onConfirm);
  onCloseRef.current = onClose;
  onConfirmRef.current = onConfirm;

  /* Enter confirms, Escape backs out. Captured, because the POS has its own window key handler
     and Escape there resets the quantity multiplier instead of closing this. */
  useEffect(() => {
    if (!isOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Enter') onConfirmRef.current?.();
        else onCloseRef.current?.();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="confirm-void-overlay" onClick={loading ? undefined : onClose} dir="rtl">
      <div className="confirm-void-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-void-modal__header">
          <div className="confirm-void-modal__icon">
            <AlertTriangle size={20} />
          </div>
          <h3>{title}</h3>
          <button type="button" className="confirm-void-modal__close" onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <div className="confirm-void-modal__body">
          <p>{description}</p>
          {detail && <div className="confirm-void-modal__detail">{detail}</div>}
        </div>

        <div className="confirm-void-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={loading}>
            لأ، سيبه
          </button>
          <button
            type="button"
            className="btn confirm-void-modal__confirm"
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? <Spinner size="sm" /> : <CheckCircle2 size={18} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
