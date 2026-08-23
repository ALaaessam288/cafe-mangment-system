import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DEFAULT_ROUTE, ROUTES } from '../../utils/constants';
import './SplashScreen.css';

export default function SplashScreen() {
  const [phase, setPhase] = useState('in'); // 'in' | 'hold' | 'out'
  const { isAuthenticated, isInitialized, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('hold'), 600);
    const timer2 = setTimeout(() => setPhase('out'), 1400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const checkOnboarding = async () => {
      if (isAuthenticated && role) {
        navigate(ROLE_DEFAULT_ROUTE[role] ?? ROUTES.POS, { replace: true });
      } else {
        try {
          const { authApi } = await import('../../api/authApi');
          const tenants = await authApi.getTenants();
          if (!tenants || tenants.length === 0) {
            navigate(ROUTES.WELCOME, { replace: true });
          } else {
            navigate(ROUTES.LOGIN, { replace: true });
          }
        } catch (err) {
          navigate(ROUTES.LOGIN, { replace: true });
        }
      }
    };

    const timer = setTimeout(checkOnboarding, 1500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isInitialized, navigate, role]);

  return (
    <div className={`splash splash--${phase}`} aria-label="جاري تحميل سيستم كافيو">
      <div className="splash__content">
        {/* Logo mark */}
        <div className="splash__logo">
          <svg viewBox="0 0 64 64" fill="none" className="splash__icon">
            <circle cx="32" cy="32" r="32" fill="#f59e0b" opacity="0.12" />
            <circle cx="32" cy="32" r="24" fill="#f59e0b" opacity="0.18" />
            <path
              d="M20 28c0-6.627 5.373-12 12-12s12 5.373 12 12c0 4.418-2.4 8.28-5.96 10.37L38 44H26l-.04-5.63C22.4 36.28 20 32.42 20 28z"
              fill="#f59e0b"
            />
            <rect x="26" y="44" width="12" height="4" rx="2" fill="#f59e0b" opacity="0.8" />
            <path d="M29 32 L31 30 L33 34 L35 28" stroke="#0b0d13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Brand */}
        <div className="splash__brand">
          <h1 className="splash__name">كافيو</h1>
          <p className="splash__tagline">نظام إدارة الكافيهات والمطاعم</p>
        </div>

        {/* Loader dots */}
        <div className="splash__dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>

      {/* Version */}
      <div className="splash__version">v1.0.0</div>
    </div>
  );
}
