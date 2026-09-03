import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Clock, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscriptionApi } from '../../api/subscriptionApi';
import { ROUTES } from '../../utils/constants';
import './TrialBanner.css';

/*
 * The subscription countdown.
 *
 * This component was a stub that returned null, which is why the first anyone knew about an expiry
 * was a cashier's failed sale mid-shift. The backend now warns the owner over WhatsApp at 7, 3 and
 * 1 days, and puts the same countdown on every API response; this is the in-app half of that.
 *
 * Only shown when there is something to act on — a trial or subscription in its final week, an
 * account inside its grace window, or one already read-only.
 */

const WARN_WITHIN_DAYS = 7;

export default function TrialBanner() {
  const { user, refreshEntitlements } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const tenantId = user?.id ?? null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  /*
   * Held in a ref, not a dependency.
   *
   * refreshEntitlements() calls setUser, which replaces the user object. Depending on `user` here
   * meant every fetch changed the very value the effect keyed on, so it re-ran and fetched again —
   * an unbounded loop that made hundreds of requests and, because the old usage payload embedded
   * the café's logo as a base64 data URI, moved tens of megabytes doing it. The effect now keys on
   * the tenant id alone, so it runs once per signed-in tenant.
   */
  const refreshRef = useRef(refreshEntitlements);
  useEffect(() => {
    refreshRef.current = refreshEntitlements;
  }, [refreshEntitlements]);

  useEffect(() => {
    if (!tenantId || isSuperAdmin) return undefined;
    let cancelled = false;

    subscriptionApi
      .usage()
      .then((data) => {
        if (cancelled) return;
        setUsage(data);
        refreshRef.current?.(data);
      })
      .catch(() => {
        /* A banner is not worth an error toast — the guard will speak for itself if it matters. */
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, isSuperAdmin]);

  if (!usage || dismissed || usage.perpetual) return null;

  const days = usage.daysRemaining;
  const status = usage.status;

  let tone = null;
  let icon = null;
  let message = null;
  let cta = 'ترقية الاشتراك';

  if (status === 'EXPIRED' || usage.accessLevel === 'READ_ONLY') {
    tone = 'danger';
    icon = <Lock size={18} />;
    message = 'انتهى اشتراكك والحساب الآن للقراءة فقط. لن تتمكن من تسجيل طلبات جديدة حتى التجديد.';
    cta = 'تفعيل الاشتراك الآن';
  } else if (status === 'GRACE') {
    tone = 'warning';
    icon = <AlertTriangle size={18} />;
    message = `انتهت فترة اشتراكك. لديك مهلة ${days ?? 0} يوم للتجديد قبل إيقاف التسجيل على الحساب.`;
    cta = 'تجديد الاشتراك';
  } else if (typeof days === 'number' && days <= WARN_WITHIN_DAYS) {
    tone = 'info';
    icon = <Clock size={18} />;
    const noun = status === 'TRIALING' ? 'فترتك التجريبية' : 'اشتراكك';
    message =
      days <= 0
        ? `${noun} ينتهي اليوم.`
        : `${noun} ينتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}.`;
  } else {
    return null;
  }

  return (
    <div className={`sub-banner sub-banner--${tone}`} role="status">
      <span className="sub-banner__icon">{icon}</span>
      <span className="sub-banner__text">
        {message}
        {usage.planName && <span className="sub-banner__plan">الباقة: {usage.planName}</span>}
      </span>
      <button type="button" className="sub-banner__cta" onClick={() => navigate(ROUTES.SETTINGS)}>
        {cta}
      </button>
      {tone === 'info' && (
        <button
          type="button"
          className="sub-banner__dismiss"
          onClick={() => setDismissed(true)}
          aria-label="إخفاء التنبيه"
        >
          ✕
        </button>
      )}
    </div>
  );
}
