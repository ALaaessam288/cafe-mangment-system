import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  badge,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /* Trap focus & ESC */
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    
    // Focus the modal when it opens
    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 50);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={closeOnOverlay ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={dialogRef}
        className={`modal modal--${size}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Top glowing accent line */}
        <div className="modal__top-bar" />

        {/* Header */}
        <div className="modal__header">
          <div className="modal__header-content">
            {icon && (
              <div className="modal__header-icon">
                {icon}
              </div>
            )}
            <div>
              <div className="modal__title-row">
                <h3 className="modal__title">{title}</h3>
                {badge && <span className="modal__badge">{badge}</span>}
              </div>
              {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            </div>
          </div>
          
          <button 
            className="modal__close" 
            onClick={onClose} 
            aria-label="إغلاق"
            title="إغلاق النافذة (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal__body">{children}</div>

        {/* Footer */}
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
