import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Download,
  Eye,
  EyeOff,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  RefreshCcw,
  ShieldCheck,
  Scissors,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { createJob, fetchJobs, loginUser, registerUser, forgotPassword, trimJob, VideoJob } from './lib/api';
import { useJobEvents } from './hooks/useJobEvents';
import { useLanguage } from './context/LanguageContext';
import ResetPasswordPage from './pages/ResetPasswordPage';

const styles = [
  { value: 'energetic', label: 'Energetic', tone: 'Fast hook, bold cadence, punchy CTA' },
  { value: 'luxury', label: 'Luxury', tone: 'Premium tone, refined pacing, elegant product framing' },
  { value: 'minimal', label: 'Minimal', tone: 'Clean visuals, crisp copy, understated confidence' },
  { value: 'cinematic', label: 'Cinematic', tone: 'Atmospheric, emotive, brand-film energy' },
];

const categories = [
  { value: 'beauty-skincare', label: 'Beauty & Skincare' },
  { value: 'food-dessert', label: 'Food & Dessert' },
  { value: 'fashion-accessories', label: 'Fashion & Accessories' },
  { value: 'fitness-wellness', label: 'Fitness & Wellness' },
  { value: 'tech-gadgets', label: 'Tech & Gadgets' },
  { value: 'home-lifestyle', label: 'Home & Lifestyle' },
  { value: 'jewelry-luxury', label: 'Jewelry & Luxury' },
  { value: 'pet-products', label: 'Pet Products' },
];

const stageLabels: Record<string, string> = {
  'queued': 'Queued',
  'writing-script': 'Writing script...',
  'finding-media': 'Finding media...',
  'generating-voice': 'Generating voice...',
  'rendering-video': 'Rendering video...',
  'uploading-assets': 'Uploading assets...',
  'completed': 'Ready',
  'failed': 'Failed',
};

