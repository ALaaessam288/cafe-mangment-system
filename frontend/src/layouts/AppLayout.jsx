import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, Tag, Table2,
  Users, Receipt, BarChart3, Settings, LogOut, Coffee, Contact
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLES, ROUTES } from '../utils/constants';
import { useToast } from '../context/ToastContext';
import './AppLayout.css';

const NAV_ITEMS = [
  { label: 'الرئيسية', icon: LayoutDashboard, route: ROUTES.DASHBOARD, roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'الكاشير',       icon: ShoppingCart,    route: ROUTES.POS,       roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER] },
  { label: 'الفواتير',      icon: Receipt,         route: ROUTES.INVOICES,  roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER] },
  { label: 'المنتجات',  icon: Package,         route: ROUTES.PRODUCTS,  roles: [ROLES.ADMIN] },
  { label: 'الأقسام',icon: Tag,             route: ROUTES.CATEGORIES,roles: [ROLES.ADMIN] },
  { label: 'الترابيزات',    icon: Table2,          route: ROUTES.TABLES,    roles: [ROLES.ADMIN] },
  { label: 'المستخدمين',     icon: Users,           route: ROUTES.USERS,     roles: [ROLES.ADMIN] },
  { label: 'الموظفين',     icon: Contact,         route: ROUTES.EMPLOYEES, roles: [ROLES.ADMIN] },
  { label: 'المصاريف',  icon: Tag,             route: ROUTES.EXPENSES,  roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER] },
  { label: 'التقارير',   icon: BarChart3,       route: ROUTES.REPORTS,   roles: [ROLES.ADMIN, ROLES.SUPERVISOR] },
  { label: 'الإعدادات',  icon: Settings,        route: ROUTES.SETTINGS,  roles: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER] },
];

export default function AppLayout({ children }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  async function handleLogout() {
    await logout();
    toast.info('تم تسجيل الخروج بنجاح.');
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar__logo">
          <Coffee size={22} className="sidebar__logo-icon" />
          <span className="sidebar__logo-text">ونس</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav" aria-label="القائمة الرئيسية">
          {visibleItems.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
              }
              title={item.label}
            >
              <item.icon size={18} className="sidebar__link-icon" />
              <span className="sidebar__link-label">{item.label}</span>
            </NavLink>
          ))}
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
        {children}
      </main>
    </div>
  );
}
