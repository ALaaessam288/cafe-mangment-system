import { useCallback, useEffect, useState, useMemo } from 'react';
import { 
  Plus, Check, X, Search, Calendar, DollarSign, 
  MinusCircle, PlusCircle, CreditCard, Eye, Trash2, 
  UserCheck, ShieldAlert, Award, FileText, ArrowRight, RefreshCw,
  Printer, RotateCcw, Users, Briefcase, ChevronRight, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { employeesApi } from '../../api/employeesApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printReceipt, buildEmployeeStatementHtml } from '../../utils/printUtils';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import { ROLES } from '../../utils/constants';
import { sounds } from '../../utils/soundEffects';
import './EmployeesPage.css';

const JOB_TITLES = ['شيف', 'ويتر', 'باريستا', 'كاشير', 'مشرف'];
const DEDUCTION_REASONS = ['أكل ومشروبات', 'سلفة عاجلة', 'تأخير عن الشيفت', 'عدم التزام بالزي', 'عجز كاشير / أوردر', 'أخرى'];

export default function EmployeesPage() {
  const toast = useToast();
  const { role, user } = useAuth();
  const isSupervisor = role === ROLES.SUPERVISOR;
  const canSeePayroll = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  const [activeTab, setActiveTab] = useState(canSeePayroll ? 'PAYROLL' : 'EMPLOYEES'); // 'PAYROLL' | 'EMPLOYEES'
  
  // Employees state
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [empSortBy, setEmpSortBy] = useState('NAME_ASC');
  const [empFilterActive, setEmpFilterActive] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  
  // Employee Form Modal state
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [employeeModalMode, setEmployeeModalMode] = useState('CREATE');
  const [employeeForm, setEmployeeForm] = useState({ id: null, name: '', jobTitle: '', baseSalary: '', salaryPeriod: 'WEEKLY', active: true });
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [jobTitleCustom, setJobTitleCustom] = useState(false);

  // Payroll state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payrollSummaries, setPayrollSummaries] = useState([]);
  const [loadingPayroll, setLoadingPayroll] = useState(true);

  // Transaction Modal (Deduction / Advance / Bonus)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState({
    employeeId: null,
    employeeName: '',
    type: 'DEDUCTION', // 'DEDUCTION' | 'ADVANCE' | 'BONUS'
    amount: '',
    notes: '',
    transactionDate: new Date().toISOString().split('T')[0],
    paidFromDrawer: true
  });
  const [savingTx, setSavingTx] = useState(false);

  // View Log Modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedLogEmp, setSelectedLogEmp] = useState(null);
  const [empLogTxs, setEmpLogTxs] = useState([]);
  const [loadingLog, setLoadingLog] = useState(false);

  // Pay Salary Modal
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    employeeId: null,
    employeeName: '',
    netPayable: 0,
    paidFromDrawer: true
  });
  const [savingPayout, setSavingPayout] = useState(false);

  // Reset Week Modal
  const [isResetWeekModalOpen, setIsResetWeekModalOpen] = useState(false);
  const [resettingWeek, setResettingWeek] = useState(false);

  // Load Employees List
  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const data = await employeesApi.findAll();
      setEmployees(data || []);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل قائمة الموظفين');
    } finally {
      setLoadingEmployees(false);
    }
  }, [toast]);

  // Load Payroll Summary
  const loadPayrollSummary = useCallback(async () => {
    if (!canSeePayroll) { setLoadingPayroll(false); return; }
    setLoadingPayroll(true);
    try {
      const data = await employeesApi.getPayrollSummary(startDate, endDate);
      setPayrollSummaries(data || []);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل حسابات القبض الأسبوعي');
    } finally {
      setLoadingPayroll(false);
    }
  }, [startDate, endDate, toast, canSeePayroll]);

  useEffect(() => {
    loadEmployees();
    loadPayrollSummary();
  }, [loadEmployees, loadPayrollSummary]);

  // Handle Date Presets
  const setDatePreset = (preset) => {
    sounds.playTap();
    const today = new Date();
    if (preset === 'THIS_WEEK') {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'LAST_WEEK') {
      const end = new Date(today);
      end.setDate(today.getDate() - 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (preset === 'THIS_MONTH') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  // Employee Modal Handlers
  function openCreateEmployeeModal() {
    sounds.playTap();
    setEmployeeModalMode('CREATE');
    setEmployeeForm({ id: null, name: '', jobTitle: '', baseSalary: '', salaryPeriod: 'WEEKLY', active: true });
    setJobTitleCustom(false);
    setIsEmployeeModalOpen(true);
  }

  function openEditEmployeeModal(emp) {
    sounds.playTap();
    setEmployeeModalMode('EDIT');
    setEmployeeForm({ ...emp });
    setJobTitleCustom(Boolean(emp.jobTitle && !JOB_TITLES.includes(emp.jobTitle)));
    setIsEmployeeModalOpen(true);
  }

  async function handleEmployeeSubmit(e) {
    e.preventDefault();
    if (!employeeForm.name.trim()) {
      toast.error('الرجاء كتابة اسم الموظف');
      return;
    }
    setSavingEmployee(true);
    try {
      if (employeeModalMode === 'CREATE') {
        await employeesApi.create(employeeForm);
        toast.success(`تم إضافة الموظف "${employeeForm.name}" بنجاح 👤`);
      } else {
        await employeesApi.update(employeeForm.id, employeeForm);
        toast.success(`تم تحديث بيانات الموظف "${employeeForm.name}" بنجاح ✨`);
      }
      setIsEmployeeModalOpen(false);
      loadEmployees();
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل حفظ الموظف');
    } finally {
      setSavingEmployee(false);
    }
  }

  async function handleToggleActive(emp) {
    sounds.playTap();
    try {
      const updated = { ...emp, active: !emp.active };
      await employeesApi.update(emp.id, updated);
      toast.success(`تم ${!emp.active ? 'تفعيل' : 'تعطيل'} حساب الموظف ${emp.name}`);
      loadEmployees();
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل تغيير حالة الموظف');
    }
  }

  async function handleDeleteEmployee(id, name) {
    if (!window.confirm(`هل أنت متأكد من مسح الموظف "${name}" نهائياً من النظام؟`)) return;
    try {
      await employeesApi.delete(id);
      toast.success(`تم مسح الموظف "${name}" بنجاح`);
      loadEmployees();
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل مسح الموظف');
    }
  }

  // Open Log Transaction Modal
  function openTxModal(emp, defaultType = 'DEDUCTION') {
    sounds.playTap();
    setTxForm({
      employeeId: emp.employeeId || emp.id,
      employeeName: emp.employeeName || emp.name,
      type: defaultType,
      amount: '',
      notes: '',
      transactionDate: new Date().toISOString().split('T')[0],
      paidFromDrawer: true
    });
    setIsTxModalOpen(true);
  }

  // Save Transaction (Deduction, Advance, Bonus)
  async function handleSaveTx(e) {
    e.preventDefault();
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    setSavingTx(true);
    try {
      await employeesApi.createTransaction({
        employeeId: txForm.employeeId,
        type: txForm.type,
        amount: parseFloat(txForm.amount),
        notes: txForm.notes,
        transactionDate: txForm.transactionDate,
        paidFromDrawer: txForm.paidFromDrawer
      });

      const labels = {
        DEDUCTION: 'خصم',
        ADVANCE: 'سُلفة',
        BONUS: 'مكافأة/بونص'
      };
      toast.success(`تم تسجيل ${labels[txForm.type]} بقيمة ${formatCurrency(txForm.amount)} للموظف ${txForm.employeeName} بنجاح`);
      setIsTxModalOpen(false);
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل تسجيل العملية');
    } finally {
      setSavingTx(false);
    }
  }

  // Open View Log Modal
  async function openLogModal(emp) {
    sounds.playTap();
    setSelectedLogEmp(emp);
    setIsLogModalOpen(true);
    setLoadingLog(true);
    try {
      const txs = await employeesApi.getTransactions(emp.employeeId || emp.id);
      setEmpLogTxs(txs || []);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل سجل الحركات');
    } finally {
      setLoadingLog(false);
    }
  }

  // Delete Individual Transaction
  async function handleDeleteTransaction(txId) {
    if (!window.confirm('هل أنت متأكد من حذف هذه العملية من سجل الموظف؟')) return;
    try {
      await employeesApi.deleteTransaction(txId);
      toast.success('تم حذف العملية بنجاح');
      if (selectedLogEmp) {
        const txs = await employeesApi.getTransactions(selectedLogEmp.employeeId || selectedLogEmp.id);
        setEmpLogTxs(txs || []);
      }
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل حذف العملية');
    }
  }

  // Print Employee Statement
  function handlePrintEmployee(emp) {
    sounds.playTap();
    const html = buildEmployeeStatementHtml(emp, user?.tenantName, { startDate, endDate });
    printReceipt(html, false);
  }

  // Print Full Team Payroll
  function handlePrintTeamPayroll() {
    sounds.playTap();
    const rows = payrollSummaries.map((s, idx) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 4px; text-align: right;">${idx + 1}. ${s.employeeName}</td>
        <td style="padding: 6px 4px; text-align: center;">${s.jobTitle || '—'}</td>
        <td style="padding: 6px 4px; text-align: center;">${formatCurrency(s.baseWeeklySalary)}</td>
        <td style="padding: 6px 4px; text-align: center; color: #10b981;">+${formatCurrency(s.totalBonuses)}</td>
        <td style="padding: 6px 4px; text-align: center; color: #ef4444;">-${formatCurrency(s.totalDeductions)}</td>
        <td style="padding: 6px 4px; text-align: center; color: #f59e0b;">-${formatCurrency(s.totalAdvances)}</td>
        <td style="padding: 6px 4px; text-align: left; font-weight: bold;">${formatCurrency(s.netPayable)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; direction: rtl; padding: 20px; color: #111;">
        <div style="text-align: center; border-bottom: 2px dashed #333; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="margin: 0 0 6px;">${user?.tenantName || 'كافيو POS'}</h2>
          <h3 style="margin: 0 0 4px; color: #444;">كشف مسير رواتب الموظفين</h3>
          <p style="margin: 0; font-size: 12px; color: #666;">الفترة من: <strong>${startDate}</strong> إلى: <strong>${endDate}</strong></p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #999;">
              <th style="padding: 8px 4px; text-align: right;">الموظف</th>
              <th style="padding: 8px 4px; text-align: center;">الوظيفة</th>
              <th style="padding: 8px 4px; text-align: center;">الأساسي</th>
              <th style="padding: 8px 4px; text-align: center;">بونص</th>
              <th style="padding: 8px 4px; text-align: center;">خصم</th>
              <th style="padding: 8px 4px; text-align: center;">سُلف</th>
              <th style="padding: 8px 4px; text-align: left;">صافي القبض</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="border-top: 2px solid #333; padding-top: 10px; font-size: 13px; font-weight: bold; display: flex; justify-content: space-between;">
          <span>إجمالي المستحق للصرف:</span>
          <span>${formatCurrency(payrollTotals.net)}</span>
        </div>

        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
          <div>توقيع المشرف المسؤول: .......................</div>
          <div>توقيع إدارة المنشأة: .......................</div>
        </div>
      </div>
    `;

    printReceipt(html, false);
  }

  // Open Pay Salary Modal
  function openPayoutModal(emp) {
    sounds.playTap();
    setPayoutForm({
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      netPayable: emp.netPayable,
      paidFromDrawer: true
    });
    setIsPayoutModalOpen(true);
  }

  // Submit Payout
  async function handlePayoutSubmit(e) {
    e.preventDefault();
    setSavingPayout(true);
    try {
      await employeesApi.payWeeklySalary(payoutForm.employeeId, {
        amount: payoutForm.netPayable,
        date: new Date().toISOString().split('T')[0],
        paidFromDrawer: payoutForm.paidFromDrawer
      });
      toast.success(`تم تسديد راتب الموظف "${payoutForm.employeeName}" بمبلغ ${formatCurrency(payoutForm.netPayable)} بنجاح 💵`);
      setIsPayoutModalOpen(false);
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل تسديد الراتب');
    } finally {
      setSavingPayout(false);
    }
  }

  // Handle Reset Week
  const handleResetWeek = async () => {
    setResettingWeek(true);
    try {
      const res = await employeesApi.resetWeek({ date: new Date().toISOString().split('T')[0] });
      toast.success(res.message || 'تمت تصفية حسابات الأسبوع وبدء دورة أسبوعية جديدة بنجاح 🎉');
      setIsResetWeekModalOpen(false);
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل تصفية الأسبوع');
    } finally {
      setResettingWeek(false);
    }
  };

  // Total KPIs
  const payrollTotals = useMemo(() => {
    let base = 0, bonus = 0, ded = 0, adv = 0, net = 0;
    payrollSummaries.forEach(s => {
      base += s.baseWeeklySalary || 0;
      bonus += s.totalBonuses || 0;
      ded += s.totalDeductions || 0;
      adv += s.totalAdvances || 0;
      net += s.netPayable || 0;
    });
    return { base, bonus, ded, adv, net };
  }, [payrollSummaries]);

  // Filter + Sort Employees
  const filteredEmployees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const result = employees.filter((emp) => {
      const matchesSearch = !q ||
        emp.name.toLowerCase().includes(q) ||
        (emp.jobTitle && emp.jobTitle.toLowerCase().includes(q));
      const matchesActive =
        empFilterActive === 'ALL' ? true :
        empFilterActive === 'ACTIVE' ? emp.active :
        !emp.active;
      return matchesSearch && matchesActive;
    });

    return [...result].sort((a, b) => {
      switch (empSortBy) {
        case 'NAME_DESC':
          return (b.name || '').localeCompare(a.name || '', 'ar');
        case 'SALARY_ASC':
          return (a.baseSalary || 0) - (b.baseSalary || 0);
        case 'SALARY_DESC':
          return (b.baseSalary || 0) - (a.baseSalary || 0);
        case 'HIRE_DATE_NEWEST':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'HIRE_DATE_OLDEST':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'NAME_ASC':
        default:
          return (a.name || '').localeCompare(b.name || '', 'ar');
      }
    });
  }, [employees, searchTerm, empFilterActive, empSortBy]);

  return (
    <div className="page employees-page">
      <ObserverBanner />

      {/* ── 3D Glassmorphic Header ── */}
      <div className="page__header employees-header">
        <div className="employees-header__info">
          <div className="employees-header__icon-box">
            <Users size={24} className="text-accent" />
          </div>
          <div>
            <div className="employees-header__title-row">
              <h1 className="page__title">شؤون الموظفين والرواتب</h1>
              <span className="employees-count-badge">{employees.length} موظف</span>
            </div>
            <p className="page__subtitle">إدارة فريق العمل، حسابات الرواتب الأسبوعية، السُلف، الخصومات، وصرف المستحقات</p>
          </div>
        </div>

        <div className="page__actions employees-header__actions">
          {canSeePayroll && (
            <Button
              variant="outline"
              leftIcon={<Printer size={16} />}
              onClick={handlePrintTeamPayroll}
              title="طباعة كشف مسير الرواتب لجميع الموظفين"
            >
              طباعة كشف الرواتب
            </Button>
          )}
          {isSupervisor && canSeePayroll && activeTab === 'PAYROLL' && (
            <Button
              variant="danger"
              leftIcon={<RotateCcw size={16} />}
              onClick={() => { sounds.playTap(); setIsResetWeekModalOpen(true); }}
              className="btn-reset-week"
              title="تصفية مستحقات وحسابات الأسبوع وبدء أسبوع جديد"
            >
              بدء أسبوع جديد وتصفية الحسابات 🔄
            </Button>
          )}
          {isSupervisor && (
            <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openCreateEmployeeModal}>
              إضافة موظف جديد
            </Button>
          )}
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="payroll-tabs-bar">
        {canSeePayroll && (
          <button
            type="button"
            className={`payroll-tab ${activeTab === 'PAYROLL' ? 'payroll-tab--active' : ''}`}
            onClick={() => { sounds.playTap(); setActiveTab('PAYROLL'); }}
          >
            <Calendar size={18} />
            <span>شيت القبض والحساب الأسبوعي</span>
          </button>
        )}
        <button 
          type="button"
          className={`payroll-tab ${activeTab === 'EMPLOYEES' ? 'payroll-tab--active' : ''}`}
          onClick={() => { sounds.playTap(); setActiveTab('EMPLOYEES'); }}
        >
          <UserCheck size={18} />
          <span>فريق العمل والرواتب الأساسية ({employees.length})</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════
          TAB 1: WEEKLY PAYROLL SHEET
         ═══════════════════════════════════════ */}
      {activeTab === 'PAYROLL' && canSeePayroll && (
        <div className="payroll-tab-content animate-fade-in">
          {/* Week Selector Filter Bar */}
          <div className="payroll-filter-card">
            <div className="date-picker-group">
              <div className="date-field">
                <label>من تاريخ:</label>
                <input 
                  type="date" 
                  className="payroll-date-input" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div className="date-field">
                <label>إلى تاريخ:</label>
                <input 
                  type="date" 
                  className="payroll-date-input" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
              <button 
                type="button"
                className="btn-refresh-payroll"
                onClick={() => { sounds.playTap(); loadPayrollSummary(); }}
                title="تحديث البيانات"
              >
                <RefreshCw size={14} />
                <span>تحديث</span>
              </button>
            </div>

            <div className="preset-buttons">
              <button type="button" className="btn-preset" onClick={() => setDatePreset('THIS_WEEK')}>الأسبوع الحالي</button>
              <button type="button" className="btn-preset" onClick={() => setDatePreset('LAST_WEEK')}>الأسبوع الماضي</button>
              <button type="button" className="btn-preset" onClick={() => setDatePreset('THIS_MONTH')}>الشهر الحالي</button>
            </div>
          </div>

          {/* Payroll KPI Summary Cards Strip */}
          <div className="payroll-kpi-grid">
            <div className="kpi-box kpi-box--base">
              <span className="kpi-box__label">إجمالي الراتب الأساسي</span>
              <strong className="kpi-box__val">{formatCurrency(payrollTotals.base)}</strong>
            </div>
            <div className="kpi-box kpi-box--bonus">
              <span className="kpi-box__label">إجمالي المكافآت/البونص</span>
              <strong className="kpi-box__val">+{formatCurrency(payrollTotals.bonus)}</strong>
            </div>
            <div className="kpi-box kpi-box--deduction">
              <span className="kpi-box__label">إجمالي الخصومات</span>
              <strong className="kpi-box__val">-{formatCurrency(payrollTotals.ded)}</strong>
            </div>
            <div className="kpi-box kpi-box--advance">
              <span className="kpi-box__label">إجمالي السُلف المسحوبة</span>
              <strong className="kpi-box__val">-{formatCurrency(payrollTotals.adv)}</strong>
            </div>
            <div className="kpi-box kpi-box--net">
              <span className="kpi-box__label">صافي القبض المستحق للجميع</span>
              <strong className="kpi-box__val">{formatCurrency(payrollTotals.net)}</strong>
            </div>
          </div>

          {/* Weekly Payroll Data Table */}
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            {loadingPayroll ? (
              <div className="data-table-empty"><Spinner size="lg" /></div>
            ) : payrollSummaries.length === 0 ? (
              <div className="data-table-empty">لا توجد بيانات رواتب متوفرة لهذه الفترة. قم بتحديد تاريخ مختلف أو إضافة موظفين.</div>
            ) : (
              <table className="data-table payroll-table">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الوظيفة</th>
                    <th>الراتب الأساسي</th>
                    <th>+ بونص / مكافأة</th>
                    <th>- الخصومات</th>
                    <th>- السُلف المسحوبة</th>
                    <th>صافي القبض المستحق</th>
                    <th>حالة التسديد</th>
                    <th className="text-center">إجراءات وعمليات</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollSummaries.map((emp) => (
                    <tr key={emp.employeeId}>
                      <td>
                        <div className="emp-table-cell-name">
                          <div className="emp-avatar-sm">
                            {emp.employeeName?.[0] || '👤'}
                          </div>
                          <strong>{emp.employeeName}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="emp-role-tag">{emp.jobTitle || '—'}</span>
                      </td>
                      <td>{formatCurrency(emp.baseWeeklySalary)}</td>
                      <td className="text-success fw-medium">
                        {emp.totalBonuses > 0 ? `+${formatCurrency(emp.totalBonuses)}` : '0 ج.م'}
                      </td>
                      <td className="text-danger fw-medium">
                        {emp.totalDeductions > 0 ? `-${formatCurrency(emp.totalDeductions)}` : '0 ج.م'}
                      </td>
                      <td className="text-warning fw-medium">
                        {emp.totalAdvances > 0 ? `-${formatCurrency(emp.totalAdvances)}` : '0 ج.م'}
                      </td>
                      <td className="net-payable-cell">
                        <strong>{formatCurrency(emp.netPayable)}</strong>
                      </td>
                      <td>
                        {emp.isSettled ? (
                          <Badge variant="success">تم التسديد 🟢</Badge>
                        ) : (
                          <Badge variant="warning">مستحق للقبض ⏳</Badge>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="payroll-actions-row">
                          {/* Quick add Deduction / Bonus / Advance */}
                          <button 
                            type="button"
                            className="btn-action-chip btn-action-chip--danger"
                            title="إضافة خصم"
                            onClick={() => openTxModal(emp, 'DEDUCTION')}
                          >
                            <MinusCircle size={13} />
                            <span>خصم</span>
                          </button>

                          <button 
                            type="button"
                            className="btn-action-chip btn-action-chip--warning"
                            title="إضافة سُلفة"
                            onClick={() => openTxModal(emp, 'ADVANCE')}
                          >
                            <CreditCard size={13} />
                            <span>سُلفة</span>
                          </button>

                          <button 
                            type="button"
                            className="btn-action-chip btn-action-chip--success"
                            title="إضافة بونص / مكافأة"
                            onClick={() => openTxModal(emp, 'BONUS')}
                          >
                            <Award size={13} />
                            <span>بونص</span>
                          </button>

                          {/* View Log */}
                          <button 
                            type="button"
                            className="btn-action-icon"
                            title="عرض تفاصيل الحركات والخصومات"
                            onClick={() => openLogModal(emp)}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Print Employee Statement */}
                          <button 
                            type="button"
                            className="btn-action-icon"
                            title="طباعة كشف حساب وراتب الموظف"
                            onClick={() => handlePrintEmployee(emp)}
                            style={{ color: 'var(--accent)' }}
                          >
                            <Printer size={15} />
                          </button>

                          {/* Pay Weekly Salary */}
                          {isSupervisor && (
                            <button 
                              type="button"
                              className="btn-action-chip btn-action-chip--primary"
                              title="صرف وتصفية القبض الأسبوعي"
                              onClick={() => openPayoutModal(emp)}
                              disabled={emp.isSettled || emp.netPayable <= 0}
                            >
                              <DollarSign size={13} />
                              <span>تسديد القبض</span>
                            </button>
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

      {/* ═══════════════════════════════════════
          TAB 2: EMPLOYEES & STAFF ROSTER
         ═══════════════════════════════════════ */}
      {activeTab === 'EMPLOYEES' && (
        <div className="payroll-tab-content animate-fade-in">
          {/* Filters Bar */}
          <div className="page-filters employees-filter-bar">
            <Input
              placeholder="ابحث باسم الموظف أو المسمى الوظيفي..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} />}
              className="page-filters__search"
            />
            <div className="field-select">
              <select
                className="field-select__control"
                value={empFilterActive}
                onChange={(e) => setEmpFilterActive(e.target.value)}
              >
                <option value="ALL">كل الحالات ({employees.length})</option>
                <option value="ACTIVE">نشط فقط</option>
                <option value="INACTIVE">موقوف فقط</option>
              </select>
            </div>
            <div className="field-select">
              <select
                className="field-select__control"
                value={empSortBy}
                onChange={(e) => setEmpSortBy(e.target.value)}
                title="الترتيب"
              >
                <option value="NAME_ASC">الاسم (أ-ي)</option>
                <option value="NAME_DESC">الاسم (ي-أ)</option>
                <option value="SALARY_DESC">الراتب (الأعلى أولاً)</option>
                <option value="SALARY_ASC">الراتب (الأقل أولاً)</option>
                <option value="HIRE_DATE_NEWEST">الأحدث تعييناً</option>
                <option value="HIRE_DATE_OLDEST">الأقدم تعييناً</option>
              </select>
            </div>
          </div>

          {/* Employees Data Table */}
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            {loadingEmployees ? (
              <div className="data-table-empty"><Spinner size="lg" /></div>
            ) : filteredEmployees.length === 0 ? (
              <div className="data-table-empty">لا يوجد موظفون مسجلون أو مطابقون للبحث الحالي.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم الكامل</th>
                    <th>المسمى الوظيفي</th>
                    <th>الراتب الأساسي والدورية</th>
                    <th>تاريخ الإضافة</th>
                    <th>الحالة</th>
                    <th style={{ textAlign: 'left' }}>العمليات والإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className={!emp.active ? 'inactive-row' : ''}>
                      <td>
                        <div className="emp-table-cell-name">
                          <div className="emp-avatar-sm">
                            {emp.name?.[0] || '👤'}
                          </div>
                          <strong>{emp.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="emp-role-tag">{emp.jobTitle || '—'}</span>
                      </td>
                      <td className="fw-bold text-accent">
                        {formatCurrency(emp.baseSalary)}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginInlineStart: '6px' }}>
                          / {emp.salaryPeriod === 'DAILY' ? 'يومي' : emp.salaryPeriod === 'MONTHLY' ? 'شهري' : 'أسبوعي'}
                        </span>
                      </td>
                      <td>{formatDateTime(emp.createdAt)}</td>
                      <td>
                        <Badge variant={emp.active ? 'success' : 'neutral'}>
                          {emp.active ? 'نشط' : 'موقوف'}
                        </Badge>
                      </td>
                      <td>
                        <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            rightIcon={<MinusCircle size={14} />} 
                            onClick={() => openTxModal(emp, 'DEDUCTION')}
                            title="تسجيل خصم / سلفة / بونص للموظف"
                          >
                            خصم / بونص
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            rightIcon={<FileText size={14} />} 
                            onClick={() => openLogModal(emp)}
                            title="عرض سجل حركات الموظف"
                          >
                            السجل
                          </Button>
                          {isSupervisor && (
                            <>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => openEditEmployeeModal(emp)}
                              >
                                تعديل
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleToggleActive(emp)}
                                style={{ color: emp.active ? 'var(--danger)' : 'var(--success)' }}
                              >
                                {emp.active ? 'تعطيل' : 'تفعيل'}
                              </Button>
                              <Button 
                                variant="danger" 
                                size="sm" 
                                onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                              >
                                مسح
                              </Button>
                            </>
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

      {/* ── Employee Add/Edit Modal ── */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => !savingEmployee && setIsEmployeeModalOpen(false)}
        title={employeeModalMode === 'CREATE' ? 'إضافة موظف جديد' : 'تعديل بيانات موظف'}
        icon={employeeModalMode === 'CREATE' ? '👤' : '✏️'}
        subtitle={employeeModalMode === 'CREATE' ? 'إضافة موظف جديد وتحديد المسمى الوظيفي ونظام الراتب' : `تعديل بيانات وراتب الموظف: ${employeeForm.name}`}
        size="md"
      >
        <form onSubmit={handleEmployeeSubmit} className="form-stack">
          <Input
            label="اسم الموظف الكامل"
            name="name"
            placeholder="مثال: أحمد محمد علي"
            value={employeeForm.name}
            onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
            required
            autoFocus
          />
          <div className="form-group">
            <label className="form-label">المسمى الوظيفي</label>
            <select
              className="input"
              value={jobTitleCustom ? '__CUSTOM__' : (employeeForm.jobTitle || '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__CUSTOM__') {
                  setJobTitleCustom(true);
                } else {
                  setJobTitleCustom(false);
                  setEmployeeForm({ ...employeeForm, jobTitle: val });
                }
              }}
            >
              <option value="">-- اختر الوظيفة --</option>
              {JOB_TITLES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="__CUSTOM__">أخرى (اكتب يدوياً)</option>
            </select>
          </div>

          {jobTitleCustom && (
            <Input
              label="المسمى الوظيفي (مخصص)"
              name="jobTitle"
              value={employeeForm.jobTitle || ''}
              onChange={(e) => setEmployeeForm({ ...employeeForm, jobTitle: e.target.value })}
              placeholder="اكتب المسمى الوظيفي"
              autoFocus
            />
          )}

          <div className="form-group">
            <label className="form-label">دورية احتساب الراتب</label>
            <select
              className="input"
              value={employeeForm.salaryPeriod || 'WEEKLY'}
              onChange={(e) => setEmployeeForm({ ...employeeForm, salaryPeriod: e.target.value })}
            >
              <option value="DAILY">يومي (اليومية)</option>
              <option value="WEEKLY">أسبوعي</option>
              <option value="MONTHLY">شهري</option>
            </select>
          </div>

          <Input
            label={
              employeeForm.salaryPeriod === 'DAILY' 
                ? 'قيمة اليومية (ج.م)' 
                : employeeForm.salaryPeriod === 'MONTHLY' 
                  ? 'قيمة الراتب الشهري الأساسي (ج.م)' 
                  : 'قيمة الراتب الأسبوعي الأساسي (ج.م)'
            }
            name="baseSalary"
            type="number"
            min="0"
            step="0.5"
            placeholder="0.00"
            value={employeeForm.baseSalary}
            onChange={(e) => setEmployeeForm({ ...employeeForm, baseSalary: parseFloat(e.target.value) || 0 })}
            required
          />

          <label className="checkbox-label" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="active"
              checked={employeeForm.active}
              onChange={(e) => setEmployeeForm({ ...employeeForm, active: e.target.checked })}
            />
            نشط (متاح في كشوفات الرواتب)
          </label>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setIsEmployeeModalOpen(false)} disabled={savingEmployee}>إلغاء</Button>
            <Button type="submit" variant="primary" loading={savingEmployee}>حفظ الموظف</Button>
          </div>
        </form>
      </Modal>

      {/* ── Transaction Modal (Deduction, Advance, Bonus) ── */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => !savingTx && setIsTxModalOpen(false)}
        title={
          txForm.type === 'DEDUCTION' ? `تسجيل خصم للموظف: ${txForm.employeeName}` :
          txForm.type === 'ADVANCE' ? `تسجيل سُلفة للموظف: ${txForm.employeeName}` :
          `تسجيل مكافأة / بونص للموظف: ${txForm.employeeName}`
        }
        icon={txForm.type === 'DEDUCTION' ? '🔻' : txForm.type === 'ADVANCE' ? '💳' : '🎁'}
        subtitle="سيتم احتساب هذه الحركة تلقائياً في شيت تصفية القبض الأسبوعي للموظف"
        size="md"
      >
        <form onSubmit={handleSaveTx} className="form-stack">
          <div className="form-group">
            <label className="form-label">نوع الحركة</label>
            <div className="tx-type-selector-pills">
              <button
                type="button"
                className={`tx-type-pill ${txForm.type === 'DEDUCTION' ? 'tx-type-pill--deduction-active' : ''}`}
                onClick={() => setTxForm({ ...txForm, type: 'DEDUCTION' })}
              >
                <MinusCircle size={15} />
                <span>خصم مالي</span>
              </button>
              <button
                type="button"
                className={`tx-type-pill ${txForm.type === 'ADVANCE' ? 'tx-type-pill--advance-active' : ''}`}
                onClick={() => setTxForm({ ...txForm, type: 'ADVANCE' })}
              >
                <CreditCard size={15} />
                <span>سُلفة نقدية</span>
              </button>
              <button
                type="button"
                className={`tx-type-pill ${txForm.type === 'BONUS' ? 'tx-type-pill--bonus-active' : ''}`}
                onClick={() => setTxForm({ ...txForm, type: 'BONUS' })}
              >
                <Award size={15} />
                <span>بونص / مكافأة</span>
              </button>
            </div>
          </div>

          <Input
            label="المبلغ (ج.م)"
            type="number"
            min="0.5"
            step="0.5"
            placeholder="0.00"
            value={txForm.amount}
            onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
            required
            autoFocus
          />

          {txForm.type === 'DEDUCTION' && (
            <div className="form-group">
              <label className="form-label">سبب الخصم (سريع)</label>
              <div className="quick-reasons-row">
                {DEDUCTION_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`quick-reason-btn ${txForm.notes === r ? 'quick-reason-btn--active' : ''}`}
                    onClick={() => setTxForm({ ...txForm, notes: r })}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input
            label="ملاحظات وتفاصيل إضافية"
            placeholder="اكتب سبب العملية بالتفصيل..."
            value={txForm.notes}
            onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
          />

          <Input
            label="تاريخ العملية"
            type="date"
            value={txForm.transactionDate}
            onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
            required
          />

          {(txForm.type === 'ADVANCE') && (
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={txForm.paidFromDrawer}
                onChange={(e) => setTxForm({ ...txForm, paidFromDrawer: e.target.checked })}
              />
              خصم مبلغ السلفة من درج النقدية للوردية الحالية
            </label>
          )}

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setIsTxModalOpen(false)} disabled={savingTx}>إلغاء</Button>
            <Button type="submit" variant="primary" loading={savingTx}>تأكيد وحفظ</Button>
          </div>
        </form>
      </Modal>

      {/* ── View Log Statement Modal ── */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title={`سجل حركات وخصومات: ${selectedLogEmp?.employeeName || selectedLogEmp?.name || ''}`}
        icon="📜"
        subtitle="عرض كافة الخصومات، السُلف، والمكافآت المسجلة لهذا الموظف"
        size="lg"
      >
        <div className="log-modal-content">
          {loadingLog ? (
            <div className="text-center py-5"><Spinner size="lg" /></div>
          ) : empLogTxs.length === 0 ? (
            <div className="text-center py-5 text-muted">لا توجد حركات مسجلة لهذا الموظف حتى الآن.</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>النوع</th>
                    <th>المبلغ</th>
                    <th>البيان / السبب</th>
                    <th>المسؤول</th>
                    {isSupervisor && <th style={{ textAlign: 'left' }}>إجراء</th>}
                  </tr>
                </thead>
                <tbody>
                  {empLogTxs.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.transactionDate}</td>
                      <td>
                        {tx.type === 'DEDUCTION' && <Badge variant="danger">خصم 🔻</Badge>}
                        {tx.type === 'ADVANCE' && <Badge variant="warning">سُلفة 💳</Badge>}
                        {tx.type === 'BONUS' && <Badge variant="success">بونص 🎁</Badge>}
                        {tx.type === 'PAYROLL_PAYOUT' && <Badge variant="primary">صرف راتب 💵</Badge>}
                      </td>
                      <td className="fw-bold">{formatCurrency(tx.amount)}</td>
                      <td>{tx.notes || '—'}</td>
                      <td>{tx.recordedByName || 'النظام'}</td>
                      {isSupervisor && (
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDeleteTransaction(tx.id)}
                              title="حذف هذه العملية"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setIsLogModalOpen(false)}>إغلاق</Button>
          </div>
        </div>
      </Modal>

      {/* ── Pay Weekly Salary Modal ── */}
      <Modal
        isOpen={isPayoutModalOpen}
        onClose={() => !savingPayout && setIsPayoutModalOpen(false)}
        title={`تسديد وصرف راتب: ${payoutForm.employeeName}`}
        icon="💵"
        subtitle="صرف صافي القبض المستحق للأسبوع الحالي وإقفال المستحقات"
        size="md"
      >
        <form onSubmit={handlePayoutSubmit} className="form-stack">
          <div className="payout-summary-card">
            <span className="payout-label">صافي الراتب المستحق للصرف:</span>
            <strong className="payout-amount">{formatCurrency(payoutForm.netPayable)}</strong>
          </div>

          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '10px' }}>
            <input
              type="checkbox"
              checked={payoutForm.paidFromDrawer}
              onChange={(e) => setPayoutForm({ ...payoutForm, paidFromDrawer: e.target.checked })}
            />
            تسجيل الصرف من درج الكاشير للوردية الحالية
          </label>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setIsPayoutModalOpen(false)} disabled={savingPayout}>إلغاء</Button>
            <Button type="submit" variant="primary" loading={savingPayout}>تأكيد الصرف والتسديد</Button>
          </div>
        </form>
      </Modal>

      {/* ── Reset Week Modal ── */}
      <Modal
        isOpen={isResetWeekModalOpen}
        onClose={() => !resettingWeek && setIsResetWeekModalOpen(false)}
        title="تصفية حسابات الأسبوع وبدء أسبوع جديد 🔄"
        icon="⚠️"
        subtitle="إغلاق مستحقات وخصومات الأسبوع الحالي وبدء دورة قبض جديدة"
        size="md"
      >
        <div className="reset-week-body">
          <div className="reset-alert-box">
            <AlertTriangle size={24} className="text-warning" />
            <p>
              هذا الإجراء سيقوم باعتماد كافة الرواتب والخصومات والسُلف المسجلة في الفترة الحالية كـ <strong>"مسددة"</strong> وبدء أسبوع جديد من الصفر لجميع الموظفين.
            </p>
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setIsResetWeekModalOpen(false)} disabled={resettingWeek}>
              تراجع
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={resettingWeek}
              onClick={handleResetWeek}
              style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#fff' }}
            >
              تأكيد بدء الأسبوع الجديد
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
