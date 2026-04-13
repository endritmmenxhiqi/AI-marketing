import axios from 'axios';

// ─── Axios Instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
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

/** Send a message to the AI assistant (Supports FormData for images) */
export const aiChat = (data) => {
  const isFormData = data instanceof FormData;
  return api.post('/ai/chat', data, {
    headers: {
      'Content-Type': isFormData ? 'multipart/form-data' : 'application/json',
    },
  });
};

/** Generate TTS audio from text using Deepgram */
export const aiTTS = async (text, model = 'aura-asteria-en') => {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:5000/api/ai/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, model }),
  });

  if (!response.ok) throw new Error('TTS request failed');

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/** Request an automatic image fix (crop + text overlay + dynamic background) */
export const aiAutoFix = (imagePath, title, background) =>
  api.post('/ai/auto-fix', { imagePath, title, background });

export default api;
