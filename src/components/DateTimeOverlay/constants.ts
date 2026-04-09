import { ThemeConfig, PaletteColor } from './types';

export const THEMES: ThemeConfig[] = [
  { name: 'Crystal', bg: 'rgba(255, 255, 255, 0.3)', text: '#0f172a', sub: '#64748b', border: 'rgba(255, 255, 255, 0.7)', glowOpacity: 0.1, className: 'theme-crystal' },
  { name: 'Cyber', bg: 'rgba(5, 5, 10, 0.95)', text: '#00ffff', sub: 'rgba(0, 255, 255, 0.6)', border: '#00ffff', glowOpacity: 0.8, font: '"Courier New", monospace', className: 'theme-cyber' },
  { name: 'Retro', bg: '#111111', text: '#ffb000', sub: '#ffb00099', border: '#444444', glowOpacity: 0.4, font: '"Courier New", monospace', className: 'theme-retro' },
  { name: 'Blueprint', bg: '#0f172a', text: '#38bdf8', sub: '#0ea5e9', border: '#38bdf8', glowOpacity: 0.5, font: 'monospace', className: 'theme-blueprint' },
  { name: 'Hologram', bg: 'rgba(255, 255, 255, 0.2)', text: '#0f172a', sub: '#475569', border: 'rgba(255, 255, 255, 0.8)', glowOpacity: 0.8, className: 'theme-hologram' },
  { name: 'Brutalism', bg: '#ffeb3b', text: '#000000', sub: '#333333', border: '#000000', glowOpacity: 0, font: '"Arial Black", system-ui, sans-serif', className: 'theme-brutalism' },
  { name: 'Organic', bg: 'rgba(10, 30, 20, 0.7)', text: '#a7f3d0', sub: '#34d399', border: '#10b981', glowOpacity: 0.5, className: 'theme-organic' },
  { name: 'Neumorph', bg: '#e0e5ec', text: '#4a5568', sub: '#718096', border: 'transparent', glowOpacity: 0, className: 'theme-neumorph' },
  { name: 'Aurora', bg: '#1e1b4b', text: '#ffffff', sub: 'rgba(255,255,255,0.7)', border: 'rgba(255,255,255,0.2)', glowOpacity: 0.6, className: 'theme-aurora' },
  { name: 'Vaporwave', bg: '#0f0c29', text: '#f72585', sub: '#4cc9f0', border: '#7209b7', glowOpacity: 0.8, font: '"Courier New", monospace', className: 'theme-vapor' },
  { name: 'Luxury', bg: '#050505', text: '#d4af37', sub: 'rgba(212, 175, 55, 0.6)', border: '#d4af37', glowOpacity: 0.2, font: '"Playfair Display", "Times New Roman", serif', className: 'theme-luxury' },
  { name: 'Galactic', bg: '#03000f', text: '#e0c4ff', sub: 'rgba(176, 100, 255, 0.7)', border: '#7c3aed', glowOpacity: 0.9, font: '"Courier New", monospace', className: 'theme-galactic' }
];

export const COLOR_PALETTES: PaletteColor[] = [
  { name: 'Cyan', hex: '#00f2ff' },
  { name: 'Magenta', hex: '#ff00ff' },
  { name: 'Lime', hex: '#adff2f' },
  { name: 'Volt', hex: '#fff000' },
  { name: 'Ruby', hex: '#ef4444' },
  { name: 'Sapphire', hex: '#3b82f6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Gold', hex: '#f5d142' },
  { name: 'Amethyst', hex: '#8b5cf6' },
  { name: 'Slate', hex: '#94a3b8' },
  { name: 'Oxide', hex: '#f97316' },
  { name: 'Carbon', hex: '#334155' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Ghost', hex: '#cbd5e1' },
  { name: 'Obsidian', hex: '#0f172a' }
];

export const STORAGE_KEY = 'kmti_clock_settings_v6';
