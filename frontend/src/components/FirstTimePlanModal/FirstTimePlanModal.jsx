import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { tenantApi } from '../../api/tenantApi';
import Button from '../Button/Button';
import './FirstTimePlanModal.css';

const PLANS = [
  {
    id: 'TRIAL',
    name: 'TRIAL',
    displayName: 'فترة تجريبية',
    price: 'مجاناً',
    duration: '14 يوم',
    badge: 'تجربة مجانية',
    badgeClass: 'bg-secondary',
    features: [
      'حتى 5 طاولات كافيه',
      'حتى 2 مستخدمين وكاشيرات',
      'حتى 30 صنف بالمنيو',
      'نظام الكاشير ونقاط البيع',
    ],
  },
  {
    id: 'STARTER',
    name: 'STARTER',
    displayName: 'الباقة الأساسية',
    price: '499 ج.م',
    duration: 'شهرياً',
    badge: 'كافيه أساسي',
    badgeClass: 'bg-info text-dark',
    features: [
      'حتى 10 طاولات',
      'حتى 4 مستخدمين وكاشيرات',
      'حتى 100 صنف بالمنيو',
      'طباعة فواتير حرارية',
      'تسجيل المصاريف ونثريات الشيفت',
    ],
  },
  {
    id: 'PRO',
    name: 'PRO',
    displayName: 'الباقة الاحترافية',
    price: '899 ج.م',
    duration: 'شهرياً',
    badge: 'الأكثر طلباً ⭐',
    badgeClass: 'bg-warning text-dark',
    featured: true,
    features: [
      'حتى 25 طاولة كافيه',
      'حتى 8 كاشيرات ومشرفين',
      'أصناف منيو ومخزون بلا حدود',
      'شاشة تحضير المطبخ والبار (KDS)',
      'سجل الديون والآجل ومسحوبات الموظفين',
      'تقارير وإحصائيات متقدمة',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'ENTERPRISE',
    displayName: 'الباقة الشاملة',
    price: '1,499 ج.م',
    duration: 'شهرياً',
    badge: 'شامل غير محدود 🚀',
    badgeClass: 'bg-success',
    features: [
      'طاولات غير محدودة ♾',
      'كاشيرات وموظفين بلا حدود',
      'منتجات ومخزون بلا حدود',
      'لوحة إدارة متكاملة + دعم فني VIP',
      'شعار وهوية مخصصة للعلامة التجارية',
    ],
  },
];

export default function FirstTimePlanModal() {
  const { user, updateTenantPlan } = useAuth();
  const toast = useToast();

  const [selectedPlan, setSelectedPlan] = useState('PRO');
  const [submitting, setSubmitting] = useState(false);

  // Only show if user is logged in, not super-admin, and planSelected is false
  if (!user || user.role === 'SUPER_ADMIN' || user.planSelected !== false) {
    return null;
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const updatedTenant = await tenantApi.selectPlan(selectedPlan);
      updateTenantPlan(updatedTenant);
      toast.success(`تم تفعيل باقة (${updatedTenant.planDisplayName || selectedPlan}) بنجاح! مرحباً بك في كافيو 🚀`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'فشل في حفظ الباقة المختارة');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ft-plan-backdrop">
      <div className="ft-plan-dialog">
        <div className="ft-plan-header">
          <div className="ft-plan-header__badge">إعداد الحساب لأول مرة ✦ First-Time Setup</div>
          <h2 className="ft-plan-header__title">
            مرحباً بك في كافيو! 🎉
          </h2>
          <p className="ft-plan-header__subtitle">
            يرجى اختيار باقة الاشتراك المناسبة لنشاطك التجاري لبدء استخدام النظام وتحديد سعة الطاولات والكاشيرات
          </p>
        </div>

        <div className="ft-plan-grid">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`ft-plan-card ${isSelected ? 'ft-plan-card--selected' : ''} ${plan.featured ? 'ft-plan-card--featured' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <div className="ft-plan-card__top">
                  <span className={`badge ${plan.badgeClass} ft-plan-card__badge`}>{plan.badge}</span>
                  <h3 className="ft-plan-card__name">{plan.name}</h3>
                  <div className="ft-plan-card__price">
                    {plan.price} <small>/ {plan.duration}</small>
                  </div>
                </div>

                <ul className="ft-plan-card__features">
                  {plan.features.map((feat, idx) => (
                    <li key={idx}>
                      <i className="bi bi-check2 text-success me-2" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="ft-plan-card__select-indicator">
                  {isSelected ? (
                    <span className="text-amber fw-bold">
                      <i className="bi bi-check-circle-fill me-1" /> تم الاختيار
                    </span>
                  ) : (
                    <span className="text-muted">اضغط للاختيار</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="ft-plan-footer">
          <Button
            variant="primary"
            size="lg"
            className="ft-plan-submit-btn"
            loading={submitting}
            disabled={submitting}
            onClick={handleConfirm}
          >
            تأكيد الباقة والبدء 🚀
          </Button>
        </div>
      </div>
    </div>
  );
}
