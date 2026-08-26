import { useCallback, useEffect, useState, useMemo } from 'react';
import { Plus, Search, Download, Wallet, Building2, Layers, Printer, CheckCircle, Clock } from 'lucide-react';
import { expensesApi } from '../../api/expensesApi';
import { employeesApi } from '../../api/employeesApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printExpenseVoucher } from '../../utils/printUtils';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import Spinner from '../../components/Spinner/Spinner';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import { ROLES } from '../../utils/constants';
import './ExpensesPage.css';

const EXPENSE_TYPES = {
  MATERIALS: 'خامات ومشتريات',
  RENT: 'إيجار',
  SALARIES: 'رواتب',
  MAINTENANCE: 'صيانة',
  INSTALLMENTS: 'أقساط'
};

const REVENUE_LINES = {
  FOOD: 'مأكولات',
  BUFFET: 'بوفيه ومشروبات',
  SHARED: 'مصروف عام (مشترك)'
};

const DATE_RANGES = {
  TODAY: 'النهاردة',
  WEEK:  'آخر 7 أيام',
  MONTH: 'الشهر ده',
  ALL:   'كل الفترات',
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function rangeStart(range) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (range === 'TODAY') return now;
  if (range === 'WEEK') { const d = new Date(now); d.setDate(d.getDate() - 6); return d; }
  if (range === 'MONTH') return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
}

