import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../utils/constants';
import './SuperAdminLayout.css';

export default function SuperAdminLayout({
  children,
  activeSection = 'dashboard',
  onSelectSection,
  onOpenProvisionModal,
  onRefresh,
  refreshing = false,
  totalTenants = 0,
  activeTenants = 0,
  expiringCount = 0,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'لوحة المؤشرات', icon: 'bi-speedometer2', badge: null },
    { id: 'tenants', label: 'إدارة المنشآت', icon: 'bi-buildings', badge: totalTenants > 0 ? totalTenants : null, badgeColor: 'bg-primary' },
    { id: 'plans', label: 'باقات الاشتراك', icon: 'bi-tags', badge: '4' },
    { id: 'subscriptions', label: 'التراخيص والاشتراكات', icon: 'bi-key', badge: expiringCount > 0 ? `${expiringCount} تنبيه` : null, badgeColor: 'bg-danger' },
    { id: 'audit-logs', label: 'سجل النشاطات', icon: 'bi-journal-text', badge: null },
    { id: 'settings', label: 'إعدادات المنصة', icon: 'bi-gear', badge: null },
  ];

  const SECTION_TITLES = {
    dashboard: 'لوحة المؤشرات والتحليلات',
    tenants: 'إدارة المنشآت والمشتركين',
    plans: 'باقات الاشتراك والأسعار',
    subscriptions: 'إدارة التراخيص ومفاتيح التفعيل',
    'audit-logs': 'سجل النشاطات والعمليات',
    settings: 'إعدادات ومعلومات النظام',
  };

  function handleLogout() {
    logout();
    navigate(ROUTES.SUPER_ADMIN_LOGIN, { replace: true });
  }

  function handleNavClick(sectionId) {
    if (onSelectSection) onSelectSection(sectionId);
    setMobileOpen(false);
  }

  return (
    <div className={`sa-app ${collapsed ? 'sa-app--collapsed' : ''}`}>
      {/* Mobile Offcanvas Backdrop */}
      {mobileOpen && (
        <div className="sa-backdrop fade show" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`sa-sidebar ${mobileOpen ? 'sa-sidebar--open' : ''}`}>
        {/* Brand Header */}
        <div className="sa-sidebar__header">
          <div className="sa-brand">
            <div className="sa-brand__logo">
              <img src="/caffio-logo.png" alt="Caffio Logo" className="sa-brand__logo-img" />
            </div>
            {!collapsed && (
              <div className="sa-brand__text">
                <span className="sa-brand__title">Caffio Cloud</span>
                <span className="sa-brand__badge">CAFÉ BUSINESS SIMPLIFIED</span>
              </div>
            )}
          </div>
          <button
            type="button"
            className="sa-sidebar__close-btn d-lg-none"
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="sa-sidebar__body">
          <div className="sa-nav-group-title">{!collapsed && 'إدارة المنصة المركزية'}</div>
          <nav className="sa-nav">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`sa-nav__item ${isActive ? 'sa-nav__item--active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <i className={`bi ${item.icon} sa-nav__icon`} />
                  {!collapsed && <span className="sa-nav__label">{item.label}</span>}
                  {!collapsed && item.badge && (
                    <span className={`badge rounded-pill ms-auto sa-nav__badge ${item.badgeColor || 'bg-secondary'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <hr className="sa-sidebar__divider" />

          {/* Quick Stats Pill */}
          {!collapsed && (
            <div className="sa-sidebar__kpi-pill">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-secondary small">حالة المنشآت</span>
                <span className="text-success small fw-bold">
                  <i className="bi bi-circle-fill me-1" style={{ fontSize: '6px' }} />
                  {activeTenants} نشط
                </span>
              </div>
              <div className="progress" style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="progress-bar bg-success"
                  style={{ width: `${totalTenants > 0 ? (activeTenants / totalTenants) * 100 : 0}%` }}
                />
              </div>
              <div className="text-muted small mt-1 text-end" style={{ fontSize: '10px' }}>
                إجمالي {totalTenants} مشترك
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sa-sidebar__footer">
          <button
            type="button"
            className="sa-collapse-btn d-none d-lg-flex"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            <i className={`bi ${collapsed ? 'bi-layout-sidebar-inset-reverse' : 'bi-layout-sidebar-inset'}`} />
            {!collapsed && <span>طي القائمة الجانبية</span>}
          </button>

          <button
            type="button"
            className="sa-logout-btn"
            onClick={handleLogout}
            title="تسجيل الخروج من المنصة"
          >
            <i className="bi bi-box-arrow-right" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT WRAPPER ── */}
      <div className="sa-wrapper">
        {/* Top Header */}
        <header className="sa-header">
          <div className="sa-header__start">
            <button
              type="button"
              className="sa-header__toggle-btn d-lg-none"
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
            >
              <i className="bi bi-list" />
            </button>

            {/* Breadcrumb & Section Title */}
            <div className="sa-header__title-area">
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb mb-0 sa-breadcrumb">
                  <li className="breadcrumb-item">
                    <a href="#dashboard" onClick={(e) => { e.preventDefault(); handleNavClick('dashboard'); }}>
                      <i className="bi bi-house-door me-1" />
                      الرئيسية
                    </a>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    {SECTION_TITLES[activeSection] || activeSection}
                  </li>
                </ol>
              </nav>
            </div>
          </div>

          <div className="sa-header__end">
            {/* Cloud Server Health */}
            <div className="sa-server-badge d-none d-sm-flex">
              <span className="sa-server-badge__dot" />
              <span>خوادم السحابة: متصلة 100%</span>
            </div>

            {/* Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary sa-icon-action-btn"
                onClick={onRefresh}
                disabled={refreshing}
                title="تحديث بيانات المنصة"
              >
                <i className={`bi bi-arrow-clockwise ${refreshing ? 'sa-spin' : ''}`} />
              </button>
            )}

            {/* Quick Provision Button */}
            {onOpenProvisionModal && (
              <button
                type="button"
                className="btn btn-sm btn-primary sa-add-btn"
                onClick={onOpenProvisionModal}
              >
                <i className="bi bi-plus-circle-fill me-1" />
                <span>إضافة منشأة جديدة</span>
              </button>
            )}

            <div className="vr sa-vr d-none d-sm-block" />

            {/* Profile Dropdown */}
            <div className="dropdown">
              <button
                className="sa-profile-btn dropdown-toggle"
                type="button"
                id="superAdminProfileDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <div className="sa-profile-avatar">
                  <i className="bi bi-person-fill" />
                </div>
                <div className="sa-profile-info d-none d-md-block">
                  <span className="sa-profile-name">{user?.fullName || user?.username || 'مالك المنصة'}</span>
                  <span className="sa-profile-role">Super Admin</span>
                </div>
              </button>

              <ul className="dropdown-menu dropdown-menu-end sa-dropdown-menu" aria-labelledby="superAdminProfileDropdown">
                <li className="dropdown-header">
                  <div className="fw-bold text-light">{user?.fullName || 'Super Administrator'}</div>
                  <div className="text-secondary small">{user?.username} • Root Access</div>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item" type="button" onClick={() => handleNavClick('settings')}>
                    <i className="bi bi-gear me-2" /> إعدادات المنصة
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" type="button" onClick={() => handleNavClick('audit-logs')}>
                    <i className="bi bi-shield-check me-2" /> سجل الأمان والنشاطات
                  </button>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button className="dropdown-item text-danger" type="button" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right me-2" /> تسجيل الخروج
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="sa-main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
