import { useCallback, useEffect, useState } from 'react';
import { Plus, Check, X, Search } from 'lucide-react';
import { employeesApi } from '../../api/employeesApi';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import './EmployeesPage.css';

export default function EmployeesPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [form, setForm] = useState({ id: null, name: '', jobTitle: '', baseSalary: 0, active: true });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await employeesApi.findAll();
      setEmployees(data);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل الموظفين');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function openCreateModal() {
    setModalMode('CREATE');
    setForm({ id: null, name: '', jobTitle: '', baseSalary: 0, active: true });
    setIsModalOpen(true);
  }

  function openEditModal(emp) {
    setModalMode('EDIT');
    setForm({ ...emp });
    setIsModalOpen(true);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('أدخل اسم الموظف');
      return;
    }
    if (form.baseSalary < 0) {
      toast.error('الراتب غير صالح');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'CREATE') {
        await employeesApi.create(form);
        toast.success('تم إضافة الموظف بنجاح');
      } else {
        await employeesApi.update(form.id, form);
        toast.success('تم تحديث الموظف بنجاح');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message, 'فشل حفظ الموظف');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('متأكد إنك عايز تمسح الموظف ده؟')) return;
    try {
      await employeesApi.delete(id);
      toast.success('تم مسح الموظف بنجاح');
      loadData();
    } catch (err) {
      toast.error(err.message, 'فشل المسح');
    }
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">إدارة الموظفين</h1>
          <p className="page__subtitle">إضافة وتعديل موظفين الكافيه والرواتب</p>
        </div>
        <div className="page__actions">
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openCreateModal}>
            إضافة موظف
          </Button>
        </div>
      </div>

      <div className="page__filters">
        <Input
          placeholder="ابحث باسم الموظف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search size={16} />}
        />
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : filteredEmployees.length === 0 ? (
          <div className="data-table-empty">مفيش موظفين متسجلين أو مطابقين للبحث.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>المسمى الوظيفي</th>
                <th>الراتب الأساسي (اليومية)</th>
                <th>تاريخ الإضافة</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'left' }}>تحكم</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className={!emp.active ? 'inactive-row' : ''}>
                  <td style={{ fontWeight: 'var(--fw-medium)' }}>{emp.name}</td>
                  <td>{emp.jobTitle || '—'}</td>
                  <td>{formatCurrency(emp.baseSalary)}</td>
                  <td>{formatDateTime(emp.createdAt)}</td>
                  <td>
                    <Badge variant={emp.active ? 'success' : 'neutral'}>
                      {emp.active ? 'نشط' : 'موقوف'}
                    </Badge>
                  </td>
                  <td>
                    <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                      <Button variant="secondary" size="sm" onClick={() => openEditModal(emp)}>تعديل</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(emp.id)}>مسح</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => !saving && setIsModalOpen(false)}
        title={modalMode === 'CREATE' ? 'إضافة موظف جديد' : 'تعديل بيانات موظف'}
      >
        <form onSubmit={handleSubmit} className="form-stack">
          <Input
            label="اسم الموظف"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            autoFocus
          />
          <Input
            label="المسمى الوظيفي"
            name="jobTitle"
            value={form.jobTitle || ''}
            onChange={handleChange}
            placeholder="مثال: شيف، ويتر، باريستا"
          />
          <Input
            label="الراتب الأساسي / اليومية"
            name="baseSalary"
            type="number"
            min="0"
            step="0.01"
            value={form.baseSalary}
            onChange={handleChange}
            required
          />
          <label className="checkbox-label" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={handleChange}
            />
            نشط (متاح لصرف الرواتب)
          </label>
          <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>إلغاء</Button>
            <Button type="submit" variant="primary" loading={saving}>حفظ</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
