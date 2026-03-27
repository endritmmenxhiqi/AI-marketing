import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const ThemeLangToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLanguage } = useLanguage();

  return (
    <div className="toggle-wrapper">
      <button className="toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <button className="toggle-btn" onClick={toggleLanguage} aria-label="Toggle Language">
        {lang.toUpperCase()}
      </button>
    </div>
  );
};

export default ThemeLangToggle;
