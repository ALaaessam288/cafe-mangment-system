import { useEffect, useState } from 'react';
import { Minus, Plus, X, Coffee, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import './SugarModal.css';

export const SUGAR_OPTIONS = [
  { id: 'sada', label: 'سادة', desc: 'بدون سكر', shortcut: '1', icon: '☕', tone: 'neutral' },
  { id: 'reeha', label: 'ع الريحة', desc: 'ربع ملعقة', shortcut: '2', icon: '🤏', tone: 'amber' },
  { id: 'mazbout', label: 'مظبوط', desc: 'ملعقة سكر', shortcut: '3', icon: '✨', tone: 'green' },
  { id: 'zyada', label: 'زيادة', desc: 'ملعقتين سكر', shortcut: '4', icon: '🍯', tone: 'gold' },
  { id: 'fawq_zyada', label: 'فوق الزيادة', desc: '3 ملاعق+', shortcut: '5', icon: '🔥', tone: 'orange' },
];

export const EXTRA_NOTES = [
  'سكر برة',
  'سكر دايت',
  'حليب زيادة',
  'بدون حليب',
  'مياه مغلية زيادة',
  'سيرب فانيليا',
  'سيرب كراميل',
  'دبل شوت',
];

export default function SugarModal({
  product,
  quantity = 1,
  onQuantityChange,
  onCancel,
  onConfirm,
}) {
  const [selectedSugar, setSelectedSugar] = useState('mazbout');
  const [customNote, setCustomNote] = useState('');
  const [extraTags, setExtraTags] = useState([]);

  // Auto-keyboard shortcuts (1-5 for sugar levels, Enter to confirm, Escape to cancel)
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // Check if typing in custom input
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleFinalConfirm();
        }
        return;
      }

      // 1 to 5 shortcuts
      const matched = SUGAR_OPTIONS.find((s) => s.shortcut === e.key);
      if (matched) {
        e.preventDefault();
        handleInstantSelect(matched.label);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleFinalConfirm();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSugar, extraTags, customNote, quantity]);

  function handleInstantSelect(sugarLabel) {
    let finalNote = sugarLabel;
    if (extraTags.length > 0) {
      finalNote += ' + ' + extraTags.join('، ');
    }
    if (customNote.trim()) {
      finalNote += ' (' + customNote.trim() + ')';
    }
    onConfirm({
      sugar: sugarLabel,
      note: finalNote,
      quantity,
    });
  }

  function handleFinalConfirm() {
    const sugarObj = SUGAR_OPTIONS.find((s) => s.id === selectedSugar);
    const sugarLabel = sugarObj ? sugarObj.label : '';
    let parts = [];
    if (sugarLabel) parts.push(sugarLabel);
    if (extraTags.length > 0) parts.push(extraTags.join('، '));
    if (customNote.trim()) parts.push(customNote.trim());

    onConfirm({
      sugar: sugarLabel,
      note: parts.join(' - '),
      quantity,
    });
  }

  function toggleExtraTag(tag) {
    setExtraTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const unitPrice = parseFloat(product.price ?? 0);
  const lineTotal = unitPrice * quantity;

  return (
    <div className="pos__open-modal-overlay" onClick={onCancel}>
      <div className="pos__open-modal sugar-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="sugar-modal__header">
          <div className="sugar-modal__title-box">
            <span className="sugar-modal__kicker">
              <Coffee size={13} /> تخصيص المشروب
            </span>
            <h3 className="sugar-modal__title">{product.name}</h3>
            <span className="sugar-modal__price">{formatCurrency(unitPrice)}</span>
          </div>
          <button type="button" className="sugar-modal__close" onClick={onCancel} aria-label="إلغاء">
            <X size={18} />
          </button>
        </header>

        {/* Section: Sugar Selection */}
        <div className="sugar-modal__body">
          <div className="sugar-modal__section-head">
            <span>🍬 اختار مستوى السكر:</span>
            <small>اضغط على أي خيار للإضافة الفورية (أو أرقام 1-5)</small>
          </div>

          <div className="sugar-grid">
            {SUGAR_OPTIONS.map((opt) => {
              const isSelected = selectedSugar === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`sugar-btn sugar-btn--${opt.tone} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleInstantSelect(opt.label)}
                >
                  <span className="sugar-btn__shortcut">{opt.shortcut}</span>
                  <span className="sugar-btn__icon">{opt.icon}</span>
                  <strong className="sugar-btn__label">{opt.label}</strong>
                  <small className="sugar-btn__desc">{opt.desc}</small>
                </button>
              );
            })}
          </div>

          {/* Section: Extra Quick Notes */}
          <div className="sugar-modal__section-head" style={{ marginTop: '16px' }}>
            <span>✨ إضافات وملاحظات سريعة:</span>
          </div>
          <div className="sugar-tags">
            {EXTRA_NOTES.map((tag) => {
              const active = extraTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`sugar-tag ${active ? 'is-active' : ''}`}
                  onClick={() => toggleExtraTag(tag)}
                >
                  {active && <Check size={12} />}
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Note & Quantity */}
          <div className="sugar-modal__footer-row">
            <div className="sugar-modal__qty">
              <span>الكمية:</span>
              <div className="sugar-modal__qty-controls">
                <button
                  type="button"
                  className="order-item__qty-btn"
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  aria-label="تقليل الكمية"
                >
                  <Minus size={14} />
                </button>
                <span className="sugar-modal__qty-value">{quantity}</span>
                <button
                  type="button"
                  className="order-item__qty-btn order-item__qty-btn--add"
                  onClick={() => onQuantityChange(Math.min(99, quantity + 1))}
                  aria-label="زيادة الكمية"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <input
              type="text"
              className="sugar-modal__custom-input"
              placeholder="ملاحظة مخصصة أخرى..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
            />
          </div>
        </div>

        {/* Modal Actions */}
        <footer className="sugar-modal__actions">
          <button
            type="button"
            className="btn btn--secondary btn--md"
            onClick={() => onConfirm({ sugar: null, note: null, quantity })}
          >
            تخطي (بدون تحديد سكر)
          </button>
          <button
            type="button"
            className="btn btn--primary btn--md"
            onClick={handleFinalConfirm}
          >
            إضافة للطلب ({formatCurrency(lineTotal)})
          </button>
        </footer>
      </div>
    </div>
  );
}
