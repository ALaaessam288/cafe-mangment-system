import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Tag, Table2,
  Users, Receipt, BarChart3, Settings, LogOut, Contact, Landmark, ChefHat,
  ChevronDown, Menu, X, Maximize, Minimize, Clock, Search, Bell, Keyboard, ChevronLeft, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES, ROUTES } from '../utils/constants';
import { useToast } from '../context/ToastContext';
import OnboardingTour from '../components/OnboardingTour/OnboardingTour';
import CommandPalette from '../components/CommandPalette/CommandPalette';
import ShortcutsModal from '../components/ShortcutsModal/ShortcutsModal';
import NotificationCenter from '../components/NotificationCenter/NotificationCenter';
import { sounds } from '../utils/soundEffects';
import './AppLayout.css';

/* Sections the sidebar folds into. Each one collapses independently and the
   state sticks, so a cashier can keep الكاشير open and everything else shut. */
const NAV_SECTIONS = [
  { id: 'OVERVIEW', label: 'نظرة عامة' },
  { id: 'OPS',      label: 'التشغيل اليومي' },
  { id: 'MONEY',    label: 'المالية والفريق' },
  { id: 'CATALOG',  label: 'المنيو والمخزون' },
  { id: 'SYSTEM',   label: 'الإدارة والنظام' },
];

const NAV_ITEMS = [
  { label: 'مركز التحكم',   icon: LayoutDashboard, route: ROUTES.DASHBOARD, section: 'OVERVIEW', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'الكاشير',      icon: ShoppingCart,    route: ROUTES.POS,       section: 'OPS',     roles: [ROLES.SUPERVISOR, ROLES.CASHIER] },
  { label: 'شاشة التحضير', icon: ChefHat,         route: ROUTES.KDS,       section: 'OPS',     roles: [ROLES.SUPERVISOR, ROLES.CASHIER] },
  { label: 'الفواتير',     icon: Receipt,         route: ROUTES.INVOICES,  section: 'OPS',     roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER] },

  { label: 'المصاريف والعهد', icon: Tag,           route: ROUTES.EXPENSES,  section: 'MONEY',   roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER] },
  { label: 'الفريق والرواتب', icon: Contact,       route: ROUTES.EMPLOYEES, section: 'MONEY',   roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER] },
  { label: 'المديونية',    icon: Landmark,        route: ROUTES.DEBTS,     section: 'MONEY',   roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'التقارير',     icon: BarChart3,       route: ROUTES.REPORTS,   section: 'MONEY',   roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },

  { label: 'المنتجات',     icon: Package,         route: ROUTES.PRODUCTS,  section: 'CATALOG', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'التقسيمات',    icon: Tag,             route: ROUTES.CATEGORIES,section: 'CATALOG', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'الطاولات',     icon: Table2,          route: ROUTES.TABLES,    section: 'CATALOG', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'المخزون والجرد', icon: Package,       route: ROUTES.INVENTORY, section: 'CATALOG', roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },

  { label: 'المستخدمين',   icon: Users,           route: ROUTES.USERS,     section: 'SYSTEM',  roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'الإعدادات',    icon: Settings,        route: ROUTES.SETTINGS,  section: 'SYSTEM',  roles: [ROLES.ADMIN] },
];

const SECTIONS_KEY  = 'caffio_sidebar_sections';

