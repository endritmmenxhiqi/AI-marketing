import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * PrivateRoute: wraps protected pages.
 * Redirects unauthenticated users to /login.
 */
const PrivateRoute = ({ children }) => {
  const { token, loading } = useAuth();

  // While restoring auth state from localStorage, show nothing
  if (loading) return null;

  return token ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
