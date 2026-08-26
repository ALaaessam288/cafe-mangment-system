import { useState, useEffect } from 'react';
import { Coffee, CheckCircle, Package, AlertTriangle, Layers } from 'lucide-react';
import Modal from '../Modal/Modal';
import Input from '../Input/Input';
import Button from '../Button/Button';
import { auditApi } from '../../api/auditApi';
import { useToast } from '../../context/ToastContext';
import './ShiftAuditModal.css';

export default function ShiftAuditModal({ isOpen, onClose, shiftId, mode = 'OPENING', onComplete }) {
  const toast = useToast();
  const [auditItems, setAuditItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wasteRecords, setWasteRecords] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    auditApi.getAuditItems()
      .then((items) => {
        const activeItems = (items || []).filter(i => i.requiresAudit);
        setAuditItems(activeItems);
        const initialCounts = {};
        activeItems.forEach(item => {
          initialCounts[item.id] = item.stockQuantity ? String(item.stockQuantity) : '0';
        });
        setCounts(initialCounts);
      })
      .catch((err) => {
        toast.error('فشل في تحميل خامات الجرد: ' + err.message);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, mode]);

  function handleCountChange(itemId, val) {
    setCounts(prev => ({ ...prev, [itemId]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!shiftId) return;

    setIsSubmitting(true);
    try {
      const payloadCounts = {};
      Object.keys(counts).forEach(k => {
        payloadCounts[k] = parseFloat(counts[k]) || 0;
      });

      if (mode === 'OPENING') {
        await auditApi.recordShiftOpening(shiftId, payloadCounts);
        toast.success('تم تسجيل جرد بداية الشيفت بنجاح 🚀');
        if (onComplete) onComplete();
        onClose();
      } else {
        const records = await auditApi.recordShiftClosing(shiftId, payloadCounts);
        setWasteRecords(records);
        toast.success('تم جرد وتنسيق تقرير الهدر وإغلاق الجرد بنجاح 📊');
        if (onComplete) onComplete(records);
      }
    } catch (err) {
      toast.error(err.message, 'فشل في حفظ الجرد');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'OPENING' ? 'جرد بداية الشيفت والتجهيز 📦' : 'جرد إغلاق الشيفت وتقييم الهدر 📊'}
      subtitle={mode === 'OPENING' ? 'أدخل الكميات الحالية المتوفرة بالجرام والقطع لبدء الشيفت' : 'أدخل الكميات الفعلية المتبقية لحساب نسبة الهدر والعجز'}
      icon={mode === 'OPENING' ? '☕' : '📊'}
      size="md"
    >
      {wasteRecords ? (
        <div className="audit-waste-report">
          <div className="audit-waste-header">
            <CheckCircle size={24} color="#16a34a" />
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>تقرير جرد الهدر والعجز للشيفت</h4>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>مقارنة المنصرف الفعلي مع المخصوم التلقائي من الأوردرات</p>
            </div>
          </div>

          <div className="audit-waste-table">
            <div className="audit-waste-row audit-waste-row--header">
              <span>الخامة</span>
              <span>الفتح</span>
              <span>المباع (تلقائي)</span>
              <span>المتوقع</span>
              <span>الفعلي</span>
              <span>الهدر/العجز</span>
            </div>
            {wasteRecords.map(r => {
              const hasWaste = r.varianceCount > 0;
              return (
                <div key={r.id} className={`audit-waste-row ${hasWaste ? 'audit-waste-row--warning' : ''}`}>
                  <span><b>{r.auditItemName}</b> ({r.auditItemUnit})</span>
                  <span>{r.openingCount}</span>
                  <span>{r.soldDeductionCount}</span>
                  <span>{r.expectedClosingCount}</span>
                  <span><b>{r.actualClosingCount}</b></span>
                  <span style={{ color: hasWaste ? '#ef4444' : '#16a34a', fontWeight: 800 }}>
                    {hasWaste ? `+${r.varianceCount} (${r.wastePercentage?.toFixed(1)}%)` : 'مطابق'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="form-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setWasteRecords(null); onClose(); }}>موافق وإنهاء 🚀</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="audit-form">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>جاري تحميل الخامات...</div>
          ) : auditItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>لا توجد خامات مخصصة للجرد حالياً.</div>
          ) : (
            <div className="audit-grid">
              {auditItems.map(item => (
                <div key={item.id} className="audit-item-box">
                  <div className="audit-item-header">
                    <span className="audit-item-title">{item.name}</span>
                    <span className="audit-item-unit">({item.unit})</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`أدخل الكمية بـ (${item.unit})`}
                    value={counts[item.id] || ''}
                    onChange={(e) => handleCountChange(item.id, e.target.value)}
                    required
                  />
                </div>
              ))}
            </div>
          )}

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={onClose} type="button">إلغاء</Button>
            <Button type="submit" loading={isSubmitting}>
              {mode === 'OPENING' ? 'حفظ الجرد وبدء الشيفت 🚀' : 'تأكيد الجرد وحساب الهدر 📊'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
