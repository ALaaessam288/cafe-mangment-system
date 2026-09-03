import { useCallback, useEffect, useState } from 'react';
import { 
  Plus, Edit2, KeyRound, LayoutGrid, Table as TableIcon, 
  Users, Shield, UserCheck, CheckCircle2, XCircle 
} from 'lucide-react';
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
import { sounds } from '../../utils/soundEffects';
import './UsersPage.css';

export default function UsersPage() {
  const toast = useToast();
  const { role, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('GRID');

  const canManageUsers = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [quotaModal, setQuotaModal] = useState({ open: false, message: '' });
  
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Forms
  const [form, setForm] = useState({ fullName: '', username: '', role: 'CASHIER', password: '', pin: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });
  const [pinForm, setPinForm] = useState({ newPin: '' });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.findAll();
      setUsers(data || []);
    } catch (err) {
      toast.error(err.message, 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  function handleOpenEdit(user = null) {
    sounds.playTap();
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
    sounds.playTap();
    setEditingUser(user);
    setPasswordForm({ newPassword: '' });
    setIsPasswordModalOpen(true);
  }

  function handleOpenPin(user) {
    sounds.playTap();
    setEditingUser(user);
    setPinForm({ newPin: '' });
    setIsPinModalOpen(true);
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
          pin: form.pin && form.pin.trim() ? form.pin.trim() : undefined,
        });
        toast.success('تم تحديث بيانات المستخدم ورمز PIN بنجاح');
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
        toast.error(err.message, 'فشل حفظ المستخدم');
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

  async function handleChangePin(e) {
    e.preventDefault();
    if (!pinForm.newPin || pinForm.newPin.length < 4) {
      toast.warning('رمز PIN يجب أن يكون 4 أرقام على الأقل');
      return;
    }
    setIsSaving(true);
    try {
      await usersApi.update(editingUser.id, {
        fullName: editingUser.fullName,
        username: editingUser.username,
        role: editingUser.role,
        pin: pinForm.newPin.trim(),
      });
      toast.success(`تم تعيين رمز PIN بنجاح للمستخدم ${editingUser.fullName || editingUser.username}`);
      setIsPinModalOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(err.message, 'فشل تعيين رمز PIN');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(user) {
    sounds.playTap();
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

  function getRoleTitle(r) {
    if (r === 'ADMIN') return '👑 مالك المنشأة';
    if (r === 'SUPERVISOR') return '⚡ مدير العمليات (Supervisor)';
    return '🛒 كاشير';
  }

  return (
    <div className="page users-page users-creative">
      {!canManageUsers && <ObserverBanner />}

      <div className="page__header users-header">
        <div className="users-header__info">
          <div className="users-header__icon-box">
            <Users size={24} />
          </div>
          <div>
            <div className="users-header__title-row">
              <h1 className="page__title">المستخدمين وصلاحيات الفريق</h1>
              <span className="users-count-badge">{users.length} مستخدم</span>
            </div>
            <p className="page__subtitle">إدارة حسابات الكاشير، المشرفين، كلمات المرور ورموز الـ PIN</p>
          </div>
        </div>

        <div className="page__actions users-header__actions">
          <div className="tables-view-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'GRID' ? 'view-mode-btn--active' : ''}`}
              onClick={() => { sounds.playTap(); setViewMode('GRID'); }}
            >
              <LayoutGrid size={15} />
              <span>كروت (3D)</span>
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

          {currentUser?.maxUsers && (
            <div className="tables-quota-pill">
              <span>السعة:</span>
              <strong className="font-mono">{users.length} / {currentUser.maxUsers}</strong>
            </div>
          )}

          {canManageUsers && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenEdit()} variant="primary">
              إضافة مستخدم جديد
            </Button>
          )}
        </div>
      </div>

      <QuotaExceededModal
        isOpen={quotaModal.open}
        onClose={() => setQuotaModal({ open: false, message: '' })}
        resourceName="المستخدمين"
        currentCount={users.length}
        maxLimit={currentUser?.maxUsers || users.length}
        customMessage={quotaModal.message}
      />

      {loading ? (
        <div className="page page-center"><Spinner /></div>
      ) : users.length === 0 ? (
        <div className="tables-empty-state">
          <Users size={48} className="tables-empty-icon" />
          <h3>لا يوجد مستخدمين مضافين</h3>
          <p>أضف حسابات جديدة للكاشير أو المشرفين للبدء</p>
          {canManageUsers && (
            <Button variant="primary" rightIcon={<Plus size={16} />} onClick={() => handleOpenEdit()}>
              إضافة مستخدم الآن
            </Button>
          )}
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="users-grid">
          {users.map((u) => {
            const roleClass = u.role === 'ADMIN' ? 'user-card__role-pill--admin' : u.role === 'SUPERVISOR' ? 'user-card__role-pill--supervisor' : 'user-card__role-pill--cashier';
            const initials = u.fullName ? u.fullName.trim().charAt(0) : u.username.charAt(0);
            return (
              <div key={u.id} className={`user-card ${u.active ? '' : 'user-card--disabled'}`}>
                <div className="user-card__head">
                  <div className="user-avatar-circle">{initials}</div>
                  <span className={`user-card__role-pill ${roleClass}`}>
                    {getRoleTitle(u.role)}
                  </span>
                </div>

                <div>
                  <h3 className="user-card__name">{u.fullName || u.username}</h3>
                  <div className="user-card__username">@{u.username}</div>
                </div>

                <div className="user-card__footer">
                  <Badge variant={u.active ? 'success' : 'neutral'}>
                    {u.active ? 'نشط' : 'معطل'}
                  </Badge>

                  {canManageUsers && (
                    <div className="user-card__actions">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenPin(u)} title="تعيين رمز PIN السريع" style={{ color: 'var(--accent)' }}>
                        <KeyRound size={14} />
                        <span># PIN</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenPassword(u)} title="تغيير كلمة المرور">
                        <Shield size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(u)} title="تعديل البيانات">
                        <Edit2 size={14} />
                      </Button>
                      {u.id !== currentUser?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(u)}
                          style={{ color: u.active ? 'var(--danger)' : 'var(--success)' }}
                        >
                          {u.active ? 'تعطيل' : 'تفعيل'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="data-table-wrap">
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
                  <td style={{ fontWeight: 700, color: '#fff' }}>{u.fullName}</td>
                  <td><code className="font-mono" style={{ color: '#94a3b8' }}>@{u.username}</code></td>
                  <td>
                    <span className="table-zone-chip font-bold">
                      {getRoleTitle(u.role)}
                    </span>
                  </td>
                  <td>
                    <Badge variant={u.active ? 'success' : 'neutral'}>
                      {u.active ? 'نشط' : 'معطل'}
                    </Badge>
                  </td>
                  {canManageUsers && (
                    <td>
                      <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPin(u)} title="تعيين رمز PIN السريع" style={{ color: 'var(--accent)' }}>
                          <KeyRound size={14} />
                          <span>رمز PIN</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPassword(u)} title="تغيير كلمة المرور">
                          <Shield size={14} />
                          <span>كلمة المرور</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(u)} title="تعديل المستخدم">
                          <Edit2 size={14} />
                          <span>تعديل</span>
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(u)}
                            style={{ color: u.active ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {u.active ? 'تعطيل' : 'تفعيل'}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

            {!editingUser ? (
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
                  <label className="modal-field-label">رمز PIN السريع للدخول (اختياري)</label>
                  <input
                    className="modal-field-input"
                    type="password"
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value })}
                    placeholder="من 4 إلى 8 أرقام"
                  />
                </div>
              </div>
            ) : (
              <div className="modal-field-group">
                <label className="modal-field-label">رمز PIN السريع للدخول (اتركه فارغاً إذا كنت لا تريد تغييره)</label>
                <input
                  className="modal-field-input"
                  type="password"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  placeholder="أدخل رمز PIN جديد (4 إلى 8 أرقام)"
                />
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

      {/* Change PIN Modal */}
      {canManageUsers && (
        <Modal
          isOpen={isPinModalOpen}
          onClose={() => setIsPinModalOpen(false)}
          title="تعيين / تغيير رمز PIN للدخول السريع"
          icon="#️⃣"
          subtitle={`تعيين رمز PIN سريع للمستخدم: ${editingUser?.fullName || editingUser?.username}`}
          size="sm"
        >
          <form onSubmit={handleChangePin} className="modal-form">
            <div className="modal-field-group">
              <label className="modal-field-label">رمز PIN الجديد <span className="required">*</span></label>
              <input
                className="modal-field-input"
                type="password"
                value={pinForm.newPin}
                onChange={(e) => setPinForm({ newPin: e.target.value })}
                placeholder="أدخل من 4 إلى 8 أرقام (مثال: 1234)"
                required
                autoFocus
                maxLength={8}
              />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 12px 0' }}>
              يُستخدم هذا الرمز في شاشة تسجيل الدخول السريع (PIN) للتنقل بين الكاشيرات وبدء الشيفت بسرعة.
            </p>
            <div className="modal__footer" style={{ padding: '10px 0 0 0', background: 'transparent', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Button variant="secondary" onClick={() => setIsPinModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving} variant="primary">حفظ رمز PIN</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
