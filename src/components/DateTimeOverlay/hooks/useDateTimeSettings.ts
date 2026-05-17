import { useState, useMemo } from 'react';
import { SettingsV6 } from '../types';
import { STORAGE_KEY, THEMES, COLOR_PALETTES } from '../constants';

export const useDateTimeSettings = () => {
  const initialSettings = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        // Migrate old palette-index schema to direct color strings
        if (typeof data.paletteIndex === 'number' && !data.accentColor) {
          data.accentColor = COLOR_PALETTES[data.paletteIndex]?.hex || '#00f2ff';
        }
        if (data.bgPaletteIndex !== undefined && data.bgColor === undefined) {
          data.bgColor = data.bgPaletteIndex !== null
            ? (COLOR_PALETTES[data.bgPaletteIndex]?.hex || null)
            : null;
        }
        return data;
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    return {
      position: { x: window.innerWidth / 2 - 100, y: 100 },
      themeIndex: 0,
      accentColor: '#00f2ff',
      bgColor: null,
      mode: 'clock',
      swRunning: false,
      swAccumulated: 0,
      swStartTime: null,
      expanded: false,
    } as SettingsV6;
  }, []);

  const [position, setPosition] = useState(initialSettings.position);
  const [themeIndex, setThemeIndex] = useState(initialSettings.themeIndex);
  const [accentColor, setAccentColor] = useState<string>(initialSettings.accentColor || '#00f2ff');
  const [bgColor, setBgColor] = useState<string | null>(initialSettings.bgColor ?? null);
  const [bgOpacity, setBgOpacity] = useState(initialSettings.bgOpacity ?? 0.85);
  const [mode, setMode] = useState<'clock' | 'stopwatch'>(initialSettings.mode);
  const [isExpanded, setIsExpanded] = useState(initialSettings.expanded);

  const safeThemeIndex = themeIndex >= THEMES.length ? 0 : themeIndex;
  const theme = THEMES[safeThemeIndex];

  return {
    position, setPosition,
    themeIndex, setThemeIndex,
    accentColor, setAccentColor,
    bgColor, setBgColor,
    bgOpacity, setBgOpacity,
    mode, setMode,
    isExpanded, setIsExpanded,
    theme,
    safeThemeIndex,
    // Stopwatch initial values — read-once, owned by useStopwatch
    swRunning: initialSettings.swRunning,
    swAccumulated: initialSettings.swAccumulated,
    swStartTime: initialSettings.swStartTime,
  };
};
