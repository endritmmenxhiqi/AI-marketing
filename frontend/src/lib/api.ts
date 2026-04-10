export interface JobScene {
  sceneNumber: number;
  headline: string;
  voiceover: string;
  onScreenText: string[];
  pexelsKeywords: string[];
  visualBrief: string;
  imagePrompt: string;
  voiceDuration?: number;
  media?: {
    kind?: string;
    source?: string;
    query?: string;
    duration?: number;
    selectionReason?: string;
  };
}

export interface VideoJob {
  _id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stage: string;
  progress: number;
  message: string;
  error?: string;
  description: string;
  productCategory?: string;
  style: string;
  enableStyleTransfer: boolean;
  imageUrl?: string;
  createdAt: string;
  script?: {
    title?: string;
    hook?: string;
    cta?: string;
    hashtags?: string[];
    scenes?: JobScene[];
  };
  output?: {
    video?: { url?: string };
    preview?: { url?: string };
    voiceover?: { url?: string };
    sceneFiles?: Array<{ url?: string }>;
    trim?: {
      startSeconds: number;
      endSeconds: number;
      asset?: { url?: string };
    };
  };
  metadata?: {
    durationSeconds?: number;
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const loginUser = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({ message: 'Login failed.' }));
  if (!response.ok) {
    throw new Error(payload.message || 'Login failed.');
  }

  return payload as { token: string; user: AuthUser };
};

export const registerUser = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => ({ message: 'Registration failed.' }));
  if (!response.ok) {
    throw new Error(payload.message || 'Registration failed.');
  }

  return payload as { token: string; user: AuthUser };
};

export const createJob = async (payload: {
  image?: File | null;
  description: string;
  productCategory: string;
  style: string;
  enableStyleTransfer: boolean;
}) => {
  const formData = new FormData();
  if (payload.image) {
    formData.append('image', payload.image);
  }
  formData.append('description', payload.description);
  formData.append('productCategory', payload.productCategory);
  formData.append('style', payload.style);
  formData.append('enableStyleTransfer', String(payload.enableStyleTransfer));

  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create job.' }));
    throw new Error(error.message || 'Failed to create job.');
  }

  const payloadJson = await response.json();
  return payloadJson.data as VideoJob;
};

export const fetchJobs = async () => {
  const response = await fetch(`${API_BASE}/jobs`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch jobs.');
  }
  const payload = await response.json();
  return payload.data as VideoJob[];
};

export const fetchJob = async (jobId: string) => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('Failed to fetch job.');
  }
  const payload = await response.json();
  return payload.data as VideoJob;
};

export const trimJob = async (jobId: string, startSeconds: number, endSeconds: number) => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/trim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ startSeconds, endSeconds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to trim video.' }));
    throw new Error(error.message || 'Failed to trim video.');
  }

  const payload = await response.json();
  return payload.data;
};

export const getJobEventsUrl = (jobId: string) => `${API_BASE}/jobs/${jobId}/events`;
