import { useState, useEffect } from 'react';
import Button from '../Button/Button';
import './OnboardingTour.css';

const TOUR_STEPS = [
  {
    target: '.pos__tables',
    content: 'اضغط على أي طاولة فاضية لفتح أوردر جديد',
    position: 'bottom',
  },
  {
    target: '.pos__menu',
    content: 'اختار المنتجات من القائمة أو ابحث بالاسم',
    position: 'left',
  },
  {
    target: '.pos__order',
    content: 'المنتجات المطلوبة هتظهر هنا',
    position: 'right',
  },
  {
    target: '.shift-strip',
    content: 'من هنا تتابع حالة الشيفت والمبيعات وحركة الدرج',
    position: 'top',
  },
  {
    target: '.app-topbar__menu-btn',
    content: 'زر القائمة يوصّلك لكل الشاشات المتاحة لصلاحيتك',
    position: 'left',
  },
];

export default function OnboardingTour({ enabled = false }) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    setIsVisible(false);
    setCurrentStep(0);
    setTargetRect(null);

    // The tour teaches the POS workflow, so it must never cover unrelated pages.
    if (!enabled) return undefined;

    const isCompleted = localStorage.getItem('onboardingCompleted');
    if (isCompleted) return undefined;

    let timer;
    const startWhenReady = () => {
      if (!document.querySelector(TOUR_STEPS[0].target)) return false;
      timer = window.setTimeout(() => setIsVisible(true), 600);
      return true;
    };

    if (startWhenReady()) return () => window.clearTimeout(timer);

    // A cashier may still be opening a shift. Wait for the POS workspace instead
    // of showing an empty full-screen overlay that blocks the application.
    const observer = new MutationObserver(() => {
      if (startWhenReady()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [enabled]);

  useEffect(() => {
    if (!isVisible) return;

    const updateTarget = () => {
      const step = TOUR_STEPS[currentStep];
      // Note: Since these elements might not exist on all pages, 
      // we only highlight them if found, otherwise we just show the tooltip centrally.
      const el = document.querySelector(step.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateTarget();
    window.addEventListener('resize', updateTarget);
    return () => window.removeEventListener('resize', updateTarget);
  }, [currentStep, isVisible]);

  // Never mount the blocking overlay without a real, visible target.
  if (!isVisible || !targetRect) return null;

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      finishTour();
    }
  };

  const finishTour = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setIsVisible(false);
  };

  const step = TOUR_STEPS[currentStep];

  const overlayStyle = {
    clipPath: `polygon(
          0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
          ${targetRect.left - 8}px ${targetRect.top - 8}px,
          ${targetRect.right + 8}px ${targetRect.top - 8}px,
          ${targetRect.right + 8}px ${targetRect.bottom + 8}px,
          ${targetRect.left - 8}px ${targetRect.bottom + 8}px,
          ${targetRect.left - 8}px ${targetRect.top - 8}px
        )`,
  };

  // Calculate tooltip position
  let tooltipStyle;
  if (step.position === 'bottom') {
    tooltipStyle = { top: targetRect.bottom + 20, left: targetRect.left + (targetRect.width / 2) };
    tooltipStyle.transform = 'translateX(-50%)';
  } else if (step.position === 'top') {
    tooltipStyle = { bottom: window.innerHeight - targetRect.top + 20, left: targetRect.left + (targetRect.width / 2) };
    tooltipStyle.transform = 'translateX(-50%)';
  } else if (step.position === 'left') {
    tooltipStyle = { top: targetRect.top + (targetRect.height / 2), right: window.innerWidth - targetRect.left + 20 };
    tooltipStyle.transform = 'translateY(-50%)';
  } else {
    tooltipStyle = { top: targetRect.top + (targetRect.height / 2), left: targetRect.right + 20 };
    tooltipStyle.transform = 'translateY(-50%)';
  }

  return (
    <div className="onboarding-tour">
      <div className="onboarding-overlay" style={overlayStyle} aria-hidden="true" />
      
      <div className="onboarding-tooltip" style={tooltipStyle}>
        <div className="onboarding-tooltip__content">
          <p>{step.content}</p>
        </div>
        
        <div className="onboarding-tooltip__footer">
          <div className="onboarding-tooltip__dots">
            {TOUR_STEPS.map((_, i) => (
              <span key={i} className={`dot ${i === currentStep ? 'active' : ''}`} />
            ))}
          </div>
          
          <div className="onboarding-tooltip__actions">
            <Button variant="ghost" size="sm" onClick={finishTour}>تخطي</Button>
            <Button size="sm" onClick={handleNext}>
              {currentStep === TOUR_STEPS.length - 1 ? 'إنهاء' : 'التالي'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
