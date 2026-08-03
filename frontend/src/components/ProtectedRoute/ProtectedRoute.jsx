import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROUTES } from '../../utils/constants';
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
    return <Navigate to={ROUTES.POS} replace />;
  }

  return children;
}
