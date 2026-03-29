import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute: wraps protected pages.
 * Redirects unauthenticated users to /login.
 */
const PrivateRoute = ({ children, roles }) => {
  const { token, loading, user } = useAuth();
  const location = useLocation();

  // While restoring auth state from localStorage, show nothing
  if (loading) return null;

  // Not authenticated -> send to login and preserve attempted location
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;

  // If route requires roles and user doesn't have one -> deny (redirect to login)
  if (roles && (!user || !roles.includes(user.role))) return <Navigate to="/login" replace />;

  return children;
};

export default PrivateRoute;
