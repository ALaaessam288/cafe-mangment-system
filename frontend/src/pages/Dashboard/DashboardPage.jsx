import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart, Table2, TrendingUp, Coffee,
  RefreshCw, ArrowLeft, Clock, AlertTriangle, ChevronRight, Zap, FileText, 
  DollarSign, Package, Eye, Users, ChefHat, Sparkles, LayoutGrid, CheckCircle2,
  Percent, ArrowUpRight, ArrowDownRight, Tag, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import { ordersApi } from '../../api/ordersApi';
import { tablesApi } from '../../api/tablesApi';
import { shiftsApi } from '../../api/shiftsApi';
import { menuApi } from '../../api/menuApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, orderStatusLabel } from '../../utils/formatters';
import { ORDER_STATUS, ROUTES, ROLES } from '../../utils/constants';
import { sounds } from '../../utils/soundEffects';
import './DashboardPage.css';

export default function DashboardPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const isSupervisor = role === ROLES.SUPERVISOR;

  const [orders, setOrders]     = useState([]);
  const [tables, setTables]     = useState([]);
  const [shift, setShift]       = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isManual = false) => {
    if (isManual) {
      sounds.playTap();
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [allOrders, allTables, currentShift, allProducts] = await Promise.allSettled([
        ordersApi.findAll(),
        tablesApi.findAll(),
        shiftsApi.myCurrent(),
        menuApi.getProducts(),
      ]);
      if (allOrders.status === 'fulfilled')   setOrders(allOrders.value || []);
      if (allTables.status === 'fulfilled')   setTables(allTables.value || []);
      if (currentShift.status === 'fulfilled') setShift(currentShift.value);
      else setShift(null);
      if (allProducts.status === 'fulfilled') setProducts(allProducts.value || []);

      if (isManual) {
        toast.success('تم تحديث بيانات لوحة القيادة بنجاح');
      }
    } catch (err) {
      toast.error(err.message, 'فشل تحميل بيانات الرئيسية');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openOrders   = orders.filter((o) => o.status === ORDER_STATUS.OPEN || o.status === ORDER_STATUS.SENT || o.status === 'SERVED');
  const closedOrders = orders.filter((o) => o.status === ORDER_STATUS.CLOSED || o.status === 'PAID');
  const voidOrders   = orders.filter((o) => o.status === 'VOIDED');
  const todayRevenue = closedOrders.reduce((sum, o) => sum + parseFloat(o.total ?? 0), 0);
  const freeTables   = tables.filter((t) => t.active && !openOrders.some((o) => o.tableId === t.id));
  const occupiedTables = tables.filter((t) => t.active && openOrders.some((o) => o.tableId === t.id));

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt || b.openedAt) - new Date(a.createdAt || a.openedAt))
    .slice(0, 8);

  const lowStockProducts = products.filter(p => 
    p.stockQuantity !== null && 
    p.stockQuantity !== undefined && 
    p.stockQuantity <= (p.minStockThreshold ?? 5)
  );

  const occupancyRate = tables.length > 0 ? Math.round((occupiedTables.length / tables.length) * 100) : 0;

  return (
    <div className="page dashboard-creative">
      <ObserverBanner />

      {/* ── Top Hero Banner ── */}
      <div className="dash-hero">
        <div className="dash-hero__info">
          <div className="dash-hero__avatar">
            <Coffee size={24} className="dash-hero__avatar-icon" />
          </div>
          <div>
            <div className="dash-hero__title-row">
              <h1 className="dash-hero__title">
                أهلاً بك، {user?.fullName || user?.username || 'مدير المنشأة'} 👋
              </h1>
              <span className={`dash-role-badge ${isAdmin ? 'dash-role-badge--admin' : 'dash-role-badge--supervisor'}`}>
                {isAdmin ? <ShieldCheck size={12} /> : <Zap size={12} />}
                <span>{isAdmin ? 'مالك المنشأة (ADMIN)' : 'مدير العمليات (SUPERVISOR)'}</span>
              </span>
            </div>
            <p className="dash-hero__subtitle">
              {isAdmin 
                ? 'لوحة المراقبة الشاملة للأداء المالي، الرقابة على الشيفتات، وحسابات المنشأة'
                : 'مركز القيادة التشغيلي المباشر: الكاشير، المطبخ، إشغال الطاولات، وحركة الصالة'}
            </p>
          </div>
        </div>

        <div className="dash-hero__actions">
          <button 
            type="button" 
            className="dash-btn dash-btn--refresh" 
            onClick={() => load(true)}
            disabled={refreshing}
            title="تحديث البيانات لحظياً"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>تحديث فوري</span>
          </button>

          {isSupervisor ? (
            <button 
              type="button" 
              className="dash-btn dash-btn--pos" 
              onClick={() => { sounds.playSuccess(); navigate(ROUTES.POS); }}
            >
              <ShoppingCart size={16} />
              <span>فتح الكاشير (POS) ⚡</span>
            </button>
          ) : (
            <button 
              type="button" 
              className="dash-btn dash-btn--reports" 
              onClick={() => { sounds.playTap(); navigate(ROUTES.REPORTS); }}
            >
              <TrendingUp size={16} />
              <span>التقارير والأرباح 📊</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Creative 4-Grid Glass KPIs ── */}
      <div className="dash-kpi-grid">
        {/* KPI 1: Revenue */}
        <div className="dash-kpi-card dash-kpi-card--revenue">
          <div className="dash-kpi-card__aura" />
          <div className="dash-kpi-card__header">
            <span className="dash-kpi-card__label">إجمالي المقبوضات اليوم</span>
            <div className="dash-kpi-card__icon-box">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="dash-kpi-card__body">
            <strong className="dash-kpi-card__val font-mono">{formatCurrency(todayRevenue)}</strong>
            <div className="dash-kpi-card__trend">
              <span className="dash-kpi-pill dash-kpi-pill--success">
                <CheckCircle2 size={11} />
                <span>{closedOrders.length} فاتورة مدفوعة</span>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Live Active Orders */}
        <div className="dash-kpi-card dash-kpi-card--active">
          <div className="dash-kpi-card__aura" />
          <div className="dash-kpi-card__header">
            <span className="dash-kpi-card__label">أوردرات جارية قيد التحصيل</span>
            <div className="dash-kpi-card__icon-box">
              <ShoppingCart size={20} />
            </div>
          </div>
          <div className="dash-kpi-card__body">
            <strong className="dash-kpi-card__val font-mono">{openOrders.length} أوردر</strong>
            <div className="dash-kpi-card__trend">
              <span className="dash-kpi-pill dash-kpi-pill--amber">
                <Clock size={11} />
                <span>بالصالة والتيك أواي</span>
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Table Occupancy Gauge */}
        <div className="dash-kpi-card dash-kpi-card--tables">
          <div className="dash-kpi-card__aura" />
          <div className="dash-kpi-card__header">
            <span className="dash-kpi-card__label">إشغال الصالة والترابيزات</span>
            <div className="dash-kpi-card__icon-box">
              <Table2 size={20} />
            </div>
          </div>
          <div className="dash-kpi-card__body">
            <div className="dash-kpi-card__val-row">
              <strong className="dash-kpi-card__val">{freeTables.length} <small>فاضية من {tables.length}</small></strong>
              <span className="dash-kpi-card__pct font-mono">{occupancyRate}%</span>
            </div>
            <div className="dash-occupancy-bar">
              <div className="dash-occupancy-bar__fill" style={{ width: `${occupancyRate}%` }} />
            </div>
          </div>
        </div>

        {/* KPI 4: Active Shift & Cashier */}
        <div className="dash-kpi-card dash-kpi-card--shift">
          <div className="dash-kpi-card__aura" />
          <div className="dash-kpi-card__header">
            <span className="dash-kpi-card__label">حالة الشيفت الحالي</span>
            <div className="dash-kpi-card__icon-box">
              <Coffee size={20} />
            </div>
          </div>
          <div className="dash-kpi-card__body">
            <strong className="dash-kpi-card__val">{shift ? `شيفت #${shift.id}` : 'لا يوجد شيفت'}</strong>
            <div className="dash-kpi-card__trend">
              {shift ? (
                <span className="dash-kpi-pill dash-kpi-pill--active-shift">
                  <span className="pulse-dot" />
                  <span>كاشير: {shift.userName || 'مفتوح'}</span>
                </span>
              ) : (
                <span className="dash-kpi-pill dash-kpi-pill--closed-shift">
                  <span>مغلق حالياً</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Supervisor / Admin Quick Operational Launcher Dock ── */}
      <div className="dash-dock">
        <div className="dash-dock__title">
          <Sparkles size={14} className="text-accent" />
          <span>القاذف السريع للعمليات</span>
        </div>
        <div className="dash-dock__grid">
          {isSupervisor && (
            <Link to={ROUTES.POS} className="dock-tile dock-tile--pos">
              <div className="dock-tile__icon"><ShoppingCart size={20} /></div>
              <div className="dock-tile__label">الكاشير (POS)</div>
              <div className="dock-tile__hint">تسجيل وطلب فوري</div>
            </Link>
          )}

          {isSupervisor && (
            <Link to={ROUTES.KDS} className="dock-tile dock-tile--kds">
              <div className="dock-tile__icon"><ChefHat size={20} /></div>
              <div className="dock-tile__label">شاشة المطبخ (KDS)</div>
              <div className="dock-tile__hint">أوردرات البار والمطبخ</div>
            </Link>
          )}

          <Link to={ROUTES.INVOICES} className="dock-tile dock-tile--invoices">
            <div className="dock-tile__icon"><FileText size={20} /></div>
            <div className="dock-tile__label">الفواتير والإيصالات</div>
            <div className="dock-tile__hint">تحصيل وبون حراري</div>
          </Link>

          <Link to={ROUTES.REPORTS} className="dock-tile dock-tile--reports">
            <div className="dock-tile__icon"><TrendingUp size={20} /></div>
            <div className="dock-tile__label">التقارير والأرباح</div>
            <div className="dock-tile__hint">تحليل مالي وحسابات</div>
          </Link>

          <Link to={ROUTES.PRODUCTS} className="dock-tile dock-tile--products">
            <div className="dock-tile__icon"><Package size={20} /></div>
            <div className="dock-tile__label">المنيو والأصناف</div>
            <div className="dock-tile__hint">إضافة وتعديل الأسعار</div>
          </Link>

          <Link to={ROUTES.TABLES} className="dock-tile dock-tile--tables">
            <div className="dock-tile__icon"><Table2 size={20} /></div>
            <div className="dock-tile__label">خريطة الطاولات</div>
            <div className="dock-tile__hint">توزيع وسعة الصالة</div>
          </Link>

          <Link to={ROUTES.INVENTORY} className="dock-tile dock-tile--inventory">
            <div className="dock-tile__icon"><LayoutGrid size={20} /></div>
            <div className="dock-tile__label">الجرد والمخزون</div>
            <div className="dock-tile__hint">متابعة النواقص والجرام</div>
          </Link>

          <Link to={ROUTES.EMPLOYEES} className="dock-tile dock-tile--staff">
            <div className="dock-tile__icon"><Users size={20} /></div>
            <div className="dock-tile__label">الموظفين والرواتب</div>
            <div className="dock-tile__hint">ساعات العمل والمسيرات</div>
          </Link>
        </div>
      </div>

      {/* ── Low Stock Alert Banner (If Any) ── */}
      {lowStockProducts.length > 0 && (
        <div className="dash-alert-card">
          <div className="dash-alert-card__icon-box">
            <AlertTriangle size={20} />
          </div>
          <div className="dash-alert-card__body">
            <strong>⚠️ تنبيه نواقص في المخزون:</strong>
            <span>يوجد {lowStockProducts.length} أصناف وصلت للحد الأدنى ({lowStockProducts.slice(0, 4).map(p => p.name).join('، ')}{lowStockProducts.length > 4 ? '…' : ''})</span>
          </div>
          <Link to={ROUTES.INVENTORY} className="dash-alert-card__btn">
            <span>تسوية الجرد</span>
            <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* ── Live Recent Transactions Table ── */}
      <div className="dash-section-card">
        <div className="dash-section-card__head">
          <div className="dash-section-card__title-group">
            <Clock size={16} className="text-accent" />
            <h3>أحدث المعاملات والأوردرات بالصالة</h3>
          </div>
          <Link to={ROUTES.INVOICES} className="dash-link">
            <span>عرض كل الفواتير</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="data-table-wrap">
          {recentOrders.length === 0 && !loading ? (
            <div className="data-table-empty">
              <FileText size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
              <p>لا توجد فواتير مسجلة اليوم حتى الآن.</p>
            </div>
          ) : (
            <table className="data-table dash-table">
              <thead>
                <tr>
                  <th>رقم الأوردر</th>
                  <th>النوع / المكان</th>
                  <th>العميل / الكابتن</th>
                  <th>التوقيت</th>
                  <th>الحالة</th>
                  <th>الإجمالي المستحق</th>
                  <th className="text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} onClick={() => navigate(ROUTES.INVOICES)}>
                    <td className="fw-bold">
                      <span className="font-mono text-accent">#{order.orderNumber ?? order.id}</span>
                    </td>
                    <td>
                      {order.type === 'TAKEAWAY' ? (
                        <span className="badge-pill badge-pill--takeaway">
                          🛍️ تيك أواي
                        </span>
                      ) : (
                        <span className="badge-pill badge-pill--dinein">
                          🪑 ترابيزة {order.tableNumber ?? '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="dash-cust-cell">
                        <span className="dash-cust-name">{order.customerName || order.openedBy?.fullName || 'عميل نقدي'}</span>
                      </div>
                    </td>
                    <td className="text-muted text-sm font-mono">
                      {order.createdAt || order.openedAt ? formatDateTime(order.createdAt || order.openedAt) : '—'}
                    </td>
                    <td>
                      <span className={`status-pill status-pill--${(order.status || '').toLowerCase()}`}>
                        {orderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="fw-bold font-mono text-accent-gold">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        type="button" 
                        className="dash-row-btn"
                        onClick={() => navigate(ROUTES.INVOICES)}
                        title="عرض الفاتورة"
                      >
                        <Eye size={13} />
                      </button>
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
