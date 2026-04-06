import React, { useState, useEffect, useRef, useMemo } from 'react';
import './DateTimeOverlay.css';

/**
 * Premium, Draggable, Persistent DateTime & Stopwatch HUD.
 * Version 5.0: Upward Expansion, Stylized Theme Previews, Nested Grid for Colors.
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
  { name: 'Crystal', bg: 'rgba(255, 255, 255, 0.45)', text: '#0f172a', sub: '#64748b', border: 'rgba(255, 255, 255, 0.5)', glowOpacity: 0.1, className: 'theme-crystal' },
  { name: 'Cyber', bg: 'rgba(10, 10, 15, 0.85)', text: '#ffffff', sub: 'rgba(255, 255, 255, 0.6)', border: 'rgba(255, 255, 255, 0.1)', glowOpacity: 0.5, className: 'theme-cyber' },
  { name: 'Retro', bg: 'rgba(20, 25, 20, 0.9)', text: '#ffb000', sub: '#ffb00099', border: '#ffb00033', glowOpacity: 0.3, font: '"Courier New", monospace', className: 'theme-retro' },
  { name: 'Industrial', bg: 'rgba(40, 45, 50, 0.85)', text: '#e2e8f0', sub: '#94a3b8', border: 'rgba(255, 255, 255, 0.1)', glowOpacity: 0.2, className: 'theme-industrial' },
  { name: 'Stealth', bg: 'rgba(0, 0, 0, 0.95)', text: '#ffffff', sub: '#ffffff66', border: 'rgba(255, 255, 255, 0.05)', glowOpacity: 0.0, className: 'theme-stealth' },
  { name: 'Blueprint', bg: 'rgba(2, 22, 60, 0.9)', text: '#94a3b8', sub: '#475569', border: 'rgba(56, 189, 248, 0.2)', glowOpacity: 0.4, className: 'theme-blueprint' }
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

const STORAGE_KEY = 'kmti_clock_settings_v5';

interface SettingsV5 {
  position: { x: number; y: number }; // y is now bottom-offset
  themeIndex: number;
  paletteIndex: number;
  mode: 'clock' | 'stopwatch';
  swRunning: boolean;
  swAccumulated: number;
  swStartTime: number | null;
  expanded: boolean;
}

const DateTimeOverlay: React.FC = () => {
  const initialSettings: SettingsV5 = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return {
      position: { x: window.innerWidth / 2 - 100, y: 100 },
      themeIndex: 0,
      paletteIndex: 0,
      mode: 'clock',
      swRunning: false,
      swAccumulated: 0,
      swStartTime: null,
      expanded: false
    };
  }, []);

  const [time, setTime] = useState(new Date());
  const [position, setPosition] = useState(initialSettings.position);
  const [themeIndex, setThemeIndex] = useState(initialSettings.themeIndex);
  const [paletteIndex, setPaletteIndex] = useState(initialSettings.paletteIndex);
  const [mode, setMode] = useState<'clock' | 'stopwatch'>(initialSettings.mode);
  const [isExpanded, setIsExpanded] = useState(initialSettings.expanded);
  
  // Stopwatch state
  const [swRunning, setSwRunning] = useState(initialSettings.swRunning);
  const [swAccumulated, setSwAccumulated] = useState(initialSettings.swAccumulated);
  const [swStartTime, setSwStartTime] = useState<number | null>(initialSettings.swStartTime);
  const [swCurrent, setSwCurrent] = useState(0);

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 }); // relative to viewport
  const dragStartCoordsRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const [dragging, setDragging] = useState(false);

  // Tick for Clock & Stopwatch
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);
      
      if (swRunning && swStartTime) {
        setSwCurrent(swAccumulated + (Date.now() - swStartTime));
      } else {
        setSwCurrent(swAccumulated);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [swRunning, swStartTime, swAccumulated]);

  // Global mouse handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const newX = e.clientX - dragStartRef.current.x;
      const newY = (window.innerHeight - e.clientY) - dragStartRef.current.y;
      
      const bounds = {
        minX: 10,
        minY: 10,
        maxX: window.innerWidth - (overlayRef.current?.offsetWidth || 200) - 10,
        maxY: window.innerHeight - (overlayRef.current?.offsetHeight || 60) - 10
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

      if (dist < 5) {
        setIsExpanded(prev => !prev);
      } else {
        snapToEdge();
      }
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
    const padding = 20;
    const snapThreshold = 60;
    const width = overlayRef.current.offsetWidth;
    const height = overlayRef.current.offsetHeight;
    
    setPosition(prev => {
        const distToLeft = prev.x;
        const distToRight = window.innerWidth - (prev.x + width);
        const distToBottom = prev.y;
        const distToTop = window.innerHeight - (prev.y + height);
        
        let targetX = prev.x;
        let targetY = prev.y;
        
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
      setSwAccumulated(swCurrent);
      setSwStartTime(null);
      setSwRunning(false);
    } else {
      setSwStartTime(Date.now());
      setSwRunning(true);
    }
  };

  const resetStopwatch = () => {
    setSwRunning(false);
    setSwStartTime(null);
    setSwAccumulated(0);
    setSwCurrent(0);
  };

  const formatStopwatch = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const settings: SettingsV5 = {
      position,
      themeIndex,
      paletteIndex,
      mode,
      swRunning,
      swAccumulated,
      swStartTime,
      expanded: isExpanded
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [position, themeIndex, paletteIndex, mode, swRunning, swAccumulated, swStartTime, isExpanded]);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  
  const theme = THEMES[themeIndex];
  const accentColor = COLOR_PALETTES[paletteIndex].hex;

  return (
    <div 
      ref={overlayRef}
      className={`findr-global-datetime ${theme.className} ${dragging ? 'dragging' : ''} ${isExpanded ? 'expanded' : ''} mode-${mode}`}
      style={{ 
        left: `${position.x}px`, 
        bottom: `${position.y}px`, // Anchored to bottom
        backgroundColor: theme.bg,
        color: theme.text,
        borderColor: theme.border,
        boxShadow: theme.glowOpacity > 0 ? `0 0 20px ${accentColor}${Math.floor(theme.glowOpacity * 255).toString(16).padStart(2, '0')}, 0 20px 40px rgba(0,0,0,0.2)` : '0 20px 40px rgba(0,0,0,0.2)',
        fontFamily: theme.font || 'inherit'
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <div className="findr-datetime-content">
        {mode === 'clock' ? (
          <>
            <span className="findr-datetime-time" style={{ color: accentColor }}>{timeStr}</span>
            <div className="findr-datetime-separator" style={{ backgroundColor: accentColor, opacity: 0.3 }} />
            <span className="findr-datetime-date" style={{ color: theme.sub }}>{dateStr}</span>
          </>
        ) : (
          <div className="findr-stopwatch-container">
             <div className="findr-sw-display" style={{ color: accentColor }}>{formatStopwatch(swCurrent)}</div>
             <div className="findr-datetime-separator" style={{ backgroundColor: accentColor, opacity: 0.3 }} />
             <div className="findr-sw-controls">
                <button 
                  className="findr-sw-icon-btn"
                  onClick={(e) => { e.stopPropagation(); toggleStopwatch(); }}
                  style={{ color: accentColor }}
                >
                  {swRunning ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button 
                  className="findr-sw-icon-btn"
                  onClick={(e) => { e.stopPropagation(); resetStopwatch(); }}
                  style={{ color: accentColor }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
             </div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="findr-control-center">
            <div className="findr-cc-group">
                <div className="findr-cc-label">THEMES</div>
                <div className="findr-cc-grid themes">
                    {THEMES.map((t, idx) => (
                        <div 
                            key={t.name}
                            className={`findr-theme-opt-v2 ${themeIndex === idx ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setThemeIndex(idx); }}
                            style={{ backgroundColor: t.bg, borderColor: t.border }}
                            title={t.name}
                        >
                            <div className="findr-theme-preview" style={{ backgroundColor: t.text }} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="findr-cc-group">
                <div className="findr-cc-label">COLORS</div>
                <div className="findr-cc-grid colors">
                    {COLOR_PALETTES.map((p, idx) => (
                        <div 
                            key={p.name}
                            className={`findr-palette-opt ${paletteIndex === idx ? 'active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setPaletteIndex(idx); }}
                            style={{ backgroundColor: p.hex }}
                            title={p.name}
                        />
                    ))}
                </div>
            </div>
            
            <div className="findr-cc-footer">
                RIGHT CLICK TO TOGGLE MODE
            </div>
        </div>
      )}
    </div>
  );
};

export default DateTimeOverlay;
