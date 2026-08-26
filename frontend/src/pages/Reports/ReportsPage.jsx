import { useCallback, useEffect, useState, useMemo } from 'react';
import { 
  Calendar, DollarSign, Clock, RefreshCw, Printer, Award, 
  CreditCard, ShoppingBag, Trash2, Download, Filter, 
  TrendingUp, TrendingDown, Layers, Search, ChevronLeft, 
  CheckCircle2, FileText
} from 'lucide-react';
import { shiftsApi } from '../../api/shiftsApi';
import { reportsApi } from '../../api/reportsApi';
import { employeesApi } from '../../api/employeesApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { sounds } from '../../utils/soundEffects';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import { ROLES } from '../../utils/constants';
import { printReceipt, buildShiftSummaryHtml, buildPeriodicFinancialReportHtml } from '../../utils/printUtils';
import { printOptionsFor } from '../../utils/printerSettings';
import DailyReportModal from '../../components/DailyReportModal/DailyReportModal';
import './ReportsPage.css';

// Helper to format Date as YYYY-MM-DD
function formatDateForInput(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReportsPage() {
  const toast = useToast();
  const { role, user } = useAuth();
  const isSupervisor = role === ROLES.SUPERVISOR;
  const canViewReports = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;
  
  const [shifts, setShifts] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [payrollData, setPayrollData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('FINANCIAL');

  // Filter mode: 'DATES' or 'SHIFT'
  const [filterMode, setFilterMode] = useState('DATES');
  const [datePreset, setDatePreset] = useState('TODAY'); // 'TODAY', 'YESTERDAY', 'WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'
  
  // Custom Date Range
  const [startDate, setStartDate] = useState(() => formatDateForInput(new Date()));
  const [endDate, setEndDate] = useState(() => formatDateForInput(new Date()));
  
  // Specific Shift Filter
  const [selectedFilterShiftId, setSelectedFilterShiftId] = useState('');

  // Payroll Filters
  const [payrollStartDate, setPayrollStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateForInput(d);
  });
  const [payrollEndDate, setPayrollEndDate] = useState(() => formatDateForInput(new Date()));

  // Product Search Filter in table
  const [productSearch, setProductSearch] = useState('');

  // Selected shift details for Modal
  const [selectedShift, setSelectedShift] = useState(null);
  const [shiftReport, setShiftReport] = useState(null);
  const [loadingShiftDetails, setLoadingShiftDetails] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dailyModalShiftId, setDailyModalShiftId] = useState(null);
  const [editingSnacksNet, setEditingSnacksNet] = useState('');
  const [savingSnacksNet, setSavingSnacksNet] = useState(false);

  // Apply Date Presets
  const applyDatePreset = (preset) => {
    sounds.playTap();
    setDatePreset(preset);
    const today = new Date();
    
    if (preset === 'TODAY') {
      const formatted = formatDateForInput(today);
      setStartDate(formatted);
      setEndDate(formatted);
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const formatted = formatDateForInput(y);
      setStartDate(formatted);
      setEndDate(formatted);
    } else if (preset === 'WEEK') {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(formatDateForInput(w));
      setEndDate(formatDateForInput(today));
    } else if (preset === 'THIS_MONTH') {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDateForInput(m));
      setEndDate(formatDateForInput(today));
    } else if (preset === 'LAST_MONTH') {
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(formatDateForInput(firstDayLastMonth));
      setEndDate(formatDateForInput(lastDayLastMonth));
    }
  };

  // Human readable period label
  const periodLabel = useMemo(() => {
    if (filterMode === 'SHIFT') {
      const sh = shifts.find(s => String(s.id) === String(selectedFilterShiftId));
      return sh ? `شيفت #${String(sh.id).slice(-6)} (${sh.username || 'كاشير'})` : 'شيفت محدد';
    }
    if (datePreset === 'TODAY') return 'مبيعات اليوم';
    if (datePreset === 'YESTERDAY') return 'مبيعات أمس';
    if (datePreset === 'WEEK') return 'مبيعات آخر 7 أيام';
    if (datePreset === 'THIS_MONTH') return 'مبيعات هذا الشهر';
    if (datePreset === 'LAST_MONTH') return 'مبيعات الشهر السابق';
    return `من ${startDate} إلى ${endDate}`;
  }, [filterMode, selectedFilterShiftId, shifts, datePreset, startDate, endDate]);

  // Load Main Reports Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const shiftsData = await shiftsApi.findAll();
      const sortedShifts = shiftsData.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
      setShifts(sortedShifts);
      
      if (canViewReports) {
        let params = {};
        if (filterMode === 'SHIFT' && selectedFilterShiftId) {
          params.shiftId = selectedFilterShiftId;
        } else if (filterMode === 'DATES') {
          if (startDate) params.startDate = startDate;
          if (endDate) params.endDate = endDate;
        }

        const finData = await reportsApi.getFinancialReport(params);
        setFinancialData(finData);

        // Load payroll data
        const pData = await employeesApi.getPayrollSummary(payrollStartDate, payrollEndDate);
        setPayrollData(pData);
      }
    } catch (err) {
      toast.error(err.message, 'فشل تحميل بيانات التقارير');
    } finally {
      setLoading(false);
    }
  }, [toast, canViewReports, filterMode, selectedFilterShiftId, startDate, endDate, payrollStartDate, payrollEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Print Periodic Financial Report (80mm / A4)
  const handlePrintPeriodicReport = () => {
    if (!financialData) {
      toast.warning('لا توجد بيانات تقرير لطباعتها حالياً');
      return;
    }
    sounds.playPaymentSuccess();
    const html = buildPeriodicFinancialReportHtml({
      financialData,
      startDate: filterMode === 'DATES' ? startDate : '',
      endDate: filterMode === 'DATES' ? endDate : '',
      cafeName: user?.tenantName,
      periodLabel
    });
    printReceipt(html, printOptionsFor('REPORT', { width: 80 }));
  };

  // Export Report to High Quality Styled Excel (.xls)
  const handleExportExcel = () => {
    if (!financialData) return;
    sounds.playTap();

    const tenantName = user?.tenantName || 'كافيو POS';
    const dateStr = new Date().toLocaleString('ar-EG');
    const totalRev = (financialData.totalCafeRevenue || 0) + (financialData.totalRestaurantRevenue || 0) + (financialData.totalSnacksNet || 0);

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>تقرير المبيعات المالي</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Arial, Tahoma, sans-serif; direction: rtl; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; font-family: 'Segoe UI', Tahoma, sans-serif; }
          th { background-color: #1e293b; color: #f59e0b; padding: 12px; border: 1px solid #334155; font-size: 13px; text-align: center; font-weight: bold; }
          td { padding: 10px 14px; border: 1px solid #cbd5e1; font-size: 12px; text-align: center; }
          .header-banner { background-color: #0f172a; color: #f59e0b; font-size: 18px; font-weight: bold; padding: 16px; text-align: center; border: 2px solid #1e293b; }
          .section-hdr { background-color: #0284c7; color: #ffffff; font-size: 14px; font-weight: bold; padding: 10px; text-align: right; }
          .kpi-row { background-color: #f8fafc; font-weight: bold; }
          .highlight-green { background-color: #10b981; color: #ffffff; font-weight: bold; font-size: 14px; }
          .number-cell { font-family: 'Courier New', monospace; font-weight: bold; direction: ltr; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="4" class="header-banner">📊 ${tenantName} — تقرير مبيعات وأرباح الكافيه والمطعم التفصيلي</td></tr>
          <tr>
            <td colspan="2"><b>فترة التقرير:</b> ${periodLabel}</td>
            <td colspan="2"><b>تاريخ وتوقيت الإصدار:</b> ${dateStr}</td>
          </tr>
        </table>
        
        <!-- Financial Summary Table -->
        <table>
          <thead>
            <tr><th colspan="2" class="section-hdr">💵 1. الملخص المالي العام والأرباح</th></tr>
            <tr><th>البنـــــد المالي</th><th>المبلغ المحصل / الإيراد (ج.م)</th></tr>
          </thead>
          <tbody>
            <tr><td style="text-align:right;">إيرادات الكافيه (المشروبات)</td><td class="number-cell">${(financialData.totalCafeRevenue || 0).toFixed(2)}</td></tr>
            <tr><td style="text-align:right;">إيرادات المطعم (المأكولات)</td><td class="number-cell">${(financialData.totalRestaurantRevenue || 0).toFixed(2)}</td></tr>
            <tr><td style="text-align:right;">صافي مبيعات السناكس والحلويات</td><td class="number-cell">${(financialData.totalSnacksNet || 0).toFixed(2)}</td></tr>
            <tr class="kpi-row"><td style="text-align:right;"><b>إجمالي الإيرادات الكلية للمنشأة</b></td><td class="number-cell"><b>${totalRev.toFixed(2)}</b></td></tr>
            <tr><td style="text-align:right;">إجمالي المصروفات والنثريات (-)</td><td class="number-cell" style="color:#ef4444;">-${((financialData.totalCafeExpenses || 0) + (financialData.totalRestaurantExpenses || 0) + (financialData.totalGeneralExpenses || 0)).toFixed(2)}</td></tr>
            <tr><td style="text-align:right;">الرواتب والسلف المسحوبة (-)</td><td class="number-cell" style="color:#ef4444;">-${(financialData.totalWages || 0).toFixed(2)}</td></tr>
            <tr class="highlight-green"><td style="text-align:right;"><b>💰 صافي الربح المحقق للفترة</b></td><td class="number-cell"><b>${(financialData.netProfit || 0).toFixed(2)} ج.م</b></td></tr>
          </tbody>
        </table>

        <!-- Product Sales Breakdown Table -->
        <table>
          <thead>
            <tr><th colspan="3" class="section-hdr">📦 2. كشف مبيعات الأقسام والمنتجات التفصيلي</th></tr>
            <tr><th>اسم الصنـف / المنتج</th><th>الكمية المباعة</th><th>إجمالي الإيراد (ج.م)</th></tr>
          </thead>
          <tbody>
            ${(financialData.productSales || []).map(p => `
              <tr>
                <td style="text-align:right; font-weight:600;">${p.name}</td>
                <td>${p.quantity}</td>
                <td class="number-cell">${(p.totalRevenue || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Payment Methods Table -->
        <table>
          <thead>
            <tr><th colspan="3" class="section-hdr">💳 3. تفاصيل التحصيل حسب طرق الدفع</th></tr>
            <tr><th>طريقة التحصيل والتعامل</th><th>عدد العمليات المنفذة</th><th>إجمالي المبلغ المحصل (ج.م)</th></tr>
          </thead>
          <tbody>
            ${(financialData.paymentMethods || []).map(pm => `
              <tr>
                <td>${pm.method === 'CASH' ? '💵 نقدي (كاش)' : pm.method === 'INSTAPAY' ? '📱 إنستاباي / فيزا' : '👛 محفظة إلكترونية'}</td>
                <td>${pm.count}</td>
                <td class="number-cell">${(pm.totalAmount || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_مبيعات_${tenantName.replace(/\s+/g, '_')}_${startDate || 'اليوم'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('تم تصدير كشف الإكسيل المنسق (.xls) بنجاح 📊');
  };

  const handleSaveSnacksNet = async () => {
    if (!selectedShift) return;
    setSavingSnacksNet(true);
    try {
      const val = parseFloat(editingSnacksNet) || 0;
      await shiftsApi.setSnacksNet(selectedShift.id, val);
      toast.success('تم حفظ صافي السناكس بنجاح');
      setSelectedShift(prev => prev ? { ...prev, snacksNet: val } : null);
      setShiftReport(prev => prev ? { ...prev, snacksNet: val } : null);
      loadData();
    } catch (err) {
      toast.error(err.message, 'فشل حفظ صافي السناكس');
    } finally {
      setSavingSnacksNet(false);
    }
  };

  const handleDeleteShiftById = async (shiftId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الشيفت؟ لا يمكن التراجع عن هذه الخطوة.')) return;
    try {
      await shiftsApi.delete(shiftId);
      toast.success('تم حذف الشيفت بنجاح');
      loadData();
    } catch (err) {
      toast.error(err.message || 'حدث خطأ أثناء الحذف', 'فشل الحذف');
    }
  };

  async function handleViewShiftDetails(shift) {
    setSelectedShift(shift);
    setEditingSnacksNet(shift.snacksNet != null ? String(shift.snacksNet) : '0');
    setIsModalOpen(true);
    setLoadingShiftDetails(true);

    try {
      const report = await shiftsApi.getReport(shift.id);
      setShiftReport(report);
      if (report.snacksNet != null) {
        setEditingSnacksNet(String(report.snacksNet));
      }
    } catch (err) {
      toast.error(err.message, 'فشل تحميل تفاصيل الشيفت');
    } finally {
      setLoadingShiftDetails(false);
    }
  }

  const activeShift = shifts.find(s => s.closedAt === null);

  // Revenue breakdown splits
  const totalRev = financialData ? (financialData.totalCafeRevenue + financialData.totalRestaurantRevenue) : 0;
  const cafePct = totalRev > 0 ? ((financialData.totalCafeRevenue / totalRev) * 100).toFixed(1) : 0;
  const restPct = totalRev > 0 ? ((financialData.totalRestaurantRevenue / totalRev) * 100).toFixed(1) : 0;

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (!financialData?.productSales) return [];
    if (!productSearch.trim()) return financialData.productSales;
    return financialData.productSales.filter(p => 
      p.name.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [financialData?.productSales, productSearch]);

  const maxProductQty = financialData?.productSales?.length > 0 
    ? Math.max(...financialData.productSales.map(p => p.quantity)) 
    : 1;

  const maxCategoryRev = financialData?.categorySales?.length > 0
    ? Math.max(...financialData.categorySales.map(c => c.totalRevenue))
    : 1;

  const PAYMENT_NAMES = {
    CASH: 'نقدي (كاش)',
    INSTAPAY: 'إنستاباي / فيزا',
    WALLET: 'محفظة إلكترونية'
  };
  const PAYMENT_COLORS = {
    CASH: 'var(--success)',
    INSTAPAY: '#a78bfa',
    WALLET: '#60a5fa'
  };

  return (
    <div className="page reports-page">
      
      {/* Page Header */}
      <div className="page__header">
        <div>
          <h1 className="page__title">مركز التقارير والإحصائيات 📊</h1>
          <p className="page__subtitle">تحليل وتصفية المبيعات والأرباح وطباعة التقارير الدورية</p>
        </div>
        <div className="page__actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canViewReports && activeTab === 'FINANCIAL' && (
            <>
              <Button 
                variant="primary" 
                rightIcon={<Printer size={15} />} 
                onClick={handlePrintPeriodicReport}
                title="طباعة التقرير الحالي"
              >
                طباعة تقرير الفترة (80mm)
              </Button>
              <Button 
                variant="secondary" 
                rightIcon={<Download size={15} />} 
                onClick={handleExportExcel}
                title="تصدير كشف إكسيل منسق"
              >
                تصدير إكسيل منسق (.xls)
              </Button>
            </>
          )}
          <Button variant="ghost" rightIcon={<RefreshCw size={15} />} onClick={loadData} loading={loading}>
            تحديث
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      {canViewReports && (
        <div className="reports-tabs">
          <button 
            className={`reports-tab-btn ${activeTab === 'FINANCIAL' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('FINANCIAL'); }}
          >
            <TrendingUp size={16} /> تقرير المبيعات والأرباح الشامل
          </button>
          <button 
            className={`reports-tab-btn ${activeTab === 'PAYROLL' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('PAYROLL'); }}
          >
            <DollarSign size={16} /> مسير رواتب الموظفين (أسبوعياً)
          </button>
        </div>
      )}

      {/* Advanced Date Range & Filter Bar */}
      {canViewReports && activeTab === 'FINANCIAL' && (
        <div className="reports-filter-panel animate-fade-in-up">
          
          {/* Top Filter Controls: Mode Switch & Presets */}
          <div className="reports-filter-panel__top">
            <div className="filter-mode-switch">
              <button 
                type="button" 
                className={`filter-mode-btn ${filterMode === 'DATES' ? 'active' : ''}`}
                onClick={() => { sounds.playTap(); setFilterMode('DATES'); }}
              >
                <Calendar size={14} /> تصفية بالفترة والتواريخ
              </button>
              <button 
                type="button" 
                className={`filter-mode-btn ${filterMode === 'SHIFT' ? 'active' : ''}`}
                onClick={() => { 
                  sounds.playTap(); 
                  setFilterMode('SHIFT');
                  if (!selectedFilterShiftId && shifts.length > 0) {
                    setSelectedFilterShiftId(shifts[0].id);
                  }
                }}
              >
                <Clock size={14} /> تصفية بالشيفت
              </button>
            </div>

            {filterMode === 'DATES' && (
              <div className="date-presets">
                <button 
                  type="button" 
                  className={`date-presets__btn ${datePreset === 'TODAY' ? 'date-presets__btn--active' : ''}`}
                  onClick={() => applyDatePreset('TODAY')}
                >
                  اليوم
                </button>
                <button 
                  type="button" 
                  className={`date-presets__btn ${datePreset === 'YESTERDAY' ? 'date-presets__btn--active' : ''}`}
                  onClick={() => applyDatePreset('YESTERDAY')}
                >
                  أمس
                </button>
                <button 
                  type="button" 
                  className={`date-presets__btn ${datePreset === 'WEEK' ? 'date-presets__btn--active' : ''}`}
                  onClick={() => applyDatePreset('WEEK')}
                >
                  آخر 7 أيام
                </button>
                <button 
                  type="button" 
                  className={`date-presets__btn ${datePreset === 'THIS_MONTH' ? 'date-presets__btn--active' : ''}`}
                  onClick={() => applyDatePreset('THIS_MONTH')}
                >
                  هذا الشهر
                </button>
                <button 
                  type="button" 
                  className={`date-presets__btn ${datePreset === 'LAST_MONTH' ? 'date-presets__btn--active' : ''}`}
                  onClick={() => applyDatePreset('LAST_MONTH')}
                >
                  الشهر السابق
                </button>
              </div>
            )}
          </div>

          {/* Bottom Filter Controls: Date Pickers or Shift Select */}
          <div className="reports-filter-panel__bottom">
            {filterMode === 'DATES' ? (
              <div className="custom-date-inputs">
                <div className="date-input-group">
                  <label className="date-input-label">من تاريخ:</label>
                  <input 
                    type="date" 
                    className="custom-date-inputs__control" 
                    value={startDate} 
                    onChange={(e) => {
                      setDatePreset('CUSTOM');
                      setStartDate(e.target.value);
                    }} 
                  />
                </div>
                <div className="date-input-group">
                  <label className="date-input-label">إلى تاريخ:</label>
                  <input 
                    type="date" 
                    className="custom-date-inputs__control" 
                    value={endDate} 
                    onChange={(e) => {
                      setDatePreset('CUSTOM');
                      setEndDate(e.target.value);
                    }} 
                  />
                </div>
                <span className="current-period-tag">
                  ✨ {periodLabel}
                </span>
              </div>
            ) : (
              <div className="shift-select-group">
                <label className="date-input-label">اختر الشيفت:</label>
                <select
                  className="field-select__control shift-select-control"
                  value={selectedFilterShiftId}
                  onChange={(e) => setSelectedFilterShiftId(e.target.value)}
                >
                  {shifts.length === 0 && <option value="">لا توجد شيفتات مسجلة</option>}
                  {shifts.map(shift => (
                    <option key={shift.id} value={shift.id}>
                      شيفت #{String(shift.id).slice(-6)} - {shift.username || 'كاشير'} ({formatDateTime(shift.openedAt)}) {!shift.closedAt ? '🟢 [مفتوح]' : '🔒 [مغلق]'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payroll Filter Bar */}
      {canViewReports && activeTab === 'PAYROLL' && (
        <div className="reports-filter-panel animate-fade-in-up">
          <div className="custom-date-inputs">
            <div className="date-input-group">
              <label className="date-input-label">من تاريخ:</label>
              <input type="date" className="custom-date-inputs__control" value={payrollStartDate} onChange={(e) => setPayrollStartDate(e.target.value)} />
            </div>
            <div className="date-input-group">
              <label className="date-input-label">إلى تاريخ:</label>
              <input type="date" className="custom-date-inputs__control" value={payrollEndDate} onChange={(e) => setPayrollEndDate(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Financial Report Content */}
      {canViewReports && financialData && activeTab === 'FINANCIAL' && (
        <>
          {/* 5 KPI Metric Cards */}
          <div className="reports-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="report-card">
              <div className="report-card__icon-wrap">
                <img src="/images/categories/hot.jpg" className="report-card__photo" alt="مشروبات" />
              </div>
              <div className="report-card__content">
                <div className="report-card__label">إيرادات المشروبات (الكافيه)</div>
                <div className="report-card__value" style={{ color: 'var(--accent)' }}>
                  {formatCurrency(financialData.totalCafeRevenue)}
                </div>
              </div>
            </div>

            <div className="report-card">
              <div className="report-card__icon-wrap">
                <img src="/images/categories/food.jpg" className="report-card__photo" alt="مأكولات" />
              </div>
              <div className="report-card__content">
                <div className="report-card__label">إيرادات المأكولات (المطعم)</div>
                <div className="report-card__value" style={{ color: 'var(--success)' }}>
                  {formatCurrency(financialData.totalRestaurantRevenue)}
                </div>
              </div>
            </div>

            <div className="report-card" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
              <div className="report-card__icon-wrap">
                <img src="/images/categories/snacks.jpg" className="report-card__photo" alt="سناكس" />
              </div>
              <div className="report-card__content">
                <div className="report-card__label" style={{ color: '#c084fc' }}>صافي السناكس والحلويات</div>
                <div className="report-card__value" style={{ color: '#a855f7' }}>
                  {formatCurrency(financialData.totalSnacksNet || 0)}
                </div>
              </div>
            </div>

            <div className="report-card">
              <div className="report-card__icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)' }}>
                <DollarSign size={20} />
              </div>
              <div className="report-card__content">
                <div className="report-card__label">المصاريف والأجور</div>
                <div className="report-card__value" style={{ color: 'var(--danger)' }}>
                  -{formatCurrency(financialData.totalCafeExpenses + financialData.totalRestaurantExpenses + financialData.totalGeneralExpenses + financialData.totalWages)}
                </div>
              </div>
            </div>

            <div className="report-card" style={{ background: financialData.netProfit >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', borderColor: financialData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              <div className="report-card__icon" style={{ backgroundColor: financialData.netProfit >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: financialData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {financialData.netProfit >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              </div>
              <div className="report-card__content">
                <div className="report-card__label">صافي الربح المحقق (Net Profit)</div>
                <div className="report-card__value" style={{ color: financialData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(financialData.netProfit)}
                </div>
              </div>
            </div>
          </div>

          {/* Expenses & Debts Detailed Grid */}
          <div className="section-card" style={{ marginBottom: '1.5rem' }}>
            <h2 className="section-card__title">تفصيل التكاليف والمصاريف والمديونيات خلال الفترة</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <div className="report-mini-card">
                <span className="report-mini-card__label">مصاريف الكافيه</span>
                <strong className="report-mini-card__val" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalCafeExpenses)}</strong>
              </div>
              <div className="report-mini-card">
                <span className="report-mini-card__label">مصاريف المطعم</span>
                <strong className="report-mini-card__val" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalRestaurantExpenses)}</strong>
              </div>
              <div className="report-mini-card">
                <span className="report-mini-card__label">المصاريف العامة</span>
                <strong className="report-mini-card__val" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalGeneralExpenses)}</strong>
              </div>
              <div className="report-mini-card">
                <span className="report-mini-card__label">الرواتب والأجور</span>
                <strong className="report-mini-card__val" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalWages)}</strong>
              </div>
              <div className="report-mini-card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                <span className="report-mini-card__label">مديونيات مستحقة ({financialData.outstandingDebtsCount || 0})</span>
                <strong className="report-mini-card__val" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalOutstandingDebts)}</strong>
              </div>
            </div>

            {/* Split Visualizer */}
            {totalRev > 0 && (
              <div className="revenue-split-bar-container">
                <div className="revenue-split-bar-labels">
                  <span>☕ مشروبات الكافيه ({cafePct}%)</span>
                  <span>🍔 مأكولات المطعم ({restPct}%)</span>
                </div>
                <div className="revenue-split-bar">
                  <div className="revenue-split-bar__cafe" style={{ width: `${cafePct}%` }}></div>
                  <div className="revenue-split-bar__rest" style={{ width: `${restPct}%` }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Visual Analytics & Breakdown */}
          <div className="analytics-grid">
            
            {/* Products Sales Table */}
            <div className="section-card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Award size={18} style={{ color: 'var(--accent)' }} /> تفاصيل مبيعات المنتجات ({filteredProducts.length})
                </h2>
                <div className="table-search-box">
                  <Search size={14} className="table-search-icon" />
                  <input
                    type="text"
                    placeholder="ابحث عن صنف..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="table-search-input"
                  />
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>لا توجد مبيعات مطابقة.</div>
              ) : (
                <div className="data-table-wrap" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                      <tr>
                        <th>الرتبة</th>
                        <th>اسم المنتج</th>
                        <th>الكمية المباعة</th>
                        <th>إجمالي الإيرادات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((prod, idx) => (
                        <tr key={idx}>
                          <td style={{ width: '40px', fontWeight: 'bold', color: idx < 3 ? 'var(--accent)' : 'var(--text-muted)' }}>
                            #{idx + 1}
                          </td>
                          <td style={{ fontWeight: 600 }}>{prod.name}</td>
                          <td>
                            <span className="badge badge--neutral">{prod.quantity} طلب</span>
                          </td>
                          <td className="data-table__number" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                            {formatCurrency(prod.totalRevenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Methods & Category Sales Splits */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Payment Methods */}
              <div className="section-card" style={{ margin: 0 }}>
                <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} style={{ color: 'var(--success)' }} /> تقسيم طرق التحصيل والدفع
                </h2>
                <div className="payment-methods-list">
                  {financialData.paymentMethods?.map((pm) => (
                    <div className="payment-method-card" key={pm.method}>
                      <div className="payment-method-card__color-tag" style={{ backgroundColor: PAYMENT_COLORS[pm.method] || 'var(--accent)' }}></div>
                      <div className="payment-method-card__info">
                        <span className="payment-method-card__name">{PAYMENT_NAMES[pm.method] || pm.method}</span>
                        <span className="payment-method-card__count">{pm.count} عملية دفع</span>
                      </div>
                      <span className="payment-method-card__amount">{formatCurrency(pm.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Category Sales */}
              <div className="section-card" style={{ margin: 0 }}>
                <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} style={{ color: 'var(--info)' }} /> المبيعات حسب الأقسام
                </h2>
                {financialData.categorySales?.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>لا توجد مبيعات.</div>
                ) : (
                  <div className="category-sales-list">
                    {financialData.categorySales?.map((cat, idx) => (
                      <div className="category-sales-item" key={idx}>
                        <div className="category-sales-item__info">
                          <span>{cat.name} ({cat.quantity} طلب)</span>
                          <strong>{formatCurrency(cat.totalRevenue)}</strong>
                        </div>
                        <div className="category-sales-item__bar-wrap">
                          <div
                            className="category-sales-item__bar"
                            style={{ width: `${(cat.totalRevenue / maxCategoryRev) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </>
      )}

      {/* Shifts History Section */}
      {activeTab === 'FINANCIAL' && (
        <div className="section-card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-card__title">سجل الشيفتات واليوميات السابقة</h2>
          <div className="data-table-wrap">
            {loading ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : shifts.length === 0 ? (
              <div className="data-table-empty">لم يتم تسجيل أي شيفت بعد.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>رقم الشيفت</th>
                    <th>وقت الفتح</th>
                    <th>وقت القفل</th>
                    <th>الكاشير</th>
                    <th>صافي السناكس</th>
                    <th>الحالة</th>
                    <th style={{ textAlign: 'left' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="data-table__mono" style={{ fontWeight: 'bold' }}>#{String(shift.id).slice(-6)}</td>
                      <td>{formatDateTime(shift.openedAt)}</td>
                      <td>{shift.closedAt ? formatDateTime(shift.closedAt) : '—'}</td>
                      <td>{shift.username || '—'}</td>
                      <td style={{ color: (shift.snacksNet || 0) > 0 ? '#a855f7' : 'var(--text-muted)', fontWeight: 600 }}>
                        {formatCurrency(shift.snacksNet || 0)}
                      </td>
                      <td>
                        <Badge variant={!shift.closedAt ? 'success' : 'neutral'}>
                          {!shift.closedAt ? '🟢 مفتوح' : '🔒 مغلق'}
                        </Badge>
                      </td>
                      <td>
                        <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            rightIcon={<FileText size={14} />} 
                            onClick={() => setDailyModalShiftId(shift.id)}
                            title="عرض التقرير الشامل والمكتمل للشيفت"
                          >
                            تقرير اليومية 📊
                          </Button>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            rightIcon={<Printer size={14} />} 
                            onClick={async () => {
                              try {
                                toast.info('جاري تجهيز بون الشيفت للطباعة الحرارية...');
                                const rep = await shiftsApi.getReport(shift.id);
                                const html = buildShiftSummaryHtml({ report: rep, cafeName: user?.tenantName });
                                printReceipt(html, printOptionsFor('REPORT', { width: 80 }));
                              } catch (e) {
                                toast.error(e.message, 'فشل طباعة بون الشيفت');
                              }
                            }}
                            title="طباعة بون التقرير الحراري (80mm)"
                          >
                            طباعة 🖨️
                          </Button>
                          {isSupervisor && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteShiftById(shift.id)}
                              title="حذف الشيفت"
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Payroll Section */}
      {activeTab === 'PAYROLL' && canViewReports && (
        <div className="section-card animate-fade-in-up">
          <h2 className="section-card__title">كشف رواتب ومستحقات الموظفين (خلال الفترة المحددة)</h2>
          <div className="data-table-wrap">
            {loading ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : !payrollData || payrollData.length === 0 ? (
              <div className="data-table-empty">لا يوجد موظفين لعرض التقرير.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم الموظف</th>
                    <th>الراتب الأساسي</th>
                    <th>مكافآت (+)</th>
                    <th>خصومات (-)</th>
                    <th>سلف مسحوبة (-)</th>
                    <th>الصافي المستحق</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollData.map((emp) => (
                    <tr key={emp.employeeId}>
                      <td style={{ fontWeight: 'bold' }}>{emp.employeeName}</td>
                      <td>{formatCurrency(emp.baseWeeklySalary)}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>+{formatCurrency(emp.totalBonuses)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(emp.totalDeductions)}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>-{formatCurrency(emp.totalAdvances)}</td>
                      <td style={{ fontWeight: 'bold', color: emp.netPayable < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {formatCurrency(emp.netPayable)}
                      </td>
                      <td>
                        <Badge variant={emp.isSettled ? 'success' : 'neutral'}>
                          {emp.isSettled ? 'تم الصرف' : 'لم يُصرف'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 'bold' }}>
                    <td>الإجمالي العام</td>
                    <td>{formatCurrency(payrollData.reduce((acc, curr) => acc + curr.baseWeeklySalary, 0))}</td>
                    <td style={{ color: 'var(--success)' }}>+{formatCurrency(payrollData.reduce((acc, curr) => acc + curr.totalBonuses, 0))}</td>
                    <td style={{ color: 'var(--danger)' }}>-{formatCurrency(payrollData.reduce((acc, curr) => acc + curr.totalDeductions, 0))}</td>
                    <td style={{ color: 'var(--danger)' }}>-{formatCurrency(payrollData.reduce((acc, curr) => acc + curr.totalAdvances, 0))}</td>
                    <td style={{ color: 'var(--success)', fontSize: '15px' }}>{formatCurrency(payrollData.reduce((acc, curr) => acc + curr.netPayable, 0))}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Shift Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`ملخص الشيفت المالي`}
        size="md"
      >
        {loadingShiftDetails ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner /></div>
        ) : (
          <div className="shift-summary">
            {/* Modal Header */}
            <div className="shift-summary__header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="shift-summary__row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold' }}>رقم الشيفت:</span>
                <span className="data-table__mono" style={{ fontWeight: 'bold', color: 'var(--accent)' }}>#{String(selectedShift?.id).slice(-6)}</span>
              </div>
              <div className="shift-summary__row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>الكاشير:</span>
                <strong>{selectedShift?.username || '—'}</strong>
              </div>
              <div className="shift-summary__row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>حالة الشيفت:</span>
                <Badge variant={!selectedShift?.closedAt ? 'success' : 'neutral'}>
                  {!selectedShift?.closedAt ? 'مفتوح (قيد التشغيل)' : 'مغلق'}
                </Badge>
              </div>
              <div className="shift-summary__row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>تاريخ الفتح:</span>
                <span>{formatDateTime(selectedShift?.openedAt)}</span>
              </div>
              {selectedShift?.closedAt && (
                <div className="shift-summary__row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>تاريخ القفل:</span>
                  <span>{formatDateTime(selectedShift?.closedAt)}</span>
                </div>
              )}
            </div>

            {/* Financial Details */}
            <h4 style={{ margin: '1.25rem 0 0.75rem', color: 'var(--text-primary)', borderRight: '3px solid var(--accent)', paddingRight: '8px', fontSize: '14px' }}>مبيعات الشيفت وإيراداته</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>إجمالي الإيرادات (كل الطرق)</div>
                <strong style={{ fontSize: '16px', color: 'var(--accent)' }}>{formatCurrency(shiftReport?.totalRevenue || 0)}</strong>
              </div>
              <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>العهدة الافتتاحية (البداية)</div>
                <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{formatCurrency(shiftReport?.shift?.openingFloat || selectedShift?.openingFloat || 0)}</strong>
              </div>
            </div>

            {/* Food vs Drinks Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ background: 'rgba(249, 115, 22, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                <div style={{ fontSize: '11px', color: '#fb923c', marginBottom: '4px', fontWeight: '600' }}>
                  🍔 مبيعات المأكولات (المطعم)
                </div>
                <strong style={{ fontSize: '16px', color: '#f97316' }}>{formatCurrency(shiftReport?.foodRevenue || 0)}</strong>
              </div>
              <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                <div style={{ fontSize: '11px', color: '#38bdf8', marginBottom: '4px', fontWeight: '600' }}>
                  ☕ مبيعات المشروبات (الكافيه)
                </div>
                <strong style={{ fontSize: '16px', color: '#06b6d4' }}>{formatCurrency(shiftReport?.buffetRevenue || 0)}</strong>
              </div>
            </div>

            {/* Snacks Net Card with Inline Edit Form */}
            <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '12px', color: '#c084fc', fontWeight: '700' }}>
                  🍿 صافي السناكس اليومي
                </div>
                <strong style={{ fontSize: '16px', color: '#a855f7' }}>
                  {formatCurrency(shiftReport?.snacksNet || selectedShift?.snacksNet || 0)}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="تعديل صافي السناكس..."
                  className="field__input field__wrapper"
                  style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                  value={editingSnacksNet}
                  onChange={(e) => setEditingSnacksNet(e.target.value)}
                />
                <Button variant="primary" size="sm" onClick={handleSaveSnacksNet} loading={savingSnacksNet}>
                  حفظ
                </Button>
              </div>
            </div>

            <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-primary)', fontSize: '12px' }}>تفاصيل مبيعات طرق الدفع</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>💵 نقدي (كاش):</span>
                <strong>{formatCurrency(shiftReport?.totalCash || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>📱 انستاباي:</span>
                <strong>{formatCurrency(shiftReport?.totalInstapay || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>👛 محفظة إلكترونية:</span>
                <strong>{formatCurrency(shiftReport?.totalWallet || 0)}</strong>
              </div>
            </div>

            {/* Shift Close Cash Drawer Verification */}
            {selectedShift?.closedAt && (
              <>
                <h4 style={{ margin: '1.25rem 0 0.5rem', color: 'var(--text-primary)', borderRight: '3px solid var(--accent)', paddingRight: '8px', fontSize: '13px' }}>جرد الدرج وتصفية النقدي</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>النقدي المتوقع بالدرج:</span>
                    <strong>{formatCurrency(shiftReport?.shift?.expectedCash || selectedShift?.expectedCash || 0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>النقدي الفعلي المحصي:</span>
                    <strong>{formatCurrency(shiftReport?.shift?.countedCash || selectedShift?.countedCash || 0)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>الفارق (عجز / زيادة):</span>
                    <Badge variant={(shiftReport?.shift?.variance || selectedShift?.variance || 0) < 0 ? 'danger' : (shiftReport?.shift?.variance || selectedShift?.variance || 0) > 0 ? 'success' : 'neutral'}>
                      {formatCurrency(shiftReport?.shift?.variance || selectedShift?.variance || 0)}
                    </Badge>
                  </div>
                </div>
              </>
            )}

            {/* Modal Actions */}
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', alignItems: 'center' }}>
              <Button variant="secondary" rightIcon={<Printer size={15} />} onClick={() => {
                if (!shiftReport) {
                  toast.warning('جاري تحميل التقرير، يرجى المحاولة بعد لحظات');
                  return;
                }
                const html = buildShiftSummaryHtml({ report: shiftReport, cafeName: selectedShift?.tenantName || user?.tenantName });
                printReceipt(html, printOptionsFor('REPORT', { width: 80 }));
              }}>
                طباعة بون اليومية (80mm)
              </Button>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إغلاق</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Full Ultimate Shift Report Modal for Admin */}
      <DailyReportModal
        isOpen={!!dailyModalShiftId}
        onClose={() => setDailyModalShiftId(null)}
        shiftId={dailyModalShiftId}
        cafeName={user?.tenantName}
      />

    </div>
  );
}
