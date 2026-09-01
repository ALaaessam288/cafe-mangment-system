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
            <img src="/caffio-logo-mark.png" alt="Caffio Logo" className="welcome-page__logo-img" />
          </div>
          <h1 className="welcome-page__title">Caffio</h1>
          <p className="welcome-page__tagline">CAFÉ BUSINESS SIMPLIFIED</p>
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
