import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, KeyRound } from 'lucide-react';
import { usersApi } from '../../api/usersApi';
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

export default function UsersPage() {
  const toast = useToast();
  const { role, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const canManageUsers = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [quotaModal, setQuotaModal] = useState({ open: false, message: '' });
  
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Forms
  const [form, setForm] = useState({ fullName: '', username: '', role: 'CASHIER', password: '', pin: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.findAll();
      setUsers(data);
    } catch (err) {
      toast.error(err.message, 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function handleOpenEdit(user = null) {
    if (user) {
      setEditingUser(user);
      setForm({ fullName: user.fullName, username: user.username, role: user.role, password: '', pin: '' });
      setIsEditModalOpen(true);
    } else {
      if (currentUser?.maxUsers && users.length >= currentUser.maxUsers) {
        setQuotaModal({
          open: true,
          message: `لقد بلغت الحد الأقصى للمستخدمين المسموح بهم في باقتك (${users.length} من أصل ${currentUser.maxUsers} مستخدم). يرجى ترقية الباقة لإضافة كاشيرات وموظفين جدد.`
        });
        return;
      }
      setEditingUser(null);
      setForm({ fullName: '', username: '', role: 'CASHIER', password: '', pin: '' });
      setIsEditModalOpen(true);
    }
  }

  function handleOpenPassword(user) {
    setEditingUser(user);
    setPasswordForm({ newPassword: '' });
    setIsPasswordModalOpen(true);
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.username.trim() || !form.role) return;

    setIsSaving(true);
    try {
      if (editingUser) {
        await usersApi.update(editingUser.id, {
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          role: form.role,
        });
        toast.success('تم تحديث بيانات المستخدم بنجاح');
      } else {
        if (!form.password) {
          toast.warning('كلمة المرور مطلوبة للمستخدم الجديد');
          setIsSaving(false);
          return;
        }
        await usersApi.create({
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          password: form.password,
          role: form.role,
          pin: form.pin || null,
        });
        toast.success('تم إنشاء المستخدم بنجاح');
      }
      setIsEditModalOpen(false);
      await loadUsers();
    } catch (err) {
      if (err.status === 403 || err.message?.includes('وصلت للحد الأقصى') || err.message?.includes('Quota exceeded') || err.data?.error === 'QUOTA_EXCEEDED') {
        setIsEditModalOpen(false);
        setQuotaModal({ open: true, message: err.message });
      } else {
        toast.error(err.message, 'فشل حفظ بيانات المستخدم');
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      toast.warning('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setIsSaving(true);
    try {
      await usersApi.changePassword(editingUser.id, { newPassword: passwordForm.newPassword });
      toast.success('تم تغيير كلمة المرور بنجاح');
      setIsPasswordModalOpen(false);
    } catch (err) {
      toast.error(err.message, 'فشل تغيير كلمة المرور');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(user) {
    if (user.id === currentUser.id) {
      toast.warning('لا يمكنك تعطيل حسابك الشخصي الحالي.');
      return;
    }
    try {
      if (user.active) {
        await usersApi.deactivate(user.id);
      } else {
        await usersApi.activate(user.id);
      }
      toast.success(`تم ${user.active ? 'تعطيل' : 'تفعيل'} حساب ${user.username}`);
      await loadUsers();
    } catch (err) {
      toast.error(err.message, 'فشل تغيير حالة المستخدم');
    }
  }

  function getRoleBadgeVariant(r) {
    if (r === 'ADMIN') return 'accent';
    if (r === 'SUPERVISOR') return 'info';
    return 'neutral';
  }

  return (
    <div className="page">
      {!canManageUsers && <ObserverBanner />}
      <div className="page__header">
        <div>
          <h1 className="page__title">إدارة المستخدمين 👤</h1>
          <p className="page__subtitle">إدارة حسابات الموظفين، تحديد الصلاحيات وتغيير كلمات المرور</p>
        </div>
        <div className="page__actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentUser?.maxUsers && (
            <span
              className="badge"
              style={{
                background: users.length >= currentUser.maxUsers ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                color: users.length >= currentUser.maxUsers ? '#ef4444' : '#f59e0b',
                border: `1px solid ${users.length >= currentUser.maxUsers ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.3)'}`,
                padding: '6px 12px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              السعة: {users.length} / {currentUser.maxUsers} مستخدم
            </span>
          )}
          {canManageUsers && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenEdit()} variant="primary">
              إضافة مستخدم جديد
            </Button>
          )}
        </div>
      </div>

      {/* Quota Limit Reached Modal */}
      <QuotaExceededModal
        isOpen={quotaModal.open}
        onClose={() => setQuotaModal({ open: false, message: '' })}
        resourceName="المستخدمين"
        currentCount={users.length}
        maxLimit={currentUser?.maxUsers || users.length}
        customMessage={quotaModal.message}
      />

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : users.length === 0 ? (
          <div className="data-table-empty">لا يوجد مستخدمين حالياً.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم بالكامل</th>
                <th>اسم المستخدم</th>
                <th>الصلاحية</th>
                <th>الحالة</th>
                {canManageUsers && <th style={{ textAlign: 'left' }}>تحكم</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    {u.fullName} {u.id === currentUser.id && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>(حسابك الحالي)</span>}
                  </td>
                  <td className="data-table__mono">{u.username}</td>
                  <td>
                    <Badge variant={getRoleBadgeVariant(u.role)} size="sm">{u.role}</Badge>
                  </td>
                  <td>
                    <Badge variant={u.active ? 'success' : 'danger'}>
                      {u.active ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  {canManageUsers && (
                    <td>
                      <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPassword(u)} title="تغيير كلمة المرور">
                          <KeyRound size={15} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(u)} title="تعديل المستخدم">
                          <Edit2 size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(u)}
                          disabled={u.id === currentUser.id}
                          style={{ color: u.active ? 'var(--danger)' : 'var(--success)' }}
                        >
                          {u.active ? 'تعطيل' : 'تفعيل'}
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

      {/* Edit / Create User Modal */}
      {canManageUsers && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={editingUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
          icon={editingUser ? '✏️' : '👤'}
          subtitle={editingUser ? `تعديل صلاحيات وحساب: ${editingUser.fullName || editingUser.username}` : 'إنشاء حساب جديد للموظف وتحديد الصلاحية وكلمة المرور'}
          size="md"
        >
          <form onSubmit={handleSaveUser} className="modal-form">
            <div className="modal-field-group">
              <label className="modal-field-label">الاسم بالكامل <span className="required">*</span></label>
              <input
                className="modal-field-input"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="مثال: أحمد محمد"
                required
                autoFocus
              />
            </div>

            <div className="modal-field-group">
              <label className="modal-field-label">اسم المستخدم (Login Username) <span className="required">*</span></label>
              <input
                className="modal-field-input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="مثال: ahmed_pos"
                required
              />
            </div>
            
            <div className="modal-field-group">
              <label className="modal-field-label">نوع الصلاحية <span className="required">*</span></label>
              <select
                className="modal-field-select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                required
              >
                <option value="CASHIER">كاشير (نقطة البيع والتحضير فقط)</option>
                <option value="SUPERVISOR">مدير العمليات / مشرف (العمليات وإدارة المنيو والجرد)</option>
                <option value="ADMIN">مالك المنشأة / أدمن (كامل الصلاحيات والتقارير)</option>
              </select>
            </div>

            {!editingUser && (
              <div className="modal-form-grid">
                <div className="modal-field-group">
                  <label className="modal-field-label">كلمة المرور (Password) <span className="required">*</span></label>
                  <input
                    className="modal-field-input"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="على الأقل 6 خانات"
                    required
                  />
                </div>
                <div className="modal-field-group">
                  <label className="modal-field-label">رمز PIN السريع (اختياري)</label>
                  <input
                    className="modal-field-input"
                    type="password"
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value })}
                    placeholder="من 4 إلى 8 أرقام"
                  />
                </div>
              </div>
            )}

            <div className="modal__footer" style={{ padding: '10px 0 0 0', background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving} variant="primary">حفظ البيانات</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change Password Modal */}
      {canManageUsers && (
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          title="تغيير كلمة المرور"
          icon="🔑"
          subtitle={`تعيين كلمة مرور جديدة للمستخدم: ${editingUser?.fullName || editingUser?.username}`}
          size="sm"
        >
          <form onSubmit={handleChangePassword} className="modal-form">
            <div className="modal-field-group">
              <label className="modal-field-label">كلمة المرور الجديدة <span className="required">*</span></label>
              <input
                className="modal-field-input"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ newPassword: e.target.value })}
                placeholder="أدخل 6 خانات على الأقل"
                required
                autoFocus
              />
            </div>
            <div className="modal__footer" style={{ padding: '10px 0 0 0', background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Button variant="secondary" onClick={() => setIsPasswordModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving} variant="primary">تحديث كلمة المرور</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
