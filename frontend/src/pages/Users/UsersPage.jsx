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
import { ROLES } from '../../utils/constants';

export default function UsersPage() {
  const toast = useToast();
  const { role, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
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
    } else {
      setEditingUser(null);
      setForm({ fullName: '', username: '', role: 'CASHIER', password: '', pin: '' });
    }
    setIsEditModalOpen(true);
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
        toast.success('User updated successfully');
      } else {
        if (!form.password) {
          toast.warning('Password is required for new users');
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
        toast.success('User created successfully');
      }
      setIsEditModalOpen(false);
      await loadUsers();
    } catch (err) {
      toast.error(err.message, 'Failed to save user');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }
    setIsSaving(true);
    try {
      await usersApi.changePassword(editingUser.id, { newPassword: passwordForm.newPassword });
      toast.success('Password changed successfully');
      setIsPasswordModalOpen(false);
    } catch (err) {
      toast.error(err.message, 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(user) {
    if (user.id === currentUser.id) {
      toast.warning('You cannot deactivate your own account.');
      return;
    }
    try {
      if (user.active) {
        await usersApi.deactivate(user.id);
      } else {
        await usersApi.activate(user.id);
      }
      toast.success(`User ${user.username} ${user.active ? 'deactivated' : 'activated'}`);
      await loadUsers();
    } catch (err) {
      toast.error(err.message, 'Failed to update user status');
    }
  }

  function getRoleBadgeVariant(r) {
    if (r === 'ADMIN') return 'accent';
    if (r === 'SUPERVISOR') return 'info';
    return 'neutral';
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">المستخدمين</h1>
          <p className="page__subtitle">إدارة حسابات الموظفين والصلاحيات</p>
        </div>
        <div className="page__actions">
          {role === ROLES.ADMIN && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenEdit()}>
              إضافة مستخدم
            </Button>
          )}
        </div>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : users.length === 0 ? (
          <div className="data-table-empty">مفيش مستخدمين.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم بالكامل</th>
                <th>اسم المستخدم</th>
                <th>الصلاحية</th>
                <th>الحالة</th>
                {role === ROLES.ADMIN && <th style={{ textAlign: 'left' }}>تحكم</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>
                    {u.fullName} {u.id === currentUser.id && <span style={{color:'var(--text-muted)', fontSize:'12px'}}>(أنت)</span>}
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
                  {role === ROLES.ADMIN && (
                    <td>
                      <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenPassword(u)} title="تغيير الباسورد">
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
      {role === ROLES.ADMIN && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم'}
        >
          <form onSubmit={handleSaveUser} className="form-grid">
            <Input
              label="الاسم بالكامل"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              autoFocus
            />
            <Input
              label="اسم المستخدم"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            
            <div className="field-select">
              <label className="field-select__label">الصلاحية</label>
              <select
                className="field-select__control"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                required
              >
                <option value="CASHIER">كاشير</option>
                <option value="SUPERVISOR">مشرف</option>
                <option value="ADMIN">مدير</option>
              </select>
            </div>

            {!editingUser && (
              <>
                <Input
                  label="رمز PIN للطباعة والعمليات السريعة (اختياري)"
                  type="password"
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  hint="من 4 لـ 8 أرقام"
                />
                <Input
                  label="الباسورد"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  hint="على الأقل 6 حروف أو أرقام"
                />
              </>
            )}

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving}>حفظ المستخدم</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Change Password Modal */}
      {role === ROLES.ADMIN && (
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
          title={`تغيير الباسورد لـ ${editingUser?.username}`}
        >
          <form onSubmit={handleChangePassword} className="form-grid">
            <Input
              label="الباسورد الجديد"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ newPassword: e.target.value })}
              required
              autoFocus
              hint="على الأقل 6 حروف أو أرقام"
            />
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={() => setIsPasswordModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving}>تحديث الباسورد</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
