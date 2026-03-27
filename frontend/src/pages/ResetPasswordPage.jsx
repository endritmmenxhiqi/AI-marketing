import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { resetPassword } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const { data } = await resetPassword(token, password);
      // Auto-login after successful password reset
      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">✦</div>
          <h1 className="auth-title">{t('resetTitle')}</h1>
          <p className="auth-subtitle">{t('resetSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="password">{t('newPasswordLabel')}</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder={t('passwordMinFormat')}
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : t('resetButton')}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">← {t('backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
