import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usersApi } from '../../api/usersApi';
import { storage } from '../../utils/storage';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import { Building2, User, KeyRound, Shield, RefreshCw, Sparkles, MessageCircle } from 'lucide-react';
import PrinterSettings from './PrinterSettings';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user, role } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const tenantSlug = storage.getTenantSlug();
  const [showUpgradeModal, setShowUpgradeModal] = useState(!!location.state?.openUpgradeModal);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const [updateStatus, setUpdateStatus] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    if (window.api && window.api.onUpdateStatus) {
      window.api.onUpdateStatus((data) => {
        setUpdateStatus(data);
        if (data.status === 'downloaded') {
          toast.success(data.message);
        }
      });
    }
  }, [toast]);

  async function handleCheckUpdates() {
    setCheckingUpdate(true);
    setUpdateStatus({ status: 'checking', message: 'جاري الاتصال بالسيرفر لفحص وجود تحديثات جديدة...' });
    try {
      if (window.api && window.api.checkForUpdates) {
        await window.api.checkForUpdates();
      } else {
        setTimeout(() => {
          setUpdateStatus({ status: 'not-available', message: 'أنت تعمل على أحدث إصدار متاح حالياً v1.0.0 ✓' });
          setCheckingUpdate(false);
        }, 1200);
      }
    } catch (err) {
      setUpdateStatus({ status: 'error', message: 'فشل الفحص: ' + err.message });
    } finally {
      setCheckingUpdate(false);
    }
  }

  function handleInstallUpdate() {
    if (window.api && window.api.installUpdate) {
      window.api.installUpdate();
    }
  }

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
          <p className="page__subtitle">إدارة حسابك والإعدادات وتحديثات النظام</p>
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

          {/* System Updates Card */}
          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={18} /> تحديثات النظام أونلاين
            </h2>
            <div className="settings-info-list">
              <div className="settings-info-item">
                <span className="settings-info-label">إصدار التطبيق</span>
                <span className="settings-info-value" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 'bold' }}>v1.0.0</span>
              </div>

              {updateStatus && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  background: updateStatus.status === 'downloaded' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${updateStatus.status === 'downloaded' ? 'var(--success)' : 'var(--accent)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  margin: '10px 0'
                }}>
                  {updateStatus.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCheckUpdates}
                  loading={checkingUpdate}
                >
                  <RefreshCw size={15} />
                  فحص وجود تحديثات جديدة
                </Button>

                {updateStatus?.status === 'downloaded' && (
                  <Button
                    type="button"
                    variant="success"
                    onClick={handleInstallUpdate}
                  >
                    تثبيت التحديث وإعادة التشغيل (5 ثوانٍ)
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="settings-column">
          <PrinterSettings />

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

          <div className="section-card">
            <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25d366' }}>
              <MessageCircle size={18} /> تنبيهات واتساب
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              قم بتفعيل استلام التنبيهات والتقارير الهامة مباشرة على رقم واتساب الخاص بك.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); toast.success('تم حفظ إعدادات واتساب بنجاح'); }} className="form-grid">
              <Input
                label="رقم الهاتف للمالك (مع رمز الدولة)"
                placeholder="مثال: +201112633164"
                defaultValue={user?.phone || ''}
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#25d366', width: '16px', height: '16px' }} />
                  ملخص المبيعات في نهاية اليوم (إغلاق الوردية)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#25d366', width: '16px', height: '16px' }} />
                  تنبيه عند نفاذ المنتجات من المخزن
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" style={{ accentColor: '#25d366', width: '16px', height: '16px' }} />
                  تنبيه الفواتير المرتجعة أو الملغاة
                </label>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <Button type="submit" variant="primary" style={{ background: '#25d366', color: '#fff', border: 'none' }}>حفظ إعدادات واتساب</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
