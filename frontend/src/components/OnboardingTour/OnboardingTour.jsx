import { useState, useEffect } from 'react';
import Button from '../Button/Button';
import './OnboardingTour.css';

const TOUR_STEPS = [
  {
    target: '.pos-tables-grid',
    content: 'اضغط على أي طاولة فاضية لفتح أوردر جديد',
    position: 'bottom',
  },
  {
    target: '.pos-menu-panel',
    content: 'اختار المنتجات من القائمة أو ابحث بالاسم',
    position: 'left',
  },
  {
    target: '.pos-order-panel',
    content: 'المنتجات المطلوبة هتظهر هنا',
    position: 'right',
  },
  {
    target: '.pos-payment-area',
    content: 'لما العميل يدفع، اضغط "حساب" لإنهاء الأوردر',
    position: 'top',
  },
  {
    target: '.app-sidebar',
    content: 'من هنا تقدر توصل للتقارير والإعدادات',
    position: 'left',
  },
];

export default function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    const isCompleted = localStorage.getItem('onboardingCompleted');
    if (!isCompleted) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

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

  if (!isVisible) return null;

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

  // Render a clip-path based overlay if target exists, else full overlay
  const overlayStyle = targetRect
    ? {
        clipPath: `polygon(
          0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
          ${targetRect.left - 8}px ${targetRect.top - 8}px,
          ${targetRect.right + 8}px ${targetRect.top - 8}px,
          ${targetRect.right + 8}px ${targetRect.bottom + 8}px,
          ${targetRect.left - 8}px ${targetRect.bottom + 8}px,
          ${targetRect.left - 8}px ${targetRect.top - 8}px
        )`,
      }
    : {};

  // Calculate tooltip position
  let tooltipStyle = {};
  if (targetRect) {
    if (step.position === 'bottom') {
      tooltipStyle = { top: targetRect.bottom + 20, left: targetRect.left + (targetRect.width / 2) };
      tooltipStyle.transform = 'translateX(-50%)';
    } else if (step.position === 'top') {
      tooltipStyle = { bottom: window.innerHeight - targetRect.top + 20, left: targetRect.left + (targetRect.width / 2) };
      tooltipStyle.transform = 'translateX(-50%)';
    } else if (step.position === 'left') {
      tooltipStyle = { top: targetRect.top + (targetRect.height / 2), right: window.innerWidth - targetRect.left + 20 };
      tooltipStyle.transform = 'translateY(-50%)';
    } else if (step.position === 'right') {
      tooltipStyle = { top: targetRect.top + (targetRect.height / 2), left: targetRect.right + 20 };
      tooltipStyle.transform = 'translateY(-50%)';
    }
  } else {
    // Center it if target not found
    tooltipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
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
