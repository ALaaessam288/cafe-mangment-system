import { useCallback, useEffect, useState, useMemo } from 'react';
import { Plus, Search, Download, Wallet, Building2, Layers } from 'lucide-react';
import { expensesApi } from '../../api/expensesApi';
import { employeesApi } from '../../api/employeesApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
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

/* Date presets - the question an owner actually asks is "what did we spend
   today / this week / this month", not "between two arbitrary timestamps". */
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
  const { role } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterRevenueLine, setFilterRevenueLine] = useState('ALL');
  const [filterPaidFrom, setFilterPaidFrom] = useState('ALL'); // ALL | DRAWER | EXTERNAL
  const [dateRange, setDateRange] = useState('MONTH');
  const [sortBy, setSortBy] = useState('DATE_DESC');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'MATERIALS',
    revenueLine: 'SHARED',
    amount: '',
    employeeId: '',
    paidFromDrawer: true,
    expenseDate: todayISO(),
    recurring: false,
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

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
      toast.error(err.message, 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  function handleOpenModal() {
    setForm({
      type: 'MATERIALS',
      revenueLine: 'SHARED',
      amount: '',
      employeeId: '',
      paidFromDrawer: true,
      expenseDate: todayISO(),
      recurring: false,
      notes: '',
    });
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.amount) return;

    setIsSaving(true);
    try {
      await expensesApi.create({
        type: form.type,
        revenueLine: form.revenueLine,
        amount: parseFloat(form.amount),
        expenseDate: form.expenseDate || todayISO(),
        recurring: !!form.recurring,
        employeeId: form.type === 'SALARIES' ? form.employeeId : null,
        paidFromDrawer: form.paidFromDrawer,
        notes: form.notes
      });
      toast.success('تم تسجيل المصروف بنجاح');
      setIsModalOpen(false);
      await loadExpenses();
    } catch (err) {
      toast.error(err.message, 'فشل في تسجيل المصروف');
    } finally {
      setIsSaving(false);
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
      const start = rangeStart(dateRange);
      const matchesDate =
        !start || new Date(exp.expenseDate || exp.createdAt || 0) >= start;
      return matchesSearch && matchesType && matchesRevenueLine && matchesPaidFrom && matchesDate;
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
  }, [expenses, search, filterType, filterRevenueLine, filterPaidFrom, dateRange, sortBy]);

  /* Everything below is computed from exactly what's on screen, so the numbers
     always agree with the rows the user is looking at. */
  const summary = useMemo(() => {
    const sum = (list) => list.reduce((t, e) => t + (Number(e.amount) || 0), 0);
    const byType = {};
    filteredExpenses.forEach((e) => {
      byType[e.type] = (byType[e.type] ?? 0) + (Number(e.amount) || 0);
    });
    const total = sum(filteredExpenses);
    return {
      total,
      count: filteredExpenses.length,
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

  /* CSV of the current view - opens straight in Excel. BOM so Arabic isn't mangled. */
  function exportCsv() {
    const header = ['التاريخ', 'النوع', 'بند الإيرادات', 'المبلغ', 'طريقة الدفع', 'الموظف', 'ملاحظات'];
    const rows = filteredExpenses.map((e) => [
      e.expenseDate ?? '',
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

  return (
    <div className="page">
      <ObserverBanner />
      <div className="page__header">
        <div>
          <h1 className="page__title">المصاريف</h1>
          <p className="page__subtitle">تسجيل ومتابعة مصاريف التشغيل</p>
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
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة مصروف
            </Button>
          )}
        </div>
      </div>

      {/* Totals for exactly what's filtered below */}
      {!loading && (
        <div className="exp-summary">
          <div className="exp-card exp-card--total">
            <span className="exp-card__label">إجمالي المصروف</span>
            <strong className="exp-card__value">{formatCurrency(summary.total)}</strong>
            <span className="exp-card__sub">{summary.count} عملية — {DATE_RANGES[dateRange]}</span>
          </div>

          <div className="exp-card">
            <span className="exp-card__label"><Wallet size={13} /> من درج الكاشير</span>
            <strong className="exp-card__value">{formatCurrency(summary.drawer)}</strong>
            <span className="exp-card__sub">بيقلل الكاش المتوقع في الدرج</span>
          </div>

          <div className="exp-card">
            <span className="exp-card__label"><Building2 size={13} /> مدفوع خارجي</span>
            <strong className="exp-card__value">{formatCurrency(summary.external)}</strong>
            <span className="exp-card__sub">مش من الدرج</span>
          </div>

          <div className="exp-card">
            <span className="exp-card__label"><Layers size={13} /> التوزيع</span>
            <div className="exp-card__split">
              <span>مأكولات <b>{formatCurrency(summary.food)}</b></span>
              <span>بوفيه <b>{formatCurrency(summary.buffet)}</b></span>
              <span>عام <b>{formatCurrency(summary.shared)}</b></span>
            </div>
          </div>
        </div>
      )}

      {/* Where the money actually went, biggest first */}
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
          placeholder="دور في الملاحظات أو نوع المصروف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
          className="page-filters__search"
        />
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">كل الأنواع</option>
            {Object.entries(EXPENSE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterRevenueLine}
            onChange={(e) => setFilterRevenueLine(e.target.value)}
          >
            <option value="ALL">كل بنود الإيرادات</option>
            {Object.entries(REVENUE_LINES).map(([k, v]) => (
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
        <div className="field-select">
          <select
            className="field-select__control"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            title="الترتيب"
          >
            <option value="DATE_DESC">الأحدث أولاً</option>
            <option value="DATE_ASC">الأقدم أولاً</option>
            <option value="AMOUNT_DESC">الأعلى مبلغاً</option>
            <option value="AMOUNT_ASC">الأقل مبلغاً</option>
          </select>
        </div>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : filteredExpenses.length === 0 ? (
          <div className="data-table-empty">مفيش مصاريف مطابقة لخيارات البحث والفلترة.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>نوع المصروف</th>
                <th>بند الإيرادات</th>
                <th>المبلغ</th>
                <th>طريقة الدفع</th>
                <th>ملاحظات</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((exp) => (
                <tr key={exp.id}>
                  <td style={{ fontWeight: 500 }}>
                    {EXPENSE_TYPES[exp.type] || exp.type}
                    {exp.type === 'SALARIES' && exp.employeeName && (
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        الموظف: {exp.employeeName}
                      </span>
                    )}
                  </td>
                  <td>
                    <Badge variant="neutral">{REVENUE_LINES[exp.revenueLine] || exp.revenueLine}</Badge>
                  </td>
                  <td className="data-table__number" style={{ color: 'var(--danger)' }}>
                    -{formatCurrency(exp.amount)}
                  </td>
                  <td>
                    <Badge variant={exp.paidFromDrawer ? 'info' : 'neutral'}>
                      {exp.paidFromDrawer ? 'من الدرج (كاشير)' : 'خارجي'}
                    </Badge>
                    {exp.recurring && (
                      <span style={{ marginInlineStart: '4px' }}>
                        <Badge variant="warning" size="sm">متكرر</Badge>
                      </span>
                    )}
                  </td>
                  <td className="data-table__muted" style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={exp.notes}>
                    {exp.notes || '-'}
                  </td>
                  <td className="data-table__muted">{formatDateTime(exp.expenseDate || exp.createdAt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="exp-total-row">
                <td colSpan={2}>الإجمالي ({summary.count} عملية)</td>
                <td className="data-table__number">-{formatCurrency(summary.total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {canAdd && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="تسجيل مصروف تشغيلي"
          icon="💸"
          subtitle="تسجيل مصروف جديد وتحديد بند الإيراد وطريقة السداد من الدرج"
          size="md"
        >
          <form onSubmit={handleSave} className="form-grid">
            <div className="field-select">
              <label className="field-select__label">نوع المصروف</label>
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
                <label className="field-select__label">اختر الموظف</label>
                <select
                  className="field-select__control"
                  value={form.employeeId}
                  onChange={(e) => {
                    const emp = employees.find(x => x.id == e.target.value);
                    setForm({ ...form, employeeId: e.target.value, amount: emp ? emp.baseSalary : '' });
                  }}
                  required
                >
                  <option value="">-- اختر --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label="المبلغ (جنيه)"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            
            <Input
              label="تاريخ المصروف"
              type="date"
              max={todayISO()}
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              required
              hint="سجّل مصروف حصل قبل كده لو اتأخرت في تسجيله"
            />

            <Input
              label="تفاصيل / تعليق (ماذا اشتريت؟)"
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            {/* Common amounts - saves typing on the repetitive daily buys */}
            <div className="exp-presets" style={{ gridColumn: '1 / -1' }}>
              {[50, 100, 200, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="exp-preset"
                  onClick={() => setForm({ ...form, amount: String(amount) })}
                >
                  {amount}
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
              <label htmlFor="paidFromDrawer">تم الدفع من درج الكاشير</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="expRecurring"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
              />
              <label htmlFor="expRecurring">مصروف متكرر (إيجار، اشتراك، قسط…)</label>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px', gridColumn: '1 / -1' }}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving}>تسجيل المصروف</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
