import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { ChatProvider } from './context/ChatContext';
import PrivateRoute from './components/PrivateRoute';
import ThemeLangToggle from './components/ThemeLangToggle';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminPage from './pages/AdminPage';
import ChatPage from './pages/ChatPage';

import MainLayout from './components/layout/MainLayout';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ChatProvider>
            <BrowserRouter>
              <ThemeLangToggle />
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

                {/* Protected routes wrapped in MainLayout */}
                <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
                  <Route path="/dashboard" element={<Navigate to="/chat" replace />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/admin" element={<AdminPage roles={['admin']} />} />
                </Route>

                {/* Default redirect */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </BrowserRouter>
          </ChatProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
