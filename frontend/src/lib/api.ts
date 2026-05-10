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

export interface ContentPackage {
  socialCaption?: string;
  hashtagSuggestions?: string[];
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
  outputMode?: 'video' | 'image';
  imageUrl?: string;
  createdAt: string;
  script?: {
    title?: string;
    hook?: string;
    cta?: string;
    hashtags?: string[];
    contentPackage?: ContentPackage;
    scenes?: JobScene[];
  };
  output?: {
    video?: { url?: string };
    preview?: { url?: string };
    image?: { url?: string };
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  credits?: number;
  totalGenerations?: number;
  subscriptionStatus?: string;
}

export interface CreditState {
  role: 'user' | 'premium';
  subscriptionStatus: 'free' | 'active' | 'cancelled';
  credits: number;
  totalGenerations: number;
}

export interface BillingConfig {
  free: {
    starterCredits: number;
  };
  premium: {
    priority: boolean;
    priceId?: string;
  };
  creditPacks: Array<{
    credits: number;
    priceId?: string;
    unitAmountCents?: number;
  }>;
}

type ApiError = Error & { status?: number };

const buildError = async (response: Response, fallbackMessage: string) => {
  const payload = await response.json().catch(() => ({ message: fallbackMessage }));
  const error = new Error(payload.message || fallbackMessage) as ApiError;
  error.status = response.status;
  return error;
};

const apiFetch = async (input: string, init: RequestInit = {}) =>
  fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.headers || {}),
    },
  });

export const loginUser = async (email: string, password: string) => {
  const response = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await buildError(response, 'Login failed.');
  }

  return (await response.json()) as { token: string; user: AuthUser };
};

export const registerUser = async (email: string, password: string) => {
  const response = await apiFetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await buildError(response, 'Registration failed.');
  }

  return (await response.json()) as { token: string; user: AuthUser };
};

export const fetchCurrentUser = async () => {
  const response = await apiFetch(`${API_BASE}/auth/me`);
  if (!response.ok) {
    throw await buildError(response, 'Failed to restore session.');
  }

  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
};

export const logoutUser = async () => {
  const response = await apiFetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw await buildError(response, 'Failed to log out.');
  }

  return response.json();
};

export const forgotPassword = async (email: string) => {
  const response = await apiFetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw await buildError(response, 'Failed to send reset email.');
  }

  return (await response.json()) as { message: string };
};

export const resetPassword = async (token: string, password: string) => {
  const response = await apiFetch(`${API_BASE}/auth/reset-password/${token}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    throw await buildError(response, 'Failed to reset password.');
  }

  return (await response.json()) as { message: string; user?: AuthUser; token?: string };
};

export const createJob = async (payload: {
  image?: File | null;
  description: string;
  productCategory: string;
  style: string;
  enableStyleTransfer: boolean;
  outputMode: 'video' | 'image';
}) => {
  const formData = new FormData();
  if (payload.image) {
    formData.append('image', payload.image);
  }
  formData.append('description', payload.description);
  formData.append('productCategory', payload.productCategory);
  formData.append('style', payload.style);
  formData.append('enableStyleTransfer', String(payload.enableStyleTransfer));
  formData.append('outputMode', payload.outputMode);

  const response = await apiFetch(`${API_BASE}/jobs`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw await buildError(response, 'Failed to create job.');
  }

  const payloadJson = await response.json();
  return payloadJson.data as VideoJob;
};

export const fetchJobs = async () => {
  const response = await apiFetch(`${API_BASE}/jobs`);
  if (!response.ok) {
    throw await buildError(response, 'Failed to fetch jobs.');
  }
  const payload = await response.json();
  return payload.data as VideoJob[];
};

export const fetchJob = async (jobId: string) => {
  const response = await apiFetch(`${API_BASE}/jobs/${jobId}`);
  if (!response.ok) {
    throw await buildError(response, 'Failed to fetch job.');
  }
  const payload = await response.json();
  return payload.data as VideoJob;
};

export const trimJob = async (jobId: string, startSeconds: number, endSeconds: number) => {
  const response = await apiFetch(`${API_BASE}/jobs/${jobId}/trim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ startSeconds, endSeconds }),
  });

  if (!response.ok) {
    throw await buildError(response, 'Failed to trim video.');
  }

  const payload = await response.json();
  return payload.data;
};

export const deleteJob = async (jobId: string) => {
  const response = await apiFetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await buildError(response, 'Failed to delete job.');
  }

  return true;
};

export const getJobEventsUrl = (jobId: string) => `${API_BASE}/jobs/${jobId}/events`;

export const fetchCredits = async () => {
  const response = await apiFetch(`${API_BASE}/user/credits`);
  if (!response.ok) {
    throw await buildError(response, 'Failed to fetch credits.');
  }

  const payload = await response.json();
  return payload as { data: CreditState; billing: BillingConfig };
};

export const createCheckoutSession = async (payload: {
  mode: 'credits' | 'subscription';
  pack?: number;
}) => {
  const response = await apiFetch(`${API_BASE}/payments/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildError(response, 'Failed to start checkout.');
  }

  const body = await response.json();
  return body.data as { id: string; url: string };
};
