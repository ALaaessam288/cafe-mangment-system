import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart, Table2, TrendingUp, Coffee,
  RefreshCw, ArrowLeft, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import Button from '../../components/Button/Button';
import { ordersApi } from '../../api/ordersApi';
import { tablesApi } from '../../api/tablesApi';
import { shiftsApi } from '../../api/shiftsApi';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime, orderStatusLabel } from '../../utils/formatters';
import { ORDER_STATUS, ROUTES } from '../../utils/constants';
import './DashboardPage.css';

function StatCard({ icon: Icon, label, value, sub, color = 'accent', loading }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__icon">
        <Icon size={20} />
      </div>
      <div className="stat-card__body">
        <div className="stat-card__label">{label}</div>
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <div className="stat-card__value">{value}</div>
        )}
        {sub && <div className="stat-card__sub">{sub}</div>}
      </div>
    </div>
  );
}

function statusBadgeVariant(status) {
  const map = { OPEN: 'warning', SENT: 'info', CLOSED: 'success', VOID: 'danger' };
  return map[status] ?? 'neutral';
}

export default function DashboardPage() {
  const toast = useToast();
  const [orders, setOrders]   = useState([]);
  const [tables, setTables]   = useState([]);
  const [shift, setShift]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allOrders, allTables, currentShift] = await Promise.allSettled([
        ordersApi.findAll(),
        tablesApi.findAll(),
        shiftsApi.myCurrent(),
      ]);
      if (allOrders.status === 'fulfilled')  setOrders(allOrders.value);
      if (allTables.status === 'fulfilled')  setTables(allTables.value);
      if (currentShift.status === 'fulfilled') setShift(currentShift.value);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل الرئيسية');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openOrders   = orders.filter((o) => o.status === ORDER_STATUS.OPEN || o.status === ORDER_STATUS.SENT);
  const closedOrders = orders.filter((o) => o.status === ORDER_STATUS.CLOSED);
  const todayRevenue = closedOrders.reduce((sum, o) => sum + parseFloat(o.total ?? 0), 0);
  const freeTables   = tables.filter((t) => t.active && !openOrders.some((o) => o.tableId === t.id));

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))
    .slice(0, 10);

  return (
    <div className="page">
      {/* Header */}
      <div className="page__header">
        <div>
          <h1 className="page__title">الرئيسية</h1>
          <p className="page__subtitle">نظرة عامة على شغل النهاردة</p>
        </div>
        <div className="page__actions">
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load} loading={loading}>
            تحديث
          </Button>
          <Link to={ROUTES.POS}>
            <Button size="sm" leftIcon={<ArrowLeft size={14} />}>روح للكاشير</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="dashboard__stats">
        <StatCard icon={ShoppingCart} label="الأوردرات المفتوحة"  value={openOrders.length}           loading={loading} color="warning" />
        <StatCard icon={Table2}      label="الترابيزات الفاضية"   value={freeTables.length}            loading={loading} color="success" />
        <StatCard icon={TrendingUp}  label="إيرادات النهاردة" value={formatCurrency(todayRevenue)} loading={loading} color="accent"  />
        <StatCard icon={Coffee}      label="الشيفت الحالي"  value={shift ? 'مفتوح' : 'مفيش'}      loading={loading} color={shift ? 'success' : 'neutral'} sub={shift ? `من ${formatDateTime(shift.openedAt)}` : ''} />
      </div>

      {/* Recent Orders */}
      <div className="dashboard__section">
        <h2 className="dashboard__section-title">أحدث الأوردرات</h2>
        <div className="data-table-wrap">
          {loading ? (
            <div className="data-table-empty"><Spinner /></div>
          ) : recentOrders.length === 0 ? (
            <div className="data-table-empty">مفيش أوردرات لسه النهاردة.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الترابيزة</th>
                  <th>الحالة</th>
                  <th>الأصناف</th>
                  <th>الإجمالي</th>
                  <th>اتفتح إمتى</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="data-table__mono">#{order.orderNumber}</td>
                    <td>{order.tableNumber ? `ترابيزة ${order.tableNumber}` : '—'}</td>
                    <td><Badge variant={statusBadgeVariant(order.status)}>{orderStatusLabel(order.status)}</Badge></td>
                    <td>{order.items?.length ?? 0}</td>
                    <td className="data-table__number">{formatCurrency(order.total)}</td>
                    <td className="data-table__muted">{formatDateTime(order.openedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
