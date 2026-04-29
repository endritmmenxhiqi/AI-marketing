import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileImage,
  ImagePlus,
  Layout,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Moon,
  Palette,
  PenTool,
  RefreshCcw,
  Scissors,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  createJob,
  fetchCurrentUser,
  fetchJobs,
  forgotPassword,
  loginUser,
  logoutUser,
  registerUser,
  trimJob,
  VideoJob,
} from './lib/api';
import { useJobEvents } from './hooks/useJobEvents';
import { useLanguage } from './context/LanguageContext';
import { useTheme } from './context/ThemeContext';
import BrandLogo from './components/common/BrandLogo';
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
  { value: 'sports-football', label: 'Sports / Football' },
  { value: 'tech-gadgets', label: 'Tech & Gadgets' },
  { value: 'home-lifestyle', label: 'Home & Lifestyle' },
  { value: 'jewelry-luxury', label: 'Jewelry & Luxury' },
  { value: 'pet-products', label: 'Pet Products' },
];

const quickBriefs = [
  {
    id: 'beauty',
    label: 'Beauty launch',
    category: 'beauty-skincare',
    style: 'luxury',
    description:
      'A brightening serum for women 28+ who want smoother, more even skin without a long routine. Show texture, glow, before-and-after feeling, and end with a subscribe-and-save CTA.',
  },
  {
    id: 'dessert',
    label: 'Food craving',
    category: 'food-dessert',
    style: 'energetic',
    description:
      'A pistachio dessert box for people who want cafe-quality treats at home. Focus on texture, close-up indulgence, giftability, and a limited weekly drop.',
  },
  {
    id: 'tech',
    label: 'Tech utility',
    category: 'tech-gadgets',
    style: 'minimal',
    description:
      'A pocket-size wireless charger for remote workers who need clean desk setups and reliable battery backup while traveling. Emphasize convenience, portability, and daily use.',
  },
  {
    id: 'football',
    label: 'Match hype',
    category: 'sports-football',
    style: 'cinematic',
    description:
      'A cinematic, high-intensity short-form video for a major soccer match. Show stadium lights, fans chanting, kickoff, fast dribbles, tackles, goal celebrations, and a bold final CTA to watch the highlights.',
  },
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

const buildContentPackageExport = (job: VideoJob) => {
  const contentPackage = job.script?.contentPackage;
  const hashtags = contentPackage?.hashtagSuggestions?.length
    ? contentPackage.hashtagSuggestions
    : job.script?.hashtags || [];

  return [
    `Campaign: ${job.script?.title || job.style || 'Marketing content package'}`,
    `Product: ${job.description || 'N/A'}`,
    '',
    'Social Caption',
    contentPackage?.socialCaption || 'N/A',
    '',
    'Hashtag Suggestions',
    hashtags.length ? hashtags.map((tag) => `#${String(tag).replace(/^#/, '')}`).join(' ') : 'N/A',
    '',
    'Call to Action',
    job.script?.cta || 'N/A',
  ].join('\n');
};

const passwordPolicyMessage =
  'Password must be at least 10 characters and include uppercase, lowercase, number, and special character.';

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (payload: { email: string }) => void;
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
  const { lang, toggleLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // Password strength
  const calcStrength = (p: string) => {
    let s = 0;
    if (!p) return s;
    if (p.length >= 10) s++;
    if (/[a-z]/.test(p)) s++;
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

    if (
      mode === 'register' &&
      !(
        password.length >= 10 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password) &&
        /[^a-zA-Z0-9]/.test(password)
      )
    ) {
      setError(passwordPolicyMessage);
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

        onAuthenticated({ email: payload.user.email });
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
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Glass card */}
      <div className="auth-glass-card">
        <div className="auth-card-accent" />
        <div className="auth-card-body">

          {/* Brand */}
          <div className="auth-brand-row">
            <div className="auth-icon-badge overflow-hidden p-0 border-none bg-transparent">
              <BrandLogo className="w-12 h-12 object-contain" />
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
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();
  const [auth, setAuth] = useState({
    email: '',
    isAuthenticated: false,
  });
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
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [error, setError] = useState('');
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [trimLoading, setTrimLoading] = useState(false);
  const [previewDurationSeconds, setPreviewDurationSeconds] = useState(0);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'overview' | 'preview' | 'history'>('overview');
  const [contentPackageNotice, setContentPackageNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser()
      .then((user) => {
        if (!cancelled) {
          setAuth({ email: user.email, isAuthenticated: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuth({ email: '', isAuthenticated: false });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSessionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    fetchJobs()
      .then((data) => {
        setJobs(data);
        if (data[0]?._id) {
          setSelectedJobId(data[0]._id);
        }
      })
      .catch((nextError: any) => {
        if (nextError?.status === 401) {
          setAuth({ email: '', isAuthenticated: false });
          setJobs([]);
          setSelectedJobId(null);
        }
      });
  }, [auth.isAuthenticated]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job._id === selectedJobId) || null,
    [jobs, selectedJobId]
  );
  const contentPackage = selectedJob?.script?.contentPackage;
  const contentPackageHashtags = contentPackage?.hashtagSuggestions?.length
    ? contentPackage.hashtagSuggestions
    : selectedJob?.script?.hashtags || [];
  const firstName = auth.email.split('@')[0] || 'creator';
  const categoryLabel =
    categories.find((item) => item.value === productCategory)?.label || 'General product';
  const jobsReady = jobs.filter((job) => job.status === 'completed').length;
  const previewReady = Boolean(selectedJob?.output?.preview?.url);
  const workspaceTabs = [
    { id: 'overview' as const, label: 'Campaign' },
    { id: 'preview' as const, label: 'Preview' },
    { id: 'history' as const, label: `History${jobs.length > 0 ? ` (${jobs.length})` : ''}` },
  ];
  const jobsProcessing = jobs.filter((job) => job.status === 'processing').length;
  const dashboardStats = [
    {
      label: 'Jobs created',
      value: jobs.length,
    },
    {
      label: 'Ready exports',
      value: jobsReady,
    },
    {
      label: jobsProcessing > 0 ? 'In production' : 'Current style',
      value: jobsProcessing > 0 ? jobsProcessing : (styles.find((item) => item.value === style)?.label || style),
    },
  ];

  useEffect(() => {
    if (!selectedJob) return;
    setTrimStart(Number(selectedJob.output?.trim?.startSeconds ?? 0) || 0);
    const persistedEnd = Number(selectedJob.output?.trim?.endSeconds ?? 0) || 0;
    const duration = Number(selectedJob.metadata?.durationSeconds ?? 0) || 0;
    setTrimEnd(persistedEnd > 0 ? persistedEnd : duration);
  }, [selectedJobId, selectedJob?.metadata?.durationSeconds]);

  useEffect(() => {
    if (!previewDurationSeconds) return;
    setTrimEnd((current) => (current > 0 ? current : previewDurationSeconds));
  }, [previewDurationSeconds]);

  useEffect(() => {
    setPreviewDurationSeconds(0);
  }, [selectedJobId]);

  useEffect(() => {
    setContentPackageNotice('');
  }, [selectedJobId]);

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
      setActiveWorkspaceTab('overview');
      setDescription('');
      clearSelectedFile();
    } catch (nextError: any) {
      setError(nextError.message || 'Unable to create a video job.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrim = async () => {
    if (!selectedJobId) return;

    try {
      setTrimLoading(true);
      setError('');
      const maxSeconds = Number(selectedJob?.metadata?.durationSeconds ?? previewDurationSeconds ?? 0) || 0;
      if (!maxSeconds || !Number.isFinite(maxSeconds) || maxSeconds <= 0) {
        throw new Error('Video duration not loaded yet. Start playback once, then try trimming again.');
      }

      const safeStart = Math.max(0, Math.min(Number(trimStart) || 0, maxSeconds));
      const safeEnd = Math.max(0, Math.min(Number(trimEnd) || maxSeconds, maxSeconds));
      if (safeEnd <= safeStart + 0.05) {
        throw new Error('Out-point must be after in-point.');
      }

      setTrimStart(safeStart);
      setTrimEnd(safeEnd);
      const result = await trimJob(selectedJobId, safeStart, safeEnd);
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

  const handleDownloadContentPackage = () => {
    if (!selectedJob) return;

    const exportText = buildContentPackageExport(selectedJob);
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${selectedJob.script?.title || 'content-package'}.txt`.replace(/[^a-z0-9._-]+/gi, '-');
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    setContentPackageNotice('Content package downloaded.');
  };

  const handleCopyContentPackage = async () => {
    if (!selectedJob) return;

    try {
      const exportText = buildContentPackageExport(selectedJob);
      await navigator.clipboard.writeText(exportText);
      setContentPackageNotice('Content package copied to clipboard.');
    } catch {
      setContentPackageNotice('Clipboard copy failed. Use Export TXT instead.');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (_error) {
      // Clear local app state even if the cookie has already expired server-side.
    } finally {
      setAuth({ email: '', isAuthenticated: false });
      setJobs([]);
      setSelectedJobId(null);
    }
  };

  const applyQuickBrief = (preset: (typeof quickBriefs)[number]) => {
    setDescription(preset.description);
    setProductCategory(preset.category);
    setStyle(preset.style);
    setError('');
  };

  const handleRegenerate = (job: typeof jobs[number]) => {
    setDescription(job.description || '');
    setProductCategory(job.productCategory || 'food-dessert');
    setStyle(job.style || 'energetic');
    setActiveWorkspaceTab('overview');
    setError('');
    // Scroll to top of creation section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const shellCard =
    'rounded-[28px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/55 dark:shadow-glow';
  const shellMutedCard =
    'rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.04]';
  const getStatusBadgeClass = (status?: string) => {
    if (status === 'completed') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200';
    }

    if (status === 'failed') {
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200';
    }

    return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-200';
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            isSessionLoading ? null : !auth.isAuthenticated ? (
              <AuthScreen onAuthenticated={({ email }) => setAuth({ email, isAuthenticated: true })} />
            ) : (
              <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_85%_15%,rgba(236,72,153,0.10),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#eef4ff_42%,#f8fbff_100%)] text-slate-900 transition-colors dark:bg-mesh dark:text-white">
                <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-6 lg:px-8">
                  <header className="grid gap-6 xl:grid-cols-[1fr,400px]">
                    <div className={`${shellCard} relative overflow-hidden bg-gradient-to-br from-white/95 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-950/90`}>
                      <div className="relative space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                           <div className="flex items-center gap-3">
                              <div className="p-1 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-sm">
                                <BrandLogo className="w-11 h-11 object-contain" />
                              </div>
                              <div>
                                <h1 className="text-3xl font-bold tracking-tight md:text-4xl text-slate-900 dark:text-white">
                                  AI Marketing Studio
                                </h1>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                  Create high-conversion short-form ads in seconds.
                                </p>
                              </div>
                           </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              className="auth-theme-toggle"
                              onClick={toggleLanguage}
                              aria-label="Toggle language"
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
                              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          {dashboardStats.map((item) => (
                            <div key={item.label} className={`${shellMutedCard} group transition-all hover:bg-white/95 dark:hover:bg-white/10`}>
                              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 dark:text-slate-500">
                                {item.label}
                              </div>
                              <div className="mt-2 text-3xl font-bold tracking-tight">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={`${shellCard} flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950 text-white dark:from-indigo-600/20 dark:to-purple-600/20 dark:text-white`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">Account info</div>
                          <h2 className="mt-1 text-2xl font-black capitalize tracking-tight text-white">{firstName}</h2>
                          <p className="text-sm font-medium opacity-60 text-slate-300 dark:text-slate-400">{auth.email}</p>
                        </div>
                        <button type="button" onClick={handleLogout} className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 transition-all hover:bg-red-500 hover:text-white dark:bg-rose-500/15 dark:text-rose-400">
                          <LogOut size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4">
                         <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/10 dark:border-white/5">
                            <span className="text-[10px] uppercase font-bold opacity-50 text-slate-400">Active style</span>
                            <span className="text-sm font-semibold text-white">{styles.find(s => s.value === style)?.label || style}</span>
                         </div>
                         <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/10 dark:bg-white/5 border border-white/10 dark:border-white/5">
                            <span className="text-[10px] uppercase font-bold opacity-50 text-slate-400">Active category</span>
                            <span className="text-sm font-semibold truncate text-white">{categories.find(c => c.value === productCategory)?.label || productCategory}</span>
                         </div>
                      </div>
                    </div>
                  </header>

                  <main className="grid gap-8 xl:grid-cols-[1fr,1.15fr]">
                    <section className={`${shellCard} flex flex-col gap-8`}>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">New Campaign</h2>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Select a template or start from scratch</p>
                        </div>
                        <div className="flex -space-x-2">
                           {[1,2,3].map(i => (
                             <div key={i} className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 dark:border-slate-900 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-400">
                               {i}
                             </div>
                           ))}
                        </div>
                      </div>

                      {error && (
                        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                          <span className="mt-0.5 shrink-0 text-rose-500">⚠</span>
                          <div className="flex-1">
                            <div className="font-bold">Campaign Error</div>
                            <div className="opacity-80">{error}</div>
                          </div>
                          <button onClick={() => setError('')} className="shrink-0 opacity-50 hover:opacity-100 text-lg leading-none">×</button>
                        </div>
                      )}

                      <div className="grid gap-3 sm:grid-cols-3">
                        {quickBriefs.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyQuickBrief(preset)}
                            className="group relative flex flex-col items-start gap-1.5 p-4 rounded-2xl border border-slate-200 bg-white/40 text-left transition-all hover:border-indigo-500/50 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-flare/40"
                          >
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{preset.label}</div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{preset.category.split('-').join(' ')}</div>
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                               <Zap size={10} className="text-indigo-500 dark:text-flare" />
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-8">
                        <div className="group relative">
                          <div
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={onDrop}
                            className="flex flex-col items-center justify-center gap-4 p-10 rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 backdrop-blur-sm transition-all hover:border-indigo-500/40 hover:bg-white dark:border-white/5 dark:bg-white/[0.01] dark:hover:border-flare/30 dark:hover:bg-white/[0.03]"
                          >
                            {file ? (
                              <div className="flex w-full items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-center gap-4">
                                  <div className="p-4 rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 dark:bg-flare dark:text-slate-900 dark:shadow-flare/10">
                                    <FileImage size={24} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{file.name}</div>
                                    <div className="text-[10px] font-black opacity-40 uppercase tracking-tighter">{formatFileSize(file.size)}</div>
                                  </div>
                                </div>
                                <button type="button" onClick={clearSelectedFile} className="p-3 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="p-5 rounded-3xl bg-white text-slate-300 shadow-sm dark:bg-white/5 dark:text-slate-600">
                                  <ImagePlus size={36} />
                                </div>
                                <div className="text-center space-y-1">
                                  <div className="text-base font-bold text-slate-900 dark:text-white">Product Asset</div>
                                  <p className="text-xs font-medium text-slate-400">Drag & drop or Click to upload</p>
                                </div>
                                <button type="button" onClick={openFilePicker} className="mt-2 px-6 py-2.5 rounded-full bg-slate-900 text-white text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-700 hover:scale-105 active:scale-95 dark:bg-white dark:text-slate-900">
                                  Select File
                                </button>
                              </>
                            )}
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onSelectFile} />
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                               <Target size={12} />
                               Product Category
                            </label>
                            <select
                              value={productCategory}
                              onChange={(event) => setProductCategory(event.target.value)}
                              className="w-full rounded-2xl border border-slate-200 bg-white/50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500/50 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-100 dark:focus:border-flare/40"
                            >
                              {categories.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                  className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                                >
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-3">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                               <Palette size={12} />
                               Visual Style
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              {styles.map((item) => (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => setStyle(item.value)}
                                  className={`rounded-xl border p-3 text-center transition-all ${
                                    style === item.value
                                      ? 'border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 dark:border-flare dark:bg-flare dark:text-slate-900 dark:shadow-flare/10'
                                      : 'border-slate-200 bg-white/50 text-slate-600 font-bold dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400'
                                  }`}
                                >
                                  <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
                             <div className="flex items-center gap-2">
                                <PenTool size={12} />
                                Proprietary Brief
                             </div>
                             <span className={`${description.length > 700 ? 'text-amber-500' : 'opacity-40'}`}>{description.length}/800</span>
                          </label>
                          <textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={6}
                            maxLength={800}
                            className="w-full rounded-[28px] border border-slate-200 bg-white/50 px-6 py-5 text-sm font-medium leading-relaxed outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500/50 focus:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:focus:border-flare/40 dark:placeholder:text-slate-600"
                            placeholder="Describe the product, target audience, and the problem you solve..."
                          />
                        </div>

                        <div className="pt-2">
                          <button type="button" onClick={handleSubmit} disabled={submitting} className="group relative w-full overflow-hidden rounded-[24px] bg-slate-900 py-6 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                             <div className="relative z-10 flex items-center justify-center gap-3">
                                {submitting ? <LoaderCircle className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                <span>{submitting ? 'Creating Studio Magic...' : 'Generate Campaign'}</span>
                             </div>
                             <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 dark:from-flare dark:to-coral" />
                          </button>
                        </div>
                      </div>
                    </section>

                    {/* RIGHT COLUMN: Studio Workspace */}
                    <section className={`${shellCard} flex flex-col gap-8 bg-white/60 dark:bg-slate-950/40 backdrop-blur-2xl border-l border-slate-200 dark:border-white/5`}>
                      <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-6 dark:border-white/5">
                          <div className="space-y-1.5">
                             <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                               Studio Workspace
                             </h2>
                             <div className="flex items-center gap-2">
                                {selectedJob ? (
                                  <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusBadgeClass(selectedJob.status)}`}>
                                    {selectedJob.status}
                                  </div>
                                ) : null}
                                <span className="text-xs font-bold text-slate-400 truncate max-w-[200px]">
                                  {selectedJob?.script?.title || 'No active workspace'}
                                </span>
                             </div>
                          </div>
                          <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400">
                             <Layout size={20} />
                          </div>
                        </div>

                        <div className="flex gap-1.5 p-1.5 rounded-2xl bg-slate-100/50 dark:bg-white/5">
                          {workspaceTabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveWorkspaceTab(tab.id)}
                              className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeWorkspaceTab === tab.id
                                  ? 'bg-white shadow-xl shadow-slate-200/50 text-slate-900 dark:bg-white/10 dark:shadow-none dark:text-white'
                                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar">
                        <AnimatePresence mode="wait">
                          {activeWorkspaceTab === 'overview' && (
                            <motion.div
                              key="overview"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-8 pb-4"
                            >
                              {selectedJob ? (
                                <>
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="p-6 rounded-[32px] bg-indigo-500/[0.03] border border-indigo-500/10 dark:bg-flare/[0.03] dark:border-flare/10">
                                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:text-flare opacity-60">
                                        <Activity size={14} />
                                        Production Stage
                                      </div>
                                      <div className="mt-4 text-2xl font-black text-slate-900 dark:text-white leading-none">
                                        {stageLabels[selectedJob.stage] || selectedJob.stage}
                                      </div>
                                    </div>
                                    
                                    <div className="p-6 rounded-[32px] bg-emerald-500/[0.03] border border-emerald-500/10 dark:bg-emerald-500/[0.06]">
                                      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-500 opacity-60">
                                        <Zap size={14} />
                                        Live Progress
                                      </div>
                                      <div className="mt-2 flex items-end gap-2">
                                        <div className="text-3xl font-black text-slate-900 dark:text-white leading-none">{selectedJob.progress}%</div>
                                      </div>
                                      <div className="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
                                        <motion.div 
                                          className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]" 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${selectedJob.progress}%` }}
                                          transition={{ duration: 1, ease: "easeOut" }}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="p-8 rounded-[40px] bg-white border border-slate-200 shadow-sm dark:bg-white/[0.02] dark:border-white/5 space-y-6">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-5 dark:border-white/5">
                                       <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Content Blueprint</div>
                                       <div className="h-2 w-2 rounded-full bg-indigo-500 dark:bg-flare animate-pulse" />
                                    </div>
                                    
                                    <div className="space-y-6">
                                      <div>
                                        <span className="inline-block px-3 py-1 rounded-lg bg-slate-50 dark:bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                          Campaign Title
                                        </span>
                                        <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                          {selectedJob.script?.title || 'Drafting...'}
                                        </h3>
                                      </div>

                                      <div className="grid gap-6">
                                        <div className="space-y-2">
                                           <span className="text-[10px] font-black uppercase tracking-widest opacity-20">The Hook</span>
                                           <p className="text-base font-bold leading-relaxed italic text-slate-700 dark:text-slate-300">
                                              "{selectedJob.script?.hook}"
                                           </p>
                                        </div>
                                        <div className="h-px bg-slate-50 dark:bg-white/5" />
                                        <div className="space-y-2">
                                           <span className="text-[10px] font-black uppercase tracking-widest opacity-20">Call to Action</span>
                                           <p className="text-lg font-black text-indigo-600 dark:text-flare tracking-tight">
                                              {selectedJob.script?.cta}
                                           </p>
                                        </div>
                                      </div>

                                      <div className="rounded-[28px] border border-slate-100 bg-slate-50/70 p-5 dark:border-white/5 dark:bg-white/[0.03]">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                              Content Package
                                            </div>
                                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                              Ready for captions, thumbnails, and ad variations.
                                            </p>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              onClick={() => void handleCopyContentPackage()}
                                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-flare/30 dark:hover:text-flare"
                                            >
                                              <Copy size={14} />
                                              Copy
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleDownloadContentPackage}
                                              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500 dark:bg-flare dark:text-slate-900"
                                            >
                                              <Download size={14} />
                                              Export TXT
                                            </button>
                                          </div>
                                        </div>

                                        {contentPackageNotice && (
                                          <div className="mt-3 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                            {contentPackageNotice}
                                          </div>
                                        )}

                                        <div className="mt-4 grid gap-4">
                                          <div className="space-y-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Social Caption</span>
                                            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                              {contentPackage?.socialCaption || 'Generating after the video finishes.'}
                                            </p>
                                          </div>

                                          <div className="space-y-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hashtag Suggestions</span>
                                            <div className="flex flex-wrap gap-2">
                                              {contentPackageHashtags.length ? (
                                                contentPackageHashtags.map((tag) => (
                                                  <span
                                                    key={tag}
                                                    className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm dark:bg-white/5 dark:text-slate-300"
                                                  >
                                                    #{String(tag).replace(/^#/, '')}
                                                  </span>
                                                ))
                                              ) : (
                                                <span className="text-sm text-slate-500 dark:text-slate-400">Generating hashtag suggestions.</span>
                                              )}
                                            </div>
                                          </div>

                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                  <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse dark:bg-flare/10" />
                                    <div className="relative p-8 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-200 dark:text-white/5">
                                      <Sparkles size={48} />
                                    </div>
                                  </div>
                                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">System Ready</h3>
                                  <p className="mt-3 text-sm font-bold text-slate-400 max-w-[280px] leading-relaxed">
                                    Launch your first campaign briefly to activate the high-fidelity studio dashboard.
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {activeWorkspaceTab === 'preview' && (
                            <motion.div
                              key="preview"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-8 pb-4"
                            >
                              {selectedJob?.output?.preview?.url ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                                   <div className="relative group mx-auto w-full max-w-[360px]">
                                      <div className="absolute -inset-6 bg-indigo-500/10 blur-[60px] opacity-0 transition-opacity duration-1000 group-hover:opacity-100 dark:bg-flare/10" />
                                      <div className="relative overflow-hidden rounded-[48px] border-[12px] border-slate-950 bg-black shadow-2xl dark:border-slate-900">
                                        <video
                                          ref={previewVideoRef}
                                          controls
                                          playsInline
                                          src={selectedJob.output.preview.url}
                                          onLoadedMetadata={(event) => {
                                            const duration = Number(event.currentTarget.duration || 0) || 0;
                                            if (duration > 0 && Number.isFinite(duration)) {
                                              setPreviewDurationSeconds(duration);
                                            }
                                          }}
                                          className="aspect-[9/16] w-full bg-black object-contain shadow-inner"
                                        />
                                      </div>
                                   </div>

                                   <div className="p-8 rounded-[40px] bg-slate-950 text-white shadow-2xl dark:bg-white/5 dark:border dark:border-white/5">
                                     <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                           <div className="p-2 rounded-xl bg-white/10">
                                              <Scissors size={20} className="text-indigo-400 dark:text-flare" />
                                           </div>
                                           <span className="text-base font-black tracking-tight uppercase">Segment Studio</span>
                                        </div>
                                        <div className="px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest dark:bg-flare/10 dark:text-flare">
                                           {formatSeconds(Math.max(0, trimEnd - trimStart))} Segment
                                        </div>
                                     </div>
                                     
                                     <div className="space-y-10">
                                        <div className="space-y-4">
                                           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                                              <span>In-point</span>
                                              <span className="text-white opacity-100">{formatSeconds(trimStart)}</span>
                                           </div>
                                           <div className="flex items-center justify-end gap-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentTime = previewVideoRef.current?.currentTime;
                                                  if (currentTime == null) return;
                                                  const nextStart = Number(currentTime) || 0;
                                                  setTrimStart(nextStart);
                                                  setTrimEnd((current) => (current > nextStart + 0.05 ? current : nextStart + 0.5));
                                                }}
                                                className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20"
                                              >
                                                Set from playhead
                                              </button>
                                           </div>
                                           <input
                                              type="range"
                                              min={0}
                                              max={selectedJob.metadata?.durationSeconds || previewDurationSeconds || 0}
                                              step={0.1}
                                              value={trimStart}
                                              onChange={(event) => {
                                                const nextStart = Number(event.target.value) || 0;
                                                setTrimStart(nextStart);
                                                setTrimEnd((current) => (current > nextStart + 0.05 ? current : nextStart + 0.5));
                                              }}
                                              className="w-full accent-indigo-500 dark:accent-flare"
                                           />
                                        </div>
                                        <div className="space-y-4">
                                           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                                              <span>Out-point</span>
                                              <span className="text-white opacity-100">{formatSeconds(trimEnd)}</span>
                                           </div>
                                           <div className="flex items-center justify-end gap-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const currentTime = previewVideoRef.current?.currentTime;
                                                  if (currentTime == null) return;
                                                  const maxSeconds = Number(selectedJob.metadata?.durationSeconds ?? previewDurationSeconds ?? 0) || 0;
                                                  const nextEnd = Math.max(0, Math.min(Number(currentTime) || 0, maxSeconds || Number(currentTime) || 0));
                                                  setTrimEnd(nextEnd);
                                                }}
                                                className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/20"
                                              >
                                                Set from playhead
                                              </button>
                                           </div>
                                           <input
                                              type="range"
                                              min={0}
                                              max={selectedJob.metadata?.durationSeconds || previewDurationSeconds || 0}
                                              step={0.1}
                                              value={trimEnd}
                                              onChange={(event) => {
                                                const nextEnd = Number(event.target.value) || 0;
                                                setTrimEnd(nextEnd);
                                                setTrimStart((current) => (nextEnd > current + 0.05 ? current : Math.max(0, nextEnd - 0.5)));
                                              }}
                                              className="w-full accent-indigo-500 dark:accent-flare"
                                           />
                                        </div>
                                     </div>

                                     <div className="grid grid-cols-2 gap-4 mt-10">
                                        <button disabled={trimLoading} onClick={handleTrim} className="py-5 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:bg-indigo-500 hover:scale-[1.02] active:scale-95 disabled:opacity-50 dark:bg-flare dark:text-slate-900 shadow-lg shadow-indigo-600/20">
                                           {trimLoading ? 'Processing...' : 'Export Clip'}
                                        </button>
                                        <a href={selectedJob.output.video?.url} target="_blank" className="flex items-center justify-center gap-2 py-5 rounded-2xl bg-white/10 border border-white/20 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white/20">
                                           <Download size={16} />
                                           Full Master
                                        </a>
                                     </div>

                                     {selectedJob.output?.trim?.asset?.url ? (
                                       <div className="mt-8 space-y-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
                                         <div className="flex items-center justify-between gap-3">
                                           <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                             Latest exported clip
                                           </div>
                                           <a
                                             href={selectedJob.output.trim.asset.url}
                                             target="_blank"
                                             download={`clip-${Math.round(trimStart * 10) / 10}-${Math.round(trimEnd * 10) / 10}.mp4`}
                                             className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-white/20"
                                           >
                                             <Download size={14} />
                                             Download clip
                                           </a>
                                         </div>
                                         <video
                                           controls
                                           playsInline
                                           src={selectedJob.output.trim.asset.url}
                                           className="aspect-[9/16] w-full rounded-[22px] bg-black object-contain"
                                         />
                                       </div>
                                     ) : null}
                                   </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
                                   <motion.div 
                                     animate={{ rotate: 360 }}
                                     transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                     className="p-8 rounded-full bg-slate-50 dark:bg-white/5 mb-6"
                                   >
                                      <Clapperboard size={48} className="opacity-20" />
                                   </motion.div>
                                   <h4 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Finalizing Assets</h4>
                                   <p className="mt-2 text-sm font-medium opacity-50">Visual data is being processed in the background.</p>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {activeWorkspaceTab === 'history' && (
                            <motion.div
                              key="history"
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="space-y-4 pb-4"
                            >
                              <div className="grid gap-3">
                                {jobs.length === 0 ? (
                                  <div className="py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Zero Records found.</div>
                                ) : (
                                  jobs.map((job) => (
                                    <div
                                      key={job._id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setSelectedJobId(job._id)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                          event.preventDefault();
                                          setSelectedJobId(job._id);
                                        }
                                      }}
                                      className={`group relative flex items-center justify-between p-5 rounded-[28px] border transition-all duration-300 cursor-pointer ${
                                        selectedJobId === job._id
                                          ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/5 dark:border-flare/40 dark:bg-flare/5'
                                          : 'border-slate-100 bg-white/40 hover:border-slate-300 hover:bg-white dark:border-white/5 dark:bg-white/[0.01] dark:hover:border-white/10'
                                      }`}
                                    >
                                      <div className="flex items-center gap-5 flex-1 min-w-0">
                                         <div className={`shrink-0 h-2.5 w-2.5 rounded-full shadow-sm ${
                                           job.status === 'completed' ? 'bg-emerald-500 shadow-emerald-500/40' :
                                           job.status === 'failed' ? 'bg-rose-500 shadow-rose-500/40 animate-pulse' :
                                           'bg-amber-400 shadow-amber-400/40 animate-pulse'
                                         }`} />
                                         <div className="text-left min-w-0">
                                            <div className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[180px] tracking-tight">
                                               {job.script?.title || job.style}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[9px] font-black uppercase opacity-30 tracking-widest truncate">
                                                {job.productCategory}
                                              </span>
                                              <div className="shrink-0 h-1 w-1 rounded-full bg-slate-300 dark:bg-white/20" />
                                              <span className={`text-[9px] font-black ${
                                                job.status === 'completed' ? 'text-emerald-500' :
                                                job.status === 'failed' ? 'text-rose-500' :
                                                'text-indigo-500 dark:text-flare'
                                              }`}>
                                                {job.status === 'completed' ? '✓ Ready' : job.status === 'failed' ? '✕ Failed' : `${job.progress}% Sync`}
                                              </span>
                                            </div>
                                         </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {job.status === 'failed' && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleRegenerate(job); }}
                                            className="px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all dark:bg-flare/10 dark:text-flare dark:hover:bg-flare dark:hover:text-slate-900"
                                          >
                                            Retry
                                          </button>
                                        )}
                                        <div className="h-10 w-10 rounded-2xl bg-slate-50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center dark:bg-white/5 translate-x-2 group-hover:translate-x-0">
                                           <ChevronRight size={18} className="text-slate-400" />
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
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
    </>
  );
}

export default App;
