import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
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
          <p className="auth-subtitle">{t('loginTitle')}</p>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label htmlFor="password" style={{ marginBottom: 0 }}>{t('passwordLabel')}</label>
              <Link to="/forgot-password" style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none' }}>
                {t('forgotPasswordLink')}
              </Link>
            </div>
            <input
              id="password"
              type="password"
              name="password"
              placeholder={t('passwordPlaceholder')}
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : t('loginButton')}
          </button>
        </form>

        <p className="auth-footer">
          {t('noAccount')}{' '}
          <Link to="/register">{t('createOne')}</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
