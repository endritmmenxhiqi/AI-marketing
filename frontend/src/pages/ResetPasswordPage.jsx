import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Sparkles, RefreshCcw, ArrowRight } from 'lucide-react';
import { resetPassword } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const passwordPolicyMessage =
  'Password must be at least 10 characters and include uppercase, lowercase, number, and special character.';

const ResetPasswordPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { token } = useParams();
  const navigate = useNavigate();
  const { lang, toggleLanguage, t } = useLanguage();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { password, confirmPassword } = formData;

    if (!password || !confirmPassword) {
      setError(t('errorRequired'));
      return;
    }
    if (
      !(
        password.length >= 10 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^a-zA-Z0-9]/.test(password)
      )
    ) {
      setError(passwordPolicyMessage);
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errorPassMatch'));
      return;
    }

    setLoading(true);
    try {
      const payload = await resetPassword(token, password);

      // The backend now restores the session through a secure cookie.
      if (payload.token && payload.user) {
        window.location.href = '/';
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
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

      {/* Top-right controls: Language + Theme */}
      <div className="auth-controls-row">
        <button
          className="auth-theme-toggle"
          onClick={toggleLanguage}
          aria-label="Toggle language"
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.02em' }}>
            {lang === 'sq' ? 'EN' : 'AL'}
          </span>
        </button>
        <button
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Glass card */}
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
              <p className="auth-subheading">{t('resetTitle')}</p>
            </div>
          </div>

          <p className="auth-subheading" style={{ marginBottom: '1.5rem', opacity: 0.9 }}>
            {t('resetSubtitle')}
          </p>

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <div className={`auth-field ${error && !formData.password ? 'auth-field--error' : ''}`}>
              <label htmlFor="password" className="auth-field-label">{t('newPasswordLabel')}</label>
              <div className="auth-field-inner">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder={t('passwordMinFormat')}
                  value={formData.password}
                  onChange={handleChange}
                  className="auth-field-input"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className={`auth-field ${error && formData.password !== formData.confirmPassword ? 'auth-field--error' : ''}`}>
              <label htmlFor="confirmPassword" className="auth-field-label">{t('confirmPasswordLabel')}</label>
              <div className="auth-field-inner">
                <Lock size={16} className="auth-field-icon" />
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder={t('passwordPlaceholder')}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="auth-field-input"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error-bar">
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>{t('resetButton')}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="auth-switch-text" style={{ marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="auth-switch-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '0.4rem' }}
            >
              <RefreshCcw size={14} />
              {t('backToLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
