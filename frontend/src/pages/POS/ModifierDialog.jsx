import { useEffect } from 'react';
import { Minus, Plus, EyeOff, X } from 'lucide-react';
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

  /*
   * One option at a time.
   *
   * The header of this file has always said it "enforces strictly ONE option selection", but the
   * chip was wired straight to a plain toggle, so every size and add-on accumulated: picking
   * كيوي، فراولة and بلوبيري together added +30 to a smoothie that can only be one flavour.
   * Clicking the selected chip again clears it, so an optional group can still be left empty.
   *
   * The parent updates through `setSelectedOptionIds(prev => ...)`, so clearing the old selection
   * and setting the new one in the same tick is safe — each call sees the previous result.
   */
  function handleOptionSelect(optionId) {
    const alreadySelected = selectedIds.includes(optionId);
    const option = customOptions.find((o) => o.id === optionId);
    const group = option?.optionGroup || 'ADDON';

    /* Extras are a list; a size is a question.
     *
     * This used to clear every other selected option regardless, because options were a flat bag
     * with nothing distinguishing a size from a sugar level from a shot of vanilla. That made
     * "large, مظبوط" impossible to order: picking the sugar unpicked the size. Now the exclusion
     * is scoped to the group, so the two questions stop fighting and extras stack freely. */
    if (group !== 'ADDON') {
      customOptions
        .filter((o) => o.id !== optionId
                    && (o.optionGroup || 'ADDON') === group
                    && selectedIds.includes(o.id))
        .forEach((o) => onToggle(o.id));
    }

    if (!alreadySelected) onToggle(optionId);
  }

  const GROUP_LABELS = { SIZE: 'الحجم', SUGAR: 'السكر', SPICE: 'التتبيلة', ADDON: 'إضافات' };

  // Grouped for display, in a fixed order, so the cashier always finds size where size was last time.
  const groupedOptions = ['SIZE', 'SUGAR', 'SPICE', 'ADDON']
    .map((group) => ({
      group,
      label: GROUP_LABELS[group],
      items: customOptions.filter((o) => (o.optionGroup || 'ADDON') === group),
    }))
    .filter((section) => section.items.length > 0);

  const extra = options
    .filter((o) => selectedIds.includes(o.id))
    .reduce((sum, o) => sum + parseFloat(o.priceDelta ?? 0), 0);
  const lineTotal = (parseFloat(product.price ?? 0) + extra) * quantity;

  /* The hardcoded sugar row only appears when the product has no SUGAR options of its own.
     Otherwise the cashier is asked the same question twice, in two different widgets, with two
     different storage mechanisms behind them - the group writes an option id, this row writes
     into the note - and the two can disagree. */
  const hasDbSugarGroup = groupedOptions.some((g) => g.group === 'SUGAR');

  return (
    /* No onClick on the overlay.
       Closing on an outside click is fine for something you only read. This dialog holds a size,
       a spice level, a list of extras, a quantity and a note - a minute of work on a busy till,
       thrown away by one stray tap beside the box. Escape and the two buttons close it, all three
       of them deliberate. */
    <div className="mod-overlay">
      <div className="mod" role="dialog" aria-modal="true" aria-label={product.name}>

        <header className="mod__head">
          <div className="mod__id">
            <strong>{product.name}</strong>
            <small>{formatCurrency(product.price)}</small>
          </div>
          <button type="button" className="mod__x" onClick={onCancel} aria-label="إلغاء">
            <X size={16} />
          </button>
        </header>

        <div className="mod__body">
          {groupedOptions.map((section) => (
            <section key={section.group} className="mod__group">
              <span className="mod__label">
                {section.label}
                <em>{section.group === 'ADDON' ? 'اختار اللي تحبه' : 'اختيار واحد'}</em>
              </span>
              <div className="mod__chips">
                {section.items.map((option) => {
                  const selected = selectedIds.includes(option.id);
                  const delta = parseFloat(option.priceDelta ?? 0);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`mod__chip ${selected ? 'is-on' : ''}`}
                      onClick={() => handleOptionSelect(option.id)}
                      aria-pressed={selected}
                    >
                      {option.nameAr}
                      {delta !== 0 && (
                        <span className="mod__delta">
                          {delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {!hasDbSugarGroup && (
            <section className="mod__group">
              <span className="mod__label">السكر<em>اختيار واحد</em></span>
              <div className="mod__chips">
                {SUGAR_NAMES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`mod__chip ${currentSugar === s ? 'is-on is-sugar' : ''}`}
                    onClick={() => handleSugarSelect(s)}
                    aria-pressed={currentSugar === s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          )}

          <input
            className="mod__note"
            placeholder="ملاحظة للبار أو المطبخ…"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />

          {onMarkUnavailable && (
            <button type="button" className="mod__eightysix" onClick={onMarkUnavailable}>
              <EyeOff size={13} /> الصنف خلص — اخفيه من الكاشير
            </button>
          )}
        </div>

        {/* Quantity, total and the decision on one line. They were four stacked blocks costing
            about 200px of a dialog that was already taller than the screen. */}
        <footer className="mod__foot">
          <div className="mod__qty">
            <button type="button" onClick={() => onQuantityChange(Math.max(1, quantity - 1))} aria-label="تقليل الكمية">
              <Minus size={14} />
            </button>
            <span>{quantity}</span>
            <button type="button" onClick={() => onQuantityChange(Math.min(99, quantity + 1))} aria-label="زيادة الكمية">
              <Plus size={14} />
            </button>
          </div>

          <div className="mod__total">
            <small>الإجمالي</small>
            <strong>{formatCurrency(lineTotal)}</strong>
          </div>

          <button type="button" className="btn btn--primary mod__go" onClick={onConfirm} autoFocus>
            إضافة
          </button>
        </footer>
      </div>
    </div>
  );
}
