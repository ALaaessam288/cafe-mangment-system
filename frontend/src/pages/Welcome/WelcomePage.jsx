import { useNavigate } from 'react-router-dom';
import { Store, User } from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import './WelcomePage.css';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <main className="welcome-page">
      {/* Floating Coffee Animations */}
      <div className="welcome-page__bg-anim" aria-hidden>
        <div className="cup cup--1">☕</div>
        <div className="cup cup--2">☕</div>
        <div className="cup cup--3">☕</div>
        <div className="cup cup--4">☕</div>
      </div>

      <div className="welcome-page__content">
        <header className="welcome-page__header">
          <div className="welcome-page__logo">
            <svg viewBox="0 0 64 64" fill="none">
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
          <h1 className="welcome-page__title">كافيو</h1>
          <p className="welcome-page__tagline">نظام إدارة الكافيهات والمطاعم</p>
        </header>

        <div className="welcome-page__cards">
          <button
            className="welcome-card welcome-card--primary"
            onClick={() => navigate(ROUTES.SETUP)}
          >
            <div className="welcome-card__icon-wrapper">
              <Store size={48} />
            </div>
            <h2>تسجيل كافيه جديد 🚀</h2>
            <p>ابدأ فترتك التجريبية المجانية دلوقتي</p>
          </button>

          <button
            className="welcome-card welcome-card--secondary"
            onClick={() => navigate(ROUTES.LOGIN)}
          >
            <div className="welcome-card__icon-wrapper">
              <User size={48} />
            </div>
            <h2>عندي حساب بالفعل</h2>
            <p>تسجيل الدخول لحسابك الحالي</p>
          </button>
        </div>
      </div>
    </main>
  );
}
