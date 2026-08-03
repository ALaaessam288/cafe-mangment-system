import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../api/usersApi';
import { storage } from '../../utils/storage';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import { Building2, User, KeyRound, Shield } from 'lucide-react';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user, role } = useAuth();
  const toast = useToast();
  const tenantSlug = storage.getTenantSlug();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  async function handlePasswordChange(e) {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.warning('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.warning('New password must be at least 6 characters');
      return;
    }

    setIsSaving(true);
    try {
      // Assuming usersApi.changePassword expects the user ID and the payload.
      // The current backend doesn't seem to validate currentPassword on the generic endpoint,
      // but a proper change-own-password endpoint would. We use the existing update endpoint.
      await usersApi.changePassword(user.id, { newPassword: passwordForm.newPassword });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.message, 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">الإعدادات</h1>
          <p className="page__subtitle">إدارة حسابك والإعدادات</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Left Column - Info */}
        <div className="settings-column">
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} /> بيانات الحساب
            </h2>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">الاسم بالكامل</span>
                <span className="settings-info-value">{user?.fullName}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">اسم المستخدم</span>
                <span className="settings-info-value">{user?.username}</span>
              </div>
              <div className="settings-info-item">
                <span className="settings-info-label">الصلاحية</span>
                <span className="settings-info-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={14} style={{ color: 'var(--accent)' }} /> {role}
                </span>
              </div>
            </div>
          </div>

          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} /> بيانات الكافيه
            </h2>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">رابط الكافيه</span>
                <span className="settings-info-value" style={{ fontFamily: 'var(--font-mono)' }}>{tenantSlug}</span>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '8px' }}>
                أنت مسجل الدخول في الكافيه ده. لو عايز تغير الكافيه لازم تسجل خروج.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="settings-column">
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} /> تغيير الباسورد
            </h2>
            <form onSubmit={handlePasswordChange} className="form-grid">
              <Input
                label="الباسورد الحالي"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
              <Input
                label="الباسورد الجديد"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                hint="على الأقل 6 حروف أو أرقام"
              />
              <Input
                label="تأكيد الباسورد الجديد"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />
              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button type="submit" loading={isSaving}>تحديث الباسورد</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
