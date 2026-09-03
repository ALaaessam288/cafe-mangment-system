import { useState, useEffect, useCallback, useMemo } from 'react';
import { ordersApi } from '../../api/ordersApi';
import { shiftsApi } from '../../api/shiftsApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Spinner from '../../components/Spinner/Spinner';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import PaymentModal from '../POS/PaymentModal';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import { 
  Search, RefreshCw, Printer, CreditCard, XCircle, 
  DollarSign, Receipt, Utensils, ShoppingBag, 
  CheckCircle2, Clock, Ban, Calendar, Filter, 
  ChevronDown, Layers, FileText, Trash2, Download, 
  Bike, Smartphone, LayoutGrid, Table, Eye, Check,
  ArrowUpDown, Sparkles
} from 'lucide-react';
import './InvoicesPage.css';
import { printReceipt, buildReceiptHtml } from '../../utils/printUtils';
import { printOptionsFor } from '../../utils/printerSettings';
import { sounds } from '../../utils/soundEffects';

export default function InvoicesPage() {
  const toast = useToast();
  const { role, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // View mode: 'GRID' (Creative Cards) or 'TABLE' (Compact Data Grid)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('caffio_invoices_view_mode') || 'GRID';
  });

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  // Void Order Modal state
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('رغبة العميل');
  const [voidCustomReason, setVoidCustomReason] = useState('');
  const [voidingLoading, setVoidingLoading] = useState(false);

  // Refund Order Modal state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('خطأ في الحساب');
  const [refundCustomReason, setRefundCustomReason] = useState('');
  const [refundingLoading, setRefundingLoading] = useState(false);

  // Shift state
  const [shifts, setShifts] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);
  const [filterShiftId, setFilterShiftId] = useState('CURRENT');
  const [showDeleteShiftModal, setShowDeleteShiftModal] = useState(false);
  const [deletingShift, setDeletingShift] = useState(false);

  // Filters state
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('NEWEST');

  const toggleViewMode = (mode) => {
    sounds.playTap();
    setViewMode(mode);
    localStorage.setItem('caffio_invoices_view_mode', mode);
  };

  const loadOrders = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await ordersApi.findAll();
      setOrders(data || []);
      if (isManualRefresh) {
        toast.success('تم تحديث قائمة الفواتير بنجاح');
      }
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الفواتير');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const loadShifts = useCallback(async () => {
    try {
      const data = await shiftsApi.findAll();
      const sorted = (data || []).sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
      setShifts(sorted);

      let cur = null;
      try {
        cur = await shiftsApi.myCurrent();
      } catch (e) {
        // Fallback: check if any open shift exists in list
        cur = sorted.find(s => !s.closedAt) || null;
      }
      
      setCurrentShift(cur);

      // Default filter to the current active shift if present
      if (cur) {
        setFilterShiftId(String(cur.id));
      } else if (sorted.length > 0) {
        // If no open shift, default to the latest shift
        setFilterShiftId(String(sorted[0].id));
      } else {
        setFilterShiftId('ALL');
      }
    } catch (err) {
      console.error('Failed to load shifts', err);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadShifts();
  }, [loadOrders, loadShifts]);

  const handleSelectOrder = async (orderOrId) => {
    sounds.playTap();
    const orderId = typeof orderOrId === 'object' ? orderOrId.id : orderOrId;
    try {
      const full = await ordersApi.findById(orderId);
      setSelectedOrder(full);
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل تفاصيل الفاتورة');
    }
  };

  // Print via Electron IPC path
  const printOrderReceipt = (order) => {
    if (!order) return;
    sounds.playSuccess();
    const html = buildReceiptHtml({ order });
    printReceipt(html, printOptionsFor('RECEIPT', { width: 80 }));
  };

  const handlePrint = (e, order = null) => {
    if (e) e.stopPropagation();
    const target = order || selectedOrder;
    if (!target) return;
    printOrderReceipt(target);
  };

  const handleSendWhatsApp = (e, order = null) => {
    if (e) e.stopPropagation();
    const target = order || selectedOrder;
    if (!target) return;

    sounds.playTap();
    const phone = target.customerPhone || '';
    if (!phone) {
      toast.warning('لا يوجد رقم هاتف مسجل لهذا الأوردر');
      return;
    }

    const itemsSummary = (target.items || [])
      .filter(i => i.status !== 'CANCELLED')
      .map(i => `• ${i.quantity}x ${i.productNameSnapshot} (${formatCurrency(i.lineTotal)})`)
      .join('\n');

    const text = `🧾 *فاتورة ${user?.tenantName || 'كافيه ونس'}*
رقم الأوردر: *#${target.orderNumber}*
التاريخ: ${formatDateTime(target.createdAt)}
${target.type === 'TAKEAWAY' ? (target.customerAddress ? '🛵 دليفري وتوصيل' : '🛍️ تيك أواي') : `🪑 صالة - ترابيزة ${target.tableNumber || '-'}`}

*الأصناف المطلوبة:*
${itemsSummary || '—'}

💰 *الإجمالي المستحق:* ${formatCurrency(target.total)}
${parseFloat(target.amountPaid) > 0 ? `💵 *المدفوع:* ${formatCurrency(target.amountPaid)}\n` : ''}${parseFloat(target.balanceDue) > 0 ? `⚠️ *المتبقي:* ${formatCurrency(target.balanceDue)}\n` : ''}
شكراً لزيارتكم ويسعدنا دائماً خدمتكم! ✨`;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone;
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;

    if (window.api && window.api.openExternal) {
      window.api.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  const handlePaymentSuccess = (updatedOrder, fullyPaid) => {
    setShowPayment(false);
    sounds.playSuccess();

    if (fullyPaid) {
      toast.success('تم الدفع وقفل الفاتورة بنجاح!');
      setTimeout(() => {
        printOrderReceipt(updatedOrder || selectedOrder);
        setSelectedOrder(null);
        loadOrders();
      }, 300);
    } else {
      setSelectedOrder(updatedOrder);
      loadOrders();
    }
  };

  const handleVoidOrderSubmit = async () => {
    if (!selectedOrder) return;
    const finalReason = voidReason === 'أخرى' ? voidCustomReason : voidReason;
    if (!finalReason || !finalReason.trim()) {
      toast.error('الرجاء كتابة سبب إلغاء الفاتورة');
      return;
    }

    setVoidingLoading(true);
    try {
      await ordersApi.voidOrder(selectedOrder.id, { reason: finalReason });
      sounds.playSuccess();
      toast.success(`تم إلغاء الفاتورة رقم #${selectedOrder.orderNumber} بنجاح`);
      setShowVoidModal(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (err) {
      sounds.playError();
      toast.error(err.message || 'فشل إلغاء الفاتورة');
    } finally {
      setVoidingLoading(false);
    }
  };

  const handleRefundSubmit = async () => {
    if (!selectedOrder) return;
    const finalReason = refundReason === 'أخرى' ? refundCustomReason : refundReason;
    if (!finalReason || !finalReason.trim()) {
      toast.error('الرجاء كتابة سبب الإرجاع');
      return;
    }

    setRefundingLoading(true);
    try {
      await ordersApi.refund(selectedOrder.id, { 
        amount: Number(selectedOrder.total || 0),
        reason: finalReason 
      });
      sounds.playSuccess();
      toast.success(`تم إرجاع الفاتورة رقم #${selectedOrder.orderNumber} بنجاح`);
      setShowRefundModal(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (err) {
      sounds.playError();
      const msg = err.response?.data?.message || err.message || 'فشل إرجاع الفاتورة';
      toast.error(msg);
    } finally {
      setRefundingLoading(false);
    }
  };

  const renderStatusBadge = (status) => {
    const map = {
      OPEN: { label: 'مفتوح', class: 'status-pill--open', icon: <Clock size={11} /> },
      SENT: { label: 'بالمطبخ', class: 'status-pill--sent', icon: <Clock size={11} /> },
      SERVED: { label: 'تم التقديم', class: 'status-pill--served', icon: <Utensils size={11} /> },
      READY_FOR_PICKUP: { label: 'جاهز للاستلام', class: 'status-pill--served', icon: <Utensils size={11} /> },
      PAID: { label: 'مدفوع', class: 'status-pill--paid', icon: <CheckCircle2 size={11} /> },
      CLOSED: { label: 'مقبوض', class: 'status-pill--closed', icon: <CheckCircle2 size={11} /> },
      VOIDED: { label: 'ملغي', class: 'status-pill--voided', icon: <Ban size={11} /> },
    };
    const mapped = map[status] || { label: status, class: 'status-pill--neutral', icon: null };
    return (
      <span className={`status-pill ${mapped.class}`}>
        {mapped.icon}
        <span>{mapped.label}</span>
      </span>
    );
  };

  // Filter & Sort Logic
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      // 1. Status Filter
      if (filterStatus === 'OPEN') {
        if (o.status !== 'OPEN' && o.status !== 'SENT' && o.status !== 'SERVED' && o.status !== 'READY_FOR_PICKUP') return false;
      } else if (filterStatus === 'CLOSED') {
        if (o.status !== 'CLOSED' && o.status !== 'PAID') return false;
      } else if (filterStatus === 'VOIDED') {
        if (o.status !== 'VOIDED') return false;
      } else if (filterStatus === 'DINE_IN') {
        if (o.type !== 'DINE_IN') return false;
      } else if (filterStatus === 'TAKEAWAY') {
        if (o.type !== 'TAKEAWAY' || o.customerAddress) return false;
      } else if (filterStatus === 'DELIVERY') {
        if (o.type !== 'TAKEAWAY' || !o.customerAddress) return false;
      }

      // 2. Type Filter (if more filters active)
      if (filterType !== 'ALL' && o.type !== filterType) return false;

      // 3. Shift Filter (Takes precedence over general date filter)
      if (filterShiftId !== 'ALL') {
        if (o.shiftId != filterShiftId) return false;
      } else if (filterDate !== 'ALL') {
        // 4. Date Filter (only if no specific shift is selected)
        const orderDate = new Date(o.createdAt);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (filterDate === 'TODAY') {
          if (orderDate < today) return false;
        } else if (filterDate === 'YESTERDAY') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          if (orderDate >= today || orderDate < yesterday) return false;
        } else if (filterDate === 'WEEK') {
          const lastWeek = new Date(today);
          lastWeek.setDate(lastWeek.getDate() - 7);
          if (orderDate < lastWeek) return false;
        }
      }
      
      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNum = o.orderNumber?.toString().includes(q);
        const matchTable = o.tableNumber?.toString().includes(q);
        const matchCustomer = o.customerName?.toLowerCase().includes(q);
        const matchPhone = o.customerPhone?.includes(q);
        if (!matchNum && !matchTable && !matchCustomer && !matchPhone) return false;
      }

      return true;
    });

    // Sorting
    return result.sort((a, b) => {
      if (sortOrder === 'NEWEST') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortOrder === 'OLDEST') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortOrder === 'TOTAL_DESC') return (b.total || 0) - (a.total || 0);
      if (sortOrder === 'TOTAL_ASC') return (a.total || 0) - (b.total || 0);
      return 0;
    });
  }, [orders, filterStatus, filterType, filterDate, filterShiftId, searchQuery, sortOrder]);

  // Statistics calculations based on filtered results
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let openCount = 0;
    let openTotal = 0;
    let closedCount = 0;
    let voidCount = 0;
    let takeawayCount = 0;
    let dineInCount = 0;

    filteredOrders.forEach(o => {
      if (o.status === 'CLOSED' || o.status === 'PAID') {
        totalRevenue += (o.total || 0);
        closedCount++;
      } else if (o.status === 'VOIDED') {
        voidCount++;
      } else {
        openCount++;
        openTotal += (o.total || 0);
      }

      if (o.type === 'TAKEAWAY') takeawayCount++;
      else dineInCount++;
    });

    return {
      totalCount: filteredOrders.length,
      totalRevenue,
      openCount,
      openTotal,
      closedCount,
      voidCount,
      takeawayCount,
      dineInCount
    };
  }, [filteredOrders]);

  const exportToCSV = () => {
    sounds.playTap();
    if (!filteredOrders.length) {
      toast.warning('لا توجد فواتير لتصديرها');
      return;
    }
    const headers = ['رقم الفاتورة', 'النوع', 'المكان / العميل', 'الموبايل', 'العنوان', 'الحالة', 'الإجمالي (ج.م)', 'التاريخ والوقت'];
    const rows = filteredOrders.map(o => [
      o.orderNumber,
      o.type === 'TAKEAWAY' ? (o.customerAddress ? 'دليفري' : 'تيك أواي') : 'صالة',
      o.type === 'TAKEAWAY' ? (o.customerName || 'تيك أواي') : `ترابيزة ${o.tableNumber || '-'}`,
      o.customerPhone || '-',
      o.customerAddress || '-',
      o.status,
      o.total || 0,
      formatDateTime(o.createdAt)
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `invoices_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير كشف الفواتير بنجاح!');
  };

  if (loading && orders.length === 0) {
    return <div className="page page-center"><Spinner /></div>;
  }

  return (
    <div className="page invoices-page invoices-creative">
      <ObserverBanner />

      {/* Creative Header */}
      <header className="invoices-header no-print">
        <div className="invoices-header__info">
          <div className="invoices-header__icon-badge">
            <Receipt size={22} className="invoices-header__glow-icon" />
          </div>
          <div>
            <div className="invoices-header__title-row">
              <h1 className="invoices-header__title">شاشة الفواتير والأوردرات</h1>
              <span className="invoices-header__count-badge">{filteredOrders.length} فاتورة</span>
              {currentShift && (
                <span 
                  className={`invoices-header__shift-badge ${String(filterShiftId) === String(currentShift.id) ? 'invoices-header__shift-badge--active' : ''}`}
                  onClick={() => {
                    sounds.playTap();
                    setFilterShiftId(String(currentShift.id));
                  }}
                  title="تفعيل فلترة الشيفت الحالي"
                >
                  <span className="live-pulse-dot" />
                  <span>الشيفت الحالي #{currentShift.id}</span>
                </span>
              )}
            </div>
            <p className="invoices-header__subtitle">
              {currentShift && String(filterShiftId) === String(currentShift.id)
                ? `⚡ معروض فواتير الشيفت الحالي (#${currentShift.id}) المفتوح`
                : 'مراجعة سريعة، تحصيل فوري، طباعة البون، وإرسال عبر واتساب'}
            </p>
          </div>
        </div>

        <div className="invoices-header__actions">
          {/* Dual View Mode Switcher */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'GRID' ? 'view-mode-btn--active' : ''}`}
              onClick={() => toggleViewMode('GRID')}
              title="عرض الكروت الحديثة"
            >
              <LayoutGrid size={15} />
              <span>كروت</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'TABLE' ? 'view-mode-btn--active' : ''}`}
              onClick={() => toggleViewMode('TABLE')}
              title="عرض الجدول المنظم"
            >
              <Table size={15} />
              <span>جدول</span>
            </button>
          </div>

          <button 
            type="button"
            className="action-btn action-btn--export" 
            onClick={exportToCSV}
            title="تصدير كشف الفواتير لملف Excel / CSV"
          >
            <Download size={14} />
            <span>تصدير CSV</span>
          </button>

          <button 
            type="button"
            className="action-btn action-btn--refresh" 
            onClick={() => { sounds.playTap(); loadOrders(true); loadShifts(); }}
            disabled={refreshing}
            title="تحديث البيانات لحظياً"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>تحديث</span>
          </button>
        </div>
      </header>

      {/* Creative Dynamic KPI Cards */}
      <div className="invoices-kpi-grid no-print">
        <div className="kpi-glass-card kpi-glass-card--revenue">
          <div className="kpi-glass-card__aura" />
          <div className="kpi-glass-card__icon-box">
            <DollarSign size={22} />
          </div>
          <div className="kpi-glass-card__content">
            <span className="kpi-glass-card__label">إجمالي المقبوضات ({stats.closedCount})</span>
            <strong className="kpi-glass-card__val font-mono">{formatCurrency(stats.totalRevenue)}</strong>
          </div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--open">
          <div className="kpi-glass-card__aura" />
          <div className="kpi-glass-card__icon-box">
            <Clock size={22} />
          </div>
          <div className="kpi-glass-card__content">
            <span className="kpi-glass-card__label">فواتير مفتوحة بالصالة ({stats.openCount})</span>
            <strong className="kpi-glass-card__val font-mono">{formatCurrency(stats.openTotal)}</strong>
          </div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--takeaway">
          <div className="kpi-glass-card__aura" />
          <div className="kpi-glass-card__icon-box">
            <ShoppingBag size={22} />
          </div>
          <div className="kpi-glass-card__content">
            <span className="kpi-glass-card__label">تيك أواي ودليفري</span>
            <strong className="kpi-glass-card__val">{stats.takeawayCount} طلب <small>({stats.dineInCount} صالة)</small></strong>
          </div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--void">
          <div className="kpi-glass-card__aura" />
          <div className="kpi-glass-card__icon-box">
            <Ban size={22} />
          </div>
          <div className="kpi-glass-card__content">
            <span className="kpi-glass-card__label">فواتير ملغاة</span>
            <strong className="kpi-glass-card__val">{stats.voidCount} فاتورة</strong>
          </div>
        </div>
      </div>

      {/* Creative Filter Strip & Quick Status Tabs */}
      <div className="invoices-filter-strip no-print">
        {/* Status Tabs */}
        <div className="filter-status-tabs">
          {[
            { id: 'ALL', label: 'الكل', count: orders.length, icon: '📋' },
            { id: 'OPEN', label: 'مفتوح وقيد التحصيل', count: stats.openCount, icon: '⏳' },
            { id: 'CLOSED', label: 'مقبوض ومغلق', count: stats.closedCount, icon: '✅' },
            { id: 'DINE_IN', label: 'صالة', count: stats.dineInCount, icon: '🪑' },
            { id: 'TAKEAWAY', label: 'تيك أواي', count: orders.filter(o => o.type === 'TAKEAWAY' && !o.customerAddress).length, icon: '🛍️' },
            { id: 'DELIVERY', label: 'دليفري', count: orders.filter(o => o.type === 'TAKEAWAY' && o.customerAddress).length, icon: '🛵' },
            { id: 'VOIDED', label: 'ملغي', count: stats.voidCount, icon: '🚫' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`filter-status-pill ${filterStatus === tab.id ? 'filter-status-pill--active' : ''}`}
              onClick={() => {
                sounds.playTap();
                setFilterStatus(tab.id);
              }}
            >
              <span>{tab.icon} {tab.label}</span>
              <span className="filter-status-pill__badge">{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Date Filter & Search Row */}
        <div className="filter-controls-row">
          <div className="search-pill-box">
            <Search size={15} className="search-pill-icon" />
            <input 
              type="text" 
              className="search-pill-input" 
              placeholder="بحث برقم الأوردر، الترابيزة، أو اسم العميل أو الهاتف..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                type="button" 
                className="search-pill-clear" 
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Shift Filter Pill */}
          {currentShift && (
            <button
              type="button"
              className={`shift-quick-pill ${String(filterShiftId) === String(currentShift.id) ? 'shift-quick-pill--active' : ''}`}
              onClick={() => {
                sounds.playTap();
                setFilterShiftId(String(currentShift.id));
              }}
            >
              <span className="live-pulse-dot" />
              <span>الشيفت الحالي (#{currentShift.id})</span>
            </button>
          )}

          {/* Date Selector */}
          <div className="date-pills">
            {[
              { id: 'ALL', label: 'كل التواريخ' },
              { id: 'TODAY', label: 'اليوم' },
              { id: 'YESTERDAY', label: 'أمس' },
              { id: 'WEEK', label: 'آخر 7 أيام' },
            ].map(d => (
              <button
                key={d.id}
                type="button"
                className={`date-pill ${filterDate === d.id ? 'date-pill--active' : ''}`}
                onClick={() => {
                  sounds.playTap();
                  setFilterDate(d.id);
                  if (d.id !== 'ALL' && filterShiftId !== 'ALL') {
                    setFilterShiftId('ALL');
                  }
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Sort & Shift Dropdowns */}
          <div className="more-filters-group">
            <div className="select-pill-wrap">
              <ArrowUpDown size={13} />
              <select className="select-pill" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="NEWEST">الأحدث أولاً</option>
                <option value="OLDEST">الأقدم أولاً</option>
                <option value="TOTAL_DESC">الأعلى قيمة</option>
                <option value="TOTAL_ASC">الأقل قيمة</option>
              </select>
            </div>

            {shifts.length > 0 && (
              <div className="select-pill-wrap select-pill-wrap--shift">
                <Filter size={13} />
                <select 
                  className="select-pill" 
                  value={filterShiftId} 
                  onChange={(e) => {
                    sounds.playTap();
                    setFilterShiftId(e.target.value);
                  }}
                >
                  {currentShift && (
                    <option value={String(currentShift.id)}>
                      ⚡ الشيفت الحالي #{currentShift.id} {currentShift.userFullName || currentShift.username ? `(بواسطة: ${currentShift.userFullName || currentShift.username})` : ''} - مفتوح
                    </option>
                  )}
                  <option value="ALL">كل الشيفتات (عرض الكل)</option>
                  {shifts.map(s => {
                    if (currentShift && s.id === currentShift.id) return null;
                    const cashier = s.userFullName || s.username || '';
                    return (
                      <option key={s.id} value={String(s.id)}>
                        شيفت #{s.id} {cashier ? `(بواسطة: ${cashier})` : ''} - {s.closedAt ? 'مغلق' : 'مفتوح'}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="invoices-workspace">
        {/* Left: Orders Stream (Grid Cards or Data Table) */}
        <div className="invoices-stream-container">
          {viewMode === 'GRID' ? (
            /* ═════ Creative Cards Grid ═════ */
            <div className="invoices-cards-grid">
              {filteredOrders.map((o) => {
                const isSelected = selectedOrder?.id === o.id;
                const isClosed = o.status === 'CLOSED' || o.status === 'PAID';
                const isOpen = o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED';
                const isVoid = o.status === 'VOIDED';

                return (
                  <div
                    key={o.id}
                    className={`order-card ${isSelected ? 'order-card--selected' : ''} ${isClosed ? 'order-card--closed' : ''} ${isOpen ? 'order-card--open' : ''} ${isVoid ? 'order-card--void' : ''}`}
                    onClick={() => handleSelectOrder(o)}
                  >
                    {/* Card Top Banner */}
                    <div className="order-card__header">
                      <div className="order-card__num-tag">
                        <span>#{o.orderNumber}</span>
                      </div>
                      {renderStatusBadge(o.status)}
                    </div>

                    {/* Destination / Customer Badge */}
                    <div className="order-card__destination">
                      {o.type === 'TAKEAWAY' ? (
                        <div className="order-card__dest-badge order-card__dest-badge--takeaway">
                          {o.customerAddress ? <Bike size={13} /> : <ShoppingBag size={13} />}
                          <span>{o.customerAddress ? 'دليفري' : 'تيك أواي'}</span>
                          {o.customerName && <strong className="order-card__cust-name">{o.customerName}</strong>}
                        </div>
                      ) : (
                        <div className="order-card__dest-badge order-card__dest-badge--dinein">
                          <Utensils size={13} />
                          <span>ترابيزة {o.tableNumber || '-'}</span>
                        </div>
                      )}

                      <span className="order-card__time">
                        {new Date(o.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Items Preview Chips */}
                    <div className="order-card__items-preview">
                      {(() => {
                        const activeItems = (o.items || []).filter(i => i.status !== 'CANCELLED');
                        if (!activeItems.length) return <span className="order-card__item-chip order-card__item-chip--empty">لا توجد أصناف</span>;
                        
                        const firstTwo = activeItems.slice(0, 2);
                        const restCount = activeItems.length - 2;

                        return (
                          <>
                            {firstTwo.map((it, idx) => (
                              <span key={idx} className="order-card__item-chip">
                                {it.quantity}x {it.productNameSnapshot}
                              </span>
                            ))}
                            {restCount > 0 && (
                              <span className="order-card__item-chip order-card__item-chip--more">
                                +{restCount} أصناف أخرى
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Card Footer: Price & Quick Action Buttons */}
                    <div className="order-card__footer">
                      <div className="order-card__price-box">
                        <span className="order-card__price-label">الإجمالي</span>
                        <strong className="order-card__price-val font-mono">{formatCurrency(o.total)}</strong>
                      </div>

                      <div className="order-card__actions" onClick={(e) => e.stopPropagation()}>
                        {isOpen && (
                          <button
                            type="button"
                            className="order-card__act-btn order-card__act-btn--pay"
                            title="تحصيل ودفع فوري"
                            onClick={() => {
                              setSelectedOrder(o);
                              setShowPayment(true);
                            }}
                          >
                            <CreditCard size={14} />
                            <span>دفع</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="order-card__act-btn order-card__act-btn--print"
                          title="طباعة إيصال حراري"
                          onClick={(e) => handlePrint(e, o)}
                        >
                          <Printer size={14} />
                        </button>

                        {o.customerPhone && (
                          <button
                            type="button"
                            className="order-card__act-btn order-card__act-btn--wa"
                            title="إرسال الفاتورة عبر واتساب"
                            onClick={(e) => handleSendWhatsApp(e, o)}
                          >
                            <Smartphone size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          className="order-card__act-btn order-card__act-btn--view"
                          title="عرض تفاصيل الفاتورة"
                          onClick={() => handleSelectOrder(o)}
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredOrders.length === 0 && (
                <div className="invoices-empty-state">
                  <div className="invoices-empty-state__icon">
                    <FileText size={38} />
                  </div>
                  <h3>لا توجد فواتير مطابقة</h3>
                  <p>جرب تغيير فلاتر الحالة أو التاريخ أو البحث بكلمات أخرى</p>
                </div>
              )}
            </div>
          ) : (
            /* ═════ Compact Data Table ═════ */
            <div className="invoices-table-card">
              <table className="data-table invoices-table">
                <thead>
                  <tr>
                    <th>الأوردر</th>
                    <th>النوع / المكان</th>
                    <th>العميل / الهاتف</th>
                    <th>الحالة</th>
                    <th>الإجمالي</th>
                    <th>التاريخ والوقت</th>
                    <th className="text-center no-print">إجراء سريع</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr 
                      key={o.id} 
                      onClick={() => handleSelectOrder(o)}
                      className={`invoice-row ${selectedOrder?.id === o.id ? 'active-row' : ''}`}
                    >
                      <td className="fw-bold">
                        <span className="order-num font-mono">#{o.orderNumber}</span>
                      </td>
                      <td>
                        {o.type === 'TAKEAWAY' ? (
                          <span className="badge-type badge-type--takeaway">
                            {o.customerAddress ? <Bike size={12} /> : <ShoppingBag size={12} />}
                            <span>{o.customerAddress ? 'دليفري' : 'تيك أواي'}</span>
                          </span>
                        ) : (
                          <span className="badge-type badge-type--dinein">
                            <Utensils size={12} />
                            <span>ترابيزة {o.tableNumber || '-'}</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="table-cust-info">
                          <span className="table-cust-name">{o.customerName || 'عميل نقدي'}</span>
                          {o.customerPhone && <span className="table-cust-phone">📱 {o.customerPhone}</span>}
                        </div>
                      </td>
                      <td>{renderStatusBadge(o.status)}</td>
                      <td className="fw-bold font-mono text-accent">{formatCurrency(o.total)}</td>
                      <td className="text-muted text-sm">{formatDateTime(o.createdAt)}</td>
                      <td className="text-center no-print" onClick={(e) => e.stopPropagation()}>
                        <div className="quick-actions">
                          {(o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED') && (
                            <button 
                              className="btn-icon btn-icon--success" 
                              title="تحصيل ودفع" 
                              onClick={() => {
                                setSelectedOrder(o);
                                setShowPayment(true);
                              }}
                            >
                              <CreditCard size={14} />
                            </button>
                          )}
                          <button 
                            className="btn-icon btn-icon--primary" 
                            title="طباعة بون إيصال"
                            onClick={(e) => handlePrint(e, o)}
                          >
                            <Printer size={14} />
                          </button>
                          {o.customerPhone && (
                            <button 
                              className="btn-icon btn-icon--wa" 
                              title="إرسال واتساب"
                              onClick={(e) => handleSendWhatsApp(e, o)}
                            >
                              <Smartphone size={14} />
                            </button>
                          )}
                          {(o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED') && (
                            <button 
                              className="btn-icon btn-icon--danger" 
                              title="إلغاء الفاتورة"
                              onClick={() => {
                                setSelectedOrder(o);
                                setShowVoidModal(true);
                              }}
                            >
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center text-muted empty-cell">
                        <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                        <p>لا توجد فواتير مطابقة لخيارات البحث والفلترة</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Authentic Thermal Receipt Inspector */}
        <div className="invoice-inspector-panel">
          {selectedOrder ? (
            <div className="invoice-inspector-wrapper">
              <div className="thermal-receipt-paper" id="print-receipt">
                {/* Paper Header Tear */}
                <div className="thermal-receipt__tear thermal-receipt__tear--top" />

                <div className="receipt-content">
                  {/* Brand Header */}
                  <div className="receipt-brand-header">
                    <div className="receipt-brand-logo">☕</div>
                    <h2 className="receipt-brand-title">{selectedOrder.tenantName || user?.tenantName || 'كافيه ونس'}</h2>
                    <p className="receipt-brand-sub">إيصال حساب إلكتروني</p>
                  </div>

                  {/* Status & Order Tag */}
                  <div className="receipt-hero-tag">
                    <div className="receipt-hero-tag__num">فاتورة رقم #{selectedOrder.orderNumber}</div>
                    <div className="receipt-hero-tag__status">{renderStatusBadge(selectedOrder.status)}</div>
                  </div>

                  {/* Meta Box */}
                  <div className="receipt-meta-card">
                    <div className="receipt-meta-line">
                      <span>نوع الطلب:</span>
                      <strong>
                        {selectedOrder.type === 'TAKEAWAY' ? (
                          selectedOrder.customerAddress ? '🛵 دليفري وتوصيل' : '🛍️ تيك أواي'
                        ) : (
                          `🪑 صالة - ترابيزة ${selectedOrder.tableNumber || '-'}`
                        )}
                      </strong>
                    </div>

                    {selectedOrder.customerName && (
                      <div className="receipt-meta-line">
                        <span>العميل:</span>
                        <strong>👤 {selectedOrder.customerName}</strong>
                      </div>
                    )}

                    {selectedOrder.customerPhone && (
                      <div className="receipt-meta-line">
                        <span>الموبايل:</span>
                        <strong className="font-mono">📱 {selectedOrder.customerPhone}</strong>
                      </div>
                    )}

                    {selectedOrder.customerAddress && (
                      <div className="receipt-meta-line">
                        <span>العنوان:</span>
                        <strong>📍 {selectedOrder.customerAddress}</strong>
                      </div>
                    )}

                    <div className="receipt-meta-line">
                      <span>التاريخ والوقت:</span>
                      <span className="font-mono">{formatDateTime(selectedOrder.createdAt)}</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="receipt-items-table">
                    <thead>
                      <tr>
                        <th className="text-start">الصنف</th>
                        <th className="text-center">الكمية</th>
                        <th className="text-end">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const grouped = [];
                        selectedOrder.items?.forEach(item => {
                          const existing = grouped.find(g => 
                            g.productNameSnapshot === item.productNameSnapshot &&
                            g.status === item.status &&
                            g.unitPriceSnapshot === item.unitPriceSnapshot &&
                            g.note === item.note
                          );
                          if (existing) {
                            existing.displayQty += item.quantity;
                            existing.displayTotal += item.lineTotal;
                          } else {
                            grouped.push({
                              ...item,
                              displayQty: item.quantity,
                              displayTotal: item.lineTotal
                            });
                          }
                        });

                        return grouped.map((item, idx) => (
                          <tr key={item.id + '-' + idx} className={item.status === 'CANCELLED' ? 'cancelled-line' : ''}>
                            <td className="text-start">
                              <span className="receipt-item-title">{item.productNameSnapshot}</span>
                              {item.note && <small className="receipt-item-note">({item.note})</small>}
                              {item.status === 'CANCELLED' && <span className="receipt-cancelled-badge"> (ملغي)</span>}
                            </td>
                            <td className="text-center font-mono">{item.displayQty}</td>
                            <td className="text-end font-mono">{formatCurrency(item.displayTotal)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>

                  {/* Calculation Breakdown */}
                  <div className="receipt-calc-box">
                    <div className="receipt-calc-line">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono">{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    {parseFloat(selectedOrder.discount) > 0 && (
                      <div className="receipt-calc-line receipt-calc-line--discount">
                        <span>خصم:</span>
                        <span className="font-mono">-{formatCurrency(selectedOrder.discount)}</span>
                      </div>
                    )}
                    {parseFloat(selectedOrder.service) > 0 && (
                      <div className="receipt-calc-line">
                        <span>خدمة الصالة:</span>
                        <span className="font-mono">+{formatCurrency(selectedOrder.service)}</span>
                      </div>
                    )}
                    {parseFloat(selectedOrder.deliveryFee) > 0 && (
                      <div className="receipt-calc-line">
                        <span>رسوم التوصيل:</span>
                        <span className="font-mono">+{formatCurrency(selectedOrder.deliveryFee)}</span>
                      </div>
                    )}
                    
                    <div className="receipt-calc-line receipt-calc-line--grand">
                      <span>الإجمالي المستحق:</span>
                      <span className="font-mono">{formatCurrency(selectedOrder.total)}</span>
                    </div>

                    {parseFloat(selectedOrder.amountPaid) > 0 && (
                      <div className="receipt-calc-line receipt-calc-line--paid">
                        <span>المدفوع:</span>
                        <span className="font-mono">{formatCurrency(selectedOrder.amountPaid)}</span>
                      </div>
                    )}
                    {parseFloat(selectedOrder.balanceDue) > 0 && (
                      <div className="receipt-calc-line receipt-calc-line--balance">
                        <span>المتبقي:</span>
                        <span className="font-mono">{formatCurrency(selectedOrder.balanceDue)}</span>
                      </div>
                    )}
                  </div>

                  {/* Receipt Footer */}
                  <div className="receipt-paper-footer">
                    <p className="receipt-paper-thanks">شكراً لزيارتكم {user?.tenantName || 'الكافيه'}!</p>
                    <p className="receipt-paper-wish">يسعدنا دائماً خدمتكم ✨</p>
                    
                    <div className="receipt-paper-barcode">
                      <div className="barcode-bars" />
                      <span className="barcode-code font-mono">*{selectedOrder.orderNumber}*</span>
                    </div>
                  </div>
                </div>

                {/* Paper Bottom Tear */}
                <div className="thermal-receipt__tear thermal-receipt__tear--bottom" />
              </div>

              {/* Floating Action Dock for Cashier */}
              <div className="inspector-actions-dock no-print">
                {(selectedOrder.status === 'OPEN' || selectedOrder.status === 'SENT' || selectedOrder.status === 'SERVED') ? (
                  <div className="actions-dock-grid">
                    <button 
                      type="button" 
                      className="dock-btn dock-btn--pay" 
                      onClick={() => setShowPayment(true)}
                    >
                      <CreditCard size={16} />
                      <span>دفع وقفل الفاتورة</span>
                    </button>
                    
                    <button 
                      type="button" 
                      className="dock-btn dock-btn--print" 
                      onClick={handlePrint}
                      title="طباعة فورية للإيصال"
                    >
                      <Printer size={16} />
                      <span>طباعة</span>
                    </button>

                    {selectedOrder.customerPhone && (
                      <button 
                        type="button" 
                        className="dock-btn dock-btn--whatsapp" 
                        onClick={handleSendWhatsApp}
                        title="إرسال الفاتورة عبر واتساب"
                      >
                        <Smartphone size={16} />
                        <span>واتساب</span>
                      </button>
                    )}

                    <button 
                      type="button" 
                      className="dock-btn dock-btn--void" 
                      onClick={() => setShowVoidModal(true)}
                      title="إلغاء الفاتورة بالكامل"
                    >
                      <XCircle size={16} />
                      <span>إلغاء</span>
                    </button>
                  </div>
                ) : (
                  <div className="actions-dock-grid">
                    <button 
                      type="button" 
                      className="dock-btn dock-btn--print-full" 
                      onClick={handlePrint}
                    >
                      <Printer size={16} />
                      <span>إعادة طباعة الفاتورة</span>
                    </button>

                    {selectedOrder.customerPhone && (
                      <button 
                        type="button" 
                        className="dock-btn dock-btn--whatsapp" 
                        onClick={handleSendWhatsApp}
                        title="إرسال الفاتورة عبر واتساب"
                      >
                        <Smartphone size={16} />
                        <span>واتساب</span>
                      </button>
                    )}

                    {selectedOrder.status === 'CLOSED' && (
                      <button 
                        type="button" 
                        className="dock-btn dock-btn--refund" 
                        onClick={() => setShowRefundModal(true)}
                      >
                        <DollarSign size={16} />
                        <span>إرجاع مبلغ</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="inspector-empty-state">
              <div className="inspector-empty-state__icon">
                <Receipt size={52} />
              </div>
              <h3>معاينة الفاتورة الحرارية</h3>
              <p>اضغط على أي فاتورة من القائمة لعرض تفاصيلها والإجراءات المتاحة عليها</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Void Order Modal */}
      {showVoidModal && selectedOrder && (
        <Modal
          isOpen={showVoidModal}
          onClose={() => setShowVoidModal(false)}
          title={`إلغاء الفاتورة رقم #${selectedOrder.orderNumber}`}
          size="sm"
        >
          <div className="void-modal-content">
            <p className="void-modal-warning">
              ⚠️ هل أنت متأكد من إلغاء الفاتورة إجمالياً بمبلغ <strong>{formatCurrency(selectedOrder.total)}</strong>؟
            </p>
            <div className="form-group">
              <label className="form-label">سبب الإلغاء:</label>
              <div className="reason-chips">
                {['رغبة العميل', 'طلب مكرر', 'خطأ في الأصناف', 'تأخير في التحضير', 'أخرى'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className={`chip ${voidReason === reason ? 'chip--active' : ''}`}
                    onClick={() => { sounds.playTap(); setVoidReason(reason); }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {voidReason === 'أخرى' && (
              <div className="form-group">
                <input
                  type="text"
                  className="input"
                  placeholder="اكتب سبب الإلغاء التفصيلي..."
                  value={voidCustomReason}
                  onChange={(e) => setVoidCustomReason(e.target.value)}
                />
              </div>
            )}

            <div className="modal-actions-right">
              <button 
                className="btn btn--outline" 
                onClick={() => setShowVoidModal(false)}
                disabled={voidingLoading}
              >
                تراجع
              </button>
              <button 
                className="btn btn--danger" 
                onClick={handleVoidOrderSubmit}
                disabled={voidingLoading}
              >
                {voidingLoading ? <Spinner size="sm" /> : 'تأكيد الإلغاء'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Refund Order Modal */}
      {showRefundModal && selectedOrder && (
        <Modal
          isOpen={showRefundModal}
          onClose={() => setShowRefundModal(false)}
          title={`إرجاع مبلغ الفاتورة رقم #${selectedOrder.orderNumber}`}
          size="sm"
        >
          <div className="void-modal-content">
            <p className="void-modal-warning">
              ⚠️ هل أنت متأكد من إرجاع مبلغ <strong>{formatCurrency(selectedOrder.total)}</strong>؟
            </p>
            <div className="form-group">
              <label className="form-label">سبب الإرجاع:</label>
              <div className="reason-chips">
                {['خطأ في الحساب', 'تغيير رأي العميل', 'عدم توفر الصنف', 'أخرى'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className={`chip ${refundReason === reason ? 'chip--active' : ''}`}
                    onClick={() => { sounds.playTap(); setRefundReason(reason); }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            {refundReason === 'أخرى' && (
              <div className="form-group">
                <input
                  type="text"
                  className="input"
                  placeholder="اكتب سبب الإرجاع التفصيلي..."
                  value={refundCustomReason}
                  onChange={(e) => setRefundCustomReason(e.target.value)}
                />
              </div>
            )}

            <div className="modal-actions-right">
              <button 
                className="btn btn--outline" 
                onClick={() => setShowRefundModal(false)}
                disabled={refundingLoading}
              >
                تراجع
              </button>
              <button 
                className="btn btn--danger" 
                onClick={handleRefundSubmit}
                disabled={refundingLoading}
              >
                {refundingLoading ? <Spinner size="sm" /> : 'تأكيد الإرجاع'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Shift Confirmation Modal */}
      {showDeleteShiftModal && filterShiftId !== 'ALL' && (
        <Modal
          isOpen={showDeleteShiftModal}
          onClose={() => setShowDeleteShiftModal(false)}
          title="حذف الشيفت"
          size="sm"
        >
          <div className="void-modal-content">
            <p className="void-modal-warning">
              ⚠️ هل أنت متأكد من حذف الشيفت رقم <strong>#{filterShiftId}</strong>؟
              <br />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                سيتم حذف الشيفت وجميع الفواتير المرتبطة به نهائياً. هذا الإجراء لا يمكن التراجع عنه.
              </span>
            </p>
            <div className="modal-actions-right">
              <button
                className="btn btn--outline"
                onClick={() => setShowDeleteShiftModal(false)}
                disabled={deletingShift}
              >
                تراجع
              </button>
              <button
                className="btn btn--danger"
                onClick={async () => {
                  setDeletingShift(true);
                  try {
                    await shiftsApi.delete(filterShiftId);
                    sounds.playSuccess();
                    toast.success('تم حذف الشيفت بنجاح');
                    setShowDeleteShiftModal(false);
                    setFilterShiftId('ALL');
                    await loadShifts();
                    await loadOrders(true);
                  } catch (err) {
                    sounds.playError();
                    toast.error(err.message || 'فشل في حذف الشيفت');
                  } finally {
                    setDeletingShift(false);
                  }
                }}
                disabled={deletingShift}
              >
                {deletingShift ? <Spinner size="sm" /> : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
