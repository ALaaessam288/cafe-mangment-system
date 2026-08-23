import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Coffee, Clock, CheckCircle2, RefreshCw, ShoppingCart, ArrowRight } from 'lucide-react';
import { ordersApi } from '../../api/ordersApi';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../utils/constants';
import Spinner from '../../components/Spinner/Spinner';
import './KdsPage.css';

/* Which items belong to this screen. Station is the server-assigned truth. */
const STATIONS = {
  KITCHEN: { label: 'المطبخ / المطعم', icon: ChefHat, match: (i) => i.stationSnapshot !== 'BAR' },
  BAR:     { label: 'البار / البوفيه', icon: Coffee,  match: (i) => i.stationSnapshot === 'BAR' },
  ALL:     { label: 'الكل',            icon: RefreshCw, match: () => true },
};

const DONE_KEY = 'wanas_kds_done';

/* Ticked lines are a local, per-screen aid: the backend has no PREPARING /
   READY item status, so we don't pretend it does. Order-level "ready" uses the
   real serve endpoint. */
function readDone() {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function writeDone(set) {
  try { localStorage.setItem(DONE_KEY, JSON.stringify([...set].slice(-500))); } catch { /* ignore */ }
}

function minutesSince(value) {
  if (!value) return 0;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

export default function KdsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [station, setStation] = useState('KITCHEN');
  const [done, setDone] = useState(readDone);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      // Only orders actually sitting with the kitchen/bar.
      setOrders(await ordersApi.findAll('SENT'));
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الأوردرات');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  /* Live board: refresh often, and re-render every 30s so the age clocks move. */
  useEffect(() => {
    const poll = setInterval(() => { if (!document.hidden) load(); }, 10000);
    const clock = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  /* One card per order, containing only the lines this station prepares. */
  const cards = useMemo(() => {
    const matcher = STATIONS[station].match;
    return orders
      .map((order) => {
        const items = (order.items ?? []).filter(
          (i) => i.status === 'SENT' && matcher(i)
        );
        return items.length ? { order, items } : null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.order.openedAt ?? 0) - new Date(b.order.openedAt ?? 0));
    // `tick` keeps the age labels honest without refetching
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, station, tick]);

  function toggleDone(itemId) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      writeDone(next);
      return next;
    });
  }

  async function markReady(order) {
    try {
      await ordersApi.serve(order.id);
      toast.success(
        order.type === 'TAKEAWAY' ? 'الأوردر جاهز للاستلام.' : 'الأوردر جاهز للتقديم.'
      );
      load();
    } catch (err) {
      toast.error(err.message, 'فشل في تحديث حالة الأوردر');
    }
  }

  return (
    <div className="kds">
      <header className="kds__header">
        <button
          type="button"
          className="kds__back-btn"
          onClick={() => navigate(ROUTES.POS)}
          title="العودة لشاشة الكاشير"
        >
          <ArrowRight size={18} />
          <ShoppingCart size={18} />
          <span>الرجوع للكاشير (POS)</span>
        </button>
        <h1 className="kds__title">شاشة التحضير</h1>
        <div className="kds__tabs">
          {Object.entries(STATIONS).map(([id, def]) => {
            const Icon = def.icon;
            return (
              <button
                key={id}
                type="button"
                className={`kds__tab ${station === id ? 'kds__tab--active' : ''}`}
                onClick={() => setStation(id)}
              >
                <Icon size={15} /> {def.label}
              </button>
            );
          })}
        </div>
        <button type="button" className="kds__refresh" onClick={load} title="تحديث">
          <RefreshCw size={16} />
        </button>
      </header>

      {loading ? (
        <div className="kds__loading"><Spinner /></div>
      ) : cards.length === 0 ? (
        <div className="kds__empty">مفيش أوردرات تحت التحضير دلوقتي ✓</div>
      ) : (
        <div className="kds__board">
          {cards.map(({ order, items }) => {
            const age = minutesSince(order.openedAt);
            const urgency = age >= 15 ? 'late' : age >= 8 ? 'warn' : 'ok';
            const allTicked = items.every((i) => done.has(i.id));
            const where = order.type === 'TAKEAWAY'
              ? `تيك أواي — ${order.customerName || 'بدون اسم'}`
              : `ترابيزة ${order.tableNumber ?? '—'}`;

            return (
              <article key={order.id} className={`kds-card kds-card--${urgency}`}>
                <header className="kds-card__head">
                  <span className="kds-card__where">{where}</span>
                  <span className="kds-card__age">
                    <Clock size={13} /> {age} د
                  </span>
                </header>
                <div className="kds-card__order">#{order.orderNumber}</div>

                <ul className="kds-card__items">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`kds-item ${done.has(item.id) ? 'kds-item--done' : ''}`}
                        onClick={() => toggleDone(item.id)}
                      >
                        <span className="kds-item__qty">{item.quantity}</span>
                        <span className="kds-item__name">
                          {item.productNameSnapshot}
                          {item.note && <em className="kds-item__note">{item.note}</em>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={`kds-card__ready ${allTicked ? 'kds-card__ready--armed' : ''}`}
                  onClick={() => markReady(order)}
                >
                  <CheckCircle2 size={15} /> جاهز
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
