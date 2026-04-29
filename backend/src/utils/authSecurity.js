const DEFAULT_AUTH_COOKIE_NAME = 'ai_marketing_session';
const DEFAULT_AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 10 characters and include uppercase, lowercase, number, and special character.';

const parseDurationToMs = (value, fallbackMs = DEFAULT_AUTH_COOKIE_MAX_AGE_MS) => {
  if (!value) {
    return fallbackMs;
  }

  if (/^\d+$/.test(String(value).trim())) {
    return Number(value) * 1000;
  }

  const match = String(value)
    .trim()
    .match(/^(\d+)(ms|s|m|h|d)$/i);

  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
};

const getAuthCookieName = () => process.env.AUTH_COOKIE_NAME || DEFAULT_AUTH_COOKIE_NAME;

const getAuthCookieMaxAgeMs = () => {
  const configured = Number(process.env.AUTH_COOKIE_MAX_AGE_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return parseDurationToMs(process.env.JWT_EXPIRES_IN, DEFAULT_AUTH_COOKIE_MAX_AGE_MS);
};

const getAuthCookieSameSite = () => {
  const configured = String(process.env.AUTH_COOKIE_SAME_SITE || 'lax').toLowerCase();
  return ['lax', 'strict', 'none'].includes(configured) ? configured : 'lax';
};

const isSecureCookie = () => {
  if (typeof process.env.AUTH_COOKIE_SECURE === 'string') {
    return process.env.AUTH_COOKIE_SECURE === 'true';
  }

  return process.env.NODE_ENV === 'production';
};

const buildAuthCookieOptions = () => ({
  httpOnly: true,
  secure: isSecureCookie(),
  sameSite: getAuthCookieSameSite(),
  path: '/',
  maxAge: getAuthCookieMaxAgeMs(),
});

const setAuthCookie = (res, token) => {
  res.cookie(getAuthCookieName(), token, buildAuthCookieOptions());
};

const clearAuthCookie = (res) => {
  res.clearCookie(getAuthCookieName(), {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: getAuthCookieSameSite(),
    path: '/',
  });
};

const parseCookieHeader = (cookieHeader = '') =>
  cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});

const extractAuthToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const cookies = parseCookieHeader(req.headers.cookie || '');
  return cookies[getAuthCookieName()] || '';
};

const getClientIdentifier =
  (req) => req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const validatePasswordStrength = (password) => {
  const normalized = String(password || '');
  const checks = {
    minLength: normalized.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(normalized),
    lowercase: /[a-z]/.test(normalized),
    number: /\d/.test(normalized),
    special: /[^A-Za-z0-9]/.test(normalized),
  };

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    message: PASSWORD_POLICY_MESSAGE,
  };
};

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  buildAuthCookieOptions,
  clearAuthCookie,
  extractAuthToken,
  getAuthCookieName,
  getClientIdentifier,
  normalizeEmail,
  setAuthCookie,
  validatePasswordStrength,
};
