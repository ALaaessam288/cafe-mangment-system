import { useCallback, useEffect, useState, useMemo } from 'react';
import { 
  Calendar, DollarSign, Clock, RefreshCw, Printer, Award, 
  CreditCard, ShoppingBag, Trash2, Download,
  TrendingUp, TrendingDown, Layers, Search,
  FileText, BarChart2, Activity
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
  const [bestSellers, setBestSellers] = useState([]);
  const [hourlySales, setHourlySales] = useState([]);
  const [recipeData, setRecipeData] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [simulatorRawId, setSimulatorRawId] = useState('');
  const [simulatorGrams, setSimulatorGrams] = useState('250');
  const [simulatorCostPerKg, setSimulatorCostPerKg] = useState('400');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
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

        // Load recipe profitability data
        try {
          const recData = await reportsApi.getRecipeProfitability(params);
          setRecipeData(recData);
          if (recData?.rawMaterials?.length > 0 && !simulatorRawId) {
            setSimulatorRawId(String(recData.rawMaterials[0].id));
            if (recData.rawMaterials[0].costPer1000Units > 0) {
              setSimulatorCostPerKg(String(recData.rawMaterials[0].costPer1000Units));
            }
          }
        } catch (e) {
          console.error('Failed to load recipe profitability', e);
        }
      }
    } catch (err) {
      toast.error(err.message, 'فشل تحميل بيانات التقارير');
    } finally {
      setLoading(false);
    }
  }, [toast, canViewReports, filterMode, selectedFilterShiftId, startDate, endDate, payrollStartDate, payrollEndDate, simulatorRawId]);

  const loadRecipeData = useCallback(async () => {
    if (!canViewReports) return;
    setRecipeLoading(true);
    try {
      let params = {};
      if (filterMode === 'SHIFT' && selectedFilterShiftId) {
        params.shiftId = selectedFilterShiftId;
      } else if (filterMode === 'DATES') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      const data = await reportsApi.getRecipeProfitability(params);
      setRecipeData(data);
      if (data?.rawMaterials?.length > 0 && !simulatorRawId) {
        setSimulatorRawId(String(data.rawMaterials[0].id));
      }
    } catch (err) {
      toast.error(err.message, 'فشل تحميل تقرير ربحية الوصفات');
    } finally {
      setRecipeLoading(false);
    }
  }, [canViewReports, filterMode, selectedFilterShiftId, startDate, endDate, simulatorRawId, toast]);

  const loadAnalytics = useCallback(async () => {
    if (!canViewReports) return;
    setAnalyticsLoading(true);
    try {
      let params = {};
      if (filterMode === 'DATES') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      const [bs, hs] = await Promise.all([
        reportsApi.getBestSellers(params),
        reportsApi.getHourlySales(params)
      ]);
      setBestSellers(bs || []);
      setHourlySales(hs || []);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل التحليلات');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [canViewReports, filterMode, startDate, endDate, toast]);

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
  const totalGrossRevenue = financialData
    ? (financialData.totalCafeRevenue || 0) + (financialData.totalRestaurantRevenue || 0) + (financialData.totalSnacksNet || 0)
    : 0;
  const totalOperatingCosts = financialData
    ? (financialData.totalCafeExpenses || 0) + (financialData.totalRestaurantExpenses || 0) + (financialData.totalGeneralExpenses || 0) + (financialData.totalWages || 0)
    : 0;
  const profitMargin = totalGrossRevenue > 0 ? ((financialData?.netProfit || 0) / totalGrossRevenue) * 100 : 0;
  const soldItemsCount = financialData?.productSales?.reduce((sum, product) => sum + (product.quantity || 0), 0) || 0;

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
      <div className="page__header reports-page-header">
        <div className="reports-page-header__identity">
          <span className="reports-page-header__icon"><BarChart2 size={21} /></span>
          <div>
            <span className="reports-page-header__eyebrow">CAFFIO BUSINESS INTELLIGENCE</span>
            <h1 className="page__title">مركز التقارير والتحليل</h1>
            <p className="page__subtitle">حوّل حركة التشغيل والمبيعات إلى قرارات واضحة وقابلة للتنفيذ</p>
          </div>
        </div>
        <div className="page__actions reports-page-header__actions">
          {canViewReports && activeTab === 'FINANCIAL' && (
            <>
              <Button 
                variant="primary" 
                rightIcon={<Printer size={15} />} 
                onClick={handlePrintPeriodicReport}
                title="طباعة التقرير الحالي"
              >
                طباعة
              </Button>
              <Button 
                variant="secondary" 
                rightIcon={<Download size={15} />} 
                onClick={handleExportExcel}
                title="تصدير كشف إكسيل منسق"
              >
                تصدير Excel
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
        <nav className="reports-tabs" aria-label="أنواع التقارير">
          <button 
            className={`reports-tab-btn ${activeTab === 'FINANCIAL' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('FINANCIAL'); }}
          >
            <span className="reports-tab-btn__icon"><TrendingUp size={16} /></span>
            <span><strong>الأداء المالي</strong><small>المبيعات، المصاريف والربح</small></span>
          </button>
          <button 
            className={`reports-tab-btn ${activeTab === 'PAYROLL' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('PAYROLL'); }}
          >
            <span className="reports-tab-btn__icon"><DollarSign size={16} /></span>
            <span><strong>الرواتب</strong><small>مستحقات وحركة الفريق</small></span>
          </button>
          <button
            className={`reports-tab-btn ${activeTab === 'BESTSELLERS' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('BESTSELLERS'); loadAnalytics(); }}
          >
            <span className="reports-tab-btn__icon"><BarChart2 size={16} /></span>
            <span><strong>الأصناف</strong><small>الأكثر مبيعاً وتأثيراً</small></span>
          </button>
          <button
            className={`reports-tab-btn ${activeTab === 'HOURLY' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('HOURLY'); loadAnalytics(); }}
          >
            <span className="reports-tab-btn__icon"><Activity size={16} /></span>
            <span><strong>ساعات الذروة</strong><small>توزيع الحركة بالساعة</small></span>
          </button>
          <button
            className={`reports-tab-btn ${activeTab === 'RECIPES' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('RECIPES'); loadRecipeData(); }}
          >
            <span className="reports-tab-btn__icon"><Layers size={16} /></span>
            <span><strong>ربحية الوصفات</strong><small>التكلفة والهامش والخامات</small></span>
          </button>
        </nav>
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

      {/* Executive reading of the selected period */}
      {canViewReports && financialData && activeTab === 'FINANCIAL' && (
        <section className="reports-executive-strip" aria-label="الملخص التنفيذي للفترة">
          <div className="reports-executive-strip__intro">
            <span className="reports-executive-strip__live"><span /> ملخص الفترة</span>
            <strong>{periodLabel}</strong>
            <small>آخر تحديث {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</small>
          </div>
          <div className="reports-executive-metric is-revenue">
            <span>إجمالي الإيراد</span><strong>{formatCurrency(totalGrossRevenue)}</strong><small>{soldItemsCount} وحدة مباعة</small>
          </div>
          <div className="reports-executive-metric is-cost">
            <span>تكلفة التشغيل</span><strong>{formatCurrency(totalOperatingCosts)}</strong><small>{totalGrossRevenue > 0 ? `${((totalOperatingCosts / totalGrossRevenue) * 100).toFixed(1)}% من الإيراد` : 'لا توجد حركة'}</small>
          </div>
          <div className={`reports-executive-metric ${profitMargin >= 0 ? 'is-profit' : 'is-loss'}`}>
            <span>هامش صافي الربح</span><strong>{profitMargin.toFixed(1)}%</strong><small>{formatCurrency(financialData.netProfit)}</small>
          </div>
          <div className="reports-executive-verdict">
            {profitMargin >= 20 ? <TrendingUp size={19} /> : <Activity size={19} />}
            <div><span>قراءة كافيو</span><strong>{profitMargin >= 20 ? 'هامش صحي للفترة' : profitMargin >= 0 ? 'الهامش يحتاج متابعة' : 'التكاليف تتجاوز الإيراد'}</strong></div>
          </div>
        </section>
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

      {/* ── BEST SELLERS TAB ── */}
      {canViewReports && activeTab === 'BESTSELLERS' && (
        <div className="animate-fade-in-up" style={{ padding: '0 1rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={20} /> الأصناف الأكثر مبيعاً
            </h3>
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={loadAnalytics} loading={analyticsLoading}>
              تحديث
            </Button>
          </div>

          {analyticsLoading ? (
            <div className="data-table-empty"><Spinner /></div>
          ) : bestSellers.length === 0 ? (
            <div className="data-table-empty">لا توجد بيانات — جرّب تغيير نطاق التاريخ وأعد التحديث.</div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الصنف</th>
                    <th>الكمية المباعة</th>
                    <th>إجمالي الإيراد</th>
                    <th>نسبة من الكل</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const totalQty = bestSellers.reduce((s, r) => s + r.totalQuantity, 0);
                    const maxRev = Math.max(...bestSellers.map(r => Number(r.totalRevenue) || 0), 1);
                    return bestSellers.map((row, idx) => {
                      const pct = totalQty > 0 ? Math.round((row.totalQuantity / totalQty) * 100) : 0;
                      const barW = Math.round(((Number(row.totalRevenue) || 0) / maxRev) * 100);
                      return (
                        <tr key={idx}>
                          <td style={{ color: idx < 3 ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: idx < 3 ? 'bold' : 'normal' }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{row.productName}</td>
                          <td className="data-table__number">{row.totalQuantity.toLocaleString()}</td>
                          <td className="data-table__number" style={{ color: 'var(--success)' }}>
                            {formatCurrency(row.totalRevenue)}
                          </td>
                          <td style={{ minWidth: '160px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                <div style={{ width: `${barW}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '32px' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── HOURLY HEATMAP TAB ── */}
      {canViewReports && activeTab === 'HOURLY' && (
        <div className="animate-fade-in-up" style={{ padding: '0 1rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} /> خريطة المبيعات بالساعة
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>(توقيت القاهرة UTC+2)</span>
            </h3>
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={loadAnalytics} loading={analyticsLoading}>
              تحديث
            </Button>
          </div>

          {analyticsLoading ? (
            <div className="data-table-empty"><Spinner /></div>
          ) : hourlySales.length === 0 ? (
            <div className="data-table-empty">لا توجد بيانات — جرّب تغيير نطاق التاريخ وأعد التحديث.</div>
          ) : (
            (() => {
              // Build a full 0-23 grid, offsetting +2 for Cairo
              const map = {};
              hourlySales.forEach(s => { map[(s.hour + 2) % 24] = s; });
              const maxRev = Math.max(...hourlySales.map(s => Number(s.revenue) || 0), 1);
              const hours = Array.from({ length: 24 }, (_, h) => {
                const cairoH = h;
                const slot = map[cairoH] || { orderCount: 0, revenue: 0 };
                return { hour: cairoH, ...slot };
              });
              return (
                <div>
                  {/* Bar chart */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '6px', marginBottom: '1rem' }}>
                    {hours.map(s => {
                      const rev = Number(s.revenue) || 0;
                      const heightPct = Math.round((rev / maxRev) * 100);
                      const ampm = s.hour < 12 ? 'ص' : 'م';
                      const label = `${s.hour === 0 ? 12 : s.hour > 12 ? s.hour - 12 : s.hour}${ampm}`;
                      return (
                        <div key={s.hour} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                            {s.orderCount > 0 ? s.orderCount : ''}
                          </div>
                          <div style={{ width: '100%', height: '80px', background: 'var(--bg-secondary)', borderRadius: '4px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                            <div style={{
                              width: '100%',
                              height: `${heightPct}%`,
                              background: heightPct > 70 ? 'var(--danger)' : heightPct > 40 ? 'var(--accent)' : heightPct > 10 ? '#3b82f6' : 'var(--bg-tertiary, #333)',
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.4s ease'
                            }} />
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Table */}
                  <div className="data-table-wrap" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الساعة (القاهرة)</th>
                          <th>عدد الطلبات</th>
                          <th>الإيراد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hours.filter(s => s.orderCount > 0).sort((a, b) => b.revenue - a.revenue).map(s => {
                          const ampm = s.hour < 12 ? 'صباحاً' : 'مساءً';
                          const h12 = s.hour === 0 ? 12 : s.hour > 12 ? s.hour - 12 : s.hour;
                          return (
                            <tr key={s.hour}>
                              <td style={{ fontWeight: 'bold' }}>{`${h12}:00 ${ampm}`}</td>
                              <td className="data-table__number">{s.orderCount}</td>
                              <td className="data-table__number" style={{ color: 'var(--success)' }}>{formatCurrency(s.revenue)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* ── RECIPE PROFITABILITY & YIELD TAB ── */}
      {canViewReports && activeTab === 'RECIPES' && (
        <div className="animate-fade-in-up" style={{ padding: '0 1rem 1.5rem' }}>
          
          {/* Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem' }}>
                <Layers size={22} /> تحليل ربحية الوصفات والمواد الخام ☕
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                حساب إنتاجية الخامات (بالجرامات) وتكلفة الفنجان وصافي الأرباح المتوقعة والفعلية — {periodLabel}
              </p>
            </div>
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={loadRecipeData} loading={recipeLoading}>
              تحديث البيانات
            </Button>
          </div>

          {recipeLoading ? (
            <div className="data-table-empty"><Spinner /></div>
          ) : !recipeData || recipeData.rawMaterials?.length === 0 ? (
            <div className="data-table-empty" style={{ padding: '3rem 1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>☕</div>
              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>لم يتم العثور على خامات أو وصفات مسجلة</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                يمكنك ربط المنتجات بالمواد الخام من شاشة المنتجات والمخزون للاستفادة من تقارير الربحية الدقيقة.
              </p>
            </div>
          ) : (
            <div>
              {/* Top 4 KPI Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '1.5rem' }}>
                <div className="report-kpi-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>💰 مبيعات الوصفات في الفترة</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                    {formatCurrency(recipeData.totalRecipeRevenue || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>إجمالي الإيراد من الأصناف المعتمدة على خامات</div>
                </div>

                <div className="report-kpi-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>📦 تكلفة الخامات المستهلكة</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ef4444' }}>
                    {formatCurrency(recipeData.totalRecipeCost || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>تكلفة المواد الخام المنصرفة في المبيعات</div>
                </div>

                <div className="report-kpi-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>🚀 صافي أرباح الوصفات المحققة</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--success)' }}>
                    {formatCurrency(recipeData.totalRecipeGrossProfit || 0)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>الأرباح المتبقية بعد خصم تكلفة الخامات</div>
                </div>

                <div className="report-kpi-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>🎯 متوسط هامش الربح الإجمالي</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#38bdf8' }}>
                    {(recipeData.averageProfitMarginPercent || 0).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>نسبة العائد الصافي من إجمالي سعر البيع</div>
                </div>
              </div>

              {/* 🧮 Interactive Yield & Profit Simulator */}
              {(() => {
                const currentRaw = recipeData.rawMaterials.find(r => String(r.id) === String(simulatorRawId)) || recipeData.rawMaterials[0];
                const grams = parseFloat(simulatorGrams) || 0;
                const costKg = parseFloat(simulatorCostPerKg) || (currentRaw ? currentRaw.costPer1000Units : 400);
                const costGram = costKg / 1000.0;
                const batchCost = grams * costGram;

                const rawProducts = currentRaw?.products || [];

                return (
                  <div style={{
                    background: 'linear-gradient(145deg, rgba(245, 158, 11, 0.06), rgba(16, 185, 129, 0.04))',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '2rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '26px' }}>🧮</span>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                            محاكي وحاسبة أرباح الخامات والوصفات (Yield & Profit Simulator)
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            اكتب كمية الخامة بالجرام وسعر الكيلو لتعرف فوراً عدد الفناجين المنتجة، الإيراد المتوقع، وصافي الأرباح
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Simulator Inputs Bar */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '16px'
                    }}>
                      {/* Select Raw Material */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                          اختر المادة الخام:
                        </label>
                        <select
                          className="field-select__control"
                          value={currentRaw?.id || ''}
                          onChange={(e) => {
                            setSimulatorRawId(e.target.value);
                            const found = recipeData.rawMaterials.find(r => String(r.id) === e.target.value);
                            if (found && found.costPer1000Units > 0) {
                              setSimulatorCostPerKg(String(found.costPer1000Units));
                            }
                          }}
                          style={{ width: '100%', height: '42px' }}
                        >
                          {recipeData.rawMaterials.map(rm => (
                            <option key={rm.id} value={rm.id}>
                              {rm.name} (المخزون: {rm.currentStock} {rm.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Input Weight / Grams */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                          الوزن / الكمية ({currentRaw?.unit || 'جرام'}):
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="input"
                          value={simulatorGrams}
                          onChange={(e) => setSimulatorGrams(e.target.value)}
                          placeholder="مثلاً 250"
                          style={{ width: '100%', height: '42px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}
                        />
                        {/* Quick Presets */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          {[100, 250, 500, 1000].map(amt => (
                            <button
                              key={amt}
                              type="button"
                              style={{
                                flex: 1,
                                padding: '4px 6px',
                                fontSize: '11px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: parseFloat(simulatorGrams) === amt ? 'var(--accent)' : 'var(--bg-secondary)',
                                color: parseFloat(simulatorGrams) === amt ? '#000' : 'var(--text-primary)',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                              onClick={() => setSimulatorGrams(String(amt))}
                            >
                              {amt} ج
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Input Cost per Kg */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                          سعر شراء الكيلو (ج.م / 1000 {currentRaw?.unit || 'جرام'}):
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="10"
                          className="input"
                          value={simulatorCostPerKg}
                          onChange={(e) => setSimulatorCostPerKg(e.target.value)}
                          placeholder="مثلاً 400"
                          style={{ width: '100%', height: '42px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}
                        />
                        {/* Cost Presets */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          {[300, 400, 500, 600].map(c => (
                            <button
                              key={c}
                              type="button"
                              style={{
                                flex: 1,
                                padding: '4px 6px',
                                fontSize: '11px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: parseFloat(simulatorCostPerKg) === c ? 'var(--accent)' : 'var(--bg-secondary)',
                                color: parseFloat(simulatorCostPerKg) === c ? '#000' : 'var(--text-primary)',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                              onClick={() => setSimulatorCostPerKg(String(c))}
                            >
                              {c} ج
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Simulation Cards for Each Recipe Product */}
                    <div style={{ marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      📊 العائد والأرباح المتوقعة لـ <span style={{ color: 'var(--accent)' }}>{grams} {currentRaw?.unit || 'جرام'}</span> {currentRaw?.name} (تكلفة الشراء الإجمالية: <span style={{ color: '#ef4444' }}>{formatCurrency(batchCost)}</span>):
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                      {rawProducts.map(prod => {
                        const deduction = prod.deductionQuantity || 10;
                        const yieldCups = Math.floor((grams / deduction) * 10) / 10;
                        const expectedRev = yieldCups * prod.sellingPrice;
                        const prodCostPerCup = deduction * costGram;
                        const prodProfitPerCup = prod.sellingPrice - prodCostPerCup;
                        const totalProfit = expectedRev - batchCost;
                        const marginPct = prod.sellingPrice > 0 ? (prodProfitPerCup / prod.sellingPrice) * 100 : 0;

                        return (
                          <div
                            key={prod.productId}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              borderRadius: '12px',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                                  ☕ {prod.productName}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  الاستهلاك: <strong>{deduction} {currentRaw?.unit || 'جرام'}</strong> / فنجان • سعر البيع: <strong>{formatCurrency(prod.sellingPrice)}</strong>
                                </div>
                              </div>
                              <Badge variant="success" style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                                هامش {marginPct.toFixed(0)}%
                              </Badge>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>☕ الإنتاجية الصافية:</span>
                                <strong style={{ fontSize: '1.1rem', color: 'var(--accent)' }}>{yieldCups} فنجان</strong>
                              </div>

                              <div style={{ background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>💵 إجمالي الإيراد:</span>
                                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{formatCurrency(expectedRev)}</strong>
                              </div>
                            </div>

                            <div style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>🚀 صافي الربح من الـ {grams} جرام:</span>
                                <strong style={{ fontSize: '1.2rem', color: 'var(--success)' }}>{formatCurrency(totalProfit)}</strong>
                              </div>
                              <div style={{ textAlign: 'left', fontSize: '0.8rem' }}>
                                <div style={{ color: 'var(--text-secondary)' }}>الربح لكل فنجان:</div>
                                <strong style={{ color: 'var(--success)' }}>+{formatCurrency(prodProfitPerCup)}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 📋 All Recipe Products Profitability Table */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', marginTop: '1.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} /> جدول أرباح ومبيعات كافة الوصفات ({recipeData.recipes?.length || 0} صنف)
                </h4>
              </div>

              <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right' }}>الصنف</th>
                      <th>المادة الخام</th>
                      <th>معيار الفنجان</th>
                      <th>سعر البيع</th>
                      <th>تكلفة الفنجان</th>
                      <th>صافي ربح الفنجان</th>
                      <th>هامش الربح</th>
                      <th>إنتاجية 250 جرام</th>
                      <th>إيراد 250 جرام</th>
                      <th>المبيعات الفعلية</th>
                      <th>الخام المستهلك</th>
                      <th>صافي الربح الفعلي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeData.recipes.map((item) => (
                      <tr key={item.productId}>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                          <div>{item.productName}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.categoryName}</span>
                        </td>
                        <td>
                          <Badge variant="neutral">{item.rawMaterialName}</Badge>
                        </td>
                        <td className="data-table__number">
                          <strong>{item.deductionQuantity}</strong> {item.rawMaterialUnit}
                        </td>
                        <td className="data-table__number" style={{ fontWeight: 'bold' }}>
                          {formatCurrency(item.sellingPrice)}
                        </td>
                        <td className="data-table__number" style={{ color: '#ef4444' }}>
                          {formatCurrency(item.costPerUnitSold)}
                        </td>
                        <td className="data-table__number" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                          +{formatCurrency(item.profitPerUnitSold)}
                        </td>
                        <td className="data-table__number">
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            background: item.profitMarginPercent >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: item.profitMarginPercent >= 70 ? '#10b981' : '#f59e0b'
                          }}>
                            {item.profitMarginPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="data-table__number" style={{ color: 'var(--accent)' }}>
                          {item.yieldPer250Units} فنجان
                        </td>
                        <td className="data-table__number" style={{ fontWeight: 'bold' }}>
                          {formatCurrency(item.revenuePer250Units)}
                        </td>
                        <td className="data-table__number" style={{ fontWeight: 'bold' }}>
                          {item.actualQuantitySold > 0 ? (
                            <span style={{ color: 'var(--accent)' }}>{item.actualQuantitySold} وحدة</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>0</span>
                          )}
                        </td>
                        <td className="data-table__number" style={{ color: 'var(--text-secondary)' }}>
                          {(item.actualQuantitySold * item.deductionQuantity).toFixed(1)} {item.rawMaterialUnit}
                        </td>
                        <td className="data-table__number" style={{ color: item.actualProfit > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>
                          {item.actualProfit > 0 ? `+${formatCurrency(item.actualProfit)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
