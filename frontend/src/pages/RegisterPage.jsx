import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Sparkles, ArrowRight } from 'lucide-react';
import { registerUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const calculateStrength = (password) => {
  let score = 0;
  if (!password) return score;
  if (password.length > 5) score += 1;
  if (password.length > 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
};

const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
const strengthColors = ['#ef4444', '#f59e0b', '#22c55e', '#22c55e'];

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focused, setFocused] = useState('');

  const passwordStrength = useMemo(() => calculateStrength(formData.password), [formData.password]);

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { email, password, confirmPassword } = formData;
    if (!email || !password || !confirmPassword) {
      setError(t('errorRequired'));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('errorEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('errorPassLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errorPassMatch'));
      return;
    }

    setLoading(true);
    try {
      const { data } = await registerUser(email, password);
      login(data.user, data.token);
      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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
        <div className="auth-card-accent" />

        <div className="auth-card-body">
          {/* Brand */}
          <div className="auth-brand-row">
            <div className="auth-icon-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="auth-heading">{t('appName')}</h1>
              <p className="auth-subheading">Create your account ✨</p>
            </div>
          </div>

          <div className="auth-divider" />

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="auth-form">
            {/* Email */}
            <div className={`auth-field ${focused === 'email' ? 'auth-field--focused' : ''}`}>
              <label htmlFor="reg-email" className="auth-field-label">Email</label>
              <div className="auth-field-inner">
                <Mail size={16} className="auth-field-icon" />
                <input
                  id="reg-email"
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
              <label htmlFor="reg-password" className="auth-field-label">Password</label>
              <div className="auth-field-inner">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={t('passwordMinFormat')}
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  autoComplete="new-password"
                  required
                  className="auth-field-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-eye-btn"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Strength indicator */}
              {formData.password && (
                <div className="auth-strength-wrap">
                  <div className="auth-strength-bars">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className="auth-strength-bar"
                        style={{
                          backgroundColor:
                            level <= passwordStrength
                              ? strengthColors[passwordStrength - 1]
                              : 'var(--auth-field-border)',
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="auth-strength-label"
                    style={{ color: passwordStrength > 0 ? strengthColors[passwordStrength - 1] : 'var(--text-muted)' }}
                  >
                    {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className={`auth-field ${focused === 'confirm' ? 'auth-field--focused' : ''}`}>
              <label htmlFor="reg-confirm" className="auth-field-label">Confirm Password</label>
              <div className="auth-field-inner">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="reg-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder={t('passwordPlaceholder')}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onFocus={() => setFocused('confirm')}
                  onBlur={() => setFocused('')}
                  autoComplete="new-password"
                  required
                  className="auth-field-input"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-eye-btn"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
              id="register-submit"
            >
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>{t('registerButton')}</span>
                  <ArrowRight size={18} className="auth-btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="auth-switch-text">
            {t('hasAccount')}{' '}
            <Link to="/login" className="auth-switch-link">
              {t('signInInstead')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
