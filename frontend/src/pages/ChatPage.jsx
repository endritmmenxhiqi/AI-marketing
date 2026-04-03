import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { aiChat } from '../services/api';
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Bot,
} from 'lucide-react';

// ---------- helpers ----------
const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const getTitle = (text) => text.length > 40 ? text.slice(0, 40) + '…' : text;

const loadConversations = () => {
  try {
    return JSON.parse(localStorage.getItem('ai_conversations') || '[]');
  } catch {
    return [];
  }
};

const saveConversations = (convs) => {
  localStorage.setItem('ai_conversations', JSON.stringify(convs));
};

// ---------- component ----------
const ChatPage = () => {
  const { t } = useLanguage();
  const messagesEndRef = useRef(null);

  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // sync current messages → conversations storage whenever they change
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeId ? { ...c, messages } : c
      );
      saveConversations(updated);
      return updated;
    });
  }, [messages]);

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
    setInput('');
  };

  const selectConversation = (id) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setActiveId(id);
      setMessages(conv.messages);
    }
  };

  const deleteConversation = (e, id) => {
    e.stopPropagation();
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    saveConversations(updated);
    if (activeId === id) startNewChat();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMsg = { role: 'user', content: userText };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    // create conversation entry if first message
    let convId = activeId;
    if (!convId) {
      convId = generateId();
      const newConv = {
        id: convId,
        title: getTitle(userText),
        messages: nextMessages,
      };
      setActiveId(convId);
      setConversations((prev) => {
        const updated = [newConv, ...prev];
        saveConversations(updated);
        return updated;
      });
    }

    try {
      const history = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const response = await aiChat(userText, history.slice(0, -1));

      if (response.data.success) {
        const aiMsg = { role: 'assistant', content: response.data.data };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('no response');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: t('errorChat') || 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const isNew = messages.length === 0;

  return (
    <div className="gpt-layout">
      {/* ── Left History Panel ───────────────────────────── */}
      <aside className="gpt-history-panel">
        <button className="gpt-new-chat" onClick={startNewChat}>
          <Plus size={16} />
          <span>{t('newChat') || 'New Chat'}</span>
        </button>

        <div className="gpt-history-list">
          {conversations.length === 0 ? (
            <p className="gpt-history-empty">{t('noHistory') || 'No conversations yet'}</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`gpt-history-item ${conv.id === activeId ? 'active' : ''}`}
                onClick={() => selectConversation(conv.id)}
              >
                <MessageSquare size={14} className="gpt-history-icon" />
                <span className="gpt-history-title">{conv.title}</span>
                <button
                  className="gpt-history-delete"
                  onClick={(e) => deleteConversation(e, conv.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Right Chat Area ──────────────────────────────── */}
      <div className="gpt-chat-area">
        {/* Messages */}
        <div className="gpt-messages">
          {isNew ? (
            <div className="gpt-welcome">
              <div className="gpt-welcome-icon">
                <Bot size={40} />
              </div>
              <h2>{t('chatWelcome') || 'How can I help you today?'}</h2>
              <p>{t('chatWelcomeSub') || 'Start a conversation with your AI Marketing Assistant'}</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`gpt-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="gpt-avatar ai-avatar">
                    <Sparkles size={16} />
                  </div>
                )}
                <div className="gpt-bubble">
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="gpt-avatar user-avatar">
                    U
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="gpt-message assistant">
              <div className="gpt-avatar ai-avatar">
                <Sparkles size={16} />
              </div>
              <div className="gpt-bubble">
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="gpt-input-wrapper">
          <form className="gpt-input-form" onSubmit={handleSend}>
            <textarea
              className="gpt-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chatPlaceholder') || 'Message AI Assistant…'}
              disabled={loading}
              rows={1}
            />
            <button
              type="submit"
              className="gpt-send-btn"
              disabled={loading || !input.trim()}
            >
              {loading ? (
                <div className="spinner" style={{ width: '16px', height: '16px' }} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
          <p className="gpt-disclaimer">
            {t('chatDisclaimer') || 'AI can make mistakes. Verify important information.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
