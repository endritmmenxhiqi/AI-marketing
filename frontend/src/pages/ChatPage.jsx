import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useChat } from '../context/ChatContext';
import {
  Send,
  User,
  Bot,
  Loader2,
  Volume2,
  Square,
} from 'lucide-react';

const ChatPage = () => {
  const { t } = useLanguage();
  const { messages, sendMessage, loading } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // TTS state
  const [ttsLoadingIdx, setTtsLoadingIdx] = useState(null);
  const [playingIdx, setPlayingIdx] = useState(null);
  const audioRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingIdx(null);
  }, []);

  const handleListen = useCallback(async (text, idx) => {
    if (playingIdx === idx) { stopAudio(); return; }
    stopAudio();

    try {
      setTtsLoadingIdx(idx);
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/ai/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, model: 'aura-asteria-en' }),
      });

      if (!res.ok) throw new Error('TTS failed with status: ' + res.status);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      const cleanup = () => {
        setPlayingIdx(null);
        setTimeout(() => URL.revokeObjectURL(url), 5000); // give the browser plenty of time
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;

      // play() returns a promise in modern browsers
      audio.play().catch(err => {
        console.error('Audio playback error:', err);
        cleanup();
      });

      setPlayingIdx(idx);
    } catch (err) {
      console.error('TTS Error:', err);
    } finally {
      setTtsLoadingIdx(null);
    }
  }, [playingIdx, stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  const isNew = messages.length === 0;

  return (
    <div className="chat-container">
      {/* ── Chat Messages ── */}
      <div className="chat-messages-area custom-scrollbar">
        {isNew ? (
          <div className="chat-welcome">
            <div className="welcome-logo">
              AI
            </div>
            <h2>{t('chatWelcome') || 'Si mund t\'ju ndihmoj sot?'}</h2>
            <p>{t('chatWelcomeSub') || 'Filloni një bisedë me asistentin tuaj inteligjent.'}</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble-container ${msg.role}`}>
              <div className="chat-bubble-wrapper">
                <div className="chat-avatar">
                  {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div className="chat-bubble-content">
                  <div className="chat-role-name">
                    {msg.role === 'assistant' ? 'AI Assistant' : 'Ju'}
                  </div>
                  <div className="chat-text">
                    {msg.content}
                  </div>

                  {/* ── TTS Button (only for assistant messages) ── */}
                  {msg.role === 'assistant' && (
                    <button
                      className={`tts-listen-btn ${playingIdx === idx ? 'playing' : ''}`}
                      onClick={() => handleListen(msg.content, idx)}
                      disabled={ttsLoadingIdx === idx}
                      title={playingIdx === idx ? 'Ndalo audio' : 'Dëgjo reklamën'}
                    >
                      {ttsLoadingIdx === idx ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : playingIdx === idx ? (
                        <>
                          <Square size={13} />
                          <span>Ndalo</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={14} />
                          <span>Dëgjo 🔊</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="chat-bubble-container assistant loading">
            <div className="chat-bubble-wrapper">
              <div className="chat-avatar">
                <Bot size={18} />
              </div>
              <div className="chat-bubble-content">
                <div className="chat-role-name">AI Assistant</div>
                <div className="typing-loader">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Chat Input ── */}
      <div className="chat-input-section">
        <div className="chat-input-container">
          <form onSubmit={handleSend} className="chat-input-form">
            <textarea
              className="chat-input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chatPlaceholder') || 'Shkruani një mesazh...'}
              rows={1}
            />
            <button
              type="submit"
              className="chat-send-button"
              disabled={loading || !input.trim()}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
            </button>
          </form>
          <p className="chat-footer-note">
            {t('chatDisclaimer')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
