import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES, ROLE_DEFAULT_ROUTE } from '../../utils/constants';
import Spinner from '../Spinner/Spinner';

/**
 * Wraps a route requiring authentication and optionally a specific role.
 * @param {string[]} allowedRoles - If omitted, any authenticated user can access.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isInitialized, role } = useAuth();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const fallback = ROLE_DEFAULT_ROUTE[role] || ROUTES.DASHBOARD;
    return <Navigate to={fallback} replace />;
  }

  return children;
}
