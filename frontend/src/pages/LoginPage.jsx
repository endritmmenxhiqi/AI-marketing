import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState('');

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { email, password } = formData;
    if (!email || !password) {
      setError(t('errorRequired'));
      return;
    }

    setLoading(true);
    try {
      const { data } = await loginUser(email, password);
      login(data.user, data.token);
      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-scene">
      {/* Animated background orbs */}
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />

      {/* Theme toggle */}
      <button
        className="auth-theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Card */}
      <div className="auth-glass-card">
        {/* Left accent strip */}
        <div className="auth-card-accent" />

        {/* Content */}
        <div className="auth-card-body">
          {/* Brand */}
          <div className="auth-brand-row">
            <div className="auth-icon-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="auth-heading">{t('appName')}</h1>
              <p className="auth-subheading">Welcome back 👋</p>
            </div>
          </div>

          {/* Divider */}
          <div className="auth-divider" />

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {/* Email */}
            <div className={`auth-field ${focused === 'email' ? 'auth-field--focused' : ''}`}>
              <label htmlFor="login-email" className="auth-field-label">Email</label>
              <div className="auth-field-inner">
                <Mail size={16} className="auth-field-icon" />
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  placeholder={t('emailPlaceholder')}
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                  autoComplete="email"
                  required
                  className="auth-field-input"
                />
              </div>
            </div>

            {/* Password */}
            <div className={`auth-field ${focused === 'password' ? 'auth-field--focused' : ''}`}>
              <div className="auth-field-label-row">
                <label htmlFor="login-password" className="auth-field-label">Password</label>
                <Link to="/forgot-password" className="auth-forgot-link">
                  Forgot password?
                </Link>
              </div>
              <div className="auth-field-inner">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={t('passwordPlaceholder')}
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  autoComplete="current-password"
                  required
                  className="auth-field-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-eye-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="auth-error-bar">
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
              id="login-submit"
            >
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>{t('loginButton')}</span>
                  <ArrowRight size={18} className="auth-btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="auth-switch-text">
            {t('noAccount')}{' '}
            <Link to="/register" className="auth-switch-link">
              {t('createOne')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
