import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  FileText, 
  TrendingUp, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

const DashboardPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const stats = [
    { label: t('campaigns'), value: '12', icon: BarChart3, trend: '+2.5%', color: '#6366f1' },
    { label: t('assets'), value: '48', icon: FileText, trend: '+12%', color: '#10b981' },
    { label: t('generations'), value: '1.2k', icon: Sparkles, trend: '+18%', color: '#f59e0b' },
  ];

  return (
    <div className="dashboard-content">
      {/* Header Section */}
      <header className="page-header">
        <div>
          <h1 className="auth-title">{t('welcomeBack')}, {user?.email?.split('@')[0]}</h1>
          <p className="auth-subtitle">{t('dashboardHint')}</p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="dashboard-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="stat-card">
            <div className="stat-header">
              <div className="stat-icon-wrapper" style={{ color: stat.color }}>
                <stat.icon size={24} />
              </div>
              <div className="stat-trend">
                <TrendingUp size={14} />
                <span>{stat.trend}</span>
              </div>
            </div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main Action Card */}
      <div className="chat-link-card" onClick={() => navigate('/chat')} style={{ marginTop: '2.5rem' }}>
        <div className="chat-link-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Sparkles size={20} style={{ color: 'var(--accent)' }} />
            <h3>{t('aiAssistant')}</h3>
          </div>
          <p>{t('chatDescription')}</p>
        </div>
        <button className="btn-start-chat" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {t('startChat')}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default DashboardPage;
