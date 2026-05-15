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
  title?: string;
  description: string;
  productCategory?: string;
  style: string;
  enableStyleTransfer?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  secondaryImageUrl?: string;
  audience?: string;
  offer?: string;
  proof?: string;
  caption?: string;
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
    performance?: {
      totalElapsedMs?: number;
      targetElapsedMs?: number;
      phaseDurations?: {
        scriptMs?: number;
        voiceMs?: number;
        mediaMs?: number;
        renderMs?: number;
        uploadMs?: number;
      };
      concurrency?: {
        voiceGeneration?: number;
        mediaSelection?: number;
        sceneRendering?: number;
      };
    };
  };
}

export interface PhotoJob {
  _id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  stage: string;
  progress: number;
  message: string;
  error?: string;
  title?: string;
  description: string;
  productCategory?: string;
  style: string;
  source?: 'upload' | 'prompt';
  imagePath?: string;
  imageUrl?: string;
  imageUrls?: string[];
  caption?: string;
  audience?: string;
  offer?: string;
  proof?: string;
  createdAt: string;
  output?: {
    variants?: Array<{ url: string; localPath?: string }>;
    final?: { url: string; localPath?: string };
  };
}

export interface PhotoAdAsset {
  provider?: string;
  key?: string;
  url?: string;
}

export interface PhotoAd {
  _id: string;
  title: string;
  prompt: string;
  aspectRatio: string;
  productCategory?: string;
  style: string;
  source?: string;
  createdAt: string;
  images: PhotoAdAsset[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  credits: number;
  creditsUsed: number;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  priceLabel: string;
  description: string;
  badge?: string;
}

export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'spend' | 'refund' | 'adjustment';
  amount: number;
  balanceAfter: number;
  source: string;
  packageId?: string;
  referenceId?: string;
  description: string;
  createdAt: string;
}

export interface PasswordResetResponse {
  message: string;
  user?: AuthUser;
  token?: string;
}

type ApiError = Error & {
  status?: number;
};

const getAccessToken = () => localStorage.getItem('token') || '';

const authHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const createApiError = async (response: Response, fallbackMessage: string): Promise<ApiError> => {
  const payload = await response.json().catch(() => ({ message: fallbackMessage }));
  const error = new Error(payload.message || fallbackMessage) as ApiError;
  error.status = response.status;
  return error;
};

export const loginUser = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Login failed.');
  }

  const payload = await response.json();
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

  if (!response.ok) {
    throw await createApiError(response, 'Registration failed.');
  }

  const payload = await response.json();
  return payload as { token: string; user: AuthUser };
};

export const forgotPassword = async (email: string) => {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to send reset email.');
  }

  const payload = await response.json();
  return payload as { message: string };
};

export const resetPassword = async (token: string, password: string) => {
  const response = await fetch(`${API_BASE}/auth/reset-password/${token}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to reset password.');
  }

  const payload = await response.json();
  return payload as PasswordResetResponse;
};

export const fetchMe = async () => {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to load account details.');
  }

  const payload = await response.json();
  return payload.user as AuthUser;
};

export const fetchCreditPackages = async () => {
  const response = await fetch(`${API_BASE}/credits/packages`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to load credit packages.');
  }

  const payload = await response.json();
  return payload.data as CreditPackage[];
};

export const fetchCreditTransactions = async () => {
  const response = await fetch(`${API_BASE}/credits/transactions`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to load credit history.');
  }

  const payload = await response.json();
  return payload.data as CreditTransaction[];
};

export const createDemoCreditPurchase = async (packageId: string) => {
  const response = await fetch(`${API_BASE}/credits/demo-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ packageId }),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Demo credit purchase failed.');
  }

  const payload = await response.json();
  return payload as {
    package: CreditPackage;
    credits: number;
    creditsUsed: number;
    transaction: CreditTransaction;
  };
};

