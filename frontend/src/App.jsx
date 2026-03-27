import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import ThemeLangToggle from './components/ThemeLangToggle';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AuthProvider>
            <ThemeLangToggle />
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />

              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
