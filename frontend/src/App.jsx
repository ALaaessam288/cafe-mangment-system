import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import AppLayout from './layouts/AppLayout';

import SplashScreen    from './pages/Splash/SplashScreen';
import LoginPage       from './pages/Login/LoginPage';
import RegisterPage    from './pages/Register/RegisterPage';
import DashboardPage   from './pages/Dashboard/DashboardPage';
import POSPage         from './pages/POS/POSPage';
import InvoicesPage    from './pages/Invoices/InvoicesPage';
import ProductsPage    from './pages/Products/ProductsPage';
import CategoriesPage  from './pages/Categories/CategoriesPage';
import TablesPage      from './pages/Tables/TablesPage';
import UsersPage       from './pages/Users/UsersPage';
import EmployeesPage   from './pages/Employees/EmployeesPage';
import ExpensesPage    from './pages/Expenses/ExpensesPage';
import ReportsPage     from './pages/Reports/ReportsPage';
import SettingsPage    from './pages/Settings/SettingsPage';

import { ROLES, ROUTES } from './utils/constants';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path={ROUTES.SPLASH} element={<SplashScreen />} />
            <Route path={ROUTES.LOGIN}  element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />

            {/* Protected — All roles */}
            <Route
              path={ROUTES.POS}
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <POSPage />
                  </AppLayout>
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

            {/* Protected — Admin only */}
            <Route
              path={ROUTES.PRODUCTS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AppLayout>
                    <ProductsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.CATEGORIES}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AppLayout>
                    <CategoriesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.TABLES}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AppLayout>
                    <TablesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.USERS}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AppLayout>
                    <UsersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path={ROUTES.EMPLOYEES}
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AppLayout>
                    <EmployeesPage />
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
  );
}
