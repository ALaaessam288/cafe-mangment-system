import { useCallback, useEffect, useState } from 'react';
import { platformApi } from '../../api/platformApi';
import { useToast } from '../../context/ToastContext';
import Spinner from '../../components/Spinner/Spinner';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import Modal from '../../components/Modal/Modal';
import { Crown, Building2, Sparkles, CheckCircle2, PauseCircle, PlayCircle, Plus, Search, Filter, UserPlus, TrendingUp, Activity } from 'lucide-react';
import './SuperAdminPage.css';

export default function SuperAdminPage() {
  const toast = useToast();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // New Tenant Form
  const [newTenantForm, setNewTenantForm] = useState({
    name: '',
    slug: '',
    businessType: 'CAFE_AND_RESTAURANT',
    ownerUsername: '',
    ownerPassword: '',
    ownerFullName: '',
    timezone: 'Africa/Cairo',
    currency: 'EGP'
  });

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformApi.getAllTenants();
      setTenants(data);
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل بيانات الكافيهات المشتركة');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  async function handleUpdateSubscription(tenantId, plan, status, extendDays) {
    setUpdating(true);
    try {
      await platformApi.updateSubscription(tenantId, { plan, status, extendDays });
      toast.success('تم تحديث خطة الكافيه بنجاح! 🚀');
      setEditModal(false);
      setSelectedTenant(null);
      loadTenants();
    } catch (err) {
      toast.error(err.message, 'فشل في تحديث الخطة');
    } finally {
      setUpdating(false);
    }
  }

  const handleOpenEditModal = async (t) => {
    setSelectedTenant(t);
    setEditModal(true);
    setLoadingLogs(true);
    setActivityLogs([]);
    try {
      const logs = await platformApi.getTenantActivityLog(t.id);
      setActivityLogs(logs || []);
    } catch (err) {
      toast.error(err.message, 'فشل جلب سجل النشاطات');
    } finally {
      setLoadingLogs(false);
    }
  };

  async function handleBulkAction(action) {
    if (selectedIds.length === 0) return;
    setUpdating(true);
    try {
      for (const id of selectedIds) {
        if (action === 'ACTIVE') await platformApi.updateSubscription(id, { status: 'ACTIVE' });
        if (action === 'SUSPENDED') await platformApi.updateSubscription(id, { status: 'SUSPENDED' });
        if (action === 'TRIAL_EXTEND') await platformApi.updateSubscription(id, { extendDays: 7 });
      }
      toast.success('تم تنفيذ الإجراء الجماعي بنجاح');
      setSelectedIds([]);
      loadTenants();
    } catch (err) {
      toast.error('حدث خطأ أثناء تنفيذ الإجراء الجماعي');
    } finally {
      setUpdating(false);
    }
  }

  async function handleCreateTenant(e) {
    e.preventDefault();
    if (!newTenantForm.name || !newTenantForm.slug || !newTenantForm.ownerUsername || !newTenantForm.ownerPassword) {
      toast.error('يرجى ملء كافة البيانات المطلوبة');
      return;
    }

    setUpdating(true);
    try {
      await platformApi.provisionTenant(newTenantForm);
      toast.success(`تم إنشاء وتفعيل كافيه (${newTenantForm.name}) بنجاح! 🚀`);
      setCreateModal(false);
      setNewTenantForm({
        name: '',
        slug: '',
        businessType: 'CAFE_AND_RESTAURANT',
        ownerUsername: '',
        ownerPassword: '',
        ownerFullName: '',
        timezone: 'Africa/Cairo',
        currency: 'EGP'
      });
      loadTenants();
    } catch (err) {
      toast.error(err.message, 'فشل في إضافة الكافيه');
    } finally {
      setUpdating(false);
    }
  }

  // Filtered tenants
  const filteredTenants = tenants.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter || t.subscriptionPlan === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = tenants.filter((t) => t.status === 'ACTIVE' || t.subscriptionPlan === 'PRO' || t.subscriptionPlan === 'STARTER').length;
  const trialCount = tenants.filter((t) => t.subscriptionPlan === 'TRIAL' || t.status === 'TRIAL').length;
  const estimatedRevenue = tenants.reduce((acc, t) => {
    if (t.subscriptionPlan === 'PRO') return acc + 999;
    if (t.subscriptionPlan === 'STARTER') return acc + 499;
    return acc;
  }, 0);

  return (
    <div className="page">
      <div className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page__title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Crown size={24} style={{ color: '#fbbf24' }} /> لوحة تحكم مالك المنصة (Super Admin)
          </h1>
          <p className="page__subtitle">إدارة الكافيهات المشتركة، إضافة كافيهات جديدة وتفعيل الاشتراكات</p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => setCreateModal(true)}
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', fontWeight: 'bold' }}
        >
          <UserPlus size={16} /> + إضافة كافيه جديد
        </Button>
      </div>

      {/* KPI Stat Cards */}
      <div className="super-admin-stats">
        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Building2 size={20} />
          </div>
          <div>
            <div className="stat-card__label">إجمالي الكافيهات</div>
            <div className="stat-card__value">{tenants.length}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="stat-card__label">الاشتراكات النشطة</div>
            <div className="stat-card__value">{activeCount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div className="stat-card__label">الفترات التجريبية (Trial)</div>
            <div className="stat-card__value">{trialCount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Crown size={20} />
          </div>
          <div>
            <div className="stat-card__label">الدخل الشهري المتوقع</div>
            <div className="stat-card__value">{estimatedRevenue.toLocaleString()} ج.م</div>
          </div>
        </div>
      </div>

      {/* Mock Revenue Section */}
      <div className="super-admin-revenue-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '20px' }}>
        <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={18} color="var(--accent)" /> الإيرادات الشهرية المتكررة (MRR)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '120px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
            {[30, 45, 60, 50, 75, 100].map((h, i) => (
              <div key={i} style={{ flex: 1, background: 'var(--accent)', height: `${h}%`, borderRadius: '4px 4px 0 0', opacity: i === 5 ? 1 : 0.6 }} title={`شهر ${i+1}`} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: 'var(--text-secondary)', fontSize: '12px' }}>
            <span>يناير</span><span>يونيو</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} color="var(--danger)" /> معدل الإلغاء (Churn Rate)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', height: '100%' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}><span>الشهر الحالي</span><span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>2.4%</span></div>
              <div style={{ background: 'var(--bg-tertiary)', height: '8px', borderRadius: '4px' }}><div style={{ background: 'var(--danger)', height: '100%', width: '2.4%', borderRadius: '4px' }} /></div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '14px' }}><span>الشهر السابق</span><span>3.1%</span></div>
              <div style={{ background: 'var(--bg-tertiary)', height: '8px', borderRadius: '4px' }}><div style={{ background: 'var(--text-muted)', height: '100%', width: '3.1%', borderRadius: '4px' }} /></div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--success)' }}>↓ تحسن بنسبة 0.7% عن الشهر الماضي</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-primary)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Filter size={18} color="var(--info)" /> مسار التحويل (Conversion Funnel)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px 12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}><span>زيارات الموقع</span><strong>1,250</strong></div>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '8px 12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', margin: '0 10px' }}><span>تسجيل حساب (Trial)</span><strong>85 (6.8%)</strong></div>
            <div style={{ background: 'rgba(59, 130, 246, 0.3)', padding: '8px 12px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', margin: '0 20px' }}><span>اشتراك مدفوع (PRO)</span><strong>12 (14.1%)</strong></div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="بحث باسم الكافيه أو الرابط..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'ACTIVE', 'TRIAL', 'SUSPENDED'].map((st) => (
            <Button
              key={st}
              type="button"
              variant={statusFilter === st ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' ? 'الكل' : st === 'ACTIVE' ? 'النشطة' : st === 'TRIAL' ? 'التجريبية' : 'الموقوفة'}
            </Button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="data-table-wrap" style={{ marginTop: '16px' }}>
        
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: 'var(--bg-lighter)', padding: '12px', borderRadius: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>تم تحديد {selectedIds.length} كافيه:</span>
            <Button size="sm" variant="success" onClick={() => handleBulkAction('ACTIVE')} loading={updating}><PlayCircle size={14} /> تفعيل الكل</Button>
            <Button size="sm" variant="danger" onClick={() => handleBulkAction('SUSPENDED')} loading={updating}><PauseCircle size={14} /> إيقاف الكل</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkAction('TRIAL_EXTEND')} loading={updating}><Plus size={14} /> تمديد التجربة +7 أيام</Button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
        ) : filteredTenants.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>لا توجد نتائج مطابقة للبحث</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredTenants.length && filteredTenants.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredTenants.map(t => t.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                </th>
                <th>الكافيه</th>
                <th>الرابط (Slug)</th>
                <th>الخطة الحالية</th>
                <th>الحالة</th>
                <th>الحدود (طاولات / كاشيرات)</th>
                <th>انتهاء التجربة</th>
                <th>التحكم والعمليات</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.map((t) => (
                <tr key={t.id} style={{ background: selectedIds.includes(t.id) ? 'rgba(59, 130, 246, 0.05)' : '' }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, t.id]);
                        else setSelectedIds(selectedIds.filter(id => id !== t.id));
                      }}
                    />
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{t.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{t.slug}</td>
                  <td>
                    <span className={`badge ${t.subscriptionPlan === 'PRO' ? 'badge--success' : t.subscriptionPlan === 'STARTER' ? 'badge--info' : 'badge--warning'}`}>
                      {t.planDisplayName || t.subscriptionPlan}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${t.status === 'ACTIVE' || t.status === 'TRIAL' ? 'badge--success' : 'badge--danger'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    {t.maxTables === 2147483647 ? 'غير محدود 🚀' : `${t.maxTables} طاولات / ${t.maxUsers} كاشير`}
                  </td>
                  <td>
                    {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('ar-EG') : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEditModal(t)}
                      >
                        <Sparkles size={14} /> إشراف الخطة
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateSubscription(t.id, null, null, 7)}
                        title="تمديد الفترة التجريبية +7 أيام"
                      >
                        <Plus size={14} /> +7 أيام
                      </Button>

                      {t.status === 'SUSPENDED' ? (
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          onClick={() => handleUpdateSubscription(t.id, null, 'ACTIVE', null)}
                        >
                          <PlayCircle size={14} /> تفعيل
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => handleUpdateSubscription(t.id, null, 'SUSPENDED', null)}
                        >
                          <PauseCircle size={14} /> إيقاف
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

      {/* Direct Provisioning Modal */}
      {createModal && (
        <Modal title="إضافة كافيه جديد مباشر من مالك المنصة ✦ Caffio" onClose={() => setCreateModal(false)}>
          <form onSubmit={handleCreateTenant} className="form-grid" style={{ padding: '8px 0' }}>
            <Input
              label="اسم الكافيه بالكامل"
              placeholder="مثال: روقان كافيه الفرع الرئيسي"
              value={newTenantForm.name}
              onChange={(e) => {
                const name = e.target.value;
                const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                setNewTenantForm({ ...newTenantForm, name, slug: newTenantForm.slug || slug });
              }}
              required
            />

            <Input
              label="رابط الكافيه بالإنجليزية (Slug)"
              placeholder="روابط المطبوعات والحسابات (مثال: rawqan-cafe)"
              value={newTenantForm.slug}
              onChange={(e) => setNewTenantForm({ ...newTenantForm, slug: e.target.value.toLowerCase().trim() })}
              required
            />

            <Input
              label="اسم صاحب الكافيه / المدير"
              placeholder="مثال: أحمد محمود"
              value={newTenantForm.ownerFullName}
              onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerFullName: e.target.value })}
              required
            />

            <Input
              label="اسم مستخدم المدير (Username)"
              placeholder="اسم مستخدم الدخول"
              value={newTenantForm.ownerUsername}
              onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerUsername: e.target.value.trim() })}
              required
            />

            <Input
              label="كلمة سر المدير"
              type="password"
              placeholder="كلمة السر الأولى"
              value={newTenantForm.ownerPassword}
              onChange={(e) => setNewTenantForm({ ...newTenantForm, ownerPassword: e.target.value })}
              required
            />

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button type="button" variant="secondary" onClick={() => setCreateModal(false)}>إلغاء</Button>
              <Button type="submit" variant="success" loading={updating}>تأكيد وتأسيس الكافيه 🚀</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Subscription Modal */}
      {editModal && selectedTenant && (
        <Modal title={`تغيير اشتراك كافيه: ${selectedTenant.name}`} onClose={() => setEditModal(false)}>
          <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Usage vs Limits Info */}
            <div style={{ background: 'var(--bg-lighter)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>الاستهلاك الفعلي للطاولات:</span>
                <strong style={{ color: 'var(--text-primary)' }}>3 / {selectedTenant.maxTables === 2147483647 ? 'غير محدود' : selectedTenant.maxTables}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>استهلاك المستخدمين:</span>
                <strong style={{ color: 'var(--text-primary)' }}>1 / {selectedTenant.maxUsers === 2147483647 ? 'غير محدود' : selectedTenant.maxUsers}</strong>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              اختر الخطة الجديدة المراد تطبيقها على كافيه <strong>{selectedTenant.name}</strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button
                type="button"
                variant="primary"
                loading={updating}
                onClick={() => handleUpdateSubscription(selectedTenant.id, 'PRO', 'ACTIVE', null)}
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#1c1917', fontWeight: 'bold' }}
              >
                <Crown size={16} /> ترقية إلى الخطة الشاملة (PRO - 999 ج.م)
              </Button>

              <Button
                type="button"
                variant="secondary"
                loading={updating}
                onClick={() => handleUpdateSubscription(selectedTenant.id, 'STARTER', 'ACTIVE', null)}
              >
                ☕ ترقية إلى خطة الكافيه الأساسية (STARTER - 499 ج.م)
              </Button>

              <Button
                type="button"
                variant="outline"
                loading={updating}
                onClick={() => handleUpdateSubscription(selectedTenant.id, 'TRIAL', 'TRIAL', 14)}
              >
                🎁 تمديد الفترة التجريبية (+14 يوم)
              </Button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '12px 0' }} />
            
            <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>سجل النشاطات (Activity Log)</h4>
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', padding: '12px' }}>
              {loadingLogs ? (
                <div style={{ textAlign: 'center', padding: '20px' }}><Spinner size="sm" /></div>
              ) : activityLogs.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>لا توجد نشاطات مسجلة</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activityLogs.map((log, i) => (
                    <li key={i} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: i < activityLogs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <span>{log.action}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(log.createdAt).toLocaleString('ar-EG')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </Modal>
      )}
    </div>
  );
}
