import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-card">
        {/* Header */}
        <div className="dashboard-header">
          <div className="dashboard-logo">✦ {t('appName')}</div>
          <button className="btn-logout" onClick={handleLogout}>
            {t('signOut')}
          </button>
        </div>

        {/* Welcome */}
        <div className="dashboard-body">
          <div className="dashboard-avatar">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <h2 className="dashboard-greeting">{t('welcomeBack')}</h2>
          <p className="dashboard-email">{user?.email}</p>

          <div className="dashboard-stats">
            <div className="stat-card">
              <span className="stat-number">0</span>
              <span className="stat-label">{t('campaigns')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">0</span>
              <span className="stat-label">{t('assets')}</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">0</span>
              <span className="stat-label">{t('generations')}</span>
            </div>
          </div>

          <p className="dashboard-hint">
            {t('dashboardHint')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
