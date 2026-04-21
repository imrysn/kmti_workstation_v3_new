import { useState, useMemo } from 'react';
import { SettingsV6 } from '../types';
import { STORAGE_KEY, THEMES } from '../constants';

export const useDateTimeSettings = () => {
  const initialSettings: SettingsV6 = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.bgPaletteIndex === undefined) data.bgPaletteIndex = null;
        return data;
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return {
      position: { x: window.innerWidth / 2 - 100, y: 100 },
      themeIndex: 0,
      paletteIndex: 0,
      bgPaletteIndex: null,
      mode: 'clock',
      swRunning: false,
      swAccumulated: 0,
      swStartTime: null,
      expanded: false
    };
  }, []);

  const [position, setPosition] = useState(initialSettings.position);
  const [themeIndex, setThemeIndex] = useState(initialSettings.themeIndex);
  const [paletteIndex, setPaletteIndex] = useState(initialSettings.paletteIndex);
  const [bgPaletteIndex, setBgPaletteIndex] = useState(initialSettings.bgPaletteIndex);
  const [bgOpacity, setBgOpacity] = useState(initialSettings.bgOpacity ?? 0.85);
  const [mode, setMode] = useState<'clock' | 'stopwatch'>(initialSettings.mode);
  const [isExpanded, setIsExpanded] = useState(initialSettings.expanded);

  const safeThemeIndex = themeIndex >= THEMES.length ? 0 : themeIndex;
  const theme = THEMES[safeThemeIndex];

  return {
    position, setPosition,
    themeIndex, setThemeIndex,
    paletteIndex, setPaletteIndex,
    bgPaletteIndex, setBgPaletteIndex,
    bgOpacity, setBgOpacity,
    mode, setMode,
    isExpanded, setIsExpanded,
    theme,
    safeThemeIndex,
    // Stopwatch initial values passed through to useStopwatch — never stored as useState
    // because useStopwatch owns that state. These are read-once on mount.
    swRunning: initialSettings.swRunning,
    swAccumulated: initialSettings.swAccumulated,
    swStartTime: initialSettings.swStartTime,
  };
};
