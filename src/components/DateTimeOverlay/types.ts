export interface ThemeConfig {
  name: string;
  bg: string;
  text: string;
  sub: string;
  border: string;
  glowOpacity: number;
  font?: string;
  className: string;
}

export interface PaletteColor {
  name: string;
  hex: string;
}

export interface StopwatchRecord {
  id: string;
  name: string;
  time: string;
  timestamp: number;
  workstation?: string;
  user_name?: string;
}

export interface SettingsV6 {
  position: { x: number; y: number };
  themeIndex: number;
  paletteIndex: number;
  bgPaletteIndex: number | null;
  bgOpacity?: number;
  mode: 'clock' | 'stopwatch';
  swRunning: boolean;
  swAccumulated: number;
  swStartTime: number | null;
  expanded: boolean;
}
