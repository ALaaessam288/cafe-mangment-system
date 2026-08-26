import { useCallback, useEffect, useState, useMemo } from 'react';
import { 
  Plus, Check, X, Search, Calendar, DollarSign, 
  MinusCircle, PlusCircle, CreditCard, Eye, Trash2, 
  UserCheck, ShieldAlert, Award, FileText, ArrowRight, RefreshCw,
  Printer, RotateCcw
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
import './EmployeesPage.css';

const JOB_TITLES = ['شيف', 'ويتر', 'باريستا', 'كاشير', 'مشرف'];
const DEDUCTION_REASONS = ['أكل', 'سلفة', 'تأخير', 'عدم التزام', 'عجز أوردر'];

export default function EmployeesPage() {
  const toast = useToast();
  const { role } = useAuth();
  const isSupervisor = role === ROLES.SUPERVISOR;
  // The weekly payroll sheet is admin/supervisor only server-side
  // (GET /employees/payroll/summary). Cashiers still get the staff list and can
  // record a payout, which the backend allows - so we just hide the sheet
  // instead of hiding the whole module from them.
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
  const [employeeForm, setEmployeeForm] = useState({ id: null, name: '', jobTitle: '', baseSalary: 0, active: true });
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
    setEmployeeModalMode('CREATE');
    setEmployeeForm({ id: null, name: '', jobTitle: '', baseSalary: 0, salaryPeriod: 'WEEKLY', active: true });
    setJobTitleCustom(false);
    setIsEmployeeModalOpen(true);
  }

  function openEditEmployeeModal(emp) {
    setEmployeeModalMode('EDIT');
    setEmployeeForm({ ...emp });
    setJobTitleCustom(!!emp.jobTitle && !JOB_TITLES.includes(emp.jobTitle));
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
        toast.success('تم إضافة الموظف بنجاح');
      } else {
        await employeesApi.update(employeeForm.id, employeeForm);
        toast.success('تم تحديث بيانات الموظف بنجاح');
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

  async function handleDeleteEmployee(id) {
    if (!window.confirm('هل أنت تأكد من مسح هذا الموظف؟')) return;
    try {
      await employeesApi.delete(id);
      toast.success('تم مسح الموظف بنجاح');
      loadEmployees();
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل المسح');
    }
  }

  // Open Log Transaction Modal
  function openTxModal(emp, defaultType = 'DEDUCTION') {
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
        BONUS: 'بونص/مكافأة'
      };
      toast.success(`تم تسجيل ${labels[txForm.type]} للموظف ${txForm.employeeName} بنجاح`);
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

  // Delete Transaction Item
  async function handleDeleteTxItem(txId) {
    if (!window.confirm('هل أنت تأكد من حذف هذه الحركة؟')) return;
    try {
      await employeesApi.deleteTransaction(txId);
      toast.success('تم حذف الحركة بنجاح');
      setEmpLogTxs(prev => prev.filter(t => t.id !== txId));
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل الحذف');
    }
  }

  // Open Payout Modal
  function openPayoutModal(empSummary) {
    setPayoutForm({
      employeeId: empSummary.employeeId,
      employeeName: empSummary.employeeName,
      netPayable: empSummary.netPayable,
      paidFromDrawer: true
    });
    setIsPayoutModalOpen(true);
  }

  // Submit Salary Payout
  async function handlePayoutSubmit(e) {
    e.preventDefault();
    setSavingPayout(true);
    try {
      await employeesApi.payWeeklySalary(payoutForm.employeeId, {
        amount: payoutForm.netPayable,
        paidFromDrawer: payoutForm.paidFromDrawer,
        date: new Date().toISOString().split('T')[0]
      });
      toast.success(`تم تسجيل صرف وتسديد القبض الأسبوعي للموظف ${payoutForm.employeeName} بنجاح`);
      setIsPayoutModalOpen(false);
      loadPayrollSummary();
    } catch (err) {
      toast.error(err.message, 'فشل عملية تسديد القبض');
    } finally {
      setSavingPayout(false);
    }
  }

  // Print Individual Employee Statement
  const handlePrintEmployee = async (empSummary) => {
    try {
      let txs = empSummary.transactions;
      if (!txs || txs.length === 0) {
        txs = await employeesApi.getTransactions(empSummary.employeeId || empSummary.id);
      }
      const html = buildEmployeeStatementHtml({
        employeeName: empSummary.employeeName || empSummary.name,
        jobTitle: empSummary.jobTitle,
        baseSalary: empSummary.baseWeeklySalary || empSummary.baseSalary,
        summary: empSummary,
        transactions: txs,
        startDate,
        endDate,
        cafeName: 'الكافيه'
      });
      printReceipt(html, { width: 80 });
      toast.success(`جاري طباعة كشف حساب الموظف ${empSummary.employeeName || empSummary.name}`);
    } catch (err) {
      toast.error(err.message, 'فشل إنشاء أمر الطباعة');
    }
  };

  // Print Full Team Payroll
  const handlePrintTeamPayroll = () => {
    if (!payrollSummaries || payrollSummaries.length === 0) {
      toast.warning('لا توجد بيانات رواتب متاحة للطباعة');
      return;
    }
    window.print();
  };

  // Confirm Reset Week
  const handleResetWeekConfirm = async () => {
    setResettingWeek(true);
    try {
      const res = await employeesApi.resetWeek({ date: endDate });
      toast.success(`تم تصفية وبدء أسبوع جديد بنجاح! تم ترحيل ${res.settledCount || 0} حركة.`);
      setIsResetWeekModalOpen(false);
      setDatePreset('THIS_WEEK');
      loadPayrollSummary();
      loadEmployees();
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
      {/* Page Header */}
      <div className="page__header">
        <div>
          <h1 className="page__title">رواتب وقبض الموظفين الأسبوعي</h1>
          <p className="page__subtitle">متابعة حسابات الرواتب الأسبوعية، الخصومات، السُلف والمكافآت وتصفية القبض</p>
        </div>
        <div className="page__actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canSeePayroll && activeTab === 'PAYROLL' && (
            <>
              <Button
                variant="outline"
                leftIcon={<Printer size={16} />}
                onClick={handlePrintTeamPayroll}
                title="طباعة كشف مسير الرواتب لجميع الموظفين"
              >
                طباعة كشف الرواتب
              </Button>
              {isSupervisor && (
                <Button
                  variant="danger"
                  leftIcon={<RotateCcw size={16} />}
                  onClick={() => setIsResetWeekModalOpen(true)}
                  style={{ background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#fff' }}
                  title="تصفية مستحقات وحسابات الأسبوع وبدء أسبوع جديد"
                >
                  بدء أسبوع جديد وتصفية الحسابات 🔄
                </Button>
              )}
            </>
          )}
          {isSupervisor && (
            <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openCreateEmployeeModal}>
              إضافة موظف جديد
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="payroll-tabs-bar">
        {canSeePayroll && (
          <button
            className={`payroll-tab ${activeTab === 'PAYROLL' ? 'payroll-tab--active' : ''}`}
            onClick={() => setActiveTab('PAYROLL')}
          >
            <Calendar size={18} />
            <span>شيت القبض والحساب الأسبوعي</span>
          </button>
        )}
        <button 
          className={`payroll-tab ${activeTab === 'EMPLOYEES' ? 'payroll-tab--active' : ''}`}
          onClick={() => setActiveTab('EMPLOYEES')}
        >
          <UserCheck size={18} />
          <span>قائمة الموظفين والراتب الأساسي</span>
        </button>
      </div>

      {/* TAB 1: WEEKLY PAYROLL SHEET */}
      {activeTab === 'PAYROLL' && canSeePayroll && (
        <div className="payroll-tab-content animate-fade-in">
          {/* Week Selector Bar */}
          <div className="payroll-filter-card">
            <div className="date-picker-group">
              <div className="date-field">
                <label>من تاريخ:</label>
                <input 
                  type="date" 
                  className="input" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                />
              </div>
              <div className="date-field">
                <label>إلى تاريخ:</label>
                <input 
                  type="date" 
                  className="input" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                />
              </div>
              <Button 
                variant="outline" 
                size="sm"
                leftIcon={<RefreshCw size={14} />}
                onClick={loadPayrollSummary}
              >
                تحديث
              </Button>
            </div>

            <div className="preset-buttons">
              <button className="btn-preset" onClick={() => setDatePreset('THIS_WEEK')}>الأسبوع الحالي</button>
              <button className="btn-preset" onClick={() => setDatePreset('LAST_WEEK')}>الأسبوع الماضي</button>
              <button className="btn-preset" onClick={() => setDatePreset('THIS_MONTH')}>الشهر الحالي</button>
            </div>
          </div>

          {/* Payroll KPI Totals Bar */}
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

          {/* Weekly Payroll Table */}
          <div className="data-table-wrap">
            {loadingPayroll ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : payrollSummaries.length === 0 ? (
              <div className="data-table-empty">مفيش بيانات رواتب متوفرة لهذه الفترة. قم بتحديد تاريخ مختلف أو إضافة موظفين.</div>
            ) : (
              <table className="data-table payroll-table">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الوظيفة</th>
                    <th>الراتب الأسبوعي</th>
                    <th>+ بونص / مكافأة</th>
                    <th>- الخصومات</th>
                    <th>- السُلف المسحوبة</th>
                    <th>صافي القبض المستحق</th>
                    <th>حالة التسديد</th>
                    <th className="text-center">إجراءات الحساب</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollSummaries.map((emp) => (
                    <tr key={emp.employeeId}>
                      <td className="fw-bold">{emp.employeeName}</td>
                      <td className="text-muted">{emp.jobTitle || '—'}</td>
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
                            className="btn-action-chip btn-action-chip--danger"
                            title="إضافة خصم"
                            onClick={() => openTxModal(emp, 'DEDUCTION')}
                          >
                            <MinusCircle size={14} />
                            <span>خصم</span>
                          </button>

                          <button 
                            className="btn-action-chip btn-action-chip--warning"
                            title="إضافة سُلفة"
                            onClick={() => openTxModal(emp, 'ADVANCE')}
                          >
                            <CreditCard size={14} />
                            <span>سُلفة</span>
                          </button>

                          <button 
                            className="btn-action-chip btn-action-chip--success"
                            title="إضافة بونص / مكافأة"
                            onClick={() => openTxModal(emp, 'BONUS')}
                          >
                            <Award size={14} />
                            <span>بونص</span>
                          </button>

                          {/* View Log */}
                          <button 
                            className="btn-action-icon"
                            title="عرض تفاصيل الحركات والخصومات"
                            onClick={() => openLogModal(emp)}
                          >
                            <Eye size={15} />
                          </button>

                          {/* Print Employee Statement */}
                          <button 
                            className="btn-action-icon"
                            title="طباعة كشف حساب وراتب الموظف"
                            onClick={() => handlePrintEmployee(emp)}
                            style={{ color: 'var(--accent)' }}
                          >
                            <Printer size={15} />
                          </button>

                          {/* Pay Weekly Salary */}
                          <button 
                            className="btn-action-chip btn-action-chip--primary"
                            title="صرف وتصفية القبض الأسبوعي"
                            onClick={() => openPayoutModal(emp)}
                            disabled={emp.isSettled || emp.netPayable <= 0}
                          >
                            <DollarSign size={14} />
                            <span>تسديد القبض</span>
                          </button>
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

      {/* TAB 2: EMPLOYEES LIST */}
      {activeTab === 'EMPLOYEES' && (
        <div className="payroll-tab-content animate-fade-in">
          <div className="page-filters">
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
                <option value="ALL">كل الحالات</option>
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

          <div className="data-table-wrap">
            {loadingEmployees ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : filteredEmployees.length === 0 ? (
              <div className="data-table-empty">مفيش موظفين متسجلين أو مطابقين للبحث.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم الكامل</th>
                    <th>المسمى الوظيفي</th>
                    <th>الراتب الأساسي والدورية</th>
                    <th>تاريخ التعيين/الإضافة</th>
                    <th>الحالة</th>
                    <th style={{ textAlign: 'left' }}>العمليات والحركات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className={!emp.active ? 'inactive-row' : ''}>
                      <td style={{ fontWeight: 'var(--fw-medium)' }}>{emp.name}</td>
                      <td>{emp.jobTitle || '—'}</td>
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
                              <Button variant="secondary" size="sm" onClick={() => openEditEmployeeModal(emp)}>تعديل</Button>
                              <Button variant="danger" size="sm" onClick={() => handleDeleteEmployee(emp.id)}>مسح</Button>
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

      {/* Employee Add/Edit Modal */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => !savingEmployee && setIsEmployeeModalOpen(false)}
        title={employeeModalMode === 'CREATE' ? 'إضافة موظف جديد' : 'تعديل بيانات موظف'}
        icon={employeeModalMode === 'CREATE' ? '👤' : '✏️'}
        subtitle={employeeModalMode === 'CREATE' ? 'إضافة موظف جديد وتحديد المسمى الوظيفي والراتب الأسبوعي' : `تعديل بيانات وراتب الموظف: ${employeeForm.name}`}
        size="md"
      >
        <form onSubmit={handleEmployeeSubmit} className="form-stack">
          <Input
            label="اسم الموظف"
            name="name"
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
                ? 'قيمة الراتب اليومي / اليومية (ج.م)' 
                : employeeForm.salaryPeriod === 'MONTHLY' 
                  ? 'قيمة الراتب الشهري الأساسي (ج.م)' 
                  : 'قيمة الراتب الأسبوعي الأساسي (ج.م)'
            }
            name="baseSalary"
            type="number"
            min="0"
            step="0.01"
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
            نشط (متاح لصرف الرواتب)
          </label>
          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setIsEmployeeModalOpen(false)} disabled={savingEmployee}>إلغاء</Button>
            <Button type="submit" variant="primary" loading={savingEmployee}>حفظ</Button>
          </div>
        </form>
      </Modal>

      {/* Add Transaction Modal (Deduction, Advance, Bonus) */}
      {isTxModalOpen && (
        <Modal
          isOpen={isTxModalOpen}
          onClose={() => !savingTx && setIsTxModalOpen(false)}
          title={`تسجيل حركة مالية`}
          icon="⚡"
          subtitle={`تسجيل خصم أو سلفة أو مكافأة للموظف: ${txForm.employeeName}`}
          size="sm"
        >
          <form onSubmit={handleSaveTx} className="form-stack">
            <div className="form-group">
              <label className="form-label">نوع الحركة:</label>
              <div className="tx-type-selector">
                <button
                  type="button"
                  className={`tx-type-btn tx-type-btn--deduction ${txForm.type === 'DEDUCTION' ? 'active' : ''}`}
                  onClick={() => setTxForm({ ...txForm, type: 'DEDUCTION' })}
                >
                  <MinusCircle size={16} />
                  <span>خصم (-)</span>
                </button>
                <button
                  type="button"
                  className={`tx-type-btn tx-type-btn--advance ${txForm.type === 'ADVANCE' ? 'active' : ''}`}
                  onClick={() => setTxForm({ ...txForm, type: 'ADVANCE' })}
                >
                  <CreditCard size={16} />
                  <span>سُلفة (-)</span>
                </button>
                <button
                  type="button"
                  className={`tx-type-btn tx-type-btn--bonus ${txForm.type === 'BONUS' ? 'active' : ''}`}
                  onClick={() => setTxForm({ ...txForm, type: 'BONUS' })}
                >
                  <Award size={16} />
                  <span>بونص/مكافأة (+)</span>
                </button>
              </div>
            </div>

            <div>
              <Input
                label="المبلغ (ج.م)"
                type="number"
                min="0.01"
                step="0.01"
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                placeholder="مثال: 50"
                required
                autoFocus
              />
              <div className="preset-chips-wrap">
                {['25', '50', '100', '150', '200'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`preset-chip-btn ${String(txForm.amount) === amt ? 'preset-chip-btn--active' : ''}`}
                    onClick={() => setTxForm({ ...txForm, amount: amt })}
                  >
                    {amt} ج.م
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="التاريخ"
              type="date"
              value={txForm.transactionDate}
              onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
              required
            />

            <div className="form-group">
              <label className="form-label">
                {txForm.type === 'DEDUCTION' ? 'سبب وتفاصيل الخصم (تعليق / ملاحظات):' : 'السبب / الملاحظات:'}
              </label>
              <Input
                value={txForm.notes}
                onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                placeholder={txForm.type === 'DEDUCTION' ? 'اكتب تعليق/سبب الخصم هنا أو اختر اختصاراً...' : 'مثال: مكافأة تميز / سلفة نقداً'}
                required={txForm.type === 'DEDUCTION'}
              />
              {txForm.type === 'DEDUCTION' && (
                <div className="preset-chips-wrap">
                  {DEDUCTION_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={`preset-chip-btn ${txForm.notes.includes(reason) ? 'preset-chip-btn--active' : ''}`}
                      onClick={() => {
                        setTxForm(prev => ({
                          ...prev,
                          notes: prev.notes ? `${prev.notes} - ${reason}` : reason
                        }));
                      }}
                    >
                      + {reason}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(txForm.type === 'ADVANCE' || txForm.type === 'BONUS') && (
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={txForm.paidFromDrawer}
                  onChange={(e) => setTxForm({ ...txForm, paidFromDrawer: e.target.checked })}
                />
                خصم المبلغ فوراً من الخزينة/الدرج الحالية (مصروف رواتب)
              </label>
            )}

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsTxModalOpen(false)} disabled={savingTx}>إلغاء</Button>
              <Button type="submit" variant="primary" loading={savingTx}>تسجيل الحركة</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Transaction Log View Modal */}
      {isLogModalOpen && selectedLogEmp && (
        <Modal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          title={`سجل الخصومات والسُلف للموظف: ${selectedLogEmp.employeeName || selectedLogEmp.name}`}
          size="md"
        >
          <div className="log-modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                تفاصيل الحركات المسجلة لهذا الموظف
              </span>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer size={14} />}
                onClick={() => handlePrintEmployee(selectedLogEmp)}
              >
                طباعة كشف الحساب
              </Button>
            </div>

            {loadingLog ? (
              <div className="text-center p-4"><Spinner /></div>
            ) : empLogTxs.length === 0 ? (
              <p className="text-center text-muted p-4">لا توجد حركات مسجلة لهذا الموظف.</p>
            ) : (
              <table className="data-table log-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>نوع الحركة</th>
                    <th>المبلغ</th>
                    <th>السبب / البيان</th>
                    <th className="text-center">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {empLogTxs.map((tx) => (
                    <tr key={tx.id}>
                      <td>{tx.transactionDate}</td>
                      <td>
                        {tx.type === 'DEDUCTION' && <Badge variant="danger">خصم 🔻</Badge>}
                        {tx.type === 'ADVANCE' && <Badge variant="warning">سُلفة 💸</Badge>}
                        {tx.type === 'BONUS' && <Badge variant="success">بونص 🎁</Badge>}
                        {tx.type === 'SALARY_PAYOUT' && <Badge variant="info">تسديد قبض 🟢</Badge>}
                      </td>
                      <td className="fw-bold">{formatCurrency(tx.amount)}</td>
                      <td>{tx.notes || '—'}</td>
                      <td className="text-center">
                        <button 
                          className="btn-icon btn-icon--danger" 
                          onClick={() => handleDeleteTxItem(tx.id)}
                          title="حذف الحركة"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {/* Pay Weekly Salary Modal */}
      {isPayoutModalOpen && (
        <Modal
          isOpen={isPayoutModalOpen}
          onClose={() => !savingPayout && setIsPayoutModalOpen(false)}
          title={`تسديد القبض الأسبوعي: ${payoutForm.employeeName}`}
          size="sm"
        >
          <form onSubmit={handlePayoutSubmit} className="form-stack">
            <div className="payout-summary-box">
              <span>صافي المستحق للقبض:</span>
              <strong className="payout-amount">{formatCurrency(payoutForm.netPayable)}</strong>
            </div>

            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
              <input
                type="checkbox"
                checked={payoutForm.paidFromDrawer}
                onChange={(e) => setPayoutForm({ ...payoutForm, paidFromDrawer: e.target.checked })}
              />
              خصم المبلغ وتسديده من الخزينة/درج الكاشير الحالي (تسجيل مصروف)
            </label>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsPayoutModalOpen(false)} disabled={savingPayout}>تراجع</Button>
              <Button type="submit" variant="primary" loading={savingPayout}>تأكيد صرف القبض</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Week Confirmation Modal */}
      {isResetWeekModalOpen && (
        <Modal
          isOpen={isResetWeekModalOpen}
          onClose={() => !resettingWeek && setIsResetWeekModalOpen(false)}
          title="تصفية مستحقات الأسبوع وبدء أسبوع جديد 🔄"
          size="sm"
        >
          <div className="form-stack">
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              هل أنت متأكد من تصفية مستحقات الأسبوع الحالي وترحيل الحركات السابقة؟
            </p>
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              fontSize: '13px',
              color: '#f87171'
            }}>
              ⚠️ سيتم تسوية وترحيل جميع السُلف والخصومات حتى تاريخ <strong>{endDate}</strong>، وسيبدأ الأسبوع الجديد بحسابات ورصيد صافي لجميع الموظفين.
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsResetWeekModalOpen(false)}
                disabled={resettingWeek}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={resettingWeek}
                onClick={handleResetWeekConfirm}
                style={{ background: '#ef4444', color: '#fff' }}
              >
                تأكيد وبدء أسبوع جديد 🚀
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
