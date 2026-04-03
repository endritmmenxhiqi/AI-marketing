import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  LogOut,
  Menu,
  X,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'chat', icon: MessageSquare, label: t('chatTitle'), path: '/chat' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* ── Sidebar ────────────────────────────────────────── */}
      <motion.aside
        className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
        initial={false}
        animate={{ width: isSidebarOpen ? 'var(--sidebar-width)' : '80px' }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Sparkles className="logo-icon" size={24} />
            {isSidebarOpen && <span className="logo-text">{t('appName')}</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span>{item.label}</span>}
              {location.pathname === item.path && (
                <motion.div
                  className="active-indicator"
                  layoutId="active-nav"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="user-info">
                <span className="user-email">{user?.email?.split('@')[0]}</span>
                <span className="user-role">User</span>
              </div>
            )}
            <button className="logout-btn" onClick={handleLogout} title={t('signOut')}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="page-container"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default MainLayout;