const formatSeconds = (value: number) => `${value.toFixed(1)}s`;
const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (payload: { email: string; token: string }) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState('');
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const { lang, toggleLanguage, t } = useLanguage();

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setIsDark(!isDark);
  };

  // Password strength
  const calcStrength = (p: string) => {
    let s = 0;
    if (!p) return s;
    if (p.length > 5) s++;
    if (p.length > 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  };
  const strength = calcStrength(password);
  const strengthColors = ['#ef4444', '#f59e0b', '#22c55e', '#22c55e'];
  const strengthLabels = lang === 'sq'
    ? ['Dobët', 'Mesatar', 'Mirë', 'Fortë']
    : ['Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const isForgot = mode === 'forgot-password';
    if (!email || (!isForgot && !password)) {
      setError(t('errorRequired'));
      return;
    }

    if (mode === 'forgot-password' && !/^\S+@\S+\.\S+$/.test(email)) {
      setError(t('errorEmail'));
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError(t('errorPassMatch'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      if (mode === 'forgot-password') {
        const payload = await forgotPassword(email);
        setSuccessMessage(payload.message || 'Reset link sent! Please check your inbox.');
      } else {
        const payload =
          mode === 'login'
            ? await loginUser(email, password)
            : await registerUser(email, password);

        localStorage.setItem('token', payload.token);
        localStorage.setItem('user_email', payload.user.email);
        onAuthenticated({ email: payload.user.email, token: payload.token });
      }
    } catch (nextError: any) {
      setError(nextError.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-scene">
      {/* Animated background orbs */}
      <div className="auth-orb auth-orb--1" />
      <div className="auth-orb auth-orb--2" />
      <div className="auth-orb auth-orb--3" />

      {/* Top-right controls: Language + Theme */}
      <div className="auth-controls-row">
        <button
          className="auth-theme-toggle"
          onClick={toggleLanguage}
          aria-label="Toggle language"
          title={lang === 'sq' ? 'Switch to English' : 'Kaloni në Shqip'}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.02em' }}>
            {lang === 'sq' ? 'EN' : 'AL'}
          </span>
        </button>
        <button
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Glass card */}
      <div className="auth-glass-card">
        <div className="auth-card-accent" />
        <div className="auth-card-body">

          {/* Brand */}
          <div className="auth-brand-row">
            <div className="auth-icon-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="auth-heading">{t('appName')}</h1>
              <p className="auth-subheading">
                {mode === 'forgot-password' ? t('forgotTitle') : (mode === 'login' ? t('loginGreeting') : t('registerGreeting'))}
              </p>
            </div>
          </div>
          
          {mode !== 'forgot-password' && (
            <p className="auth-subheading" style={{ marginBottom: '1.5rem', opacity: 0.8 }}>
              {mode === 'login' ? t('loginTitle') : t('registerTitle')}
            </p>
          )}

          {mode === 'forgot-password' && (
            <p className="auth-subheading" style={{ marginBottom: '1.5rem', opacity: 0.9 }}>
              {t('forgotSubtitle')}
            </p>
          )}

          {/* Mode tabs */}
          {mode !== 'forgot-password' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {(['login', 'register'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setMode(item); setError(''); setSuccessMessage(''); }}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0',
                    borderRadius: '10px',
                    border: mode === item ? '1.5px solid #6366f1' : '1.5px solid var(--border-subtle)',
                    background: mode === item ? 'rgba(99,102,241,0.12)' : 'transparent',
                    color: mode === item ? '#6366f1' : 'var(--text-muted)',
                    fontWeight: mode === item ? 700 : 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  {item === 'login' ? t('loginTab') : t('registerTab')}
                </button>
              ))}
            </div>
          )}

          <div className="auth-divider" />

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="auth-form">

            {/* Email */}
            <div className={`auth-field ${focused === 'email' ? 'auth-field--focused' : ''}`}>
              <label htmlFor="auth-email" className="auth-field-label">{t('emailLabel')}</label>
              <div className="auth-field-inner">
                <Mail size={16} className="auth-field-icon" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                  placeholder={t('emailPlaceholder')}
                  autoComplete="email"
                  className="auth-field-input"
                />
              </div>
            </div>

            {/* Password */}
            {mode !== 'forgot-password' && (
              <div className={`auth-field ${focused === 'password' ? 'auth-field--focused' : ''}`}>
                <div className="auth-field-label-row">
                  <label htmlFor="auth-password" className="auth-field-label">{t('passwordLabel')}</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => { setMode('forgot-password'); setError(''); setSuccessMessage(''); }}
                    >
                      {t('forgotPasswordLink')}
                    </button>
                  )}
                </div>
                <div className="auth-field-inner">
                  <Lock size={16} className="auth-field-icon" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused('')}
                    placeholder={t('passwordPlaceholder')}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="auth-field-input"
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Strength bar (register only) */}
                {mode === 'register' && password && (
                  <div className="auth-strength-wrap">
                    <div className="auth-strength-bars">
                      {[1, 2, 3, 4].map((lvl) => (
                        <div
                          key={lvl}
                          className="auth-strength-bar"
                          style={{
                            backgroundColor: lvl <= strength
                              ? strengthColors[strength - 1]
                              : 'var(--border-subtle)',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="auth-strength-label"
                      style={{ color: strength > 0 ? strengthColors[strength - 1] : 'var(--text-muted)' }}
                    >
                      {strength > 0 ? strengthLabels[strength - 1] : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div className={`auth-field ${focused === 'confirm' ? 'auth-field--focused' : ''}`}>
                <label htmlFor="auth-confirm" className="auth-field-label">{t('confirmPasswordLabel')}</label>
                <div className="auth-field-inner">
                  <Lock size={16} className="auth-field-icon" />
                  <input
                    id="auth-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused('')}
                    placeholder={t('passwordPlaceholder')}
                    autoComplete="new-password"
                    className="auth-field-input"
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="auth-error-bar">
                <span>{error}</span>
              </div>
            )}
            
            {successMessage && (
              <div className="auth-success-bar" style={{
                background: 'rgba(52, 211, 153, 0.1)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: '10px',
                padding: '0.65rem 0.875rem',
                fontSize: '0.8125rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="auth-submit-btn"
              id="auth-submit"
            >
              {loading ? (
                <span className="auth-spinner" />
              ) : (
                <>
                  <span>
                    {mode === 'forgot-password' ? t('forgotButton') : (mode === 'login' ? t('signInAction') : t('createAccountAction'))}
                  </span>
                  <ArrowRight size={18} className="auth-btn-arrow" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="auth-switch-text" style={{ marginTop: '1.5rem' }}>
            {mode === 'forgot-password' ? (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
                className="auth-switch-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '0.4rem' }}
              >
                <RefreshCcw size={14} />
                {t('backToLogin')}
              </button>
            ) : (
              <>
                {mode === 'login' ? `${t('noAccount')} ` : `${t('hasAccount')} `}
                <button
                  type="button"
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccessMessage(''); }}
                  className="auth-switch-link"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  {mode === 'login' ? t('createOne') : t('signInInstead')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(() => ({
    token: localStorage.getItem('token') || '',
    email: localStorage.getItem('user_email') || '',
  }));
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [productCategory, setProductCategory] = useState('food-dessert');
  const [style, setStyle] = useState('energetic');
  const [enableStyleTransfer, setEnableStyleTransfer] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimLoading, setTrimLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!auth.token) return;
    fetchJobs()
      .then((data) => {
        setJobs(data);
        if (data[0]?._id) {
          setSelectedJobId(data[0]._id);
        }
      })
      .catch(() => { });
  }, [auth.token]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    if (!selectedJob?.metadata?.durationSeconds) return;
    setTrimStart(selectedJob.output?.trim?.startSeconds || 0);
    setTrimEnd(selectedJob.output?.trim?.endSeconds || selectedJob.metadata.durationSeconds);
  }, [selectedJob]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useJobEvents(
    selectedJobId,
    (payload) => {
      setJobs((current) =>
        current.map((job) => (job._id === selectedJobId ? { ...job, ...payload } : job))
      );
    },
    Boolean(selectedJobId)
  );

  const handleFileChange = (nextFile: File | null) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    setIsPreviewOpen(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  };

  const onSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    handleFileChange(nextFile);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const clearSelectedFile = () => {
    handleFileChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Add a product description first.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const job = await createJob({
        image: file,
        description,
        productCategory,
        style,
        enableStyleTransfer,
      });

      setJobs((current) => [job, ...current]);
      setSelectedJobId(job._id);
      setDescription('');
      clearSelectedFile();
    } catch (nextError: any) {
      setError(nextError.message || 'Unable to create a video job.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrim = async () => {
    if (!selectedJobId || !selectedJob?.metadata?.durationSeconds) return;

    try {
      setTrimLoading(true);
      const result = await trimJob(selectedJobId, trimStart, trimEnd);
      setJobs((current) =>
        current.map((job) =>
          job._id === selectedJobId
            ? {
              ...job,
              output: {
                ...job.output,
                trim: result.trim,
              },
            }
            : job
        )
      );
    } catch (nextError: any) {
      setError(nextError.message || 'Unable to trim the video.');
    } finally {
      setTrimLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_email');
    setAuth({ token: '', email: '' });
    setJobs([]);
    setSelectedJobId(null);
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          !auth.token ? (
            <AuthScreen onAuthenticated={setAuth} />
          ) : (
            <div className="min-h-screen bg-mesh text-white">
              <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-4 py-8 lg:px-8">
                <header className="grid gap-8 rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-glow backdrop-blur xl:grid-cols-[1.2fr,0.8fr]">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-mist">
                      <Sparkles size={16} className="text-flare" />
                      AI Marketing Studio MVP
                    </div>
                    <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-slate-200">
                      <span>{auth.email}</span>
                      <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 text-slate-300 hover:text-white">
                        <LogOut size={14} />
                        Logout
                      </button>
                    </div>
                    <div className="space-y-4">
                      <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
                        Turn one product shot into a polished short-form ad.
                      </h1>
                      <p className="max-w-2xl text-base text-slate-200 md:text-lg">
                        Start with a product image or just a detailed brief, then generate a vertical video with
                        scene-based scriptwriting, Pexels b-roll, Deepgram voiceover, animated captions,
                        ducked music, and MP4 export.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[ 
                        '3-5 scene composition',
                        'Live generation progress',
                        'Trim and export workflow',
                      ].map((item) => (
                        <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6">
                    <div className="space-y-5">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-200">
                          <ShieldCheck size={14} />
                          Product-Safe Workflow
                        </div>
                        <h2 className="mt-4 text-2xl font-semibold">Build ads that stay loyal to the product.</h2>
                        <p className="mt-2 text-sm text-slate-300">
                          The latest pipeline prioritizes category-specific copy, tighter stock search intent,
                          Deepgram voiceover, and safer product-first fallbacks when stock clips are weak.
                        </p>
                      </div>

                      <div className="grid gap-3">
                        {[
                          'Upload one clean hero image instead of a collage or screenshot.',
                          'No image is fine too. The studio can generate from a strong product brief alone.',
                          'Describe the buyer, craving/problem, product texture, and the exact CTA.',
                          'For niche foods, accurate stills now beat wrong stock video.'
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                            <CheckCircle2 size={18} className="mt-0.5 text-flare" />
                            <p className="text-sm text-slate-200">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </header>

                <main className="grid gap-8 xl:grid-cols-[0.9fr,1.1fr]">
                  <section className="space-y-6 rounded-[28px] border border-white/10 bg-slate-950/50 p-6 backdrop-blur">
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold">Create a video job</h2>
                      <p className="text-sm text-slate-300">
                        This workflow is for marketing creatives only. Pick the product category so the AI writes ad copy and searches media with the right intent. A product image is optional.
                      </p>
                    </div>

                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={onDrop}
                      className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-100">Product image</div>
                          <p className="max-w-md text-sm text-slate-300">
                            Optional. Add one clean JPG or PNG, or skip it and let the studio generate from the brief only.
                          </p>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onSelectFile}
                        />

                        <button
                          type="button"
                          onClick={openFilePicker}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900"
                        >
                          <UploadCloud size={16} />
                          {file ? 'Replace image' : 'Choose image'}
                        </button>
                      </div>

                      {file ? (
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="rounded-2xl bg-white/10 p-3">
                              <FileImage size={20} className="text-flare" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-white">{file.name}</div>
                              <div className="mt-1 text-xs text-slate-400">{formatFileSize(file.size)}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {previewUrl ? (
                              <button
                                type="button"
                                onClick={() => setIsPreviewOpen(true)}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white"
                              >
                                <Eye size={14} />
                                Preview
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={openFilePicker}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white"
                            >
                              <RefreshCcw size={14} />
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={clearSelectedFile}
                              className="inline-flex items-center gap-2 rounded-full border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-red-100"
                            >
                              <Trash2 size={14} />
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 flex min-h-[132px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 px-5 text-center">
                          <div className="rounded-full bg-white/10 p-4">
                            <ImagePlus size={28} className="text-flare" />
                          </div>
                          <p className="mt-3 text-sm font-medium text-white">Drop the product image here, choose one, or skip it</p>
                          <p className="mt-2 max-w-sm text-xs text-slate-400">
                            Cleaner product shots lead to better overlays, but a strong product description alone can still generate a marketing video.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-200">Product category</label>
                      <select
                        value={productCategory}
                        onChange={(event) => setProductCategory(event.target.value)}
                        className="w-full rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white outline-none"
                      >
                        {categories.map((item) => (
                          <option key={item.value} value={item.value} className="bg-slate-900">
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-200">Product description</label>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={7}
                        className="w-full rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white outline-none ring-0 placeholder:text-slate-500"
                        placeholder="Describe the product, buyer, pain point, core promise, offer, and CTA. Example: A collagen peptide powder for busy women 30+ who want healthier hair and skin without another complicated routine. Strawberry flavor, 20 servings, subscribe-and-save offer."
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {styles.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setStyle(item.value)}
                          className={`rounded-3xl border px-4 py-4 text-left transition ${style === item.value
                              ? 'border-flare bg-flare/10'
                              : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                            }`}
                        >
                          <div className="text-base font-medium">{item.label}</div>
                          <div className="mt-1 text-sm text-slate-300">{item.tone}</div>
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Wand2 size={16} className="text-coral" />
                          Experimental AI image fallback
                        </div>
                        <p className="text-xs text-slate-300">
                          Recommended off for most product ads. Keep it disabled if literal product accuracy matters.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableStyleTransfer}
                        onChange={(event) => setEnableStyleTransfer(event.target.checked)}
                        className="h-5 w-5 rounded border-white/20 bg-transparent"
                      />
                    </label>

                    {error ? (
                      <div className="rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-red-100">
                        {error}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-flare disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <LoaderCircle className="animate-spin" size={16} /> : <Clapperboard size={16} />}
                      {submitting ? 'Generating job...' : 'Generate video'}
                    </button>
                  </section>

                  <section className="grid gap-8">
                    <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-6 backdrop-blur">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-semibold">Live progress</h2>
                          <p className="mt-1 text-sm text-slate-300">
                            Real-time queue updates for script, media, voice, render, and export.
                          </p>
                        </div>
                        {selectedJob ? (
                          <div className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300">
                            {stageLabels[selectedJob.stage] || selectedJob.stage}
                          </div>
                        ) : null}
                      </div>

                      {selectedJob ? (
                        <div className="mt-6 space-y-5">
                          <div className="h-3 overflow-hidden rounded-full bg-white/5">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-flare via-coral to-white"
                              animate={{ width: `${selectedJob.progress || 0}%` }}
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200">
                            <span>{selectedJob.message}</span>
                            <span>{selectedJob.progress || 0}%</span>
                          </div>
                          {selectedJob.error ? (
                            <div className="rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-red-100">
                              {selectedJob.error}
                            </div>
                          ) : null}
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Hook</div>
                              <div className="mt-2 text-sm text-white">
                                {selectedJob.script?.hook || 'Waiting for script generation...'}
                              </div>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">CTA</div>
                              <div className="mt-2 text-sm text-white">
                                {selectedJob.script?.cta || 'Call to action will appear here.'}
                              </div>
                            </div>
                          </div>
                          {selectedJob.script?.scenes?.length ? (
                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Scene plan</div>
                              <div className="mt-4 space-y-3">
                                {selectedJob.script.scenes.map((scene) => (
                                  <div key={scene.sceneNumber} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm font-medium text-white">
                                        Scene {scene.sceneNumber}: {scene.headline}
                                      </div>
                                      {scene.voiceDuration ? (
                                        <div className="text-xs text-slate-300">{formatSeconds(scene.voiceDuration)}</div>
                                      ) : null}
                                    </div>
                                    <div className="mt-2 text-xs text-slate-300">
                                      {(scene.media?.source || 'pending')} {scene.media?.kind ? `| ${scene.media.kind}` : ''}
                                    </div>
                                    {scene.media?.query ? (
                                      <div className="mt-1 text-xs text-slate-400">Query: {scene.media.query}</div>
                                    ) : null}
                                    {scene.media?.selectionReason ? (
                                      <div className="mt-2 text-xs text-slate-300">{scene.media.selectionReason}</div>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-6 rounded-3xl border border-dashed border-white/10 p-8 text-sm text-slate-300">
                          Your newest job will appear here once you generate a video.
                        </div>
                      )}
                    </div>

                    <div className="grid gap-8 xl:grid-cols-[1fr,0.8fr]">
                      <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-6 backdrop-blur">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl font-semibold">Preview studio</h2>
                            <p className="mt-1 text-sm text-slate-300">
                              Review the current render, trim the opening/ending, and export the final cut.
                            </p>
                          </div>
                        </div>

                        <AnimatePresence mode="wait">
                          {selectedJob?.output?.preview?.url ? (
                            <motion.div
                              key={selectedJob.output.preview.url}
                              initial={{ opacity: 0, y: 18 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -18 }}
                              className="mt-6 space-y-6"
                            >
                              <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-glow">
                                <video
                                  controls
                                  playsInline
                                  src={selectedJob.output.preview.url}
                                  className="aspect-[9/16] w-full bg-black object-contain"
                                />
                              </div>

                              {selectedJob.output?.sceneFiles?.length ? (
                                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                                  <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-medium text-slate-100">Scene previews</div>
                                      <p className="mt-1 text-xs text-slate-400">
                                        Review each rendered scene separately before judging the full cut.
                                      </p>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {selectedJob.output.sceneFiles.length} scenes
                                    </div>
                                  </div>
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {selectedJob.output.sceneFiles.map((sceneFile, index) =>
                                      sceneFile?.url ? (
                                        <div
                                          key={sceneFile.url}
                                          className="overflow-hidden rounded-3xl border border-white/10 bg-black/40"
                                        >
                                          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-slate-300">
                                            <span>Scene {index + 1}</span>
                                            <span>{selectedJob.script?.scenes?.[index]?.headline || 'Rendered scene'}</span>
                                          </div>
                                          <video
                                            controls
                                            playsInline
                                            preload="metadata"
                                            src={sceneFile.url}
                                            className="aspect-[9/16] w-full bg-black object-contain"
                                          />
                                        </div>
                                      ) : null
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-100">
                                  <Scissors size={16} className="text-flare" />
                                  Trim slider
                                </div>
                                <div className="grid gap-4">
                                  <label className="text-sm text-slate-300">
                                    Start: {formatSeconds(trimStart)}
                                    <input
                                      type="range"
                                      min={0}
                                      max={selectedJob.metadata?.durationSeconds || 0}
                                      step={0.1}
                                      value={trimStart}
                                      onChange={(event) => setTrimStart(Number(event.target.value))}
                                      className="mt-2 w-full"
                                    />
                                  </label>
                                  <label className="text-sm text-slate-300">
                                    End: {formatSeconds(trimEnd)}
                                    <input
                                      type="range"
                                      min={0}
                                      max={selectedJob.metadata?.durationSeconds || 0}
                                      step={0.1}
                                      value={trimEnd}
                                      onChange={(event) => setTrimEnd(Number(event.target.value))}
                                      className="mt-2 w-full"
                                    />
                                  </label>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={handleTrim}
                                    disabled={trimLoading || trimEnd <= trimStart}
                                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
                                  >
                                    {trimLoading ? 'Trimming...' : 'Create trimmed export'}
                                  </button>
                                  {selectedJob.output?.trim?.asset?.url ? (
                                    <a
                                      href={selectedJob.output.trim.asset.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white"
                                    >
                                      <Download size={14} />
                                      Download trimmed cut
                                    </a>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-3">
                                <a
                                  href={selectedJob.output.video?.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-full bg-flare px-4 py-2 text-sm font-medium text-slate-900"
                                >
                                  <Download size={14} />
                                  Download final MP4
                                </a>
                                {selectedJob.output.voiceover?.url ? (
                                  <a
                                    href={selectedJob.output.voiceover.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-white/10 px-4 py-2 text-sm text-white"
                                  >
                                    Download voiceover
                                  </a>
                                ) : null}
                              </div>
                            </motion.div>
                          ) : (
                            <div className="mt-6 rounded-3xl border border-dashed border-white/10 p-8 text-sm text-slate-300">
                              Rendered video preview will appear here once the worker finishes.
                            </div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="rounded-[28px] border border-white/10 bg-slate-950/50 p-6 backdrop-blur">
                        <h2 className="text-2xl font-semibold">Recent jobs</h2>
                        <div className="mt-6 space-y-3">
                          {jobs.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-slate-300">
                              No jobs yet.
                            </div>
                          ) : (
                            jobs.map((job) => (
                              <button
                                key={job._id}
                                type="button"
                                onClick={() => setSelectedJobId(job._id)}
                                className={`w-full rounded-3xl border px-4 py-4 text-left transition ${selectedJobId === job._id
                                    ? 'border-flare bg-flare/10'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-medium">{job.script?.title || job.style}</div>
                                    <div className="mt-1 text-xs text-slate-300">
                                      {job.productCategory || 'general-product'} | {job.description.slice(0, 80)}
                                    </div>
                                  </div>
                                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                    {job.progress || 0}%
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                </main>

                <AnimatePresence>
                  {isPreviewOpen && previewUrl ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8"
                      onClick={() => setIsPreviewOpen(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.96, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.96, opacity: 0 }}
                        className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-900 p-5 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-white">{file?.name || 'Selected image'}</div>
                            <div className="text-xs text-slate-400">Quick preview only. The studio keeps the upload compact in the form.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPreviewOpen(false)}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white"
                          >
                            Close
                          </button>
                        </div>

                        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black">
                          <img src={previewUrl} alt="Selected product preview" className="max-h-[70vh] w-full object-contain" />
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          )
        }
      />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