export const createJob = async (payload: {
  image?: File | null;
  secondaryImage?: File | null;
  images?: File[] | null;
  title?: string;
  description: string;
  productCategory: string;
  style: string;
  enableStyleTransfer?: boolean;
}) => {
  const formData = new FormData();
  const images = payload.images || [];
  const primaryImage = payload.image || images[0] || null;
  const secondaryImage = payload.secondaryImage || images[1] || null;

  if (primaryImage) {
    formData.append('image', primaryImage);
  }
  if (secondaryImage) {
    formData.append('secondaryImage', secondaryImage);
  }
  if (payload.title) {
    formData.append('title', payload.title);
  }
  formData.append('description', payload.description);
  formData.append('productCategory', payload.productCategory);
  formData.append('style', payload.style);
  formData.append('enableStyleTransfer', String(payload.enableStyleTransfer || false));

  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to create job.');
  }

  const payloadJson = await response.json();
  return payloadJson.data as VideoJob;
};

export const createPhotoJob = async (payload: {
  images?: File[] | null;
  title: string;
  description: string;
  productCategory: string;
  style: string;
}) => {
  const created = await createJob({
    images: payload.images,
    title: payload.title,
    description: payload.description,
    productCategory: payload.productCategory,
    style: payload.style,
  });

  return {
    ...created,
    title: payload.title,
    source: payload.images?.length ? 'upload' : 'prompt',
    output: created.output?.preview?.url
      ? {
          final: { url: created.output.preview.url },
          variants: [{ url: created.output.preview.url }]
        }
      : undefined
  } as PhotoJob;
};

export const fetchJobs = async () => {
  const response = await fetch(`${API_BASE}/jobs`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw await createApiError(response, 'Failed to fetch jobs.');
  }
  const payload = await response.json();
  const videoJobs = Array.isArray(payload.data) ? payload.data : payload.data?.videoJobs || [];
  const photoJobs = Array.isArray(payload.data?.photoJobs) ? payload.data.photoJobs : [];
  return {
    videoJobs: videoJobs as VideoJob[],
    photoJobs: photoJobs as PhotoJob[]
  };
};

export const fetchJob = async (jobId: string) => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw await createApiError(response, 'Failed to fetch job.');
  }
  const payload = await response.json();
  return payload.data as VideoJob;
};

export const createPhotoAd = async (payload: {
  title: string;
  prompt: string;
  aspectRatio: string;
  productCategory: string;
  style: string;
  source?: string;
  imageDataUrls: string[];
}) => {
  const response = await fetch(`${API_BASE}/photo-ads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to save photo ads.');
  }

  const payloadJson = await response.json();
  return payloadJson as { data: PhotoAd; credits?: number };
};

export const fetchPhotoAds = async () => {
  const response = await fetch(`${API_BASE}/photo-ads`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to fetch photo ads.');
  }

  const payload = await response.json();
  return payload.data as PhotoAd[];
};

export const fetchPhotoAd = async (photoAdId: string) => {
  const response = await fetch(`${API_BASE}/photo-ads/${photoAdId}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw await createApiError(response, 'Failed to fetch photo ad set.');
  }

  const payload = await response.json();
  return payload.data as PhotoAd;
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
    throw await createApiError(response, 'Failed to trim video.');
  }

  const payload = await response.json();
  return payload.data;
};

export const completePhotoJob = async (jobId: string, imageBlob: Blob) => {
  const imageDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read generated image.'));
    reader.readAsDataURL(imageBlob);
  });

  return createPhotoAd({
    title: 'Puter Generated Photo',
    prompt: 'Browser-generated Puter photo campaign.',
    aspectRatio: '1:1',
    productCategory: 'general-product',
    style: 'minimal',
    source: 'puter',
    imageDataUrls: [imageDataUrl],
  });
};

export const getJobEventsUrl = (jobId: string) => {
  const url = new URL(`${API_BASE}/jobs/${jobId}/events`);
  const token = getAccessToken();
  if (token) {
    url.searchParams.set('access_token', token);
  }

  return url.toString();
};
