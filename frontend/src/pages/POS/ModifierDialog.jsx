import { useEffect } from 'react';
import { Minus, Plus, EyeOff } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

/**
 * Opened automatically when a product has options in the existing
 * ProductOption model, or on demand (right-click a card) to set a quantity /
 * kitchen note. Options are flat toggles - nameAr + priceDelta + isDefault -
 * exactly as the backend defines them; no new modifier system.
 *
 * Enter confirms, Escape cancels, so the cashier never has to reach for the
 * mouse.
 */
export default function ModifierDialog({
  product,
  options = [],
  selectedIds,
  onToggle,
  quantity,
  onQuantityChange,
  note,
  onNoteChange,
  onCancel,
  onConfirm,
  onMarkUnavailable,
}) {
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      // Enter inside the note box should add a newline, not submit.
      if (e.key === 'Enter' && e.target?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, onConfirm]);

  const extra = options
    .filter((o) => selectedIds.includes(o.id))
    .reduce((sum, o) => sum + parseFloat(o.priceDelta ?? 0), 0);
  const lineTotal = (parseFloat(product.price ?? 0) + extra) * quantity;

  return (
    <div className="pos__open-modal-overlay" onClick={onCancel}>
      <div className="pos__open-modal modifier-dialog" onClick={(e) => e.stopPropagation()}>
        <span className="modifier-dialog__kicker">CUSTOMIZE ITEM · 03</span>
        <h3 className="modifier-dialog__title">{product.name}</h3>
        <p className="modifier-dialog__subtitle">
          {options.length > 0 ? 'اختار الحجم / الإضافات' : 'الكمية والملاحظات'}
        </p>

        {options.length > 0 && (
          <div className="modifier-dialog__options">
            {options.map((option) => {
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
        )}

        <div className="modifier-dialog__qty">
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

        <div style={{ margin: '12px 0 6px', display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#9c8c7f', fontWeight: 800 }}>🍬 سكر سريع (اختيار واحد):</span>
          {['سادة', 'ع الريحة', 'مظبوط', 'زيادة', 'فوق الزيادة', 'سكر برة', 'سكر دايت'].map((s) => {
            const isSelected = (note || '').includes(s);
            return (
              <button
                key={s}
                type="button"
                style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  padding: '4px 9px',
                  fontSize: '11.5px',
                  background: isSelected ? '#5fd2b7' : 'rgba(255,255,255,0.04)',
                  color: isSelected ? '#110e0c' : '#dcd1c6',
                  fontWeight: isSelected ? 850 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.14s',
                }}
                onClick={() => {
                  const ALL_SUGARS = ['سادة', 'ع الريحة', 'مظبوط', 'زيادة', 'فوق الزيادة', 'سكر برة', 'سكر دايت'];
                  let cleanNote = note || '';
                  ALL_SUGARS.forEach((other) => {
                    cleanNote = cleanNote.replace(new RegExp(`\\s*-?\\s*${other}\\s*-?\\s*`, 'g'), ' ').trim();
                  });
                  if (isSelected) {
                    onNoteChange(cleanNote);
                  } else {
                    onNoteChange(cleanNote ? `${s} - ${cleanNote}` : s);
                  }
                }}
              >
                {s}
              </button>
            );
          })}
        </div>

        <textarea
          className="modifier-dialog__note"
          placeholder="ملاحظة للمطبخ / البار (اختياري)"
          rows={2}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />

        <div className="modifier-dialog__total">
          <span>الإجمالي</span>
          <span>{formatCurrency(lineTotal)}</span>
        </div>

        {/* 86 the item straight from the till - no trip to the admin screens.
            Only offered to roles the backend actually allows. */}
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
