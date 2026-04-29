import { useEffect, useState, type ReactNode } from 'react';
import { useTheme } from '../../context/ThemeContext';
import logoMark from '../../assets/logo-mark-ui-1.png';

const LOADER_DURATION_MS = 4000;
const LOADER_FADE_MS = 500;

type AppLoadingScreenProps = {
  children: ReactNode;
};

export default function AppLoadingScreen({ children }: AppLoadingScreenProps) {
  const { theme } = useTheme();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isAppVisible, setIsAppVisible] = useState(false);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setIsFadingOut(true);
      setIsAppVisible(true);
    }, LOADER_DURATION_MS);

    const completeTimer = window.setTimeout(() => {
      setIsLoadingComplete(true);
    }, LOADER_DURATION_MS + LOADER_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, []);

  return (
    <>
      <div
        className={`app-shell ${isAppVisible ? 'app-shell--ready' : 'app-shell--hidden'}`}
        aria-hidden={!isAppVisible}
      >
        {children}
      </div>

      {!isLoadingComplete ? (
        <div
          className={`app-loader ${theme === 'dark' ? 'app-loader--dark' : 'app-loader--light'} ${
            isFadingOut ? 'app-loader--fade-out' : ''
          }`}
          role="status"
          aria-live="polite"
          aria-label="Loading Video AI Studio"
        >
          <div className="app-loader__content">
            <div className="app-loader__logo-wrap">
              <div className="app-loader__glow" />
              <img src={logoMark} alt="Video AI Studio logo" className="app-loader__logo" />
            </div>
            <div className="app-loader__title">Video AI Studio</div>
            <div className="app-loader__subtitle">Loading AI Experience...</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
