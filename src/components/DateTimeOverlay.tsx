import React, { useState, useEffect, useRef, useMemo } from 'react';
import './DateTimeOverlay.css';

/**
 * Premium, Draggable, Persistent DateTime & Stopwatch HUD.
 */
interface Theme {
  name: string;
  bg: string;
  text: string;
  accent: string;
  sub: string;
  border: string;
  glow?: string;
  font?: string;
}

const THEMES: Theme[] = [
  { name: 'Crystal', bg: 'rgba(255, 255, 255, 0.45)', text: '#0f172a', accent: '#0284c7', sub: '#64748b', border: 'rgba(255, 255, 255, 0.5)' },
  { name: 'Cyber', bg: 'rgba(10, 10, 15, 0.85)', text: '#00f2ff', accent: '#ff00ff', sub: 'rgba(0, 242, 255, 0.6)', border: '#00f2ff33', glow: '0 0 15px rgba(0, 242, 255, 0.3)' },
  { name: 'Retro', bg: 'rgba(20, 25, 20, 0.9)', text: '#ffb000', accent: '#ffb000', sub: '#ffb00099', border: '#ffb00033', font: '"Courier New", monospace' },
  { name: 'Industrial', bg: 'rgba(40, 45, 50, 0.85)', text: '#e2e8f0', accent: '#f59e0b', sub: '#94a3b8', border: 'rgba(255, 255, 255, 0.1)' },
  { name: 'Stealth', bg: 'rgba(0, 0, 0, 0.95)', text: '#ffffff', accent: '#ffffff', sub: '#ffffff66', border: 'rgba(255, 255, 255, 0.05)' }
];

const STORAGE_KEY = 'kmti_clock_settings';

interface Settings {
  position: { x: number; y: number };
  themeIndex: number;
  mode: 'clock' | 'stopwatch';
  swRunning: boolean;
  swAccumulated: number;
  swStartTime: number | null;
  expanded: boolean;
}

const DateTimeOverlay: React.FC = () => {
  const initialSettings: Settings = useMemo(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return {
      position: { x: window.innerWidth / 2 - 100, y: window.innerHeight - 100 },
      themeIndex: 0,
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
  const [mode, setMode] = useState<'clock' | 'stopwatch'>(initialSettings.mode);
  const [isExpanded, setIsExpanded] = useState(initialSettings.expanded);
  
  // Stopwatch state
  const [swRunning, setSwRunning] = useState(initialSettings.swRunning);
  const [swAccumulated, setSwAccumulated] = useState(initialSettings.swAccumulated);
  const [swStartTime, setSwStartTime] = useState<number | null>(initialSettings.swStartTime);
  const [swCurrent, setSwCurrent] = useState(0);

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartCoordsRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Re-sync with state for rendering (or just for triggering re-renders)
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

  // Global mouse handlers to prevent "sticking"
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      
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
      if (e.button !== 0 || !isDraggingRef.current) return;
      
      isDraggingRef.current = false;
      setDragging(false);
      
      const dist = Math.sqrt(
        Math.pow(e.clientX - dragStartCoordsRef.current.x, 2) + 
        Math.pow(e.clientY - dragStartCoordsRef.current.y, 2)
      );

      if (dist < 5) {
        setIsExpanded(prev => !prev);
      } else {
        // Snap to nearest edge
        snapToEdge();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, []); // Once on mount

  const snapToEdge = () => {
    if (!overlayRef.current) return;
    const padding = 20;
    const snapThreshold = 60;
    const width = overlayRef.current.offsetWidth;
    const height = overlayRef.current.offsetHeight;
    
    setPosition(prev => {
        const distToLeft = prev.x;
        const distToRight = window.innerWidth - (prev.x + width);
        const distToTop = prev.y;
        const distToBottom = window.innerHeight - (prev.y + height);
        
        let targetX = prev.x;
        let targetY = prev.y;
        
        if (distToLeft < snapThreshold) targetX = padding;
        else if (distToRight < snapThreshold) targetX = window.innerWidth - width - padding;
        
        if (distToTop < snapThreshold) targetY = padding;
        else if (distToBottom < snapThreshold) targetY = window.innerHeight - height - padding;

        return { x: targetX, y: targetY };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.findr-control-center')) return;
    if ((e.target as HTMLElement).closest('.findr-sw-controls')) return;
    
    // Only process left mouse button for drag/expand
    if (e.button !== 0) return;
    
    // Prevent browser drag and drop interference
    e.preventDefault();
    
    isDraggingRef.current = true;
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    dragStartCoordsRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMode(prev => prev === 'clock' ? 'stopwatch' : 'clock');
  };

  // Stopwatch controls
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

  // Persist settings
  useEffect(() => {
    const settings: Settings = {
      position,
      themeIndex,
      mode,
      swRunning,
      swAccumulated,
      swStartTime,
      expanded: isExpanded
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [position, themeIndex, mode, swRunning, swAccumulated, swStartTime, isExpanded]);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const theme = THEMES[themeIndex];

  return (
    <div 
      ref={overlayRef}
      className={`findr-global-datetime theme-${theme.name.toLowerCase()} ${dragging ? 'dragging' : ''} ${isExpanded ? 'expanded' : ''} mode-${mode}`}
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        backgroundColor: theme.bg,
        color: theme.text,
        borderColor: theme.border,
        boxShadow: theme.glow ? `${theme.glow}, 0 20px 40px rgba(0,0,0,0.2)` : '0 20px 40px rgba(0,0,0,0.2)',
        fontFamily: theme.font || 'inherit'
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <div className="findr-datetime-content">
        {mode === 'clock' ? (
          <>
            <span className="findr-datetime-time" style={{ color: theme.accent }}>{timeStr}</span>
            <div className="findr-datetime-separator" style={{ backgroundColor: theme.accent, opacity: 0.3 }} />
            <span className="findr-datetime-date" style={{ color: theme.sub }}>{dateStr}</span>
          </>
        ) : (
          <div className="findr-stopwatch-container">
             <div className="findr-sw-display" style={{ color: theme.accent }}>{formatStopwatch(swCurrent)}</div>
             <div className="findr-datetime-separator" style={{ backgroundColor: theme.accent, opacity: 0.3 }} />
             <div className="findr-sw-controls">
                <button 
                  className="findr-sw-icon-btn"
                  onClick={(e) => { e.stopPropagation(); toggleStopwatch(); }}
                  style={{ color: theme.accent }}
                  title={swRunning ? 'Pause' : 'Start'}
                >
                  {swRunning ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <button 
                  className="findr-sw-icon-btn"
                  onClick={(e) => { e.stopPropagation(); resetStopwatch(); }}
                  style={{ color: theme.accent }}
                  title="Reset"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="findr-cc-header">THEMES</div>
            <div className="findr-cc-themes">
                {THEMES.map((t, idx) => (
                    <div 
                        key={t.name}
                        className={`findr-theme-swatch ${themeIndex === idx ? 'active' : ''}`}
                        title={t.name}
                        onClick={(e) => { e.stopPropagation(); setThemeIndex(idx); }}
                        style={{ backgroundColor: t.accent, borderColor: t.text }}
                    />
                ))}
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
