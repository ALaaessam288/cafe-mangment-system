import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, X, AlertTriangle, CheckCircle, Clock, ShoppingCart,
  Package, ChevronLeft, Volume2, VolumeX, Sparkles
} from 'lucide-react';
import { ROUTES, ROLES } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../utils/soundEffects';
import './NotificationCenter.css';

export default function NotificationCenter({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const [soundEnabled, setSoundEnabled] = useState(() => sounds.isEnabled());

  // Dynamic system notifications
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'success',
      title: 'النظام متصل ويعمل بنجاح',
      description: 'قاعدة البيانات والمزامنة متصلة وجاهزة لتسجيل المعاملات.',
      time: 'الآن',
      route: isAdmin ? ROUTES.INVOICES : ROUTES.POS,
      icon: CheckCircle,
    },
    {
      id: 2,
      type: 'warning',
      title: 'تنبيه مخزون: مياه معدنية صغيرة',
      description: 'المتبقي في المخزن 6 قطع فقط. يرجى إعادة الطلب.',
      time: 'منذ 15 دقيقة',
      route: ROUTES.INVENTORY,
      icon: AlertTriangle,
    },
    {
      id: 3,
      type: 'info',
      title: 'تقرير المبيعات والشيفت',
      description: 'يمكنك مراجعة ملخص الإيرادات والمصروفات من صفحة التقارير.',
      time: 'اليوم',
      route: ROUTES.REPORTS,
      icon: Clock,
    },
  ]);

  function handleSoundToggle() {
    const next = sounds.toggle();
    setSoundEnabled(next);
  }

  function handleDismiss(id, e) {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function handleItemClick(route) {
    if (route) {
      navigate(route);
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="notif-overlay" onClick={onClose} />
      <aside className="notif-offcanvas" aria-label="مركز التنبيهات">
        {/* Header */}
        <div className="notif-header">
          <div className="notif-header__title">
            <Bell size={16} className="notif-header__icon" />
            <span>مركز التنبيهات والأحداث</span>
            <span className="notif-badge">{notifications.length}</span>
          </div>
          <button type="button" className="notif-close-btn" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>

        {/* Sound FX Control Strip */}
        <div className="notif-sound-strip">
          <div className="notif-sound-strip__info">
            <Sparkles size={13} style={{ color: 'var(--accent)' }} />
            <span>المؤثرات الصوتية للأوردرات</span>
          </div>
          <button
            type="button"
            className={`notif-sound-toggle ${soundEnabled ? 'notif-sound-toggle--active' : ''}`}
            onClick={handleSoundToggle}
            title={soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{soundEnabled ? 'مفعل' : 'مكتوم'}</span>
          </button>
        </div>

        {/* Notification List */}
        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <CheckCircle size={32} style={{ color: 'var(--success)', opacity: 0.6, marginBottom: 8 }} />
              <div>لا توجد تنبيهات جديدة حالياً</div>
              <div className="notif-empty__hint">جميع العمليات والمخزون تعمل بصورة ممتازة.</div>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.id}
                  className={`notif-item notif-item--${n.type}`}
                  onClick={() => handleItemClick(n.route)}
                >
                  <div className="notif-item__icon-wrap">
                    <Icon size={15} />
                  </div>
                  <div className="notif-item__content">
                    <div className="notif-item__head">
                      <span className="notif-item__title">{n.title}</span>
                      <span className="notif-item__time">{n.time}</span>
                    </div>
                    <div className="notif-item__desc">{n.description}</div>
                  </div>
                  <button
                    type="button"
                    className="notif-item__dismiss"
                    onClick={(e) => handleDismiss(n.id, e)}
                    title="حذف التنبيه"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="notif-footer">
          <button
            type="button"
            className="notif-footer__btn"
            onClick={() => setNotifications([])}
            disabled={notifications.length === 0}
          >
            مسح جميع التنبيهات
          </button>
        </div>
      </aside>
    </>
  );
}
