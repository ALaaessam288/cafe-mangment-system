import { Crown, Sparkles, X, ArrowUpRight, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import Button from '../Button/Button';
import './QuotaExceededModal.css';

export default function QuotaExceededModal({
  isOpen,
  onClose,
  resourceName = 'العناصر',
  currentCount = 0,
  maxLimit = 0,
  customMessage = '',
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  function handleUpgrade() {
    onClose();
    navigate(ROUTES.SETTINGS);
  }

  function handleWhatsAppSupport() {
    const text = encodeURIComponent(`مرحباً إدارة كافيو، أرغب في ترقية باقتي لزيادة الحد الأقصى من ${resourceName}.`);
    window.open(`https://wa.me/201099689947?text=${text}`, '_blank');
  }

  return (
    <div className="quota-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="quota-modal-card animate-scale-up" role="dialog" aria-modal="true">
        {/* Glow Header */}
        <div className="quota-modal-glow" />

        <button type="button" className="quota-modal-close" onClick={onClose} aria-label="إغلاق">
          <X size={18} />
        </button>

        <div className="quota-modal-icon-wrap">
          <Crown size={36} className="quota-modal-crown" />
          <Sparkles size={20} className="quota-modal-sparkle" />
        </div>

        <h2 className="quota-modal-title">وصلت للحد الأقصى للباقة!</h2>
        
        <p className="quota-modal-desc">
          {customMessage || `لقد بلغت الحد الأقصى المسموح به لعدد ${resourceName} في باقتك الحالية (${currentCount} من أصل ${maxLimit}).`}
        </p>

        {maxLimit > 0 && (
          <div className="quota-modal-meter-box">
            <div className="quota-modal-meter-info">
              <span>السعة المستخدمة:</span>
              <span className="quota-modal-meter-val text-warning font-mono">{currentCount} / {maxLimit}</span>
            </div>
            <div className="quota-modal-meter-bar">
              <div
                className="quota-modal-meter-fill"
                style={{ width: `${Math.min(100, Math.round((currentCount / maxLimit) * 100))}%` }}
              />
            </div>
            <span className="quota-modal-meter-status">⚠️ الباقة الحالية ممتلئة بنسبة 100%</span>
          </div>
        )}

        <div className="quota-modal-benefits">
          <div className="quota-benefit-item">
            <span>✨ زيادة غير محدودة للطاولات والكاشيرات والأصناف</span>
          </div>
          <div className="quota-benefit-item">
            <span>⚡ دعم فني مخصص ونسخ احتياطي فوري</span>
          </div>
        </div>

        <div className="quota-modal-actions">
          <Button
            size="lg"
            variant="primary"
            onClick={handleUpgrade}
            className="quota-btn-upgrade"
            leftIcon={<ArrowUpRight size={18} />}
          >
            ترقية باقة المنشأة 🚀
          </Button>

          <Button
            size="md"
            variant="outline"
            onClick={handleWhatsAppSupport}
            className="quota-btn-wa"
            leftIcon={<MessageCircle size={18} className="text-success" />}
          >
            تواصل مع خدمة العملاء (WhatsApp)
          </Button>
        </div>
      </div>
    </div>
  );
}
