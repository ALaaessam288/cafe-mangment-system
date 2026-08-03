/* ── API ── */
export const BASE_URL = '/api';

/* ── Roles ── */
export const ROLES = {
  ADMIN:      'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  CASHIER:    'CASHIER',
};

/* ── Order Statuses ── */
export const ORDER_STATUS = {
  OPEN:   'OPEN',
  SENT:   'SENT',
  CLOSED: 'CLOSED',
  VOID:   'VOID',
};

/* ── Order Types ── */
export const ORDER_TYPE = {
  DINE_IN:  'DINE_IN',
  TAKEAWAY: 'TAKEAWAY',
};

/* ── Order Item Statuses ── */
export const ITEM_STATUS = {
  PENDING:   'PENDING',
  SENT:      'SENT',
  CANCELLED: 'CANCELLED',
};

/* ── Payment Methods ── */
export const PAYMENT_METHOD = {
  CASH:   'CASH',
  CARD:   'CARD',
  MIXED:  'MIXED',
};

/* ── Table Statuses ── */
export const TABLE_STATUS = {
  FREE:   'FREE',
  OPEN:   'OPEN',
  CLOSED: 'CLOSED',
};

/* ── Shift ── */
export const SHIFT_STATUS = {
  OPEN:   'OPEN',
  CLOSED: 'CLOSED',
};

/* ── Routes ── */
export const ROUTES = {
  SPLASH:     '/',
  LOGIN:      '/login',
  REGISTER:   '/register',
  DASHBOARD:  '/dashboard',
  POS:        '/pos',
  PRODUCTS:   '/products',
  CATEGORIES: '/categories',
  TABLES:     '/tables',
  USERS:      '/users',
  EXPENSES:   '/expenses',
  INVOICES:   '/invoices',
  EMPLOYEES:  '/employees',
  REPORTS:    '/reports',
  SETTINGS:   '/settings',
};

/* ── Role default routes ── */
export const ROLE_DEFAULT_ROUTE = {
  [ROLES.CASHIER]:    ROUTES.POS,
  [ROLES.SUPERVISOR]: ROUTES.DASHBOARD,
  [ROLES.ADMIN]:      ROUTES.DASHBOARD,
};

/* ── Role-allowed routes ── */
export const ROLE_ROUTES = {
  [ROLES.CASHIER]:    [ROUTES.POS, ROUTES.INVOICES, ROUTES.SETTINGS],
  [ROLES.SUPERVISOR]: [ROUTES.DASHBOARD, ROUTES.POS, ROUTES.INVOICES, ROUTES.EXPENSES, ROUTES.REPORTS, ROUTES.SETTINGS],
  [ROLES.ADMIN]:      Object.values(ROUTES).filter((r) => r !== ROUTES.SPLASH && r !== ROUTES.LOGIN),
};
