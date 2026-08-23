import React, { useState, useMemo } from 'react';
import { Tag, Percent, DollarSign, Trash2, Check, Sparkles, Calculator, Info } from 'lucide-react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import { formatCurrency } from '../../utils/formatters';
import './DiscountServiceModal.css';

export default function DiscountServiceModal({
  isOpen,
  onClose,
  order,
  onApplyDiscount,
  onClearDiscount,
  onApplyServiceFee,
  onClearServiceFee,
  initialTab = 'discount'
}) {
  const [tab, setTab] = useState(initialTab); // 'discount' | 'service'
  const [discountMode, setDiscountMode] = useState('PERCENT'); // 'PERCENT' | 'FIXED'
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('خصم يدوي');

  const [serviceMode, setServiceMode] = useState('FIXED'); // 'FIXED' | 'PERCENT'
  const [serviceValue, setServiceValue] = useState('');

  const subtotal = Number(order?.subtotal ?? 0);
  const currentDiscount = Number(order?.discount ?? 0);
  const currentService = Number(order?.service ?? 0);
  const deliveryFee = Number(order?.deliveryFee ?? 0);

  // Live preview calculations for Discount
  const previewDiscountAmount = useMemo(() => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) return 0;
    if (discountMode === 'PERCENT') {
      const pct = Math.min(100, Math.max(0, val));
      return Math.round((subtotal * (pct / 100)) * 100) / 100;
    }
    return Math.min(subtotal, Math.max(0, val));
  }, [discountValue, discountMode, subtotal]);

  // Live preview calculations for Service Fee
  const previewServiceAmount = useMemo(() => {
    const val = parseFloat(serviceValue);
    if (isNaN(val) || val <= 0) return 0;
    if (serviceMode === 'PERCENT') {
      const pct = Math.max(0, val);
      return Math.round((subtotal * (pct / 100)) * 100) / 100;
    }
    return Math.max(0, val);
  }, [serviceValue, serviceMode, subtotal]);

  // Projected Grand Total
  const activeDiscount = tab === 'discount' && discountValue ? previewDiscountAmount : currentDiscount;
  const activeService = tab === 'service' && serviceValue ? previewServiceAmount : currentService;
  const projectedTotal = Math.max(0, subtotal - activeDiscount + activeService + deliveryFee);

  const discountPresets = [
    { label: '5%', mode: 'PERCENT', val: 5 },
    { label: '10%', mode: 'PERCENT', val: 10 },
    { label: '15%', mode: 'PERCENT', val: 15 },
    { label: '20%', mode: 'PERCENT', val: 20 },
    { label: '25%', mode: 'PERCENT', val: 25 },
    { label: '50%', mode: 'PERCENT', val: 50 },
    { label: '10 ج', mode: 'FIXED', val: 10 },
    { label: '20 ج', mode: 'FIXED', val: 20 },
    { label: '50 ج', mode: 'FIXED', val: 50 },
    { label: '100 ج', mode: 'FIXED', val: 100 },
  ];

  const servicePresets = [
    { label: '5%', mode: 'PERCENT', val: 5 },
    { label: '10%', mode: 'PERCENT', val: 10 },
    { label: '12%', mode: 'PERCENT', val: 12 },
    { label: '15%', mode: 'PERCENT', val: 15 },
    { label: '10 ج', mode: 'FIXED', val: 10 },
    { label: '15 ج', mode: 'FIXED', val: 15 },
    { label: '20 ج', mode: 'FIXED', val: 20 },
    { label: '30 ج', mode: 'FIXED', val: 30 },
  ];

  const reasonOptions = ['خصم يدوي', 'ضيافة إدارة', 'عرض خاص', 'عميل مميز', 'تعويض تأخير'];

  const handleApplyDiscount = () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) return;
    onApplyDiscount({
      type: discountMode,
      value: val,
      reason: discountReason || 'خصم يدوي',
    });
    onClose();
  };

  const handleApplyService = () => {
    if (serviceMode === 'PERCENT') {
      const pct = parseFloat(serviceValue) || 0;
      const amt = Math.round((subtotal * (pct / 100)) * 100) / 100;
      onApplyServiceFee(amt);
    } else {
      const amt = parseFloat(serviceValue) || 0;
      onApplyServiceFee(amt);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="خصومات وخدمة الفاتورة"
      size="sm"
    >
      <div className="discount-modal-container">
        {/* Tab switcher Header */}
        <div className="discount-modal__tabs">
          <button
            type="button"
            className={`discount-modal__tab-btn ${tab === 'discount' ? 'discount-modal__tab-btn--active-discount' : ''}`}
            onClick={() => setTab('discount')}
          >
            <Tag size={13} />
            <span>الخصم</span>
            {currentDiscount > 0 && (
              <span className="discount-modal__badge discount-modal__badge--danger">
                -{formatCurrency(currentDiscount)}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`discount-modal__tab-btn ${tab === 'service' ? 'discount-modal__tab-btn--active-service' : ''}`}
            onClick={() => setTab('service')}
          >
            <Sparkles size={13} />
            <span>رسوم الخدمة</span>
            {currentService > 0 && (
              <span className="discount-modal__badge discount-modal__badge--success">
                +{formatCurrency(currentService)}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: DISCOUNT */}
        {tab === 'discount' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Mode selection bar */}
            <div className="discount-modal__mode-bar">
              <span className="discount-modal__label">
                <Calculator size={12} /> النوع:
              </span>
              <div className="discount-modal__mode-toggle">
                <button
                  type="button"
                  className={`discount-modal__mode-btn ${discountMode === 'PERCENT' ? 'discount-modal__mode-btn--active' : ''}`}
                  onClick={() => { setDiscountMode('PERCENT'); setDiscountValue(''); }}
                >
                  <Percent size={11} /> نسبة %
                </button>
                <button
                  type="button"
                  className={`discount-modal__mode-btn ${discountMode === 'FIXED' ? 'discount-modal__mode-btn--active' : ''}`}
                  onClick={() => { setDiscountMode('FIXED'); setDiscountValue(''); }}
                >
                  <DollarSign size={11} /> مبلغ ج.م
                </button>
              </div>
            </div>

            {/* Quick Presets Grid */}
            <div className="discount-modal__section">
              <span className="discount-modal__label" style={{ fontSize: '10px', color: '#94a3b8' }}>
                اختيار سريع:
              </span>
              <div className="discount-modal__presets-grid">
                {discountPresets.map((p, idx) => {
                  const isSelected = discountMode === p.mode && parseFloat(discountValue) === p.val;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`discount-modal__preset-chip ${isSelected ? 'discount-modal__preset-chip--selected' : ''}`}
                      onClick={() => {
                        setDiscountMode(p.mode);
                        setDiscountValue(String(p.val));
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="discount-modal__section">
              <span className="discount-modal__label" style={{ fontSize: '10px', color: '#94a3b8' }}>
                القيمة:
              </span>
              <div className="discount-modal__input-wrapper">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder={discountMode === 'PERCENT' ? 'النسبة مثلاً 15' : 'المبلغ مثلاً 30'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  autoFocus
                  className="discount-modal__input"
                />
                <span className="discount-modal__input-suffix">
                  {discountMode === 'PERCENT' ? '%' : 'ج.م'}
                </span>
              </div>
            </div>

            {/* Discount Reason */}
            <div className="discount-modal__section">
              <span className="discount-modal__label" style={{ fontSize: '10px', color: '#94a3b8' }}>
                السبب:
              </span>
              <div className="discount-modal__reasons-flex">
                {reasonOptions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`discount-modal__reason-chip ${discountReason === r ? 'discount-modal__reason-chip--selected' : ''}`}
                    onClick={() => setDiscountReason(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERVICE FEE */}
        {tab === 'service' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Mode selection bar */}
            <div className="discount-modal__mode-bar">
              <span className="discount-modal__label">
                <Calculator size={12} /> النوع:
              </span>
              <div className="discount-modal__mode-toggle">
                <button
                  type="button"
                  className={`discount-modal__mode-btn ${serviceMode === 'FIXED' ? 'discount-modal__mode-btn--active' : ''}`}
                  onClick={() => { setServiceMode('FIXED'); setServiceValue(''); }}
                >
                  <DollarSign size={11} /> مبلغ ج.م
                </button>
                <button
                  type="button"
                  className={`discount-modal__mode-btn ${serviceMode === 'PERCENT' ? 'discount-modal__mode-btn--active' : ''}`}
                  onClick={() => { setServiceMode('PERCENT'); setServiceValue(''); }}
                >
                  <Percent size={11} /> نسبة %
                </button>
              </div>
            </div>

            {/* Quick Presets Grid */}
            <div className="discount-modal__section">
              <span className="discount-modal__label" style={{ fontSize: '10px', color: '#94a3b8' }}>
                اختيار سريع:
              </span>
              <div className="discount-modal__presets-grid">
                {servicePresets.map((p, idx) => {
                  const isSelected = serviceMode === p.mode && parseFloat(serviceValue) === p.val;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`discount-modal__preset-chip ${isSelected ? 'discount-modal__preset-chip--selected' : ''}`}
                      onClick={() => {
                        setServiceMode(p.mode);
                        setServiceValue(String(p.val));
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input */}
            <div className="discount-modal__section">
              <span className="discount-modal__label" style={{ fontSize: '10px', color: '#94a3b8' }}>
                القيمة:
              </span>
              <div className="discount-modal__input-wrapper">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder={serviceMode === 'PERCENT' ? 'النسبة مثلاً 12' : 'المبلغ مثلاً 20'}
                  value={serviceValue}
                  onChange={(e) => setServiceValue(e.target.value)}
                  autoFocus
                  className="discount-modal__input"
                />
                <span className="discount-modal__input-suffix">
                  {serviceMode === 'PERCENT' ? '%' : 'ج.م'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Live Calculation Summary */}
        <div className="discount-modal__summary-card">
          <div className="discount-modal__summary-title">
            <span>المعاينة الفورية</span>
            <Info size={11} color="#64748b" />
          </div>

          <div className="discount-modal__summary-row">
            <span>المجموع الفرعي:</span>
            <span style={{ fontWeight: '700' }}>{formatCurrency(subtotal)}</span>
          </div>

          {activeDiscount > 0 && (
            <div className="discount-modal__summary-row discount-modal__summary-row--discount">
              <span>الخصم:</span>
              <span>-{formatCurrency(activeDiscount)}</span>
            </div>
          )}

          {activeService > 0 && (
            <div className="discount-modal__summary-row discount-modal__summary-row--service">
              <span>الخدمة:</span>
              <span>+{formatCurrency(activeService)}</span>
            </div>
          )}

          {deliveryFee > 0 && (
            <div className="discount-modal__summary-row">
              <span>التوصيل:</span>
              <span style={{ fontWeight: '700' }}>+{formatCurrency(deliveryFee)}</span>
            </div>
          )}

          <div className="discount-modal__summary-divider" />

          <div className="discount-modal__summary-row discount-modal__summary-row--total">
            <span>الإجمالي:</span>
            <span className="discount-modal__total-amount">{formatCurrency(projectedTotal)}</span>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="discount-modal__footer">
          <div>
            {tab === 'discount' && currentDiscount > 0 && (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={12} />}
                onClick={() => { onClearDiscount(); onClose(); }}
              >
                إلغاء الخصم
              </Button>
            )}

            {tab === 'service' && currentService > 0 && (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={12} />}
                onClick={() => { onClearServiceFee(); onClose(); }}
              >
                إلغاء الخدمة
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              إلغاء
            </Button>

            {tab === 'discount' ? (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check size={12} />}
                onClick={handleApplyDiscount}
                disabled={!discountValue || parseFloat(discountValue) <= 0}
              >
                تطبيق الخصم
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check size={12} />}
                onClick={handleApplyService}
                disabled={!serviceValue || parseFloat(serviceValue) <= 0}
              >
                تطبيق الخدمة
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
