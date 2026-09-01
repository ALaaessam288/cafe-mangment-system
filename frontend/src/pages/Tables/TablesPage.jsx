import { useCallback, useEffect, useState, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Table2, LayoutGrid, Table as TableIcon, 
  Users, CheckCircle2, XCircle, Search, Sparkles, MapPin, Eye
} from 'lucide-react';
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
import { sounds } from '../../utils/soundEffects';
import './TablesPage.css';

const TABLE_ZONES = {
  ALL: 'كل المناطق',
  INDOOR: 'داخلي (صالة)',
  OUTDOOR: 'خارجي (تراس)',
  UPSTAIRS: 'الدور العلوي'
};

export default function TablesPage() {
  const toast = useToast();
  const { user, role } = useAuth();
  const isSupervisor = role === ROLES.SUPERVISOR;

  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID' or 'TABLE'
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form, setForm] = useState({ number: '', seats: '', zone: 'INDOOR' });
  const [isSaving, setIsSaving] = useState(false);
  const [quotaModal, setQuotaModal] = useState({ open: false, message: '' });

  const loadTables = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tablesApi.findAll();
      setTables((data || []).sort((a, b) => a.number - b.number));
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الطاولات');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      if (selectedZone !== 'ALL' && t.zone !== selectedZone) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchNum = String(t.number).includes(q);
        const matchZone = (TABLE_ZONES[t.zone] || '').toLowerCase().includes(q);
        if (!matchNum && !matchZone) return false;
      }
      return true;
    });
  }, [tables, selectedZone, searchQuery]);

  const stats = useMemo(() => {
    const total = tables.length;
    const active = tables.filter(t => t.active).length;
    const totalSeats = tables.reduce((sum, t) => sum + (parseInt(t.seats, 10) || 0), 0);
    return { total, active, totalSeats };
  }, [tables]);

  function handleOpenModal(table = null) {
    sounds.playTap();
    if (table) {
      setEditingTable(table);
      setForm({
        number: table.number,
        seats: table.seats || '',
        zone: table.zone || 'INDOOR',
      });
      setIsModalOpen(true);
    } else {
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
    sounds.playTap();
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
    <div className="page tables-page tables-creative">
      <ObserverBanner />

      {/* ── Creative Header ── */}
      <div className="page__header tables-header">
        <div className="tables-header__info">
          <div className="tables-header__icon-box">
            <Table2 size={24} className="text-accent" />
          </div>
          <div>
            <div className="tables-header__title-row">
              <h1 className="page__title">خريطة وتوزيع الطاولات</h1>
              <span className="tables-count-badge">{filteredTables.length} طاولة</span>
            </div>
            <p className="page__subtitle">تنسيق سعة الصالة، التراسات، وأماكن الجلوس</p>
          </div>
        </div>

        <div className="page__actions tables-header__actions">
          {/* View Toggle */}
          <div className="tables-view-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'GRID' ? 'view-mode-btn--active' : ''}`}
              onClick={() => { sounds.playTap(); setViewMode('GRID'); }}
            >
              <LayoutGrid size={15} />
              <span>مجسمات (3D)</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'TABLE' ? 'view-mode-btn--active' : ''}`}
              onClick={() => { sounds.playTap(); setViewMode('TABLE'); }}
            >
              <TableIcon size={15} />
              <span>جدول منظم</span>
            </button>
          </div>

          {user?.maxTables && (
            <div className="tables-quota-pill">
              <span>السعة:</span>
              <strong className="font-mono">{tables.length} / {user.maxTables}</strong>
            </div>
          )}

          {isSupervisor && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()} variant="primary">
              إضافة طاولة جديدة
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Glass Summary ── */}
      <div className="tables-kpi-strip">
        <div className="table-kpi-item">
          <span className="table-kpi-item__label">إجمالي الطاولات</span>
          <strong className="table-kpi-item__val">{stats.total} طاولة</strong>
        </div>
        <div className="table-kpi-item">
          <span className="table-kpi-item__label">الطاولات المفعلة</span>
          <strong className="table-kpi-item__val text-emerald">{stats.active} نشطة</strong>
        </div>
        <div className="table-kpi-item">
          <span className="table-kpi-item__label">إجمالي سعة الجلوس</span>
          <strong className="table-kpi-item__val text-accent font-mono">{stats.totalSeats} فرد</strong>
        </div>
      </div>

      {/* ── Zone Filters & Search Strip ── */}
      <div className="tables-filter-strip">
        <div className="tables-zone-pills">
          {Object.entries(TABLE_ZONES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`zone-pill ${selectedZone === key ? 'zone-pill--active' : ''}`}
              onClick={() => { sounds.playTap(); setSelectedZone(key); }}
            >
              <MapPin size={12} />
              <span>{label}</span>
              <span className="zone-pill__count">
                {key === 'ALL' ? tables.length : tables.filter(t => t.zone === key).length}
              </span>
            </button>
          ))}
        </div>

        <div className="tables-search-box">
          <Search size={14} className="tables-search-icon" />
          <input
            type="text"
            className="tables-search-input"
            placeholder="بحث برقم الطاولة أو المنطقة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="tables-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      </div>

      {/* ── Content View (3D Grid or Table) ── */}
      {loading ? (
        <div className="page page-center"><Spinner /></div>
      ) : filteredTables.length === 0 ? (
        <div className="tables-empty-state">
          <Table2 size={48} className="tables-empty-icon" />
          <h3>لا توجد طاولات مطابقة</h3>
          <p>أضف طاولات جديدة أو قم بتغيير فلتر البحث والمناطق</p>
          {isSupervisor && (
            <Button variant="primary" rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة طاولة الآن
            </Button>
          )}
        </div>
      ) : viewMode === 'GRID' ? (
        /* ═════ 3D Visual Cards Grid ═════ */
        <div className="tables-visual-grid">
          {filteredTables.map((table) => {
            return (
              <div 
                key={table.id} 
                className={`table-3d-card ${table.active ? 'table-3d-card--active' : 'table-3d-card--disabled'}`}
              >
                <div className="table-3d-card__head">
                  <div className="table-3d-card__badge">
                    <span className="font-mono">#{table.number}</span>
                  </div>
                  <span className={`table-status-dot ${table.active ? 'table-status-dot--active' : 'table-status-dot--disabled'}`} title={table.active ? 'نشطة' : 'معطلة'} />
                </div>

                <div className="table-3d-card__body">
                  <div className="table-3d-visual">
                    <div className="table-3d-top">
                      <span className="table-3d-num">طاولة {table.number}</span>
                    </div>
                  </div>
                  <div className="table-3d-card__zone-badge">
                    <MapPin size={11} />
                    <span>{TABLE_ZONES[table.zone] || table.zone || 'داخلي'}</span>
                  </div>
                </div>

                <div className="table-3d-card__footer">
                  <div className="table-3d-card__seats">
                    <Users size={14} className="text-muted" />
                    <span><strong>{table.seats || 4}</strong> مقاعد</span>
                  </div>

                  {isSupervisor && (
                    <div className="table-3d-card__actions">
                      <button
                        type="button"
                        className="table-action-btn table-action-btn--edit"
                        onClick={() => handleOpenModal(table)}
                        title="تعديل الطاولة"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className={`table-action-btn ${table.active ? 'table-action-btn--deactivate' : 'table-action-btn--activate'}`}
                        onClick={() => handleToggleActive(table)}
                        title={table.active ? 'تعطيل الطاولة' : 'تفعيل الطاولة'}
                      >
                        {table.active ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ═════ Data Table View ═════ */
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الطاولة</th>
                <th>سعة الجلوس</th>
                <th>المنطقة المخصصة</th>
                <th>الحالة التشغيلية</th>
                {isSupervisor && <th style={{ textAlign: 'left' }}>إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {filteredTables.map((table) => (
                <tr key={table.id}>
                  <td className="data-table__number font-mono fw-bold">طاولة #{table.number}</td>
                  <td>
                    <span className="table-seats-chip">
                      <Users size={12} />
                      <span>{table.seats ? `${table.seats} أفراد` : '—'}</span>
                    </span>
                  </td>
                  <td>
                    <span className="table-zone-chip">
                      <MapPin size={12} />
                      <span>{TABLE_ZONES[table.zone] || table.zone || '—'}</span>
                    </span>
                  </td>
                  <td>
                    <Badge variant={table.active ? 'success' : 'neutral'}>
                      {table.active ? 'جاهزة ونشطة' : 'معطلة'}
                    </Badge>
                  </td>
                  {isSupervisor && (
                    <td>
                      <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(table)}>
                          <Edit2 size={14} />
                          <span>تعديل</span>
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
        </div>
      )}

      {/* Quota Limit Reached Modal */}
      <QuotaExceededModal
        isOpen={quotaModal.open}
        onClose={() => setQuotaModal({ open: false, message: '' })}
        resourceName="الطاولات"
        currentCount={tables.length}
        maxLimit={user?.maxTables || tables.length}
        customMessage={quotaModal.message}
      />

      {/* Create / Edit Table Modal */}
      {isSupervisor && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingTable ? 'تعديل بيانات الطاولة' : 'إضافة طاولة جديدة'}
          icon={editingTable ? '✏️' : '🪑'}
          subtitle={editingTable ? `تعديل سعة ومنطقة طاولة رقم ${editingTable.number}` : 'إضافة طاولة جديدة للصالة وتحديد عدد الكراسي والمنطقة'}
          size="sm"
        >
          <form onSubmit={handleSave} className="form-grid">
            <Input
              label="رقم الطاولة"
              type="number"
              min="1"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              required
              autoFocus
            />
            <Input
              label="سعة الطاولة (عدد الكراسي)"
              type="number"
              min="1"
              value={form.seats}
              onChange={(e) => setForm({ ...form, seats: e.target.value })}
              hint="عدد الأفراد المتاح جلوسهم على الطاولة"
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
                <option value="INDOOR">داخلي (صالة)</option>
                <option value="OUTDOOR">خارجي (تراس)</option>
                <option value="UPSTAIRS">الدور العلوي</option>
              </select>
            </div>
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving} variant="primary">حفظ الطاولة</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
