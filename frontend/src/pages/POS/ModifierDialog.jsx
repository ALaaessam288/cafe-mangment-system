import { useEffect, useState } from 'react';
import { Minus, Plus, EyeOff, Coffee } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const SUGAR_NAMES = ['سادة', 'ع الريحة', 'مظبوط', 'زيادة', 'فوق الزيادة', 'سكر برة', 'سكر دايت'];
const SUGAR_NORMALIZE = {
  'ع الريحه': 'ع الريحة',
  'زياده': 'زيادة',
  'مضبوط': 'مظبوط',
  'فوق الزياده': 'فوق الزيادة',
  'سكر بره': 'سكر برة',
};

/**
 * Smart Modifier & Sugar Dialog:
 * - Distinguishes between Size/Add-ons (e.g. دبل +20 ج.م) and Sugar levels.
 * - Enforces strictly ONE option selection and strictly ONE sugar level.
 */
export default function ModifierDialog({
  product,
  options = [],
  selectedIds = [],
  onToggle,
  quantity = 1,
  onQuantityChange,
  note = '',
  onNoteChange,
  onCancel,
  onConfirm,
  onMarkUnavailable,
}) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA' && e.target?.tagName !== 'INPUT') {
        e.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, onConfirm]);

  // Separate non-sugar modifiers (e.g. "دبل", "حجم كبير") from sugar-named options
  const isSugarOption = (o) => {
    const name = (o.nameAr || '').trim();
    const normalized = SUGAR_NORMALIZE[name] || name;
    return SUGAR_NAMES.includes(normalized);
  };

  const customOptions = options.filter((o) => !isSugarOption(o));
  const dbSugarOptions = options.filter(isSugarOption);

  // Determine current active sugar from note or selected option
  const activeSugarInNote = SUGAR_NAMES.find((s) => (note || '').includes(s));
  const activeSugarOption = dbSugarOptions.find((o) => selectedIds.includes(o.id));
  const currentSugar = activeSugarInNote || (activeSugarOption ? (SUGAR_NORMALIZE[activeSugarOption.nameAr] || activeSugarOption.nameAr) : '');

  function handleSugarSelect(sugarLabel) {
    // If db has a matching option for this sugar, toggle it
    const matchingDbOption = dbSugarOptions.find((o) => (SUGAR_NORMALIZE[o.nameAr] || o.nameAr) === sugarLabel);
    
    // Clean old sugar names from note
    let cleanNote = note || '';
    SUGAR_NAMES.forEach((s) => {
      cleanNote = cleanNote.replace(new RegExp(`\\s*-?\\s*${s}\\s*-?\\s*`, 'g'), ' ').trim();
    });
    Object.keys(SUGAR_NORMALIZE).forEach((k) => {
      cleanNote = cleanNote.replace(new RegExp(`\\s*-?\\s*${k}\\s*-?\\s*`, 'g'), ' ').trim();
    });

    if (currentSugar === sugarLabel) {
      // Toggle off
      onNoteChange(cleanNote);
      if (matchingDbOption && selectedIds.includes(matchingDbOption.id)) {
        onToggle(matchingDbOption.id);
      }
    } else {
      // Select new single sugar
      onNoteChange(cleanNote ? `${sugarLabel} - ${cleanNote}` : sugarLabel);
      if (matchingDbOption) {
        onToggle(matchingDbOption.id);
      }
    }
  }

  const extra = options
    .filter((o) => selectedIds.includes(o.id))
    .reduce((sum, o) => sum + parseFloat(o.priceDelta ?? 0), 0);
  const lineTotal = (parseFloat(product.price ?? 0) + extra) * quantity;

  return (
    <div className="pos__open-modal-overlay" onClick={onCancel}>
      <div className="pos__open-modal modifier-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <span className="modifier-dialog__kicker">تخصيص الطلب · OPTION</span>
        <h3 className="modifier-dialog__title">{product.name}</h3>
        <p className="modifier-dialog__subtitle">اختار الحجم ومستوى السكر المطلوب</p>

        {/* Section 1: Custom Addons / Sizes (if any exist) */}
        {customOptions.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#e5d8cc', display: 'block', marginBottom: '8px' }}>
              الحجم / الإضافات:
            </span>
            <div className="modifier-dialog__options">
              {customOptions.map((option) => {
                const selected = selectedIds.includes(option.id);
                const delta = parseFloat(option.priceDelta ?? 0);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`modifier-chip ${selected ? 'modifier-chip--selected' : ''}`}
                    onClick={() => onToggle(option.id)}
                    aria-pressed={selected}
                  >
                    <span className="modifier-chip__name">{option.nameAr}</span>
                    {delta !== 0 && (
                      <span className="modifier-chip__delta">
                        {delta > 0 ? '+' : '-'}{formatCurrency(Math.abs(delta))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Sugar Selector (Single Choice) */}
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#e5d8cc', display: 'block', marginBottom: '8px' }}>
            🍬 مستوى السكر (اختيار واحد):
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {['سادة', 'ع الريحة', 'مظبوط', 'زيادة', 'فوق الزيادة', 'سكر برة', 'سكر دايت'].map((s) => {
              const isSelected = currentSugar === s;
              return (
                <button
                  key={s}
                  type="button"
                  style={{
                    border: isSelected ? '1.5px solid #5fd2b7' : '1px solid rgba(255,255,255,0.09)',
                    borderRadius: '8px',
                    padding: '8px 4px',
                    fontSize: '12px',
                    background: isSelected ? '#5fd2b7' : 'rgba(255,255,255,0.03)',
                    color: isSelected ? '#110e0c' : '#dcd1c6',
                    fontWeight: isSelected ? 900 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.14s',
                    textAlign: 'center',
                  }}
                  onClick={() => handleSugarSelect(s)}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity Controls */}
        <div className="modifier-dialog__qty" style={{ margin: '10px 0' }}>
          <span>الكمية</span>
          <div className="modifier-dialog__qty-controls">
            <button
              type="button"
              className="order-item__qty-btn"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              aria-label="تقليل الكمية"
            >
              <Minus size={14} />
            </button>
            <span className="modifier-dialog__qty-value">{quantity}</span>
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

        {/* Note Textarea */}
        <textarea
          className="modifier-dialog__note"
          placeholder="ملاحظة إضافية للبار أو المطبخ..."
          rows={2}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />

        <div className="modifier-dialog__total">
          <span>الإجمالي</span>
          <span>{formatCurrency(lineTotal)}</span>
        </div>

        {onMarkUnavailable && (
          <button type="button" className="modifier-dialog__eightysix" onClick={onMarkUnavailable}>
            <EyeOff size={14} /> الصنف خلص — إخفاؤه من الكاشير
          </button>
        )}

        <div className="pos__open-actions">
          <button type="button" className="btn btn--secondary btn--md" onClick={onCancel}>
            إلغاء
          </button>
          <button type="button" className="btn btn--primary btn--md" onClick={onConfirm} autoFocus>
            إضافة للطلب
          </button>
        </div>
      </div>
    </div>
  );
}
