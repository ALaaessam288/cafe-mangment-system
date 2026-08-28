import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { tablesApi } from '../../api/tablesApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import Spinner from '../../components/Spinner/Spinner';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import QuotaExceededModal from '../../components/QuotaExceededModal/QuotaExceededModal';
import { ROLES } from '../../utils/constants';
import './TablesPage.css';

const TABLE_ZONES = {
  INDOOR: 'داخلي (صالة)',
  OUTDOOR: 'خارجي (تراس)',
  UPSTAIRS: 'الدور العلوي'
};

export default function TablesPage() {
  const toast = useToast();
  const { user, role } = useAuth();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form, setForm] = useState({ number: '', seats: '', zone: 'INDOOR' });
  const [isSaving, setIsSaving] = useState(false);
  const [quotaModal, setQuotaModal] = useState({ open: false, message: '' });

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tablesApi.findAll();
      setTables(data.sort((a, b) => a.number - b.number));
    } catch (err) {
      toast.error(err.message, 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTables(); }, [loadTables]);

  function handleOpenModal(table = null) {
    if (table) {
      setEditingTable(table);
      setForm({
        number: table.number,
        seats: table.seats || '',
        zone: table.zone || 'INDOOR',
      });
      setIsModalOpen(true);
    } else {
      // Check quota before opening
      if (user?.maxTables && tables.length >= user.maxTables) {
        setQuotaModal({
          open: true,
          message: `لقد بلغت الحد الأقصى للطاولات المسموحة في باقتك (${tables.length} من أصل ${user.maxTables} طاولة). يرجى ترقية الباقة لزيادة السعة.`
        });
        return;
      }
      setEditingTable(null);
      setForm({ number: '', seats: '', zone: 'INDOOR' });
      setIsModalOpen(true);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.number || !form.seats || !form.zone) return;

    setIsSaving(true);
    const payload = {
      number: parseInt(form.number, 10),
      seats: parseInt(form.seats, 10),
      zone: form.zone,
    };

    try {
      if (editingTable) {
        await tablesApi.update(editingTable.id, payload);
        toast.success('تم تعديل الترابيزة بنجاح');
      } else {
        await tablesApi.create(payload);
        toast.success('تم إضافة الترابيزة بنجاح');
      }
      setIsModalOpen(false);
      await loadTables();
    } catch (err) {
      if (err.status === 403 || err.message?.includes('وصلت للحد الأقصى') || err.message?.includes('Quota exceeded') || err.data?.error === 'QUOTA_EXCEEDED') {
        setIsModalOpen(false);
        setQuotaModal({ open: true, message: err.message });
      } else {
        toast.error(err.message, 'فشل في حفظ الترابيزة');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(table) {
    try {
      if (table.active) {
        await tablesApi.deactivate(table.id);
      } else {
        await tablesApi.activate(table.id);
      }
      toast.success(`ترابيزة ${table.number} ${table.active ? 'تم تعطيلها' : 'تم تفعيلها'}`);
      await loadTables();
    } catch (err) {
      toast.error(err.message, 'فشل في تحديث حالة الترابيزة');
    }
  }

  return (
    <div className="page tables-page">
      <ObserverBanner />
      <div className="page__header">
        <div>
          <h1 className="page__title">الترابيزات</h1>
          <p className="page__subtitle">إدارة ترابيزات الكافيه وسعة الجلوس</p>
        </div>
        <div className="page__actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user?.maxTables && (
            <span
              className="badge"
              style={{
                background: tables.length >= user.maxTables ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                color: tables.length >= user.maxTables ? '#ef4444' : '#f59e0b',
                border: `1px solid ${tables.length >= user.maxTables ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.3)'}`,
                padding: '6px 12px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              السعة: {tables.length} / {user.maxTables} طاولة
            </span>
          )}
          {role === ROLES.SUPERVISOR && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة ترابيزة
            </Button>
          )}
        </div>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : tables.length === 0 ? (
          <div className="data-table-empty">مفيش ترابيزات. ضيف واحدة عشان تبدأ.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الترابيزة</th>
                <th>السعة</th>
                <th>المنطقة</th>
                <th>الحالة</th>
                {role === ROLES.SUPERVISOR && <th style={{ textAlign: 'left' }}>تحكم</th>}
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id} data-zone={table.zone}> 
                  <td className="data-table__number">ترابيزة {table.number}</td>
                  <td>{table.seats ? `${table.seats} أشخاص` : '—'}</td>
                  <td>{TABLE_ZONES[table.zone] || table.zone || '—'}</td>
                  <td>
                    <Badge variant={table.active ? 'success' : 'neutral'}>
                      {table.active ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  {role === ROLES.SUPERVISOR && (
                    <td>
                      <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(table)}>
                          <Edit2 size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(table)}
                          style={{ color: table.active ? 'var(--danger)' : 'var(--success)' }}
                        >
                          {table.active ? 'تعطيل' : 'تفعيل'}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quota Limit Reached Modal */}
      <QuotaExceededModal
        isOpen={quotaModal.open}
        onClose={() => setQuotaModal({ open: false, message: '' })}
        resourceName="الطاولات"
        currentCount={tables.length}
        maxLimit={user?.maxTables || tables.length}
        customMessage={quotaModal.message}
      />

      {role === ROLES.SUPERVISOR && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingTable ? 'تعديل بيانات الترابيزة' : 'إضافة ترابيزة جديدة'}
          icon={editingTable ? '✏️' : '🪑'}
          subtitle={editingTable ? `تعديل سعة ومنطقة ترابيزة رقم ${editingTable.number}` : 'إضافة ترابيزة جديدة للصالة وتحديد عدد الكراسي والمنطقة'}
          size="sm"
        >
          <form onSubmit={handleSave} className="form-grid">
            <Input
              label="رقم الترابيزة"
              type="number"
              min="1"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              required
              autoFocus
            />
            <Input
              label="سعة الترابيزة (عدد الكراسي)"
              type="number"
              min="1"
              value={form.seats}
              onChange={(e) => setForm({ ...form, seats: e.target.value })}
              hint="عدد الأفراد المتاح جلوسهم على الترابيزة"
              required
            />
            <div className="field-select">
              <label className="field-select__label">منطقة الصالة / الجلوس</label>
              <select
                className="field-select__control"
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                required
              >
                {Object.entries(TABLE_ZONES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving} variant="primary">حفظ الترابيزة</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
