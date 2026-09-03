import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { tenantApi } from '../../api/tenantApi';
import { plansApi, formatLimit } from '../../api/plansApi';
import Button from '../Button/Button';
import Spinner from '../Spinner/Spinner';
import './FirstTimePlanModal.css';

/*
 * First-run plan picker.
 *
 * Two things were wrong here. The cards were a hardcoded array whose limits contradicted what the
 * server enforced — PRO advertised 25 tables and unlimited menu items against a real 50 and 500 —
 * and the default selection was PRO, a paid tier the endpoint rejects with 402, whose raw English
 * message ("Paid plans require a valid license or a platform administrator") was then rendered
 * straight to an Arabic-speaking café owner. So the modal's happy path failed by default.
 *
 * Cards now come from /api/plans, the free trial is preselected, and paid tiers are shown as what
 * they are: an upgrade you arrange with a licence key, not something you can grant yourself.
 */
export default function FirstTimePlanModal() {
  const { user, updateTenantPlan } = useAuth();
  const toast = useToast();

  const [plans, setPlans] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const shouldShow = !!user && user.role !== 'SUPER_ADMIN' && user.planSelected === false;

  useEffect(() => {
    if (!shouldShow) return;
    let cancelled = false;

    plansApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setPlans(data);
        // Preselect the plan the customer can actually take right now.
        const selectable = data.find((p) => p.selfSelectable) ?? data[0];
        setSelectedPlan(selectable?.code ?? null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.response?.data?.message || 'تعذر تحميل باقات الاشتراك');
      });

    return () => {
      cancelled = true;
    };
  }, [shouldShow]);

  const selected = useMemo(
    () => plans?.find((p) => p.code === selectedPlan) ?? null,
    [plans, selectedPlan],
  );

  if (!shouldShow) return null;

  async function handleConfirm() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const subscription = await tenantApi.selectPlan(selected.code);
      updateTenantPlan(subscription);
      toast.success(`تم تفعيل باقة (${subscription.planName || selected.displayName}) بنجاح! مرحباً بك في كافيو 🚀`);
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
          <h2 className="ft-plan-header__title">مرحباً بك في كافيو! 🎉</h2>
          <p className="ft-plan-header__subtitle">
            ابدأ بالفترة التجريبية المجانية، ويمكنك الترقية في أي وقت من صفحة الإعدادات بمفتاح الترخيص.
          </p>
        </div>

        {loadError && (
          <div className="alert alert-danger m-3" role="alert">
            {loadError}
          </div>
        )}

        {!plans && !loadError && (
          <div className="d-flex justify-content-center py-5">
            <Spinner />
          </div>
        )}

        {plans && (
          <div className="ft-plan-grid">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.code;
              const available = plan.selfSelectable;
              return (
                <div
                  key={plan.code}
                  role="button"
                  tabIndex={available ? 0 : -1}
                  aria-disabled={!available}
                  className={[
                    'ft-plan-card',
                    isSelected ? 'ft-plan-card--selected' : '',
                    !available ? 'ft-plan-card--locked' : '',
                  ].join(' ')}
                  onClick={() => available && setSelectedPlan(plan.code)}
                  onKeyDown={(e) => {
                    if (available && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setSelectedPlan(plan.code);
                    }
                  }}
                >
                  <div className="ft-plan-card__top">
                    <span className={`badge ${available ? 'bg-secondary' : 'bg-warning text-dark'} ft-plan-card__badge`}>
                      {available ? 'متاحة الآن' : 'ترقية بمفتاح ترخيص'}
                    </span>
                    <h3 className="ft-plan-card__name">{plan.displayName}</h3>
                    <div className="ft-plan-card__price">
                      {plan.price > 0 ? `${plan.price} ${plan.currency}` : 'مجاناً'}{' '}
                      <small>
                        /{' '}
                        {plan.trialDays > 0
                          ? `${plan.trialDays} يوم`
                          : `${plan.billingPeriodDays} يوم`}
                      </small>
                    </div>
                  </div>

                  <ul className="ft-plan-card__features">
                    <li>
                      <i className="bi bi-check2 text-success me-2" />
                      <span>{formatLimit(plan.limits.maxTables, 'طاولة')}</span>
                    </li>
                    <li>
                      <i className="bi bi-check2 text-success me-2" />
                      <span>{formatLimit(plan.limits.maxUsers, 'مستخدم')}</span>
                    </li>
                    <li>
                      <i className="bi bi-check2 text-success me-2" />
                      <span>{formatLimit(plan.limits.maxProducts, 'صنف')}</span>
                    </li>
                    {plan.features.map((feature) => (
                      <li key={feature.code}>
                        <i className="bi bi-check2 text-success me-2" />
                        <span>{feature.displayName}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="ft-plan-card__select-indicator">
                    {isSelected ? (
                      <span className="text-amber fw-bold">
                        <i className="bi bi-check-circle-fill me-1" /> تم الاختيار
                      </span>
                    ) : available ? (
                      <span className="text-muted">اضغط للاختيار</span>
                    ) : (
                      <span className="text-muted">تواصل مع المبيعات للتفعيل</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="ft-plan-footer">
          <Button
            variant="primary"
            size="lg"
            className="ft-plan-submit-btn"
            loading={submitting}
            disabled={submitting || !selected}
            onClick={handleConfirm}
          >
            تأكيد الباقة والبدء 🚀
          </Button>
        </div>
      </div>
    </div>
  );
}
