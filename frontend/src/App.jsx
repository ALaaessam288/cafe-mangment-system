import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import AppLayout from './layouts/AppLayout';

import SplashScreen    from './pages/Splash/SplashScreen';
import WelcomePage     from './pages/Welcome/WelcomePage';
import SetupWizard     from './pages/Setup/SetupWizard';
import LoginPage       from './pages/Login/LoginPage';
import RegisterPage    from './pages/Register/RegisterPage';
import DashboardPage   from './pages/Dashboard/DashboardPage';
import POSPage         from './pages/POS/POSPage';
import KdsPage         from './pages/KDS/KdsPage';
import InvoicesPage    from './pages/Invoices/InvoicesPage';
import ProductsPage    from './pages/Products/ProductsPage';
import CategoriesPage  from './pages/Categories/CategoriesPage';
import TablesPage      from './pages/Tables/TablesPage';
import UsersPage       from './pages/Users/UsersPage';
import EmployeesPage   from './pages/Employees/EmployeesPage';
import ExpensesPage    from './pages/Expenses/ExpensesPage';
import ReportsPage     from './pages/Reports/ReportsPage';
import SettingsPage    from './pages/Settings/SettingsPage';
import InventoryPage   from './pages/Inventory/InventoryPage';
import DebtsPage       from './pages/Debts/DebtsPage';
import SuperAdminPage  from './pages/SuperAdmin/SuperAdminPage';

import { ROLES, ROUTES } from './utils/constants';

export default function App() {
  return (
    // Outside the router on purpose: a crash inside routing itself still has to land somewhere,
    // and the boundary's recovery button navigates with window.location rather than the router.
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
            {/* Public */}
            <Route path={ROUTES.SPLASH} element={<SplashScreen />} />
            <Route path={ROUTES.WELCOME} element={<WelcomePage />} />
            <Route path={ROUTES.SETUP} element={<SetupWizard />} />
            <Route path={ROUTES.LOGIN}  element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />

            {/* Protected — Cashier & Supervisor only (Hidden from Admin) */}
            <Route
              path={ROUTES.POS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.CASHIER]}>
                  <AppLayout>
                    <POSPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Kitchen / bar display - deliberately full-screen, no app chrome */}
            <Route
              path={ROUTES.KDS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.SUPERVISOR, ROLES.CASHIER]}>
                  <KdsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.INVOICES}
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <InvoicesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.SETTINGS}
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected — Supervisor + Admin */}
            <Route
              path={ROUTES.DASHBOARD}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <DashboardPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.EXPENSES}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER]}>
                  <AppLayout>
                    <ExpensesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.REPORTS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <ReportsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.INVENTORY}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <InventoryPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected — Admin only */}
            <Route
              path={ROUTES.PRODUCTS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <ProductsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.CATEGORIES}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <CategoriesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.TABLES}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <TablesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.USERS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <UsersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.EMPLOYEES}
              element={
                /* Cashiers may view staff and record salary payouts - the backend
                   already allows it (GET /employees + POST /employees/transactions).
                   The payroll summary stays admin/supervisor only, inside the page. */
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.CASHIER]}>
                  <AppLayout>
                    <EmployeesPage />
                  </AppLayout>
                </ProtectedRoute>

              }
            />

            <Route
              path={ROUTES.DEBTS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.SUPERVISOR]}>
                  <AppLayout>
                    <DebtsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.SUPER_ADMIN}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AppLayout>
                    <SuperAdminPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to={ROUTES.SPLASH} replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
