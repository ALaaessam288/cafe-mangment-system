import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ShoppingCart, LayoutDashboard, Package, Tag, Table2,
  Users, Receipt, BarChart3, Settings, LogOut, Coffee, Contact,
  Landmark, ChefHat, Maximize, Volume2, VolumeX, Keyboard, ArrowRight
} from 'lucide-react';
import { ROUTES, ROLES } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../utils/soundEffects';
import './CommandPalette.css';

export default function CommandPalette({ isOpen, onClose, onOpenShortcuts }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const isCashier = role === ROLES.CASHIER;
  const isSupervisor = role === ROLES.SUPERVISOR;
  const isAdmin = role === ROLES.ADMIN;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const list = [
      // Quick Actions
      { id: 'pos', title: 'الكاشير ونقطة البيع', category: 'صفحات النظام', icon: ShoppingCart, route: ROUTES.POS, allowed: !isAdmin },
      { id: 'dashboard', title: 'لوحة التحكم والملخص', category: 'صفحات النظام', icon: LayoutDashboard, route: ROUTES.DASHBOARD, allowed: isAdmin || isSupervisor },
      { id: 'invoices', title: 'الفواتير والمبيعات', category: 'صفحات النظام', icon: Receipt, route: ROUTES.INVOICES, allowed: true },
      { id: 'kds', title: 'شاشة تحضير المطبخ والبار (KDS)', category: 'صفحات النظام', icon: ChefHat, route: ROUTES.KDS, allowed: !isAdmin },
      { id: 'products', title: 'إدارة المنتجات والأسعار', category: 'صفحات النظام', icon: Package, route: ROUTES.PRODUCTS, allowed: isAdmin || isSupervisor },
      { id: 'categories', title: 'أقسام وتقسيمات المنيو', category: 'صفحات النظام', icon: Tag, route: ROUTES.CATEGORIES, allowed: isAdmin || isSupervisor },
      { id: 'tables', title: 'إدارة طاولات الكافيه', category: 'صفحات النظام', icon: Table2, route: ROUTES.TABLES, allowed: isAdmin || isSupervisor },
      { id: 'inventory', title: 'المخزون والجرد', category: 'صفحات النظام', icon: Package, route: ROUTES.INVENTORY, allowed: isAdmin || isSupervisor },
      { id: 'expenses', title: 'تسجيل المصاريف والنثريات', category: 'صفحات النظام', icon: Tag, route: ROUTES.EXPENSES, allowed: true },
      { id: 'employees', title: 'حسابات ومسحوبات الموظفين', category: 'صفحات النظام', icon: Contact, route: ROUTES.EMPLOYEES, allowed: true },
      { id: 'debts', title: 'سجل الآجل والديون', category: 'صفحات النظام', icon: Landmark, route: ROUTES.DEBTS, allowed: isAdmin || isSupervisor },
      { id: 'reports', title: 'التقارير وحسابات الشيفتات', category: 'صفحات النظام', icon: BarChart3, route: ROUTES.REPORTS, allowed: isAdmin || isSupervisor },
      { id: 'users', title: 'المستخدمين والصلاحيات', category: 'صفحات النظام', icon: Users, route: ROUTES.USERS, allowed: isAdmin || isSupervisor },
      { id: 'settings', title: 'الإعدادات والبيانات', category: 'صفحات النظام', icon: Settings, route: ROUTES.SETTINGS, allowed: true },
      
      // Actions
      { id: 'shortcuts', title: 'دليل اختصارات لوحة المفاتيح', category: 'إجراءات سريعة', icon: Keyboard, action: () => { onClose(); onOpenShortcuts?.(); }, allowed: true },
      { id: 'fullscreen', title: 'ملء الشاشة بالكامل (Fullscreen)', category: 'إجراءات سريعة', icon: Maximize, action: () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen?.().catch(() => {});
        onClose();
      }, allowed: true },
      { id: 'sound-toggle', title: 'كتم / تشغيل المؤثرات الصوتية', category: 'إجراءات سريعة', icon: sounds.isEnabled() ? Volume2 : VolumeX, action: () => {
        sounds.toggle();
        onClose();
      }, allowed: true },
      { id: 'logout', title: 'تسجيل الخروج من الحساب', category: 'إجراءات سريعة', icon: LogOut, action: () => {
        logout();
        navigate(ROUTES.LOGIN);
        onClose();
      }, allowed: true },
    ].filter(i => i.allowed);

    if (!query.trim()) return list;

    const q = query.toLowerCase().trim();
    return list.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    );
  }, [query, isAdmin, isSupervisor, isCashier, onClose, onOpenShortcuts, logout, navigate]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        executeItem(items[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const executeItem = (item) => {
    sounds.playTap();
    if (item.action) {
      item.action();
    } else if (item.route) {
      navigate(item.route);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Search Header */}
        <div className="cmd-header">
          <Search size={18} className="cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="ابحث عن صفحة، منتج، تقرير أو إجراء سريع..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="cmd-kbd">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="cmd-results">
          {items.length === 0 ? (
            <div className="cmd-empty">لا توجد نتائج تطابق «{query}»</div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`cmd-item ${isSelected ? 'cmd-item--selected' : ''}`}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="cmd-item__icon-wrap">
                    <Icon size={16} />
                  </div>
                  <div className="cmd-item__content">
                    <div className="cmd-item__title">{item.title}</div>
                    <div className="cmd-item__category">{item.category}</div>
                  </div>
                  {isSelected && <ArrowRight size={14} className="cmd-item__arrow" />}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="cmd-footer">
          <span className="cmd-footer__hint">
            <kbd>↑</kbd> <kbd>↓</kbd> للتنقل
          </span>
          <span className="cmd-footer__hint">
            <kbd>↵</kbd> للاختيار
          </span>
          <span className="cmd-footer__hint">
            <kbd>ESC</kbd> للإغلاق
          </span>
        </div>
      </div>
    </div>
  );
}
