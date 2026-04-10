import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import ThemeLangToggle from '../components/ThemeLangToggle';

const ForgotPasswordPage = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError(t('errorRequired'));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('errorEmail'));
      return;
    }

    setLoading(true);
    try {
      const { data } = await forgotPassword(email);
      setMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <ThemeLangToggle />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">✦</div>
          <h1 className="auth-title">{t('forgotTitle')}</h1>
          <p className="auth-subtitle">{t('forgotSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">{t('emailLabel')}</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : t('forgotButton')}
          </button>
        </form>

        {message && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', borderRadius: '8px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>{message}</p>
          </div>
        )}

        <p className="auth-footer">
          <Link to="/login">← {t('backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
