import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { ROLES } from '../../utils/constants';

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

export default function ExpensesPage() {
  const toast = useToast();
  const { role } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ 
    type: 'MATERIALS', 
    revenueLine: 'SHARED', 
    amount: '', 
    employeeId: '',
    paidFromDrawer: true 
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
    setForm({ type: 'MATERIALS', revenueLine: 'SHARED', amount: '', employeeId: '', paidFromDrawer: true });
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
        expenseDate: new Date().toISOString().split('T')[0],
        recurring: false,
        employeeId: form.type === 'SALARIES' ? form.employeeId : null,
        paidFromDrawer: form.paidFromDrawer
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

  const canAdd = role === ROLES.ADMIN || role === ROLES.SUPERVISOR || role === ROLES.CASHIER;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">المصاريف</h1>
          <p className="page__subtitle">تسجيل ومتابعة مصاريف التشغيل</p>
        </div>
        <div className="page__actions">
          {canAdd && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة مصروف
            </Button>
          )}
        </div>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : expenses.length === 0 ? (
          <div className="data-table-empty">مفيش مصاريف اتسجلت لسه.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>نوع المصروف</th>
                <th>بند الإيراد</th>
                <th>المبلغ</th>
                <th>طريقة الدفع</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp) => (
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
                  </td>
                  <td className="data-table__muted">{formatDateTime(exp.expenseDate || exp.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canAdd && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="إضافة مصروف"
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="paidFromDrawer"
                checked={form.paidFromDrawer}
                onChange={(e) => setForm({ ...form, paidFromDrawer: e.target.checked })}
              />
              <label htmlFor="paidFromDrawer">تم الدفع من درج الكاشير</label>
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
