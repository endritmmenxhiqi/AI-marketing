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

  const sendMessage = async (content) => {
    if (!content.trim() || loading) return;

    const userMsg = { role: 'user', content: content.trim() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    let currentId = activeId;
    if (!currentId) {
      currentId = generateId();
      const newConv = {
        id: currentId,
        title: getTitle(content.trim()),
        messages: nextMessages,
        timestamp: new Date().toISOString(),
      };
      setActiveId(currentId);
      setConversations((prev) => [newConv, ...prev]);
    }

    try {
      const history = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const response = await aiChat(content, history.slice(0, -1));

      if (response.data.success) {
        const aiMsg = { role: 'assistant', content: response.data.data };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error('API Error');
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: 'Something went wrong. Please try again.' },
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
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
