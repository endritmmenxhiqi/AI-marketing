import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { registerUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ThemeLangToggle from '../components/ThemeLangToggle';

const calculateStrength = (password) => {
  let score = 0;
  if (!password) return score;
  if (password.length > 5) score += 1;
  if (password.length > 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.min(score, 4); // Max score 4
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [formData, setFormData] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      // Redirect based on role
      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strengthColors = ['#ef4444', '#f59e0b', '#10b981', '#10b981'];
  const strengthColor = passwordStrength > 0 ? strengthColors[passwordStrength - 1] : 'transparent';

  return (
    <div className="auth-wrapper">
      <ThemeLangToggle />
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
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder={t('passwordMinFormat')}
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Password strength indicator */}
            {formData.password && (
              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', height: '4px' }}>
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    style={{
                      flex: 1,
                      backgroundColor: level <= passwordStrength ? strengthColor : 'var(--bg-hover)',
                      borderRadius: '2px',
                      transition: 'background-color 0.3s'
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('confirmPasswordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder={t('passwordPlaceholder')}
                value={formData.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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
