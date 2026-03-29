import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      // Redirect based on role
      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">✦</div>
          <h1 className="auth-title">{t('appName')}</h1>
          <p className="auth-subtitle">{t('registerTitle')}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">{t('emailLabel')}</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder={t('emailPlaceholder')}
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('passwordLabel')}</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder={t('passwordMinFormat')}
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder={t('passwordPlaceholder')}
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : t('registerButton')}
          </button>
        </form>

        <p className="auth-footer">
          {t('hasAccount')}{' '}
          <Link to="/login">{t('signInInstead')}</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
