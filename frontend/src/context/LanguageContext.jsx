import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Translations Dictionary ───────────────────────────────────────────────────
const translations = {
  en: {
    // Auth Shared
    appName: 'AI Marketing',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '••••••••',
    passwordMinFormat: 'Min. 6 characters',
    loading: 'Loading...',

    // Login
    loginTitle: 'Sign in to your account',
    loginButton: 'Sign In',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
    forgotPasswordLink: 'Forgot password?',

    // Register
    registerTitle: 'Create your free account',
    registerButton: 'Create Account',
    confirmPasswordLabel: 'Confirm Password',
    hasAccount: 'Already have an account?',
    signInInstead: 'Sign in',

    // Forgot Password
    forgotTitle: 'Reset your password',
    forgotSubtitle: 'Enter your email and we will send you a reset link.',
    forgotButton: 'Send Reset Link',
    backToLogin: 'Back to sign in',

    // Reset Password
    resetTitle: 'Set new password',
    resetSubtitle: 'Please enter your new password below.',
    resetButton: 'Update Password',
    newPasswordLabel: 'New Password',
    
    // Dashboard
    welcomeBack: 'Welcome back!',
    campaigns: 'Campaigns',
    assets: 'Assets',
    generations: 'Generations',
    signOut: 'Sign Out',
    dashboardHint: '🚀 Your AI Marketing workspace is ready. Start creating!',
    
    // Errors
    errorRequired: 'Please fill in all fields.',
    errorEmail: 'Please enter a valid email address.',
    errorPassLength: 'Password must be at least 6 characters.',
    errorPassMatch: 'Passwords do not match.',
  },
  sq: {
    // Auth Shared
    appName: 'Marketing AI',
    emailLabel: 'Adresa e email-it',
    emailPlaceholder: 'ju@shembull.com',
    passwordLabel: 'Fjalëkalimi',
    passwordPlaceholder: '••••••••',
    passwordMinFormat: 'Min. 6 karaktere',
    loading: 'Duke ngarkuar...',

    // Login
    loginTitle: 'Hyni në llogarinë tuaj',
    loginButton: 'Hyr',
    noAccount: 'Nuk keni llogari?',
    createOne: 'Krijo një',
    forgotPasswordLink: 'Keni harruar fjalëkalimin?',

    // Register
    registerTitle: 'Krijoni llogarinë tuaj falas',
    registerButton: 'Krijo Llogari',
    confirmPasswordLabel: 'Konfirmo Fjalëkalimin',
    hasAccount: 'Keni tashmë një llogari?',
    signInInstead: 'Hyr',

    // Forgot Password
    forgotTitle: 'Rivendos fjalëkalimin',
    forgotSubtitle: 'Shënoni email-in dhe do t\'ju dërgojmë një link rivendosjeje.',
    forgotButton: 'Dërgo Linkun',
    backToLogin: 'Kthehu te hyrja',

    // Reset Password
    resetTitle: 'Vendosni fjalëkalimin e ri',
    resetSubtitle: 'Ju lutemi shënoni fjalëkalimin e ri më poshtë.',
    resetButton: 'Përditëso Fjalëkalimin',
    newPasswordLabel: 'Fjalëkalimi i Ri',

    // Dashboard
    welcomeBack: 'Mirësevini përsëri!',
    campaigns: 'Kompani',
    assets: 'Asete',
    generations: 'Gjenerime',
    signOut: 'Dil',
    dashboardHint: '🚀 Hapësira juaj e Marketing AI është gati. Fillo të krijosh!',
    
    // Errors
    errorRequired: 'Ju lutemi plotësoni të gjitha fushat.',
    errorEmail: 'Ju lutemi jepni një email të vlefshëm.',
    errorPassLength: 'Fjalëkalimi duhet të jetë të paktën 6 karaktere.',
    errorPassMatch: 'Fjalëkalimet nuk përputhen.',
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('language') || 'en');

  useEffect(() => {
    localStorage.setItem('language', lang);
  }, [lang]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'sq' : 'en'));
  };

  /**
   * Translation function
   * @param {string} key - the translation key
   */
  const t = (key) => {
    return translations[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
