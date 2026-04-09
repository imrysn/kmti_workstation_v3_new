import React, { useState, useEffect, useRef, useMemo } from 'react';
import './DateTimeOverlay.css';

/**
 * Premium, Draggable, Persistent DateTime & Stopwatch HUD.
 * Version 6.1: Bug Fixes, Mode-based Switching, and Refined Palette Toggles.
 */

interface ThemeConfig {
  name: string;
  bg: string;
  text: string;
  sub: string;
  border: string;
  glowOpacity: number;
  font?: string;
  className: string;
}

const THEMES: ThemeConfig[] = [
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
  { name: 'Luxury', bg: '#050505', text: '#d4af37', sub: 'rgba(212, 175, 55, 0.6)', border: '#d4af37', glowOpacity: 0.2, font: '"Playfair Display", "Times New Roman", serif', className: 'theme-luxury' }
];

interface PaletteColor {
  name: string;
  hex: string;
}

const COLOR_PALETTES: PaletteColor[] = [
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

const STORAGE_KEY = 'kmti_clock_settings_v6';

interface StopwatchRecord {
    id: string;
    name: string;
    time: string;
    timestamp: number;
}

interface SettingsV6 {
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

const DateTimeOverlay: React.FC = () => {
  const initialSettings: SettingsV6 = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.bgPaletteIndex === undefined) data.bgPaletteIndex = null;
        return data;
      } catch (e) { console.error("Failed to parse settings", e); }
    }
    return {
      position: { x: window.innerWidth / 2 - 100, y: 100 },
      themeIndex: 0, paletteIndex: 0, bgPaletteIndex: null,
      mode: 'clock', swRunning: false, swAccumulated: 0, swStartTime: null, expanded: false
    };
  }, []);

  const [time, setTime] = useState(new Date());
  const [position, setPosition] = useState(initialSettings.position);
  const [themeIndex, setThemeIndex] = useState(initialSettings.themeIndex);
  const [paletteIndex, setPaletteIndex] = useState(initialSettings.paletteIndex);
  const [bgPaletteIndex, setBgPaletteIndex] = useState(initialSettings.bgPaletteIndex);
  const [bgOpacity, setBgOpacity] = useState(initialSettings.bgOpacity ?? 0.85);
  const [mode, setMode] = useState<'clock' | 'stopwatch'>(initialSettings.mode);
  const [isExpanded, setIsExpanded] = useState(initialSettings.expanded);
  
  // Stopwatch state
  const [swRunning, setSwRunning] = useState(initialSettings.swRunning);
  const [swAccumulated, setSwAccumulated] = useState(initialSettings.swAccumulated);
  const [swStartTime, setSwStartTime] = useState<number | null>(initialSettings.swStartTime);
  const [swCurrent, setSwCurrent] = useState(0);
  const [swRecords, setSwRecords] = useState<StopwatchRecord[]>([]);

  // UI States
  const [showMoreThemes, setShowMoreThemes] = useState(false);
  const [showMoreColors, setShowMoreColors] = useState(false);
  const [showMoreBgColors, setShowMoreBgColors] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [dragging, setDragging] = useState(false);

  // Dragging Refs
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartCoordsRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Load Records on Init
  useEffect(() => {
    (window as any).electronAPI?.getStopwatchRecords().then((list: StopwatchRecord[]) => {
      if (list) setSwRecords(list);
    });
  }, []);

  // Tick for Clock & Stopwatch
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      if (swRunning && swStartTime) {
        setSwCurrent(swAccumulated + (Date.now() - swStartTime));
      } else {
        setSwCurrent(swAccumulated);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [swRunning, swStartTime, swAccumulated]);

  // Global mouse handlers for Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newX = e.clientX - dragStartRef.current.x;
      const newY = (window.innerHeight - e.clientY) - dragStartRef.current.y;
      
      const overlayWidth = overlayRef.current?.offsetWidth || 200;
      const overlayHeight = (overlayRef.current?.querySelector('.findr-datetime-content') as HTMLElement)?.offsetHeight || 44;

      const bounds = {
        minX: 10, minY: 10,
        maxX: window.innerWidth - overlayWidth - 10,
        maxY: window.innerHeight - overlayHeight - 10
      };
      setPosition({
        x: Math.max(bounds.minX, Math.min(newX, bounds.maxX)),
        y: Math.max(bounds.minY, Math.min(newY, bounds.maxY))
      });
    };

    const handleMouseUpGlobal = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setDragging(false);
      const dist = Math.sqrt(
        Math.pow(e.clientX - dragStartCoordsRef.current.x, 2) + 
        Math.pow(e.clientY - dragStartCoordsRef.current.y, 2)
      );
      if (dist < 5) { setIsExpanded(prev => !prev); } else { snapToEdge(); }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, []);

  const snapToEdge = () => {
    if (!overlayRef.current) return;
    const padding = 20, snapThreshold = 60;
    const width = overlayRef.current.offsetWidth, height = overlayRef.current.offsetHeight;
    setPosition(prev => {
        const distToLeft = prev.x, distToRight = window.innerWidth - (prev.x + width);
        const distToBottom = prev.y, distToTop = window.innerHeight - (prev.y + height);
        let targetX = prev.x, targetY = prev.y;
        if (distToLeft < snapThreshold) targetX = padding;
        else if (distToRight < snapThreshold) targetX = window.innerWidth - width - padding;
        if (distToBottom < snapThreshold) targetY = padding;
        else if (distToTop < snapThreshold) targetY = window.innerHeight - height - padding;
        return { x: targetX, y: targetY };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.findr-control-center')) return;
    if ((e.target as HTMLElement).closest('.findr-sw-controls')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    isDraggingRef.current = true;
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: (window.innerHeight - e.clientY) - position.y
    };
    dragStartCoordsRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMode(prev => prev === 'clock' ? 'stopwatch' : 'clock');
  };

  const toggleStopwatch = () => {
    if (swRunning) {
      setSwAccumulated(swCurrent); setSwStartTime(null); setSwRunning(false);
    } else {
      setSwStartTime(Date.now()); setSwRunning(true);
    }
  };

  const resetStopwatch = () => {
    setSwRunning(false); setSwStartTime(null); setSwAccumulated(0); setSwCurrent(0);
  };

  const formatStopwatch = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  const saveRecord = async () => {
      const newRecord: StopwatchRecord = {
          id: Math.random().toString(36).substr(2, 9),
          name: `Record ${swRecords.length + 1}`,
          time: formatStopwatch(swCurrent),
          timestamp: Date.now()
      };
      const updated = [newRecord, ...swRecords].slice(0, 50);
      setSwRecords(updated);
      await (window as any).electronAPI?.saveStopwatchRecords(updated);
  };

  const deleteRecord = async (id: string) => {
      const updated = swRecords.filter(r => r.id !== id);
      setSwRecords(updated);
      await (window as any).electronAPI?.saveStopwatchRecords(updated);
  };

  const renameRecord = async (id: string, newName: string) => {
      const updated = swRecords.map(r => r.id === id ? { ...r, name: newName } : r);
      setSwRecords(updated);
      await (window as any).electronAPI?.saveStopwatchRecords(updated);
  };

  // Persistence Sync
  useEffect(() => {
    const settings: SettingsV6 = {
      position, themeIndex, paletteIndex, bgPaletteIndex, bgOpacity, mode,
      swRunning, swAccumulated, swStartTime, expanded: isExpanded
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [position, themeIndex, paletteIndex, bgPaletteIndex, bgOpacity, mode, swRunning, swAccumulated, swStartTime, isExpanded]);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const safeThemeIndex = themeIndex >= THEMES.length ? 0 : themeIndex;
  const theme = THEMES[safeThemeIndex];
  const accentColor = COLOR_PALETTES[paletteIndex]?.hex || COLOR_PALETTES[0].hex;
  
  const activeColors = useMemo(() => {
    const hexToRgbStr = (colorStr: string) => {
        if (colorStr.startsWith('rgba') || colorStr.startsWith('rgb')) {
            const match = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (match) return `${match[1]}, ${match[2]}, ${match[3]}`;
        }
        if (colorStr.startsWith('#')) {
            let h = colorStr.slice(1);
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            if (h.length === 8) h = h.slice(0, 6);
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return `${r}, ${g}, ${b}`;
        }
        return '0, 0, 0';
    };

    let baseColor = theme.bg;
    let isLight = false;

    if (bgPaletteIndex !== null) {
      baseColor = COLOR_PALETTES[bgPaletteIndex].hex;
      const rgb = hexToRgbStr(baseColor).split(',');
      const yiq = ((parseInt(rgb[0]) * 299) + (parseInt(rgb[1]) * 587) + (parseInt(rgb[2]) * 114)) / 1000;
      isLight = yiq >= 128;
    } else {
      const rgb = hexToRgbStr(baseColor).split(',');
      if (rgb.length === 3 && !Number.isNaN(parseInt(rgb[0]))) {
          const yiq = ((parseInt(rgb[0]) * 299) + (parseInt(rgb[1]) * 587) + (parseInt(rgb[2]) * 114)) / 1000;
          isLight = yiq >= 128;
      } else {
          isLight = theme.name === 'Crystal' || theme.name === 'Brutalism';
      }
    }
    
    return {
      bg: `rgba(${hexToRgbStr(baseColor)}, ${bgOpacity})`,
      text: isLight ? '#0f172a' : '#ffffff',
      sub: isLight ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
      border: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
      contrastRgb: isLight ? '0, 0, 0' : '255, 255, 255'
    };
  }, [bgPaletteIndex, theme, bgOpacity]);

  const isInactive = !isExpanded && (Date.now() - lastActivity > 30000);
  const isTopHalf = useMemo(() => position.y > window.innerHeight / 2, [position.y]);
  const clockHeight = 44; 

  return (
    <div 
      ref={overlayRef}
      className={`findr-global-datetime ${theme.className} ${dragging ? 'dragging' : ''} ${isExpanded ? 'expanded' : ''} ${isInactive ? 'inactive' : ''} mode-${mode} ${isTopHalf ? 'expand-down' : 'expand-up'}`}
      style={{ 
        left: `${position.x}px`, 
        bottom: isTopHalf ? 'auto' : `${position.y}px`,
        top: isTopHalf ? `${window.innerHeight - position.y - clockHeight}px` : 'auto',
        backgroundColor: activeColors.bg, color: activeColors.text, borderColor: activeColors.border,
        boxShadow: theme.glowOpacity > 0 ? `0 0 20px ${accentColor}${Math.floor(theme.glowOpacity * 255).toString(16).padStart(2, '0')}, 0 20px 40px rgba(0,0,0,0.2)` : '0 20px 40px rgba(0,0,0,0.2)',
        fontFamily: theme.font || 'inherit',
        '--sw-contrast': activeColors.contrastRgb
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setLastActivity(Date.now())}
      onMouseMove={() => setLastActivity(Date.now())}
    >
      {/* Control Center Interior */}
      <div className="findr-datetime-content">
        {mode === 'clock' ? (
          <>
            <span className="findr-datetime-time" style={{ color: accentColor }}>{timeStr}</span>
            <div className="findr-datetime-separator" style={{ backgroundColor: accentColor, opacity: 0.3 }} />
            <span className="findr-datetime-date" style={{ color: accentColor, opacity: 0.8 }}>{dateStr}</span>
          </>
        ) : (
          <div className="findr-stopwatch-container">
             <div className="findr-sw-display" style={{ color: accentColor }}>{formatStopwatch(swCurrent)}</div>
             <div className="findr-datetime-separator" style={{ backgroundColor: accentColor, opacity: 0.3 }} />
             <div className="findr-sw-controls">
                <button className="findr-sw-icon-btn" onClick={(e) => { e.stopPropagation(); toggleStopwatch(); }} style={{ color: accentColor }} title={swRunning ? 'Pause' : 'Start'}>
                  {swRunning ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <button className="findr-sw-icon-btn" onClick={(e) => { e.stopPropagation(); saveRecord(); }} style={{ color: accentColor }} title="Record Lap">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
                </button>
                <button className="findr-sw-icon-btn" onClick={(e) => { e.stopPropagation(); resetStopwatch(); }} style={{ color: accentColor }} title="Reset">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                  </svg>
                </button>
             </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="findr-control-center">
            {mode === 'clock' ? (
                <>
                    <div className="findr-cc-group animate-1">
                        <div className="findr-cc-header">
                            <div className="findr-cc-label">THEMES</div>
                            <button className="findr-palette-toggle" onClick={(e) => { e.stopPropagation(); setShowMoreThemes(!showMoreThemes); }} title={showMoreThemes ? "Show Less" : "Show All"}>
                                {showMoreThemes ? (
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                                ) : "..."}
                            </button>
                        </div>
                        <div className="findr-cc-track">
                          <div className="findr-cc-grid themes" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, width: 'fit-content' }}>
                              {(showMoreThemes ? THEMES : THEMES.slice(0, 5)).map((t, idx) => (
                                  <div key={t.name} className={`findr-theme-opt-v2 ${safeThemeIndex === idx ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setThemeIndex(idx); }}
                                      style={{ backgroundColor: t.bg, borderColor: t.border }} title={t.name}>
                                      <div className="findr-theme-preview" style={{ backgroundColor: t.text }} />
                                  </div>
                              ))}
                          </div>
                        </div>
                    </div>

                    {/* --- Text Colors --- */}
                    <div className="findr-cc-group animate-2">
                        <div className="findr-cc-header">
                            <div className="findr-cc-label">TEXT COLORS</div>
                            <button className="findr-palette-toggle" onClick={(e) => { e.stopPropagation(); setShowMoreColors(!showMoreColors); }} title={showMoreColors ? "Show Less" : "Show All"}>
                                {showMoreColors ? (
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                                ) : "..."}
                            </button>
                        </div>
                        <div className="findr-cc-track">
                          <div className="findr-cc-grid colors">
                              {(showMoreColors ? COLOR_PALETTES : COLOR_PALETTES.slice(0, 6)).map((p, idx) => (
                                  <div key={p.name} className={`findr-palette-opt ${paletteIndex === idx ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setPaletteIndex(idx); }}
                                      style={{ backgroundColor: p.hex }} title={p.name} />
                              ))}
                          </div>
                        </div>
                    </div>

                    {/* --- Background Colors --- */}
                    <div className="findr-cc-group animate-3">
                        <div className="findr-cc-header">
                            <div className="findr-cc-label">BG COLORS</div>
                            <button className="findr-palette-toggle" onClick={(e) => { e.stopPropagation(); setShowMoreBgColors(!showMoreBgColors); }} title={showMoreBgColors ? "Show Less" : "Show All"}>
                                {showMoreBgColors ? (
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                                ) : "..."}
                            </button>
                        </div>
                        <div className="findr-cc-track">
                          <div className="findr-cc-grid colors">
                              <div className={`findr-palette-opt ${bgPaletteIndex === null ? 'active' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); setBgPaletteIndex(null); }}
                                  style={{ background: 'transparent', border: '1px dashed rgba(var(--sw-contrast),0.3)' }} title="Theme Default" />
                              {(showMoreBgColors ? COLOR_PALETTES : COLOR_PALETTES.slice(0, 5)).map((p, idx) => (
                                  <div key={p.name} className={`findr-palette-opt ${bgPaletteIndex === idx ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setBgPaletteIndex(idx); }}
                                      style={{ backgroundColor: p.hex }} title={p.name} />
                              ))}
                          </div>
                        </div>
                        
                        <div className="findr-cc-slider-wrap">
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                            </svg>
                            <input 
                                type="range" 
                                min="0" max="1" step="0.05"
                                value={bgOpacity}
                                onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                                className="findr-opacity-slider"
                                onMouseDown={(e) => e.stopPropagation()}
                                title="Adjust Glassmorphism Opacity"
                            />
                        </div>
                    </div>
                </>
            ) : (
                /* --- Stopwatch Records --- */
                <div className="findr-cc-group">
                    <div className="findr-cc-header">
                        <div className="findr-cc-label">RECORDS ({swRecords.length})</div>
                        <button className="findr-sw-icon-btn" style={{ opacity: 0.6 }} onClick={(e) => { e.stopPropagation(); (window as any).electronAPI?.openStopwatchFolder(); }} title="Open Recording Folder">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </button>
                    </div>
                    <div className="findr-sw-records">
                        {swRecords.length === 0 ? (
                            <div style={{ fontSize: '10px', opacity: 0.3, textAlign: 'center', padding: '10px' }}>NO RECORDS</div>
                        ) : (
                            swRecords.map((r) => (
                                <div key={r.id} className="findr-sw-record-item">
                                    <div className="findr-sw-record-info">
                                        <input 
                                            className="findr-sw-record-name" 
                                            defaultValue={r.name} 
                                            onBlur={(e) => renameRecord(r.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    (e.target as HTMLInputElement).blur();
                                                }
                                            }}
                                        />
                                        <div className="findr-sw-record-time">{r.time}</div>
                                    </div>
                                    <div className="findr-sw-record-actions">
                                        <button className="findr-sw-action-btn" title="Rename" onClick={(e) => { 
                                            const input = (e.currentTarget.closest('.findr-sw-record-item')?.querySelector('.findr-sw-record-name') as HTMLInputElement);
                                            input?.focus();
                                        }}>
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button className="findr-sw-action-btn delete" title="Delete" onClick={(e) => { e.stopPropagation(); deleteRecord(r.id); }}>
                                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            
            <div className="findr-cc-footer">RIGHT CLICK TO TOGGLE MODE</div>
        </div>
      )}
    </div>
  );
};

export default DateTimeOverlay;
