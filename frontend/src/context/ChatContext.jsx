import React, { createContext, useContext, useState, useEffect } from 'react';
import { aiChat } from '../services/api';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const getTitle = (text) => text.length > 40 ? text.slice(0, 40) + '…' : text;

export const ChatProvider = ({ children }) => {
  const [conversations, setConversations] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ai_conversations') || '[]');
    } catch {
      return [];
    }
  });

  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('ai_conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Sync current messages to history entry
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setConversations((prev) => 
      prev.map((c) => (c.id === activeId ? { ...c, messages } : c))
    );
  }, [messages, activeId]);

  const startNewChat = () => {
    setActiveId(null);
    setMessages([]);
  };

  const selectConversation = (id) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) {
      setActiveId(id);
      setMessages(conv.messages);
    }
  };

  const deleteConversation = (id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) startNewChat();
  };

  const renameConversation = (id, newTitle) => {
    if (!newTitle.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
    );
  };

  const sendMessage = async (content, file = null) => {
    if (!content.trim() && !file) return;
    if (loading) return;

    const userMsg = { 
      role: 'user', 
      content: content.trim(),
      image: file ? URL.createObjectURL(file) : null // Local preview URL
    };
    
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    let currentId = activeId;
    if (!currentId) {
      currentId = generateId();
      const newConv = {
        id: currentId,
        title: getTitle(content.trim() || 'Imazh i ngarkuar'),
        messages: nextMessages,
        timestamp: new Date().toISOString(),
      };
      setActiveId(currentId);
      setConversations((prev) => [newConv, ...prev]);
    }

    try {
      const history = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      
      let payload;
      if (file) {
        payload = new FormData();
        payload.append('message', content);
        payload.append('history', JSON.stringify(history.slice(0, -1)));
        payload.append('image', file);
      } else {
        payload = { message: content, history: history.slice(0, -1) };
      }

      const response = await aiChat(payload);

      if (response.data.success) {
        // Update User Message to use the stable server URL instead of the fragile Blob URL
        if (response.data.imagePath) {
          const serverUrl = `http://localhost:5000${response.data.imagePath}`;
          setMessages((prev) => prev.map((msg, i) => 
            i === nextMessages.length - 1 ? { ...msg, image: serverUrl } : msg
          ));
        }

        const aiMsg = { 
          role: 'assistant', 
          content: response.data.data,
          analysisImage: response.data.imagePath ? `http://localhost:5000${response.data.imagePath}` : null
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('API Error');
      }
    } catch (error) {
      console.error('Send Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: 'Diçka shkoi keq. Ju lutem provoni sërish.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeId,
        messages,
        loading,
        startNewChat,
        selectConversation,
        deleteConversation,
        renameConversation,
        sendMessage,
        setMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
