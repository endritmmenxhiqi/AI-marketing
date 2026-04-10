import axios from 'axios';

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

// ─── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth API Calls ────────────────────────────────────────────────────────────

/** Register a new user */
export const registerUser = (email, password) =>
  api.post('/auth/register', { email, password });

/** Log in an existing user */
export const loginUser = (email, password) =>
  api.post('/auth/login', { email, password });

/** Request password reset email/link */
export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email });

/** Reset password using token */
export const resetPassword = (token, password) =>
  api.put(`/auth/reset-password/${token}`, { password });

/** Fetch the currently authenticated user */
export const fetchMe = () => api.get('/auth/me');

// ─── AI API Calls ─────────────────────────────────────────────────────────────

/** Send a message to the AI assistant */
export const aiChat = (message, history) =>
  api.post('/ai/chat', { message, history });

/** Generate and save a marketing content job */
export const generateMarketingContent = (payload) =>
  api.post('/ai/generate', payload);

/** Fetch recent saved generations */
export const fetchGenerations = (params = {}) =>
  api.get('/ai/generations', { params });

/** Refresh stock media suggestions for a saved generation */
export const refreshGenerationMedia = (generationId) =>
  api.post(`/ai/generations/${generationId}/media`);

/** Refresh voiceover audio for a saved generation */
export const refreshGenerationVoice = (generationId) =>
  api.post(`/ai/generations/${generationId}/voice`);

/** Render a preview video for a saved generation */
export const renderGenerationPreview = (generationId) =>
  api.post(`/ai/generations/${generationId}/render`);

export default api;
