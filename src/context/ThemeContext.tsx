import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'void';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  themeLocked: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('kmti-theme');
    return (saved as Theme) || 'light';
  });

  const [themeLocked, setThemeLocked] = useState(false);
  // 🥚 Rage-click void theme tracking
  const toggleClickTimes = React.useRef<number[]>([]);
  const toggleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (theme === 'void') {
      setThemeLocked(true);
      const timer = setTimeout(() => setThemeLocked(false), 5000);
      return () => clearTimeout(timer);
    } else {
      setThemeLocked(false);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('kmti-theme', theme);
    const body = document.body;
    body.classList.remove('dark-theme', 'void-theme');
    if (theme === 'dark') body.classList.add('dark-theme');
    if (theme === 'void') body.classList.add('void-theme');
  }, [theme]);

  const toggleTheme = () => {
    if (themeLocked) return;

    // Void escape hatch: one click from void returns to light immediately
    if (theme === 'void') {
      setTheme('light');
      toggleClickTimes.current = [];
      return;
    }

    // Track click timing for rage-click detection (3s window)
    const now = Date.now();
    toggleClickTimes.current = [
      ...toggleClickTimes.current.filter(t => now - t < 3000),
      now
    ];

    const count = toggleClickTimes.current.length;

    // 7 clicks: fire void immediately and cancel any pending normal toggle
    if (count >= 7) {
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
      toggleClickTimes.current = [];
      setTimeout(() => setTheme('void'), 80);
      return;
    }

    // Normal light <-> dark toggle (debounced 250ms to make sequences not obvious)
    if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
    toggleTimeoutRef.current = setTimeout(() => {
      setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    }, 250);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeLocked }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
