import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart, Table2, TrendingUp, Coffee,
  RefreshCw, ArrowLeft, Clock, AlertTriangle, ChevronRight, Zap, FileText, DollarSign, Package, Eye, Users
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '../../layouts/AppLayout';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import Button from '../../components/Button/Button';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import { ordersApi } from '../../api/ordersApi';
import { tablesApi } from '../../api/tablesApi';
import { shiftsApi } from '../../api/shiftsApi';
import { menuApi } from '../../api/menuApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, orderStatusLabel } from '../../utils/formatters';
import { ORDER_STATUS, ROUTES, ROLES } from '../../utils/constants';
import './DashboardPage.css';

function StatCard({ icon: Icon, label, value, sub, color = 'accent', loading }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card__head">
        <span className="stat-card__title">{label}</span>
        <div className="stat-card__icon">
          <Icon size={18} />
        </div>
      </div>
      <div className="stat-card__body">
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <div className="stat-card__value">{value}</div>
        )}
        {sub && <div className="stat-card__subtext">{sub}</div>}
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
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const isSupervisor = role === ROLES.SUPERVISOR;

  const [orders, setOrders]   = useState([]);
  const [tables, setTables]   = useState([]);
  const [shift, setShift]     = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allOrders, allTables, currentShift, allProducts] = await Promise.allSettled([
        ordersApi.findAll(),
        tablesApi.findAll(),
        shiftsApi.myCurrent(),
        menuApi.getProducts(),
      ]);
      if (allOrders.status === 'fulfilled')  setOrders(allOrders.value);
      if (allTables.status === 'fulfilled')  setTables(allTables.value);
      if (currentShift.status === 'fulfilled') setShift(currentShift.value);
      if (allProducts.status === 'fulfilled') setProducts(allProducts.value);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل الرئيسية');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openOrders   = orders.filter((o) => o.status === ORDER_STATUS.OPEN || o.status === ORDER_STATUS.SENT || o.status === 'SERVED');
  const closedOrders = orders.filter((o) => o.status === ORDER_STATUS.CLOSED);
  const todayRevenue = closedOrders.reduce((sum, o) => sum + parseFloat(o.total ?? 0), 0);
  const freeTables   = tables.filter((t) => t.active && !openOrders.some((o) => o.tableId === t.id));

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt))
    .slice(0, 8);

  const lowStockProducts = products.filter(p => 
    p.stockQuantity !== null && 
    p.stockQuantity !== undefined && 
    p.stockQuantity <= (p.minStockThreshold ?? 5)
  );

  return (
    <div className="page">
      <ObserverBanner />
      {/* Header */}
      <div className="page__header">
        <div>
          <h1 className="page__title">الرئيسية ☕</h1>
          <p className="page__subtitle">{isAdmin ? 'لوحة مراقبة أداء المنشأة والتقارير' : 'نظرة عامة على نشاط ومبيعات الكافيه'}</p>
        </div>
        <div className="page__actions">
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw size={14} />} onClick={load} loading={loading}>
            تحديث
          </Button>
          {isSupervisor ? (
            <Button variant="primary" size="md" leftIcon={<Zap size={16} />} onClick={() => navigate(ROUTES.POS)}>
              شاشة الكاشير (POS)
            </Button>
          ) : isAdmin ? (
            <Button variant="primary" size="md" leftIcon={<TrendingUp size={16} />} onClick={() => navigate(ROUTES.REPORTS)}>
              التقارير المالية 📊
            </Button>
          ) : null}
        </div>
      </div>

      {/* Quick Access Action Bar */}
      <div className="dashboard__quick-actions">
        {isSupervisor && (
          <Link to={ROUTES.POS} className="quick-action-btn quick-action-btn--primary">
            <ShoppingCart size={18} />
            <span>فتح أوردر جديد (الكاشير)</span>
          </Link>
        )}
        {isAdmin && (
          <Link to={ROUTES.REPORTS} className="quick-action-btn quick-action-btn--primary">
            <TrendingUp size={18} />
            <span>التقارير المالية 📊</span>
          </Link>
        )}
        <Link to={ROUTES.INVOICES} className="quick-action-btn">
          <FileText size={18} />
          <span>استعراض الفواتير</span>
        </Link>
        {isSupervisor && (
          <Link to={ROUTES.PRODUCTS} className="quick-action-btn">
            <Package size={18} />
            <span>إدارة الأصناف والمنيو</span>
          </Link>
        )}
        {isAdmin && (
          <Link to={ROUTES.DEBTS} className="quick-action-btn">
            <DollarSign size={18} />
            <span>متابعة المديونيات</span>
          </Link>
        )}
        <Link to={ROUTES.EMPLOYEES} className="quick-action-btn">
          <Users size={18} />
          <span>{isSupervisor ? 'إدارة الموظفين' : 'متابعة الموظفين'}</span>
        </Link>
        <Link to={ROUTES.REPORTS} className="quick-action-btn">
          <TrendingUp size={18} />
          <span>التقارير المالية</span>
        </Link>
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="dashboard__alert">
          <AlertTriangle size={18} className="dashboard__alert-icon" />
          <div className="dashboard__alert-body">
            <strong>تنبيه نواقص المخزون:</strong> هناك {lowStockProducts.length} أصناف أوشكت على النفاد ({lowStockProducts.slice(0, 3).map(p => p.name).join('، ')}{lowStockProducts.length > 3 ? '…' : ''})
          </div>
          <Link to={ROUTES.INVENTORY} className="dashboard__alert-link">
            عرض الجرد <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stat-grid">
        <StatCard
          icon={TrendingUp}
          label="إجمالي مبيعات اليوم"
          value={formatCurrency(todayRevenue)}
          sub={`${closedOrders.length} فاتورة مدفوعة`}
          color="accent"
          loading={loading}
        />
        <StatCard
          icon={ShoppingCart}
          label="أوردرات شغالة حالياً"
          value={openOrders.length}
          sub="في الصالة والتيك أواي"
          color="info"
          loading={loading}
        />
        <StatCard
          icon={Table2}
          label="الطاولات المتاحة"
          value={`${freeTables.length} / ${tables.length}`}
          sub="طاولات فاضية جاهزة"
          color="success"
          loading={loading}
        />
        <StatCard
          icon={Coffee}
          label="الشيفت الحالي"
          value={shift ? `#${shift.id}` : 'مفيش شيفت'}
          sub={shift ? `كاشير: ${shift.userName || 'نشط'}` : 'مغلق حالياً'}
          color={shift ? 'warning' : 'neutral'}
          loading={loading}
        />
      </div>

      {/* Recent Orders Section */}
      <div className="dashboard__section">
        <div className="section-head">
          <h2 className="dashboard__section-title">آخر الأوردرات</h2>
          <Link to={ROUTES.INVOICES} className="section-link">
            عرض كل الفواتير <ChevronRight size={14} />
          </Link>
        </div>

        <div className="data-table-wrap">
          {recentOrders.length === 0 && !loading ? (
            <div className="data-table-empty">مفيش أوردرات مسجلة النهاردة لسه.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الأوردر</th>
                  <th>النوع / الترابيزة</th>
                  <th>العميل / الكابتن</th>
                  <th>الوقت</th>
                  <th>الحالة</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span className="data-table__mono">#{order.orderNumber ?? order.id}</span>
                    </td>
                    <td>
                      {order.type === 'TAKEAWAY' ? (
                        <span style={{ color: 'var(--accent-hover)', fontWeight: 'bold' }}>🥡 تيك أواي</span>
                      ) : (
                        <span>ترابيزة {order.tableNumber ?? '—'}</span>
                      )}
                    </td>
                    <td>
                      {order.customerName || order.openedBy?.fullName || '—'}
                    </td>
                    <td className="data-table__muted">
                      {order.openedAt ? formatDateTime(order.openedAt) : '—'}
                    </td>
                    <td>
                      <Badge variant={statusBadgeVariant(order.status)}>
                        {orderStatusLabel(order.status)}
                      </Badge>
                    </td>
                    <td>
                      <span className="data-table__number" style={{ color: 'var(--accent-hover)' }}>
                        {formatCurrency(order.total)}
                      </span>
                    </td>
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
