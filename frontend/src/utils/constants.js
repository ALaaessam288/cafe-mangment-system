/* ── API ── */
export const BASE_URL = '/api';

/* ── Roles ── */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN:      'ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  CASHIER:    'CASHIER',
};

/* ── Order Statuses ── */
export const ORDER_STATUS = {
  OPEN:   'OPEN',
  SENT:   'SENT',
  CLOSED: 'CLOSED',
  VOID:   'VOIDED',
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
  SPLASH:            '/',
  WELCOME:           '/welcome',
  SETUP:             '/setup',
  LOGIN:             '/login',
  REGISTER:          '/register',
  DASHBOARD:         '/dashboard',
  POS:               '/pos',
  KDS:               '/kds',
  PRODUCTS:          '/products',
  CATEGORIES:        '/categories',
  TABLES:            '/tables',
  USERS:             '/users',
  EXPENSES:          '/expenses',
  INVOICES:          '/invoices',
  EMPLOYEES:         '/employees',
  REPORTS:           '/reports',
  SETTINGS:          '/settings',
  INVENTORY:         '/inventory',
  DEBTS:             '/debts',
  SUPER_ADMIN:       '/super-admin',
  SUPER_ADMIN_LOGIN: '/super-admin/login',
};

/* ── Role default routes ── */
export const ROLE_DEFAULT_ROUTE = {
  [ROLES.CASHIER]:     ROUTES.POS,
  [ROLES.SUPERVISOR]:  ROUTES.DASHBOARD,
  [ROLES.ADMIN]:       ROUTES.DASHBOARD,
  [ROLES.SUPER_ADMIN]: ROUTES.SUPER_ADMIN,
};

/* ── Role-allowed routes ── */
export const ROLE_ROUTES = {
  [ROLES.CASHIER]:     [ROUTES.POS, ROUTES.KDS, ROUTES.INVOICES, ROUTES.EXPENSES, ROUTES.EMPLOYEES],
  [ROLES.SUPERVISOR]:  Object.values(ROUTES).filter((r) => r !== ROUTES.SPLASH && r !== ROUTES.LOGIN && r !== ROUTES.SUPER_ADMIN && r !== ROUTES.SUPER_ADMIN_LOGIN && r !== ROUTES.SETTINGS),
  [ROLES.SUPER_ADMIN]: [ROUTES.SUPER_ADMIN],
  [ROLES.ADMIN]:       Object.values(ROUTES).filter((r) => r !== ROUTES.SPLASH && r !== ROUTES.LOGIN && r !== ROUTES.POS && r !== ROUTES.KDS && r !== ROUTES.SUPER_ADMIN && r !== ROUTES.SUPER_ADMIN_LOGIN),
};
