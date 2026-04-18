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
    loginGreeting: 'Welcome back 👋',
    loginButton: 'Sign In',
    loginTab: 'Login',
    signInAction: 'Sign in',
    noAccount: "Don't have an account?",
    createOne: 'Create one',
    forgotPasswordLink: 'Forgot password?',

    // Register
    registerTitle: 'Create your free account',
    registerGreeting: 'Create your account ✨',
    registerButton: 'Create Account',
    registerTab: 'Register',
    createAccountAction: 'Create account',
    confirmPasswordLabel: 'Confirm Password',
    hasAccount: 'Already have an account?',
    signInInstead: 'Sign in instead',

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
    aiAssistant: 'AI Assistant',
    chatDescription: 'Chat with our AI to generate ideas and content.',
    startChat: 'Start Chat',

    // Chat
    chatTitle: 'AI Assistant',
    chatPlaceholder: 'Message AI Assistant…',
    send: 'Send',
    clearChat: 'Clear',
    aiThinking: 'AI is thinking...',
    newChat: 'New Chat',
    noHistory: 'No conversations yet',
    chatWelcome: 'How can I help you today?',
    chatWelcomeSub: 'Start a conversation with your AI Marketing Assistant',
    chatDisclaimer: 'AI can make mistakes. Check important info.',

    // Errors
    errorRequired: 'Please fill in all fields.',
    errorEmail: 'Please enter a valid email address.',
    errorPassLength: 'Password must be at least 6 characters.',
    errorPassMatch: 'Passwords do not match.',
    errorChat: 'Something went wrong. Please try again.',
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
    loginGreeting: 'Mirë se u kthyet 👋',
    loginButton: 'Hyr',
    loginTab: 'Hyr',
    signInAction: 'Kyçu',
    noAccount: 'Nuk keni llogari?',
    createOne: 'Krijo një',
    forgotPasswordLink: 'Keni harruar fjalëkalimin?',

    // Register
    registerTitle: 'Krijoni llogarinë tuaj falas',
    registerGreeting: 'Krijo llogarinë tënde ✨',
    registerButton: 'Krijo Llogari',
    registerTab: 'Regjistrohu',
    createAccountAction: 'Krijo Llogari',
    confirmPasswordLabel: 'Konfirmo Fjalëkalimin',
    hasAccount: 'Keni tashmë një llogari?',
    signInInstead: 'Kyçu në vend',

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
    aiAssistant: 'Asistenti AI',
    chatDescription: 'Bisedoni me AI tonë për të gjeneruar ide dhe përmbajtje.',
    startChat: 'Fillo Bisedën',

    // Chat
    chatTitle: 'Asistenti AI',
    chatPlaceholder: 'Shkruaj një mesazh…',
    send: 'Dërgo',
    clearChat: 'Pastro',
    aiThinking: 'AI po mendon...',
    newChat: 'Bisedë e Re',
    noHistory: 'Asnjë bisedë ende',
    chatWelcome: 'Si mund t\'ju ndihmoj sot?',
    chatWelcomeSub: 'Filloni një bisedë me Asistentin tuaj AI të Marketingut',
    chatDisclaimer: 'AI mund të bëjë gabime. Kontrolloni informacionet e rëndësishme.',

    // Errors
    errorRequired: 'Ju lutemi plotësoni të gjitha fushat.',
    errorEmail: 'Ju lutemi jepni një email të vlefshëm.',
    errorPassLength: 'Fjalëkalimi duhet të jetë të paktën 6 karaktere.',
    errorPassMatch: 'Fjalëkalimet nuk përputhen.',
    errorChat: 'Diçka shkoi keq. Ju lutemi provoni sërish.',
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
