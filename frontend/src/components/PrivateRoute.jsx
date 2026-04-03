import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute: wraps protected pages.
 * Redirects unauthenticated users to /login.
 * Supports both layout route pattern (Outlet) and children wrapper pattern.
 */
const PrivateRoute = ({ children, roles }) => {
  const { token, loading, user } = useAuth();
  const location = useLocation();

  // While restoring auth state from localStorage, show nothing
  if (loading) return null;

  // Not authenticated -> send to login and preserve attempted location
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

  // If route requires roles and user doesn't have one -> deny
  if (roles && (!user || !roles.includes(user.role))) return <Navigate to="/login" replace />;

  // Support both usage patterns:
  // 1. <PrivateRoute><MainLayout /></PrivateRoute> — children pattern
  // 2. <Route element={<PrivateRoute />}> — layout route pattern using Outlet
  return children ?? <Outlet />;
};

export default PrivateRoute;