const ADMIN_PAGE_META = {
  [ROUTES.DASHBOARD]:  ['مركز التحكم', 'ملخص أداء المنشأة وما يحتاج قرارك الآن'],
  [ROUTES.INVOICES]:   ['العمليات والفواتير', 'مراجعة دورة الطلب والتحصيل وخدمة العملاء'],
  [ROUTES.EXPENSES]:   ['المصاريف والعهد', 'متابعة التدفقات الخارجة والمسؤوليات المالية'],
  [ROUTES.EMPLOYEES]:  ['الفريق والرواتب', 'إدارة مستحقات الفريق وحركة الحسابات'],
  [ROUTES.DEBTS]:      ['المديونية', 'متابعة الآجل والتسويات والتحصيلات المستحقة'],
  [ROUTES.REPORTS]:    ['التقارير والتحليل', 'قرارات مبنية على أداء المبيعات والشيفتات'],
  [ROUTES.PRODUCTS]:   ['المنتجات والمنيو', 'الأسعار والتوافر وتجربة الطلب'],
  [ROUTES.CATEGORIES]: ['أقسام المنيو', 'هيكلة العرض وترتيب رحلة اختيار العميل'],
  [ROUTES.TABLES]:     ['الصالة والطاولات', 'تخطيط الطاقة الاستيعابية وتوزيع الخدمة'],
  [ROUTES.INVENTORY]:  ['المخزون والجرد', 'حماية الهامش وتقليل الهدر والنواقص'],
  [ROUTES.USERS]:      ['المستخدمون والصلاحيات', 'حوكمة الوصول ومسؤوليات فريق التشغيل'],
  [ROUTES.SETTINGS]:   ['إعدادات المنشأة', 'الهوية والاشتراك والطباعة والأمان'],
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function AppLayout({ children }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const isAdminWorkspace = role === ROLES.ADMIN;
  const adminPageMeta = ADMIN_PAGE_META[location.pathname] || ['مساحة الإدارة', 'إدارة وتشغيل منشأتك من مكان واحد'];

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const [closedSections, setClosedSections] = useState(() => readJson(SECTIONS_KEY, []));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      } else if (e.key === 'F1' || (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName))) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isCmdOpen) setIsCmdOpen(false);
        else if (isShortcutsOpen) setIsShortcutsOpen(false);
        else if (isNotifOpen) setIsNotifOpen(false);
        else if (isSidebarOpen) setIsSidebarOpen(false);
      }
    }
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isCmdOpen, isShortcutsOpen, isNotifOpen, isSidebarOpen]);

  function toggleFullscreen() {
    sounds.playTap();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function toggleSection(id) {
    setClosedSections((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  async function handleLogout() {
    sounds.playTap();
    await logout();
    toast.info('تم تسجيل الخروج بنجاح.');
    navigate(ROUTES.LOGIN, { replace: true });
  }

  const timeStr = time.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = time.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className={`app-layout ${isAdminWorkspace ? 'app-layout--admin' : ''}`}>
      {/* ── Sleek Topbar Header ── */}
      <header className="app-topbar">
        {/* Right side in RTL: Menu Toggle & Brand */}
        <div className="app-topbar__start">
          <button
            type="button"
            className="app-topbar__menu-btn"
            onClick={() => { sounds.playTap(); setIsSidebarOpen(true); }}
            title="فتح القائمة الرئيسية (☰)"
            aria-label="فتح القائمة الرئيسية"
          >
            <Menu size={15} />
            <span className="app-topbar__menu-label">القائمة</span>
          </button>

          <div className="app-topbar__brand">
            <img
              src={user?.logoUrl || '/caffio-logo.png'}
              alt="Logo"
              style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: 6, filter: 'drop-shadow(0 2px 4px rgba(245, 158, 11, 0.4))' }}
            />
            <span className="app-topbar__brand-name">{user?.tenantName || 'كافيو POS'}</span>
          </div>
        </div>

        {/* Center: Omni-Search Bar & Monospace Clock */}
        <div className="app-topbar__center">
          <button
            type="button"
            className="app-topbar__search-btn"
            onClick={() => { sounds.playTap(); setIsCmdOpen(true); }}
            title="البحث السريع والأوامر (Ctrl + K)"
          >
            <Search size={13} className="app-topbar__search-icon" />
            <span className="app-topbar__search-placeholder">بحث سريع أو أمر...</span>
            <kbd className="app-topbar__search-kbd">Ctrl+K</kbd>
          </button>

          <div className="app-topbar__clock-chip">
            <Clock size={11} style={{ color: 'var(--accent)', opacity: 0.8 }} />
            <span className="app-topbar__date">{dateStr}</span>
            <span className="app-topbar__clock-divider">•</span>
            <span className="app-topbar__time">{timeStr}</span>
          </div>
        </div>

        {/* Left side in RTL: Tools, User Badge, Fullscreen & Logout */}
        <div className="app-topbar__end">
          {/* Notification Center Trigger */}
          <button
            type="button"
            className="app-topbar__action-btn"
            onClick={() => { sounds.playTap(); setIsNotifOpen(true); }}
            title="مركز التنبيهات"
            aria-label="مركز التنبيهات"
          >
            <Bell size={13} />
            <span className="app-topbar__dot" />
          </button>

          {/* Shortcuts Modal Trigger */}
          <button
            type="button"
            className="app-topbar__action-btn"
            onClick={() => { sounds.playTap(); setIsShortcutsOpen(true); }}
            title="اختصارات لوحة المفاتيح (F1)"
            aria-label="اختصارات لوحة المفاتيح"
          >
            <Keyboard size={13} />
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            className="app-topbar__action-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة بالكامل (F11)'}
            aria-label="ملء الشاشة"
          >
            {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>

          {/* Active User Chip */}
          <div className="app-topbar__user-chip">
            <div className="app-topbar__avatar">
              {user?.fullName?.[0]?.toUpperCase() ?? user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="app-topbar__user-name">{user?.fullName ?? user?.username}</span>
            <span className="app-topbar__role-badge">{role}</span>
          </div>

          {/* Logout Button */}
          <button
            type="button"
            className="app-topbar__action-btn app-topbar__action-btn--logout"
            onClick={handleLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* ── Backdrop Overlay ── */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-out Drawer Sidebar ── */}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar--open' : ''}`}>
        {/* Logo & Close Button */}
        <div className="sidebar__logo">
          <img
            src={user?.logoUrl || '/caffio-logo.png'}
            alt="Logo"
            style={{ width: 34, height: 34, objectFit: 'contain', borderRadius: 8, filter: 'drop-shadow(0 3px 8px rgba(245, 158, 11, 0.45))' }}
          />
          <span className="sidebar__logo-text" title={user?.tenantName || 'كافيو POS'}>
            {user?.tenantName || 'كافيو POS'}
          </span>
          <button
            type="button"
            className="sidebar__close-btn"
            onClick={() => setIsSidebarOpen(false)}
            title="إغلاق القائمة"
            aria-label="إغلاق القائمة"
          >
            <X size={17} />
          </button>
        </div>

        {/* Navigation — grouped into sections */}
        <nav className="sidebar__nav" aria-label="القائمة الرئيسية">
          {NAV_SECTIONS.map((section) => {
            const items = visibleItems.filter((i) => i.section === section.id);
            if (items.length === 0) return null;
            const isClosed = closedSections.includes(section.id);

            return (
              <div className="sidebar__section" key={section.id}>
                <button
                  type="button"
                  className="sidebar__section-head"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={!isClosed}
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={13}
                    className={`sidebar__chevron ${isClosed ? 'sidebar__chevron--closed' : ''}`}
                  />
                </button>

                {!isClosed && items.map((item) => (
                  <NavLink
                    key={item.route}
                    to={item.route}
                    onClick={() => { sounds.playTap(); setIsSidebarOpen(false); }}
                    className={({ isActive }) =>
                      `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                    }
                    title={item.label}
                  >
                    <item.icon size={16} className="sidebar__link-icon" />
                    <span className="sidebar__link-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar" aria-hidden>
              {user?.fullName?.[0]?.toUpperCase() ?? user?.username?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="sidebar__user-info">
              <div className="sidebar__user-name truncate">{user?.fullName ?? user?.username}</div>
              <div className="sidebar__user-role">{role}</div>
            </div>
          </div>
          <button
            className="sidebar__logout"
            onClick={handleLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="app-main">
        {isAdminWorkspace && (
          <div className="admin-context-bar">
            <div className="admin-context-bar__identity">
              <span className="admin-context-bar__mark"><ShieldCheck size={15} /></span>
              <div>
                <div className="admin-context-bar__trail">
                  <span>مساحة المالك</span><ChevronLeft size={11} /><strong>{adminPageMeta[0]}</strong>
                </div>
                <span className="admin-context-bar__description">{adminPageMeta[1]}</span>
              </div>
            </div>
            <button type="button" className="admin-context-bar__command" onClick={() => setIsCmdOpen(true)}>
              <Search size={13} /><span>انتقل لأي شاشة أو نفّذ إجراء</span><kbd>Ctrl+K</kbd>
            </button>
          </div>
        )}
        {children}
      </main>

      {/* ── Global Floating Modals & Tools ── */}
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={() => setIsCmdOpen(false)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <NotificationCenter
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />

      <OnboardingTour />
    </div>
  );
}
