import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

/**
 * AuthProvider: wraps the app and provides auth state + actions to all children.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // On mount, restore user from localStorage if token exists
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setToken(null);
      }
    }
    setLoading(false);
  }, []);

  /** Call after a successful register/login API response */
  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  /** Clear auth state */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Convenience hook */
export const useAuth = () => useContext(AuthContext);
