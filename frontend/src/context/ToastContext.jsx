import { createContext, useCallback, useContext, useId, useRef, useState, useMemo } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

/* ── Toast types ── */
const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function ToastItem({ toast, onRemove }) {
  return (
    <div
      className={`toast toast--${toast.type} animate-fade-in`}
      role="alert"
      aria-live="polite"
    >
      <span className="toast__icon">{ICONS[toast.type]}</span>
      <div className="toast__body">
        {toast.title && <div className="toast__title">{toast.title}</div>}
        <div className="toast__message">{toast.message}</div>
      </div>
      <button className="toast__close" onClick={() => onRemove(toast.id)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id]);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    ({ type = 'info', title, message, duration = 4000 }) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      if (duration > 0) {
        timers.current[id] = setTimeout(() => remove(id), duration);
      }
    },
    [remove]
  );

  const toast = useMemo(() => ({
    success: (message, title) => add({ type: 'success', message, title }),
    error:   (message, title) => add({ type: 'error',   message, title, duration: 6000 }),
    warning: (message, title) => add({ type: 'warning', message, title }),
    info:    (message, title) => add({ type: 'info',    message, title }),
  }), [add]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
