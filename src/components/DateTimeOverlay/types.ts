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
  accentColor: string;       // hex string from text color picker
  bgColor: string | null;    // hex string from bg color picker, null = theme default
  bgOpacity?: number;
  mode: 'clock' | 'stopwatch';
  swRunning: boolean;
  swAccumulated: number;
  swStartTime: number | null;
  expanded: boolean;
}
