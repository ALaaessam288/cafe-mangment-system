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

    const checkOnboarding = () => {
      if (isAuthenticated && role) {
        navigate(ROLE_DEFAULT_ROUTE[role] ?? ROUTES.POS, { replace: true });
      } else {
        navigate(ROUTES.LOGIN, { replace: true });
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
          <img
            src="/caffio-logo-mark.png"
            alt="Caffio Logo"
            className="splash__logo-img"
          />
        </div>

        {/* Brand */}
        <div className="splash__brand">
          <h1 className="splash__name">Caffio</h1>
          <p className="splash__tagline">CAFÉ BUSINESS SIMPLIFIED</p>
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
