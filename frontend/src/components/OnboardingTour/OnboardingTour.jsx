import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Button from '../Button/Button';
import './OnboardingTour.css';

/* Each step names the panel it is about and which side it would PREFER its card on. Preference,
   not instruction - see placeCard() for why a literal reading of this put two of the five cards
   off the edge of the screen. */
const TOUR_STEPS = [
  {
    target: '.pos__tables',
    title: 'ابدأ من الترابيزة',
    content: 'دوس على أي ترابيزة فاضية ويتفتح أوردر جديد عليها على طول.',
    position: 'left',
  },
  {
    target: '.pos__menu',
    title: 'ضيف الأصناف',
    content: 'دوسة واحدة على الصنف تضيفه للأوردر. اكتب في خانة البحث أو اضغط F2 لو مستعجل.',
    position: 'left',
  },
  {
    target: '.pos__order',
    title: 'راجع واحسب',
    content: 'الأوردر بيتجمع هنا، والإجمالي وزرار «تحصيل ودفع» بيفضلوا تحت قدامك دايماً.',
    position: 'right',
  },
  {
    target: '.shift-strip',
    title: 'الشيفت والدرج',
    content: 'مبيعات الشيفت والمفروض في الدرج. ومن «إدارة الشيفت» تعمل مصروف أو تغذية مخزون أو تقفل الشيفت.',
    position: 'bottom',
  },
  {
    target: '.app-topbar__menu-btn',
    title: 'باقي الشاشات',
    content: 'زرار القائمة بيوصّلك لكل الشاشات المتاحة لصلاحيتك.',
    position: 'bottom',
  },
];

const CARD_W = 320;
const CARD_MARGIN = 16;
const SPOTLIGHT_PAD = 8;

/**
 * First-run walkthrough of the cashier screen.
 *
 * <p>The spotlight is a bordered box with an enormous outward box-shadow rather than a polygon
 * clip-path on a full-screen div. Same picture, and it buys three things the polygon could not:
 * the hole can have rounded corners that match the panel it is cutting around, the geometry is
 * one rectangle instead of a ten-point polygon string rebuilt on every render, and the dimmed
 * area is the shadow itself - so there is no separate layer that can end up painted over the
 * card meant to sit on top of it.
 */
export default function OnboardingTour({ enabled = false }) {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardPos, setCardPos] = useState(null);

  const cardRef = useRef(null);
  const finishRef = useRef(null);

  const finish = useCallback(() => {
    localStorage.setItem('onboardingCompleted', 'true');
    setIsVisible(false);
  }, []);
  finishRef.current = finish;

  /* ── Start, but only once the screen it describes actually exists ── */
  useEffect(() => {
    setIsVisible(false);
    setStep(0);
    setRect(null);

    // The tour teaches the POS workflow, so it must never cover unrelated pages.
    if (!enabled) return undefined;
    if (localStorage.getItem('onboardingCompleted')) return undefined;

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

  /* ── Measure the current target, and keep measuring while things move ── */
  useEffect(() => {
    if (!isVisible) return undefined;

    const measure = () => {
      const el = document.querySelector(TOUR_STEPS[step].target);
      setRect(el ? el.getBoundingClientRect() : null);
    };

    measure();
    window.addEventListener('resize', measure);
    // Capture phase: the panels scroll internally, and a scroll inside one of them does not
    // bubble to window. Without this the spotlight drifts off its target as the page moves.
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step, isVisible]);

  /* ── Escape ends it ──
     This is 85% black across the whole screen with pointer events enabled. Until now the only
     way out was a card button, and that card could be positioned off the edge of the window -
     so the app could be left unusable. Escape is what everyone reaches for first anyway. */
  useEffect(() => {
    if (!isVisible) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finishRef.current(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isVisible]);

  /**
   * Place the card near its target, then refuse to let it leave the screen.
   *
   * <p>The old version took the requested side literally against the target's own edges. That
   * works for a small target and fails completely for a big one: step 1 asked for "bottom" of
   * .pos__tables, a FULL-HEIGHT panel, so the card landed twenty pixels past the end of the
   * screen - and with it the only button that could dismiss a blocking black overlay. Measuring
   * the card's real height and clamping into the viewport makes that impossible to reproduce.
   *
   * <p>A card slightly overlapping its target is a cosmetic problem. A card nobody can reach is
   * an application nobody can use.
   */
  useLayoutEffect(() => {
    if (!isVisible || !rect) { setCardPos(null); return; }

    const h = cardRef.current?.offsetHeight ?? 190;
    const side = TOUR_STEPS[step].position;
    const midX = rect.left + rect.width / 2 - CARD_W / 2;
    const midY = rect.top + rect.height / 2 - h / 2;

    let left;
    let top;
    if (side === 'bottom')      { top = rect.bottom + 20; left = midX; }
    else if (side === 'top')    { top = rect.top - 20 - h; left = midX; }
    else if (side === 'left')   { top = midY; left = rect.left - 20 - CARD_W; }
    else                        { top = midY; left = rect.right + 20; }

    const maxX = Math.max(CARD_MARGIN, window.innerWidth - CARD_W - CARD_MARGIN);
    const maxY = Math.max(CARD_MARGIN, window.innerHeight - h - CARD_MARGIN);

    setCardPos({
      left: Math.min(Math.max(left, CARD_MARGIN), maxX),
      top: Math.min(Math.max(top, CARD_MARGIN), maxY),
    });
  }, [rect, step, isVisible]);

  // Never mount the blocking overlay without a real, visible target.
  if (!isVisible || !rect) return null;

  const isLast = step === TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[step];

  return (
    <div className="tour" dir="rtl">
      {/* The spotlight. Its shadow IS the dimmed screen, and clicking it ends the tour - someone
          tapping the dark part is telling you they want it gone. */}
      <div
        className="tour__spot"
        style={{
          top: rect.top - SPOTLIGHT_PAD,
          left: rect.left - SPOTLIGHT_PAD,
          width: rect.width + SPOTLIGHT_PAD * 2,
          height: rect.height + SPOTLIGHT_PAD * 2,
        }}
        onClick={finish}
        role="button"
        tabIndex={-1}
        aria-label="إنهاء الجولة"
      />

      <div
        ref={cardRef}
        className="tour__card"
        style={cardPos ? { top: cardPos.top, left: cardPos.left } : { opacity: 0 }}
        role="dialog"
        aria-label={current.title}
      >
        <div className="tour__head">
          <span className="tour__count">{step + 1} من {TOUR_STEPS.length}</span>
          <button type="button" className="tour__skip" onClick={finish}>
            تخطي الجولة
          </button>
        </div>

        <h4 className="tour__title">{current.title}</h4>
        <p className="tour__text">{current.content}</p>

        <div className="tour__foot">
          <div className="tour__dots" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <span key={s.target} className={`tour__dot ${i === step ? 'is-on' : ''}`} />
            ))}
          </div>

          <div className="tour__actions">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((n) => n - 1)}>
                رجوع
              </Button>
            )}
            <Button size="sm" onClick={() => (isLast ? finish() : setStep((n) => n + 1))}>
              {isLast ? 'يلا نبدأ' : 'التالي'}
            </Button>
          </div>
        </div>

        <span className="tour__esc">اضغط Esc في أي وقت للخروج</span>
      </div>
    </div>
  );
}
