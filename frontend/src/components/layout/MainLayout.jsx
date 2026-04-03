import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  LogOut,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useChat } from '../../context/ChatContext';

const MainLayout = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { 
    conversations, 
    activeId, 
    startNewChat, 
    selectConversation, 
    deleteConversation, 
    renameConversation 
  } = useChat();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef(null);

  // Focus effect for rename input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRename = (id, currentTitle) => {
    setEditingId(id);
    setEditValue(currentTitle);
  };

  const saveRename = (e) => {
    e?.stopPropagation();
    if (editValue.trim()) {
      renameConversation(editingId, editValue);
    }
    setEditingId(null);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [idToDelete, setIdToDelete] = useState(null);

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setIdToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (idToDelete) {
      deleteConversation(idToDelete);
    }
    setShowDeleteModal(false);
    setIdToDelete(null);
  };

  return (
    <div className="app-layout">
      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <motion.div 
              className="confirm-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-icon">
                <Trash2 size={32} />
              </div>
              <h3>{t('lang') === 'sq' ? 'Fshij Bisedën' : 'Delete Conversation'}</h3>
              <p>
                {t('lang') === 'sq' 
                  ? 'A jeni i sigurt që dëshironi ta fshini këtë bisedë? Ky veprim nuk mund të kthehet.' 
                  : 'Are you sure you want to delete this conversation? This action cannot be undone.'}
              </p>
              <div className="modal-actions">
                <button className="modal-btn cancel" onClick={() => setShowDeleteModal(false)}>
                  {t('lang') === 'sq' ? 'Anulo' : 'Cancel'}
                </button>
                <button className="modal-btn delete" onClick={confirmDelete}>
                  {t('lang') === 'sq' ? 'Fshije' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ── Sidebar ────────────────────────────────────────── */}
      <motion.aside
        className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
        initial={false}
        animate={{ width: isSidebarOpen ? 'var(--sidebar-width)' : '80px' }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon-container">
              AI
            </div>
            {isSidebarOpen && <span className="logo-text">Marketing</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* New Chat Button */}
        <div className="sidebar-action">
          <button 
            className="new-chat-btn" 
            onClick={() => {
              startNewChat();
              navigate('/chat');
            }}
          >
            <Plus size={18} />
            {isSidebarOpen && <span>{t('newChat') || 'Bisedë e Re'}</span>}
          </button>
        </div>

        {/* History List */}
        <nav className="history-nav">
          {isSidebarOpen && <div className="history-label">{t('history') || 'Historiku'}</div>}
          <div className="history-list custom-scrollbar">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`history-item ${conv.id === activeId ? 'active' : ''} ${editingId === conv.id ? 'editing' : ''}`}
                onClick={() => {
                  if (editingId !== conv.id) {
                    selectConversation(conv.id);
                    navigate('/chat');
                  }
                }}
              >
                <MessageSquare size={16} className="history-icon" />
                
                {isSidebarOpen && (
                  <>
                    {editingId === conv.id ? (
                      <div className="history-edit-mode">
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename();
                            if (e.key === 'Escape') cancelRename();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="history-rename-input"
                        />
                        <button className="edit-action-btn check" onClick={saveRename}>
                          <Check size={14} />
                        </button>
                        <button className="edit-action-btn cancel" onClick={cancelRename}>
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="history-title">{conv.title}</span>
                        <div className="history-actions">
                          <button
                            className="history-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}
                            title="Rename"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="history-action-btn delete"
                            onClick={(e) => handleDeleteClick(e, conv.id)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            {isSidebarOpen && (
              <div className="user-info">
                <span className="user-email">{user?.email?.split('@')[0]}</span>
                <span className="user-role">Premium</span>
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
