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
  Image as ImageIcon,
  X,
} from 'lucide-react';

import { aiAutoFix } from '../services/api';

const ChatPage = () => {
  const { t } = useLanguage();
  const { messages, sendMessage, loading, setMessages } = useChat(); // Added setMessages to update local state
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fixingIdx, setFixingIdx] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // TTS state
  const [ttsLoadingIdx, setTtsLoadingIdx] = useState(null);
  const [playingIdx, setPlayingIdx] = useState(null);
  const audioRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = (e) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || loading) return;
    
    sendMessage(input, selectedFile);
    
    setInput('');
    removeFile();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleAutoFix = async (idx, imagePath, title, background = '') => {
    try {
      setFixingIdx(idx);
      const res = await aiAutoFix(imagePath, title, background);
      if (res.data.success) {
        // Update the specific message with the fixed image in the correct slot
        setMessages(prev => prev.map((msg, i) => 
          i === idx ? { ...msg, fixedImage: `http://localhost:5000${res.data.data.url}` } : msg
        ));
      }
    } catch (error) {
      console.error('AutoFix Error:', error);
    } finally {
      setFixingIdx(null);
    }
  };

  // Automate the "Fixing" process when AI returns analysis
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.analysisImage && !lastMsg.fixedAutomatically) {
      const content = typeof lastMsg.content === 'string' ? lastMsg.content : '';
      
      const matchTitle = content.match(/(?:Teksti mbi foto|Title):\s*(.*)/i);
      const matchPrompt = content.match(/(?:Background Prompt|Reconstruction Prompt|Prompt):\s*(.*)/i);
      
      const title = (matchTitle ? matchTitle[1] : "Oferta e Ditës!").replace(/[*#]/g, '').trim();
      const prompt = (matchPrompt ? matchPrompt[1] : "Professional product background, 9:16").replace(/[*#]/g, '').trim();
      
      let imgPath = lastMsg.analysisImage;
      // Safety: Only proceed if it's a server URL, ignore local blobs
      if (imgPath.startsWith('http://localhost:5000')) {
        imgPath = imgPath.replace('http://localhost:5000', '');
        // Mark as fixed so we don't loop
        lastMsg.fixedAutomatically = true;
        handleAutoFix(messages.length - 1, imgPath, title, prompt);
      }
    }
  }, [messages]);

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
                    {/* Render User Uploaded Image if present */}
                    {msg.image && (
                      <img src={msg.image} alt="User Upload" className="chat-user-img" />
                    )}

                    {/* Render AI Analysis Image if present */}
                    {msg.analysisImage && (
                      <div className="ai-analysis-img-box">
                         <img src={msg.analysisImage} alt="Analysis" className="chat-ai-img" />
                         
                         {/* MOVED AUTO-FIX BUTTON HERE FOR PERMANENT VISIBILITY */}
                         {!msg.fixedImage && (
                            <button 
                              className="auto-fix-trigger-btn"
                              style={{ marginTop: '10px', width: 'auto', padding: '10px 20px' }}
                              onClick={() => {
                                // Try to find a title and reconstruction prompt in the content
                                const content = typeof msg.content === 'string' ? msg.content : '';
                                // More robust regex to handle potential markdown bolding like **Reconstruction Prompt:**
                                const matchTitle = content.match(/(?:Teksti mbi foto|Title):\s*(.*)/i);
                                const matchPrompt = content.match(/(?:Reconstruction Prompt|Prompt):\s*(.*)/i);
                                
                                const title = (matchTitle ? matchTitle[1] : "Oferta e Ditës!").replace(/[*#]/g, '').trim();
                                const prompt = (matchPrompt ? matchPrompt[1] : "Professional studio product photo, 9:16").replace(/[*#]/g, '').trim();
                                
                                handleAutoFix(idx, msg.analysisImage?.replace('http://localhost:5000', '') || '', title, prompt);
                              }}
                              disabled={fixingIdx === idx}
                            >
                              {fixingIdx === idx ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>Duke dizajnuar...</span>
                                </>
                              ) : (
                                <>
                                  <span>✨ Rregulloje për mua</span>
                                </>
                              )}
                            </button>
                         )}
                      </div>
                    )}

                    {/* Render FIXED Image if present */}
                    {msg.fixedImage && (
                      <div className="ai-fixed-img-box">
                         <div className="fixed-badge">AD-READY ✨</div>
                         <img src={msg.fixedImage} alt="Fixed" className="chat-fixed-img" />
                         <a href={msg.fixedImage} download className="download-ready-btn">Shkarko Visual-in ⬇️</a>
                      </div>
                    )}

                    {typeof msg.content === 'string' ? msg.content.split(/(\[IMAGE: [\s\S]*?\])/g).map((part, i) => {
                      if (part.startsWith('[IMAGE: ') && part.endsWith(']')) {
                        const promptText = part.replace('[IMAGE: ', '').replace(']', '').trim();
                        const finalPrompt = promptText || "Professional product photo";
                        const safePrompt = encodeURIComponent(finalPrompt);
                        // HIT THE LOCAL BACKEND PROXY instead of external API
                        const imgUrl = `http://localhost:5000/api/ai/image-proxy?prompt=${safePrompt}`;
                        
                        return (
                          <div key={i} className="ai-image-wrapper">
                            <div className="ai-image-loader-container">
                              <div className="modern-spinner"></div>
                              <div className="loader-text">AI po gjeneron imazhin në backend...</div>
                              <div className="loader-subtext">Vizatimi nga zero kërkon pak durim (10-15s).</div>
                            </div>
                            <img 
                              src={imgUrl} 
                              alt="Marketing Visual" 
                              className="ai-generated-img-inline"
                              onLoad={(e) => {
                                e.target.style.display = 'block';
                                e.target.previousSibling.style.display = 'none';
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.previousSibling.innerHTML = "<div style='color:#ef4444'>⚠️ Gabim gjatë gjenerimit. Provoni sërish.</div>";
                              }}
                              style={{ display: 'none' }}
                            />
                            <div style={{ fontSize: '11px', color: '#666', marginTop: '10px', textAlign: 'center' }}>
                              Generated by AI Marketing Engine (Backend Mode)
                            </div>
                          </div>
                        );
                      }
                      
                      // Style Status messages (Generating...)
                      if (part.toLowerCase().includes('duke gjeneruar imazhin') || part.toLowerCase().includes('duke përgatitur')) {
                        return (
                          <div key={i} className="ai-status-note">
                            <Loader2 size={14} className="animate-spin" />
                            {part}
                          </div>
                        );
                      }

                      // Style "Teksti mbi foto" rubrik
                      if (part.includes('Teksti mbi foto:')) {
                        const [label, ...rest] = part.split(':');
                        const caption = rest.join(':').trim();
                        return (
                          <div key={i} className="ai-caption-rubrik">
                            <strong className="label">{label}:</strong>
                            <div className="caption-content">{caption}</div>
                            
                            {/* Auto-Fix Button (only if we have an image to fix) */}
                            {msg.analysisImage && !msg.fixedImage && (
                              <button 
                                className="auto-fix-trigger-btn"
                                onClick={() => {
                                  const content = typeof msg.content === 'string' ? msg.content : '';
                                  const matchPrompt = content.match(/(?:Reconstruction Prompt|Prompt):\s*(.*)/i);
                                  const prompt = (matchPrompt ? matchPrompt[1] : "Professional studio product photo, 9:16").replace(/[*#]/g, '').trim();
                                  handleAutoFix(idx, msg.analysisImage.replace('http://localhost:5000', ''), caption, prompt);
                                }}
                                disabled={fixingIdx === idx}
                              >
                                {fixingIdx === idx ? (
                                  <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Duke dizajnuar...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>✨ Rregulloje për mua</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <span key={i}>
                          {part.split('\n').map((line, j) => (
                            <React.Fragment key={j}>
                              {line}
                              {j !== part.split('\n').length - 1 && <br />}
                            </React.Fragment>
                          ))}
                        </span>
                      );
                    }) : msg.content}
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
          {/* File Preview */}
          {previewUrl && (
            <div className="chat-file-preview">
              <img src={previewUrl} alt="Preview" />
              <button onClick={removeFile} className="remove-preview">
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="chat-input-form">
            <button 
              type="button" 
              className="chat-attach-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={onFileChange}
            />

            <textarea
              className="chat-input-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedFile ? 'Shto një mesazh për foton...' : (t('chatPlaceholder') || 'Shkruani një mesazh...')}
              rows={1}
            />
            <button
              type="submit"
              className="chat-send-button"
              disabled={loading || (!input.trim() && !selectedFile)}
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

// --- CSS STYLES FOR AI COMPONENTS ---
const styles = `
.ai-image-wrapper {
  margin: 25px 0;
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(124, 58, 237, 0.2);
  min-height: 200px;
}

.ai-image-loader-container {
  padding: 80px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  color: #7c3aed;
  font-weight: 500;
  text-align: center;
}

.modern-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(124, 58, 237, 0.1);
  border-top: 3px solid #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loader-text {
  font-size: 15px;
  color: #f8fafc;
}

.loader-subtext {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
  max-width: 250px;
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.ai-generated-img-inline {
  width: 100%;
  height: auto;
  max-height: 800px;
  object-fit: contain;
  display: block;
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.ai-status-note {
  background: rgba(124, 58, 237, 0.1);
  border-left: 3px solid #7c3aed;
  padding: 10px 15px;
  margin: 10px 0;
  border-radius: 0 8px 8px 0;
  font-size: 13px;
  color: #a78bfa;
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-caption-rubrik {
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.ai-caption-rubrik .label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #94a3b8;
  margin-bottom: 5px;
}

.ai-caption-rubrik .caption-content {
  font-size: 16px;
  font-weight: 500;
  color: #f8fafc;
  line-height: 1.4;
}

.fallback-card {
  padding: 20px;
  text-align: center;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.fallback-card a {
  display: block;
  margin-top: 10px;
  color: #ef4444;
  text-decoration: underline;
}

.chat-user-img, .chat-ai-img {
  max-width: 100%;
  border-radius: 12px;
  margin-bottom: 15px;
  display: block;
}

.chat-file-preview {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: rgba(15, 23, 42, 0.95);
  padding: 10px;
  border-radius: 12px 12px 0 0;
  border: 1px solid rgba(124, 58, 237, 0.3);
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: -1px;
  backdrop-filter: blur(10px);
}

.chat-file-preview img {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
}

.remove-preview {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-preview:hover {
  background: #ef4444;
  color: white;
}

.chat-attach-button {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-attach-button:hover {
  background: rgba(124, 58, 237, 0.1);
  color: #7c3aed;
}

.chat-input-form {
  display: flex;
  align-items: center;
  gap: 10px;
.ai-fixed-img-box {
  margin: 20px 0;
  position: relative;
  border: 2px solid #10b981;
  border-radius: 16px;
  overflow: hidden;
  background: #0f172a;
}

.fixed-badge {
  position: absolute;
  top: 15px;
  right: 15px;
  background: #10b981;
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.chat-fixed-img {
  width: 100%;
  height: auto;
  display: block;
}

.download-ready-btn {
  display: block;
  width: 100%;
  padding: 15px;
  background: #10b981;
  color: white;
  text-align: center;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
}

.download-ready-btn:hover {
  background: #059669;
}

.auto-fix-trigger-btn {
  margin-top: 15px;
  width: 100%;
  padding: 12px;
  background: linear-gradient(90deg, #7c3aed, #9333ea);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.auto-fix-trigger-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
}

.auto-fix-trigger-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