export default function ExpensesPage() {
  const toast = useToast();
  const { role, user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterRevenueLine, setFilterRevenueLine] = useState('ALL');
  const [filterPaidFrom, setFilterPaidFrom] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | COMPLETED | PENDING_SETTLEMENT
  const [dateRange, setDateRange] = useState('MONTH');
  const [sortBy, setSortBy] = useState('DATE_DESC');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState('DIRECT'); // DIRECT | ADVANCE
  const [form, setForm] = useState({
    type: 'MATERIALS',
    revenueLine: 'SHARED',
    amount: '',
    employeeId: '',
    paidFromDrawer: true,
    expenseDate: todayISO(),
    recurring: false,
    notes: '',
    autoPrint: true
  });
  const [isSaving, setIsSaving] = useState(false);

  // Settlement Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [targetAdvance, setTargetAdvance] = useState(null);
  const [settleForm, setSettleForm] = useState({
    actualAmount: '',
    notes: '',
    autoPrint: true
  });
  const [isSettling, setIsSettling] = useState(false);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const [expData, empData] = await Promise.all([
        expensesApi.findAll(),
        employeesApi.findAll()
      ]);
      setExpenses(expData.sort((a, b) => new Date(b.expenseDate || b.createdAt || 0) - new Date(a.expenseDate || a.createdAt || 0)));
      setEmployees(empData.filter(e => e.active));
    } catch (err) {
      toast.error(err.message, 'فشل تحميل المصروفات');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  function handleOpenModal(mode = 'DIRECT') {
    setEntryMode(mode);
    setForm({
      type: mode === 'ADVANCE' ? 'MATERIALS' : 'MATERIALS',
      revenueLine: 'SHARED',
      amount: '',
      employeeId: '',
      paidFromDrawer: true,
      expenseDate: todayISO(),
      recurring: false,
      notes: mode === 'ADVANCE' ? 'سحب عُهدة مؤقتة لشراء مستلزمات' : '',
      autoPrint: true
    });
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('يرجى كتابة مبلغ صحيح أكبر من الصفر');
      return;
    }

    setIsSaving(true);
    try {
      const created = await expensesApi.create({
        type: form.type,
        revenueLine: form.revenueLine,
        amount: parseFloat(form.amount),
        expenseDate: form.expenseDate || todayISO(),
        recurring: !!form.recurring,
        isAdvance: entryMode === 'ADVANCE',
        employeeId: form.type === 'SALARIES' ? form.employeeId : null,
        paidFromDrawer: form.paidFromDrawer,
        notes: form.notes
      });

      toast.success(entryMode === 'ADVANCE' ? 'تم تسجيل وتأكيد سحب العُهدة المؤقتة بنجاح' : 'تم تسجيل المصروف بنجاح');
      setIsModalOpen(false);

      if (form.autoPrint) {
        try {
          printExpenseVoucher(created, user?.tenantName);
        } catch (pErr) {
          console.error('Print failed:', pErr);
        }
      }

      await loadExpenses();
    } catch (err) {
      toast.error(err.message, 'فشل في تسجيل المصروف');
    } finally {
      setIsSaving(false);
    }
  }

  function handleOpenSettleModal(exp) {
    setTargetAdvance(exp);
    setSettleForm({
      actualAmount: exp.amount ? String(exp.amount) : '',
      notes: '',
      autoPrint: true
    });
    setSettleModalOpen(true);
  }

  async function handleSettleSubmit(e) {
    e.preventDefault();
    if (!targetAdvance || !settleForm.actualAmount) return;

    const actual = parseFloat(settleForm.actualAmount);
    if (isNaN(actual) || actual < 0) {
      toast.error('يرجى إدخال المبلغ الفعلي المصروف من الفاتورة بشكل صحيح');
      return;
    }

    setIsSettling(true);
    try {
      const settled = await expensesApi.settle(targetAdvance.id, {
        actualAmount: actual,
        notes: settleForm.notes
      });

      toast.success('تمت تسوية العُهدة وإرجاع الباقي للدرج بنجاح 🎉');
      setSettleModalOpen(false);

      if (settleForm.autoPrint) {
        try {
          printExpenseVoucher(settled, user?.tenantName);
        } catch (pErr) {
          console.error('Print failed:', pErr);
        }
      }

      await loadExpenses();
    } catch (err) {
      toast.error(err.message, 'فشل في تسوية العُهدة');
    } finally {
      setIsSettling(false);
    }
  }

  function handlePrintTicket(exp) {
    try {
      printExpenseVoucher(exp, user?.tenantName);
      toast.success('جاري طباعة بون المصروف...');
    } catch (err) {
      toast.error('تعذر طباعة البون: ' + err.message);
    }
  }

  const canAdd = role === ROLES.SUPERVISOR || role === ROLES.CASHIER;

  // Filter + Sort expenses
  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = expenses.filter((exp) => {
      const matchesSearch = !q ||
        (exp.notes && exp.notes.toLowerCase().includes(q)) ||
        (exp.employeeName && exp.employeeName.toLowerCase().includes(q)) ||
        (EXPENSE_TYPES[exp.type] || '').toLowerCase().includes(q);
      const matchesType = filterType === 'ALL' ? true : exp.type === filterType;
      const matchesRevenueLine = filterRevenueLine === 'ALL' ? true : exp.revenueLine === filterRevenueLine;
      const matchesPaidFrom =
        filterPaidFrom === 'ALL' ? true :
        filterPaidFrom === 'DRAWER' ? exp.paidFromDrawer :
        !exp.paidFromDrawer;
      const matchesStatus =
        filterStatus === 'ALL' ? true : exp.status === filterStatus;
      const start = rangeStart(dateRange);
      const matchesDate =
        !start || new Date(exp.expenseDate || exp.createdAt || 0) >= start;
      return matchesSearch && matchesType && matchesRevenueLine && matchesPaidFrom && matchesStatus && matchesDate;
    });

    return [...result].sort((a, b) => {
      const dateA = new Date(a.expenseDate || a.createdAt || 0);
      const dateB = new Date(b.expenseDate || b.createdAt || 0);
      switch (sortBy) {
        case 'DATE_ASC':
          return dateA - dateB;
        case 'AMOUNT_DESC':
          return (b.amount || 0) - (a.amount || 0);
        case 'AMOUNT_ASC':
          return (a.amount || 0) - (b.amount || 0);
        case 'DATE_DESC':
        default:
          return dateB - dateA;
      }
    });
  }, [expenses, search, filterType, filterRevenueLine, filterPaidFrom, filterStatus, dateRange, sortBy]);

  const summary = useMemo(() => {
    const sum = (list) => list.reduce((t, e) => t + (Number(e.amount) || 0), 0);
    const byType = {};
    filteredExpenses.forEach((e) => {
      byType[e.type] = (byType[e.type] ?? 0) + (Number(e.amount) || 0);
    });
    const total = sum(filteredExpenses);
    const pendingAdvancesList = filteredExpenses.filter((e) => e.status === 'PENDING_SETTLEMENT');
    return {
      total,
      count: filteredExpenses.length,
      pendingCount: pendingAdvancesList.length,
      pendingTotal: sum(pendingAdvancesList),
      drawer: sum(filteredExpenses.filter((e) => e.paidFromDrawer)),
      external: sum(filteredExpenses.filter((e) => !e.paidFromDrawer)),
      food: sum(filteredExpenses.filter((e) => e.revenueLine === 'FOOD')),
      buffet: sum(filteredExpenses.filter((e) => e.revenueLine === 'BUFFET')),
      shared: sum(filteredExpenses.filter((e) => e.revenueLine === 'SHARED')),
      byType: Object.entries(byType)
        .map(([type, amount]) => ({ type, amount, pct: total ? (amount / total) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [filteredExpenses]);

  function exportCsv() {
    const header = ['التاريخ', 'الحالة', 'النوع', 'بند الإيرادات', 'المبلغ', 'طريقة الدفع', 'الموظف', 'ملاحظات'];
    const rows = filteredExpenses.map((e) => [
      e.expenseDate ?? '',
      e.status === 'PENDING_SETTLEMENT' ? 'عُهدة تحت التسوية' : 'مكتمل ومسوى',
      EXPENSE_TYPES[e.type] ?? e.type,
      REVENUE_LINES[e.revenueLine] ?? e.revenueLine,
      Number(e.amount ?? 0).toFixed(2),
      e.paidFromDrawer ? 'من الدرج' : 'خارجي',
      e.employeeName ?? '',
      (e.notes ?? '').replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${cell}"`).join(','))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Calculate live settlement math
  const calculatedReturned = useMemo(() => {
    if (!targetAdvance) return 0;
    const initial = targetAdvance.advanceAmount || targetAdvance.amount || 0;
    const actual = parseFloat(settleForm.actualAmount) || 0;
    return initial - actual;
  }, [targetAdvance, settleForm.actualAmount]);

  return (
    <div className="page">
      <ObserverBanner />
      <div className="page__header">
        <div>
          <h1 className="page__title">إدارة المصاريف والعهد المالية</h1>
          <p className="page__subtitle">تسجيل المصاريف، سحب العهد المؤقتة، وإصدار بونات الطباعة الحرارية</p>
        </div>
        <div className="page__actions">
          <Button
            variant="secondary"
            rightIcon={<Download size={16} />}
            onClick={exportCsv}
            disabled={filteredExpenses.length === 0}
            title="تصدير المعروض حالياً"
          >
            تصدير CSV
          </Button>
          {canAdd && (
            <>
              <Button
                variant="secondary"
                rightIcon={<Clock size={16} />}
                onClick={() => handleOpenModal('ADVANCE')}
                style={{ borderColor: '#f59e0b', color: '#d97706' }}
              >
                سحب عُهدة مؤقتة ⏳
              </Button>
              <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal('DIRECT')}>
                إضافة مصروف مباشر 💸
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      {!loading && (
        <div className="exp-summary">
          <div className="exp-card exp-card--total">
            <span className="exp-card__label">إجمالي المصروف الفعلي</span>
            <strong className="exp-card__value">{formatCurrency(summary.total)}</strong>
            <span className="exp-card__sub">{summary.count} عملية — {DATE_RANGES[dateRange]}</span>
          </div>

          <div className="exp-card" style={{ borderColor: summary.pendingCount > 0 ? '#f59e0b' : 'var(--border)' }}>
            <span className="exp-card__label" style={{ color: summary.pendingCount > 0 ? '#d97706' : 'var(--text-primary)' }}>
              <Clock size={13} /> عُهد معلقة (تحت التسوية)
            </span>
            <strong className="exp-card__value" style={{ color: summary.pendingCount > 0 ? '#d97706' : 'inherit' }}>
              {formatCurrency(summary.pendingTotal)}
            </strong>
            <span className="exp-card__sub">{summary.pendingCount} عُهدة تحتاج تسوية وباقي</span>
          </div>

          <div className="exp-card">
            <span className="exp-card__label"><Wallet size={13} /> من درج الكاشير</span>
            <strong className="exp-card__value">{formatCurrency(summary.drawer)}</strong>
            <span className="exp-card__sub">خصم مباشر من الخزينة النقدية</span>
          </div>

          <div className="exp-card">
            <span className="exp-card__label"><Building2 size={13} /> مدفوع خارجي</span>
            <strong className="exp-card__value">{formatCurrency(summary.external)}</strong>
            <span className="exp-card__sub">دفع مباشر بدون سحب كاش</span>
          </div>
        </div>
      )}

      {/* Breakdown Bar */}
      {!loading && summary.byType.length > 0 && (
        <div className="exp-breakdown">
          {summary.byType.map((row) => (
            <div key={row.type} className="exp-breakdown__row">
              <span className="exp-breakdown__label">{EXPENSE_TYPES[row.type] || row.type}</span>
              <div className="exp-breakdown__bar">
                <div className="exp-breakdown__fill" style={{ width: `${row.pct}%` }} />
              </div>
              <span className="exp-breakdown__amount">{formatCurrency(row.amount)}</span>
              <span className="exp-breakdown__pct">{Math.round(row.pct)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="page-filters">
        <div className="field-select">
          <select
            className="field-select__control"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            {Object.entries(DATE_RANGES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <Input
          placeholder="بحث في البيان، الملاحظات أو اسم الموظف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
          className="page-filters__search"
        />
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">كل الحالات (مكتمل ومؤقت)</option>
            <option value="COMPLETED">مكتمل ومسوى ✅</option>
            <option value="PENDING_SETTLEMENT">عُهدة تحت التسوية ⏳</option>
          </select>
        </div>
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">كل أنواع المصروفات</option>
            {Object.entries(EXPENSE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterPaidFrom}
            onChange={(e) => setFilterPaidFrom(e.target.value)}
          >
            <option value="ALL">كل طرق الدفع</option>
            <option value="DRAWER">من الدرج (كاشير)</option>
            <option value="EXTERNAL">خارجي</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : filteredExpenses.length === 0 ? (
          <div className="data-table-empty">لا توجد مصاريف أو عُهد مطابقة لخيارات البحث.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم البون</th>
                <th>نوع المصروف</th>
                <th>حالة العُهدة</th>
                <th>المبلغ المسجل</th>
                <th>تفاصيل التسوية (الباقي)</th>
                <th>طريقة الدفع</th>
                <th>البيان والملاحظات</th>
                <th>التاريخ</th>
                <th style={{ textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => {
                const isPending = exp.status === 'PENDING_SETTLEMENT';
                return (
                  <tr key={exp.id} className={isPending ? 'row-pending-advance' : ''}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      EXP-{String(exp.id).padStart(5, '0')}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {EXPENSE_TYPES[exp.type] || exp.type}
                      {exp.type === 'SALARIES' && exp.employeeName && (
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          الموظف: {exp.employeeName}
                        </span>
                      )}
                    </td>
                    <td>
                      {isPending ? (
                        <Badge variant="warning" size="sm">
                          ⏳ عُهدة تحت التسوية
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          ✅ مكتمل ومسوى
                        </Badge>
                      )}
                    </td>
                    <td className="data-table__number" style={{ color: isPending ? '#d97706' : 'var(--danger)', fontWeight: 700 }}>
                      -{formatCurrency(exp.amount)}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {exp.isAdvance || exp.advanceAmount != null ? (
                        exp.actualAmount != null ? (
                          <div>
                            <div>المسحوب: <b>{formatCurrency(exp.advanceAmount)}</b></div>
                            <div>الفعلي: <b>{formatCurrency(exp.actualAmount)}</b></div>
                            <div style={{ color: '#16a34a', fontWeight: 600 }}>مرتجع للدرج: +{formatCurrency(exp.returnedAmount)}</div>
                          </div>
                        ) : (
                          <div style={{ color: '#d97706' }}>
                            مسحوب مؤقتاً: <b>{formatCurrency(exp.advanceAmount || exp.amount)}</b>
                          </div>
                        )
                      ) : (
                        <span className="data-table__muted">مباشر بدقة</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={exp.paidFromDrawer ? 'info' : 'neutral'}>
                        {exp.paidFromDrawer ? 'من الدرج (كاشير)' : 'خارجي'}
                      </Badge>
                    </td>
                    <td className="data-table__muted" style={{ maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={exp.notes}>
                      {exp.notes || '-'}
                    </td>
                    <td className="data-table__muted">{formatDateTime(exp.expenseDate || exp.createdAt)}</td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {isPending && canAdd && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenSettleModal(exp)}
                            style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' }}
                            title="تسوية العُهدة وإرجاع الباقي"
                          >
                            <CheckCircle size={14} style={{ marginInlineEnd: '4px' }} /> تسوية الباقي
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handlePrintTicket(exp)}
                          title="طباعة بون إيصال حراري"
                        >
                          <Printer size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Advance Modal */}
      {canAdd && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={entryMode === 'ADVANCE' ? 'سحب عُهدة مؤقتة من الخزينة ⏳' : 'تسجيل مصروف تشغيلي مباشر 💸'}
          icon={entryMode === 'ADVANCE' ? '⏳' : '💸'}
          subtitle={entryMode === 'ADVANCE' ? 'سحب مبلغ مؤقت للشرائيات وسيتم تسويته وإرجاع الباقي بعد الشراء' : 'تسجيل مصروف دقيق ومعه فاتورة شراء مؤكدة'}
          size="md"
        >
          <div className="expense-mode-tabs">
            <button
              type="button"
              className={`expense-mode-tab ${entryMode === 'DIRECT' ? 'expense-mode-tab--active' : ''}`}
              onClick={() => setEntryMode('DIRECT')}
            >
              💸 مصروف مباشر (معه فاتورة)
            </button>
            <button
              type="button"
              className={`expense-mode-tab ${entryMode === 'ADVANCE' ? 'expense-mode-tab--active' : ''}`}
              onClick={() => setEntryMode('ADVANCE')}
            >
              ⏳ سحب عُهدة مؤقتة (تحت التسوية)
            </button>
          </div>

          <form onSubmit={handleSave} className="form-grid">
            <div className="field-select">
              <label className="field-select__label">نوع البند المصروف</label>
              <select
                className="field-select__control"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
              >
                {Object.entries(EXPENSE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            
            <div className="field-select">
              <label className="field-select__label">يخص بند إيرادات</label>
              <select
                className="field-select__control"
                value={form.revenueLine}
                onChange={(e) => setForm({ ...form, revenueLine: e.target.value })}
                required
              >
                {Object.entries(REVENUE_LINES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {form.type === 'SALARIES' && (
              <div className="field-select">
                <label className="field-select__label">اختر الموظف المستلم</label>
                <select
                  className="field-select__control"
                  value={form.employeeId}
                  onChange={(e) => {
                    const emp = employees.find(x => x.id == e.target.value);
                    setForm({ ...form, employeeId: e.target.value, amount: emp ? emp.baseSalary : '' });
                  }}
                  required
                >
                  <option value="">-- اختر الموظف --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label={entryMode === 'ADVANCE' ? 'المبلغ المسحوب مؤقتاً كعُهدة (جنيه)' : 'المبلغ المصروف (جنيه)'}
              type="number"
              step="0.01"
              min="0.5"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            
            <Input
              label="تاريخ الإخراج"
              type="date"
              max={todayISO()}
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              required
            />

            <Input
              label="البيان والتفاصيل (ماذا سيتم شراؤه؟)"
              type="text"
              placeholder={entryMode === 'ADVANCE' ? 'مثال: شراء شاي وسكر ونعناع من الماركت' : 'مثال: فاتورة كهرباء شهر أغسطس'}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              required={entryMode === 'ADVANCE'}
            />

            <div className="exp-presets" style={{ gridColumn: '1 / -1' }}>
              {[20, 50, 100, 200, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="exp-preset"
                  onClick={() => setForm({ ...form, amount: String(amount) })}
                >
                  {amount} ج
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="paidFromDrawer"
                checked={form.paidFromDrawer}
                onChange={(e) => setForm({ ...form, paidFromDrawer: e.target.checked })}
              />
              <label htmlFor="paidFromDrawer">خصم وسحب من درج كاشير الشيفت المفتوح</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="autoPrintVoucher"
                checked={form.autoPrint}
                onChange={(e) => setForm({ ...form, autoPrint: e.target.checked })}
              />
              <label htmlFor="autoPrintVoucher" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                🖨️ طباعة إيصال/بون مصروفات حراري تلقائياً فور الحفظ
              </label>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', gridColumn: '1 / -1' }}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving}>
                {entryMode === 'ADVANCE' ? 'تأكيد وسحب العُهدة ⏳' : 'حفظ وتسجيل المصروف 💸'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Settle Advance Modal */}
      {settleModalOpen && targetAdvance && (
        <Modal
          isOpen={settleModalOpen}
          onClose={() => setSettleModalOpen(false)}
          title="تسوية العُهدة وإرجاع الباقي للدرج 🧾"
          icon="🧾"
          subtitle={`تسوية العُهدة رقم EXP-${String(targetAdvance.id).padStart(5, '0')} بقيمة مسحوبة ${formatCurrency(targetAdvance.advanceAmount || targetAdvance.amount)}`}
          size="md"
        >
          <form onSubmit={handleSettleSubmit} className="form-grid">
            <div className="settle-summary-box" style={{ gridColumn: '1 / -1' }}>
              <div className="settle-summary-row">
                <span>مبلغ العُهدة المسحوب سابقاً من الخزينة:</span>
                <b>{formatCurrency(targetAdvance.advanceAmount || targetAdvance.amount)}</b>
              </div>
            </div>

            <Input
              label="إجمالي المبلغ الفعلي المصروف (حسب فواتير الشراء)"
              type="number"
              step="0.01"
              min="0"
              max={targetAdvance.advanceAmount || targetAdvance.amount}
              value={settleForm.actualAmount}
              onChange={(e) => setSettleForm({ ...settleForm, actualAmount: e.target.value })}
              required
              autoFocus
            />

            <Input
              label="ملاحظات التسوية / الفواتير المرفقة"
              type="text"
              placeholder="مثال: تم إرجاع 10 جنيه للدرج مع إرفاق فاتورة السوبرماركت"
              value={settleForm.notes}
              onChange={(e) => setSettleForm({ ...settleForm, notes: e.target.value })}
            />

            {/* Live Calculation Preview */}
            <div className={`settle-calc-card ${calculatedReturned < 0 ? 'settle-calc-card--negative' : ''}`} style={{ gridColumn: '1 / -1' }}>
              <div className="settle-calc-item">
                <span>المبلغ المصروف الفعلي:</span>
                <strong>{formatCurrency(parseFloat(settleForm.actualAmount) || 0)}</strong>
              </div>
              <div className="settle-calc-item settle-calc-item--highlight">
                <span>المبلغ الواجب إرجاعه لدرج الخزينة (الباقي):</span>
                <strong style={{ color: calculatedReturned >= 0 ? '#16a34a' : '#dc2626' }}>
                  {calculatedReturned >= 0 ? `+${formatCurrency(calculatedReturned)}` : formatCurrency(calculatedReturned)}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="autoPrintSettleVoucher"
                checked={settleForm.autoPrint}
                onChange={(e) => setSettleForm({ ...settleForm, autoPrint: e.target.checked })}
              />
              <label htmlFor="autoPrintSettleVoucher" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                🖨️ طباعة إيصال بون تسوية العُهدة تلقائياً على طابعة الفواتير
              </label>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', gridColumn: '1 / -1' }}>
              <Button variant="secondary" onClick={() => setSettleModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSettling} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>
                تأكيد التسوية وإعادة الباقي للدرج ✅
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
