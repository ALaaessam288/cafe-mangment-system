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
  ChevronDown, Layers, FileText, Trash2, Download, QrCode, Bike, MapPin, Phone
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
  const [filterShiftId, setFilterShiftId] = useState('ALL');
  const [showDeleteShiftModal, setShowDeleteShiftModal] = useState(false);
  const [deletingShift, setDeletingShift] = useState(false);

  // Filters state
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDate, setFilterDate] = useState('TODAY');
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('NEWEST'); // NEWEST, OLDEST, TOTAL_DESC, TOTAL_ASC
  // Type/sort/shift are used far less often than search/status/date - keep them out of the
  // way by default so the filter bar isn't 6+ controls deep on every visit.
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const moreFiltersActive = filterType !== 'ALL' || sortOrder !== 'NEWEST' || filterShiftId !== 'ALL';

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

  useEffect(() => {
    loadOrders();
    loadShifts();
  }, [loadOrders]);

  const loadShifts = async () => {
    try {
      const data = await shiftsApi.findAll();
      const sorted = (data || []).sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
      setShifts(sorted);
    } catch (err) {
      console.error('Failed to load shifts', err);
    }
  };

  const handleRowClick = async (orderId) => {
    try {
      const full = await ordersApi.findById(orderId);
      setSelectedOrder(full);
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل تفاصيل الفاتورة');
    }
  };

  // Print via the reliable Electron IPC path (explicit 80mm pageSize) - window.print() doesn't
  // honor CSS @page sizing and falls back to the OS default page (e.g. A4/Letter with large
  const printOrderReceipt = (order) => {
    if (!order) return;
    const html = buildReceiptHtml({ order });
    printReceipt(html, printOptionsFor('RECEIPT', { width: 80 }));
  };

  const handlePrint = () => {
    if (!selectedOrder) return;
    printOrderReceipt(selectedOrder);
  };

  const handlePaymentSuccess = (updatedOrder, fullyPaid) => {
    setShowPayment(false);

    if (fullyPaid) {
      toast.success('تم الدفع وقفل الفاتورة بنجاح!');
      // updatedOrder is the just-closed order straight from the close() response - already
      // has final totals/items/payments, no need to re-fetch before printing.
      setTimeout(() => {
        printOrderReceipt(updatedOrder || selectedOrder);
        setSelectedOrder(null);
        loadOrders();
      }, 300);
    } else {
      // Partial payment - order stays open with a reduced balance, keep the invoice selected
      // so its updated amountPaid/balanceDue are visible instead of closing the panel.
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
      toast.success(`تم إلغاء الفاتورة رقم #${selectedOrder.orderNumber} بنجاح`);
      setShowVoidModal(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (err) {
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
      toast.success(`تم إرجاع الفاتورة رقم #${selectedOrder.orderNumber} بنجاح`);
      setShowRefundModal(false);
      setSelectedOrder(null);
      loadOrders();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'فشل إرجاع الفاتورة';
      toast.error(msg);
    } finally {
      setRefundingLoading(false);
    }
  };

  const renderStatus = (status) => {
    const map = {
      OPEN: { label: 'مفتوح', variant: 'warning', icon: <Clock size={12} /> },
      SENT: { label: 'مُرسل للمطبخ', variant: 'info', icon: <Clock size={12} /> },
      SERVED: { label: 'تم تقديم الطلب', variant: 'info', icon: <Utensils size={12} /> },
      READY_FOR_PICKUP: { label: 'جاهز للاستلام', variant: 'info', icon: <Utensils size={12} /> },
      PAID: { label: 'مدفوع', variant: 'success', icon: <CheckCircle2 size={12} /> },
      CLOSED: { label: 'مقبوض', variant: 'success', icon: <CheckCircle2 size={12} /> },
      VOIDED: { label: 'ملغي', variant: 'danger', icon: <Ban size={12} /> },
    };
    const mapped = map[status] || { label: status, variant: 'neutral', icon: null };
    return (
      <Badge variant={mapped.variant} size="sm" className="status-badge-flex">
        {mapped.icon}
        <span>{mapped.label}</span>
      </Badge>
    );
  };

  // Filter & Sort Logic
  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
      // 1. Status Filter
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
      
      // 2. Type Filter
      if (filterType !== 'ALL' && o.type !== filterType) return false;

      // 3. Date Filter
      if (filterDate !== 'ALL') {
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
      
      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNum = o.orderNumber?.toString().includes(q);
        const matchTable = o.tableNumber?.toString().includes(q);
        const matchCustomer = o.customerName?.toLowerCase().includes(q);
        if (!matchNum && !matchTable && !matchCustomer) return false;
      }
      
      // 5. Shift Filter
      if (filterShiftId !== 'ALL' && o.shiftId != filterShiftId) return false;

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

    filteredOrders.forEach(o => {
      if (o.status === 'CLOSED') {
        totalRevenue += (o.total || 0);
        closedCount++;
      } else if (o.status === 'VOIDED') {
        voidCount++;
      } else {
        openCount++;
        openTotal += (o.total || 0);
      }
    });

    return {
      totalCount: filteredOrders.length,
      totalRevenue,
      openCount,
      openTotal,
      closedCount,
      voidCount
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
    <div className="page invoices-page">
      <ObserverBanner />
      {/* Header */}
      <header className="page__header">
        <div>
          <h1 className="page__title">الفواتير والأوردرات</h1>
          <p className="page__subtitle">إدارة ومراجعة الفواتير والدفع والطباعة والإلغاء بسهولة</p>
        </div>
        <div className="page__actions no-print">
          <button 
            type="button"
            className="btn btn--outline btn--sm" 
            onClick={exportToCSV}
            title="تصدير كشف الفواتير لملف Excel / CSV"
          >
            <Download size={14} />
            <span>تصدير CSV</span>
          </button>
          <button 
            type="button"
            className="btn btn--outline btn--sm btn-refresh" 
            onClick={() => { sounds.playTap(); loadOrders(true); }}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </header>

      {/* KPI Stats Cards */}
      <div className="invoices-kpi-grid no-print">
        <div className="kpi-card kpi-card--primary">
          <div className="kpi-card__icon"><DollarSign size={22} /></div>
          <div className="kpi-card__info">
            <span className="kpi-card__label">إجمالي المقبوضات</span>
            <strong className="kpi-card__value">{formatCurrency(stats.totalRevenue)}</strong>
          </div>
        </div>

        <div className="kpi-card kpi-card--warning">
          <div className="kpi-card__icon"><Clock size={22} /></div>
          <div className="kpi-card__info">
            <span className="kpi-card__label">فواتير مفتوحة ({stats.openCount})</span>
            <strong className="kpi-card__value">{formatCurrency(stats.openTotal)}</strong>
          </div>
        </div>

        <div className="kpi-card kpi-card--success">
          <div className="kpi-card__icon"><Receipt size={22} /></div>
          <div className="kpi-card__info">
            <span className="kpi-card__label">فواتير مغلقة</span>
            <strong className="kpi-card__value">{stats.closedCount} فاتورة</strong>
          </div>
        </div>

        <div className="kpi-card kpi-card--danger">
          <div className="kpi-card__icon"><Ban size={22} /></div>
          <div className="kpi-card__info">
            <span className="kpi-card__label">فواتير ملغاة</span>
            <strong className="kpi-card__value">{stats.voidCount} فاتورة</strong>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="invoices-filter-bar no-print">
        <div className="search-box-wrap">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            className="input search-input" 
            placeholder="بحث برقم الأوردر، الترابيزة، أو اسم العميل..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          {/* Status Filter */}
          <div className="select-wrap">
            <Filter size={14} className="select-icon" />
            <select className="input input-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="ALL">كل الحالات</option>
              <option value="OPEN">مفتوح</option>
              <option value="SENT">مُرسل للمطبخ</option>
              <option value="SERVED">تم التقديم</option>
              <option value="CLOSED">مقبوض</option>
              <option value="VOIDED">ملغي</option>
            </select>
          </div>

          {/* Date Presets Filter */}
          <div className="select-wrap">
            <Calendar size={14} className="select-icon" />
            <select className="input input-select" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
              <option value="TODAY">اليوم</option>
              <option value="YESTERDAY">أمس</option>
              <option value="WEEK">آخر 7 أيام</option>
              <option value="ALL">كل الأوقات</option>
            </select>
          </div>

          {/* Type/sort/shift are used far less often - tucked behind this toggle so the bar
              isn't 6+ controls deep by default. */}
          <button
            type="button"
            className={`btn btn--secondary btn--sm ${moreFiltersActive ? 'filters-toggle--active' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
            onClick={() => setShowMoreFilters((v) => !v)}
          >
            <span>فلاتر أكثر{moreFiltersActive ? ' •' : ''}</span>
            <ChevronDown size={14} style={{ transform: showMoreFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {showMoreFilters && (
            <>
              {/* Type Filter */}
              <div className="select-wrap">
                <Layers size={14} className="select-icon" />
                <select className="input input-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="ALL">كل الأنواع</option>
                  <option value="DINE_IN">صالة / ترابيزات</option>
                  <option value="TAKEAWAY">تيك أواي</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="select-wrap">
                <select className="input input-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                  <option value="NEWEST">الأحدث أولاً</option>
                  <option value="OLDEST">الأقدم أولاً</option>
                  <option value="TOTAL_DESC">الأعلى إجمالي</option>
                  <option value="TOTAL_ASC">الأقل إجمالي</option>
                </select>
              </div>

              {/* Shift Filter */}
              <div className="select-wrap">
                <Filter size={14} className="select-icon" />
                <select className="input input-select" value={filterShiftId} onChange={(e) => setFilterShiftId(e.target.value)}>
                  <option value="ALL">كل الشيفتات</option>
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>
                      شيفت #{s.id} - {new Date(s.openedAt).toLocaleDateString('ar-EG')} {s.closedAt ? '(مغلق)' : '(مفتوح)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin: Delete Shift */}
              {role === 'SUPERVISOR' && filterShiftId !== 'ALL' && (
                <button
                  className="btn btn--danger btn--sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                  onClick={() => setShowDeleteShiftModal(true)}
                  title="حذف الشيفت المحدد"
                >
                  <Trash2 size={14} />
                  <span>حذف الشيفت</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="invoices-layout">
        {/* Left: Enhanced Orders Data Table */}
        <div className="invoices-list data-table-wrap">
          <table className="data-table invoices-table">
            <thead>
              <tr>
                <th>الأوردر</th>
                <th>النوع / المكان</th>
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
                  onClick={() => handleRowClick(o.id)}
                  className={`invoice-row ${selectedOrder?.id === o.id ? 'active-row' : ''}`}
                >
                  <td className="fw-bold">
                    <span className="order-num">#{o.orderNumber}</span>
                  </td>
                  <td>
                    {o.type === 'TAKEAWAY' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span className="badge-type badge-type--takeaway">
                          <ShoppingBag size={13} /> تيك أواي
                        </span>
                        {o.customerPhone && (
                          <span className="text-muted text-sm" style={{ fontSize: '11px' }}>📱 {o.customerPhone}</span>
                        )}
                      </div>
                    ) : (
                      <span className="badge-type badge-type--dinein">
                        <Utensils size={13} /> ترابيزة {o.tableNumber || '-'}
                      </span>
                    )}
                  </td>
                  <td>{renderStatus(o.status)}</td>
                  <td className="fw-bold text-accent">{formatCurrency(o.total)}</td>
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
                          <CreditCard size={15} />
                        </button>
                      )}
                      <button 
                        className="btn-icon btn-icon--primary" 
                        title="معاينة وطباعة"
                        onClick={() => handleRowClick(o.id)}
                      >
                        <Printer size={15} />
                      </button>
                      {(o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED') && (
                        <button 
                          className="btn-icon btn-icon--danger" 
                          title="إلغاء الفاتورة"
                          onClick={() => {
                            setSelectedOrder(o);
                            setShowVoidModal(true);
                          }}
                        >
                          <XCircle size={15} />
                        </button>
                      )}
                      {o.status === 'CLOSED' && (
                        <button 
                          className="btn-icon btn-icon--danger" 
                          title="إرجاع مبلغ"
                          onClick={() => {
                            setSelectedOrder(o);
                            setShowRefundModal(true);
                          }}
                        >
                          <DollarSign size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted empty-cell">
                    <FileText size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p>لا توجد فواتير مطابقة لخيارات البحث والفلترة</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Receipt details & actions */}
        <div className="invoice-details-panel">
          {selectedOrder ? (
            <div className="invoice-receipt-wrapper">
              <div className="invoice-receipt" id="print-receipt">
                <div className="receipt-header">
                  <h2 className="receipt-brand">☕ {selectedOrder.tenantName || user?.tenantName || 'كافيه ونس'}</h2>
                  <div className="receipt-badge-status">{renderStatus(selectedOrder.status)}</div>
                  <div className="receipt-order-tag">فاتورة رسمية #{selectedOrder.orderNumber}</div>
                  
                  <div className="receipt-meta-box">
                    <div className="receipt-meta-row">
                      <span className="receipt-meta-label">نوع الطلب:</span>
                      <span className="receipt-meta-val">
                        {selectedOrder.type === 'TAKEAWAY' ? (
                          selectedOrder.customerAddress ? '🛵 دليفري وتوصيل' : '🛍️ تيك أواي'
                        ) : (
                          `🪑 صالة - ترابيزة ${selectedOrder.tableNumber || '-'}`
                        )}
                      </span>
                    </div>

                    {selectedOrder.customerName && (
                      <div className="receipt-meta-row">
                        <span className="receipt-meta-label">العميل:</span>
                        <span className="receipt-meta-val">👤 {selectedOrder.customerName}</span>
                      </div>
                    )}

                    {selectedOrder.customerPhone && (
                      <div className="receipt-meta-row">
                        <span className="receipt-meta-label">الموبايل:</span>
                        <span className="receipt-meta-val">📱 {selectedOrder.customerPhone}</span>
                      </div>
                    )}

                    {selectedOrder.customerAddress && (
                      <div className="receipt-meta-row">
                        <span className="receipt-meta-label">العنوان:</span>
                        <span className="receipt-meta-val">📍 {selectedOrder.customerAddress}</span>
                      </div>
                    )}

                    <div className="receipt-meta-row">
                      <span className="receipt-meta-label">التاريخ والوقت:</span>
                      <span className="receipt-meta-val">{formatDateTime(selectedOrder.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                <table className="receipt-items">
                  <thead>
                    <tr>
                      <th className="text-start">الصنف</th>
                      <th className="text-center">الكمية</th>
                      <th className="text-end">السعر</th>
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
                        <tr key={item.id + '-' + idx} className={item.status === 'CANCELLED' ? 'cancelled-item' : ''}>
                          <td className="text-start">
                            <span className="item-name">{item.productNameSnapshot}</span>
                            {item.note && <span className="item-note">({item.note})</span>}
                            {item.status === 'CANCELLED' && <span className="badge-cancelled-tag"> (ملغي)</span>}
                          </td>
                          <td className="text-center font-mono">{item.displayQty}</td>
                          <td className="text-end font-mono">{formatCurrency(item.displayTotal)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>

                <div className="receipt-totals">
                  <div className="receipt-row">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono">{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {parseFloat(selectedOrder.discount) > 0 && (
                    <div className="receipt-row receipt-row--discount">
                      <span>خصم:</span>
                      <span className="font-mono">-{formatCurrency(selectedOrder.discount)}</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.service) > 0 && (
                    <div className="receipt-row">
                      <span>خدمة الصالة:</span>
                      <span className="font-mono">+{formatCurrency(selectedOrder.service)}</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.deliveryFee) > 0 && (
                    <div className="receipt-row">
                      <span>رسوم التوصيل:</span>
                      <span className="font-mono">+{formatCurrency(selectedOrder.deliveryFee)}</span>
                    </div>
                  )}
                  <div className="receipt-row receipt-total">
                    <span>الإجمالي النهائي المستحق:</span>
                    <span className="font-mono">{formatCurrency(selectedOrder.total)}</span>
                  </div>
                  {parseFloat(selectedOrder.amountPaid) > 0 && (
                    <div className="receipt-row receipt-row--paid">
                      <span>المدفوع:</span>
                      <span className="font-mono">{formatCurrency(selectedOrder.amountPaid)}</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.balanceDue) > 0 && (
                    <div className="receipt-row receipt-row--balance">
                      <span>المتبقي:</span>
                      <span className="font-mono">{formatCurrency(selectedOrder.balanceDue)}</span>
                    </div>
                  )}
                </div>
                
                <div className="receipt-footer">
                  <p className="receipt-thanks">شكراً لزيارتكم {user?.tenantName || 'الكافيه'}!</p>
                  <p className="receipt-subtext">يسعدنا دائماً خدمتكم ✨</p>
                  <div className="receipt-barcode">
                    <div className="receipt-barcode__lines" />
                    <span className="receipt-barcode__text">*{selectedOrder.orderNumber}*</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="invoice-actions no-print">
                {(selectedOrder.status === 'OPEN' || selectedOrder.status === 'SENT' || selectedOrder.status === 'SERVED') ? (
                  <>
                    <button className="btn btn--success btn--md" onClick={() => setShowPayment(true)}>
                      <CreditCard size={16} />
                      <span>دفع وقفل وطباعة</span>
                    </button>
                    <button className="btn btn--danger btn--md" onClick={() => setShowVoidModal(true)}>
                      <XCircle size={16} />
                      <span>إلغاء الفاتورة</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn--primary btn--md" onClick={handlePrint}>
                      <Printer size={16} />
                      <span>طباعة الفاتورة</span>
                    </button>
                    {selectedOrder.status === 'CLOSED' && (
                      <button className="btn btn--danger btn--md" onClick={() => setShowRefundModal(true)}>
                        <DollarSign size={16} />
                        <span>إرجاع مبلغ</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="invoice-empty">
              <Receipt size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
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
              ⚠️ هل أنت تأكد من إلغاء الفاتورة إجمالياً بمبلغ <strong>{formatCurrency(selectedOrder.total)}</strong>؟
            </p>
            <div className="form-group">
              <label className="form-label">سبب الإلغاء:</label>
              <div className="reason-chips">
                {['رغبة العميل', 'طلب مكرر', 'خطأ في الأصناف', 'تأخير في التحضير', 'أخرى'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className={`chip ${voidReason === reason ? 'chip--active' : ''}`}
                    onClick={() => setVoidReason(reason)}
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
                    onClick={() => setRefundReason(reason)}
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
                    toast.success('تم حذف الشيفت بنجاح');
                    setShowDeleteShiftModal(false);
                    setFilterShiftId('ALL');
                    await loadShifts();
                    await loadOrders(true);
                  } catch (err) {
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
