import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useDateTimeSettings } from './hooks/useDateTimeSettings';
import { useStopwatch } from './hooks/useStopwatch';
import { useDragging } from './hooks/useDragging';
import { GalacticCanvas } from './components/GalacticCanvas';
import { ClockDisplay } from './components/ClockDisplay';
import { StopwatchDisplay } from './components/StopwatchDisplay';
import { ControlCenter } from './components/ControlCenter';
import StopwatchLibraryModal from './components/StopwatchLibraryModal';
import { COLOR_PALETTES, STORAGE_KEY } from './constants';
import { SettingsV6 } from './types';
import './DateTimeOverlay.css'; // Path will be updated if we move the CSS

/**
 * Premium, Draggable, Persistent DateTime & Stopwatch HUD.
 * Modular Version.
 */
const DateTimeOverlay: React.FC = () => {
  const settings = useDateTimeSettings();
  const stopwatch = useStopwatch(settings); // Note: we should pass initialSettings carefully
  
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [dragging, setDragging] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { handleMouseDown } = useDragging(
    settings.position,
    settings.setPosition,
    settings.setIsExpanded,
    setDragging,
    overlayRef
  );

  // Sync stopwatch state back to persistence
  useEffect(() => {
    const data: SettingsV6 = {
      position: settings.position,
      themeIndex: settings.themeIndex,
      paletteIndex: settings.paletteIndex,
      bgPaletteIndex: settings.bgPaletteIndex,
      bgOpacity: settings.bgOpacity,
      mode: settings.mode,
      swRunning: stopwatch.swRunning,
      swAccumulated: stopwatch.swAccumulated,
      swStartTime: stopwatch.swStartTime,
      expanded: settings.isExpanded
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [settings, stopwatch.swRunning, stopwatch.swAccumulated, stopwatch.swStartTime]);

  // Keep overlay in bounds when window is resized
  useEffect(() => {
    const handleResize = () => {
      if (!overlayRef.current) return;
      
      const padding = 15;
      const width = overlayRef.current.offsetWidth;
      const height = overlayRef.current.offsetHeight;

      settings.setPosition(prev => {
        const maxX = window.innerWidth - width - padding;
        const maxY = window.innerHeight - height - padding;
        
        let newX = Math.max(padding, Math.min(prev.x, maxX));
        let newY = Math.max(padding, Math.min(prev.y, maxY));
        
        // If nothing changed, return prev to avoid unnecessary re-renders
        if (newX === prev.x && newY === prev.y) return prev;
        
        return { x: newX, y: newY };
      });
    };

    window.addEventListener('resize', handleResize);
    // Initial check in case it's already out of bounds on mount (e.g. state loaded from larger screen)
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, [settings.setPosition, settings.isExpanded]); // Re-run when expanded/collapsed as dimensions change

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    settings.setMode(prev => prev === 'clock' ? 'stopwatch' : 'clock');
  };

  const accentColor = COLOR_PALETTES[settings.paletteIndex]?.hex || COLOR_PALETTES[0].hex;

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

    let baseColor = settings.theme.bg;
    let isLight = false;

    if (settings.bgPaletteIndex !== null) {
      baseColor = COLOR_PALETTES[settings.bgPaletteIndex].hex;
      const rgb = hexToRgbStr(baseColor).split(',');
      const yiq = ((parseInt(rgb[0]) * 299) + (parseInt(rgb[1]) * 587) + (parseInt(rgb[2]) * 114)) / 1000;
      isLight = yiq >= 128;
    } else {
      const rgb = hexToRgbStr(baseColor).split(',');
      if (rgb.length === 3 && !Number.isNaN(parseInt(rgb[0]))) {
        const yiq = ((parseInt(rgb[0]) * 299) + (parseInt(rgb[1]) * 587) + (parseInt(rgb[2]) * 114)) / 1000;
        isLight = yiq >= 128;
      } else {
        isLight = settings.theme.name === 'Crystal' || settings.theme.name === 'Brutalism';
      }
    }

    if (settings.theme.className === 'theme-galactic') {
      return {
        bg: settings.bgPaletteIndex !== null ? `rgba(${hexToRgbStr(COLOR_PALETTES[settings.bgPaletteIndex].hex)}, ${settings.bgOpacity})` : settings.theme.bg,
        text: '#ffffff',
        sub: 'rgba(255, 255, 255, 0.6)',
        border: 'rgba(255, 120, 30, 0.4)',
        isLight: false,
        contrastRgb: '255, 255, 255'
      };
    }

    return {
      bg: `rgba(${hexToRgbStr(baseColor)}, ${settings.bgOpacity})`,
      text: isLight ? '#0f172a' : '#ffffff',
      sub: isLight ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.6)',
      border: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
      contrastRgb: isLight ? '0, 0, 0' : '255, 255, 255'
    };
  }, [settings.bgPaletteIndex, settings.theme, settings.bgOpacity]);

  const isInactive = !settings.isExpanded && (Date.now() - lastActivity > 30000);
  const isTopHalf = useMemo(() => settings.position.y > window.innerHeight / 2, [settings.position.y]);
  const clockHeight = 44;

  return (
    <div
      ref={overlayRef}
      className={`findr-global-datetime ${settings.theme.className} ${dragging ? 'dragging' : ''} ${settings.isExpanded ? 'expanded' : ''} ${isInactive ? 'inactive' : ''} mode-${settings.mode} ${isTopHalf ? 'expand-down' : 'expand-up'}`}
      style={{
        left: `${settings.position.x}px`,
        bottom: isTopHalf ? 'auto' : `${settings.position.y}px`,
        top: isTopHalf ? `${window.innerHeight - settings.position.y - clockHeight}px` : 'auto',
        backgroundColor: activeColors.bg, color: activeColors.text, borderColor: activeColors.border,
        boxShadow: settings.theme.glowOpacity > 0 ? `0 0 20px ${accentColor}${Math.floor(settings.theme.glowOpacity * 255).toString(16).padStart(2, '0')}, 0 20px 40px rgba(0,0,0,0.2)` : '0 20px 40px rgba(0,0,0,0.2)',
        fontFamily: settings.theme.font || 'inherit',
        '--sw-contrast': activeColors.contrastRgb
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setLastActivity(Date.now())}
      onMouseMove={() => setLastActivity(Date.now())}
    >
      {/* Black hole canvas background */}
      {settings.theme.className === 'theme-galactic' && (
        <GalacticCanvas
          theme={settings.theme}
          overlayRef={overlayRef}
          isInactive={isInactive}
        />
      )}

      {/* Control Center Interior */}
      <div className="findr-datetime-content">
        {settings.mode === 'clock' ? (
          <ClockDisplay accentColor={accentColor} />
        ) : (
          <StopwatchDisplay
            swCurrent={stopwatch.swCurrent}
            swRunning={stopwatch.swRunning}
            accentColor={accentColor}
            formatStopwatch={stopwatch.formatStopwatch}
            toggleStopwatch={stopwatch.toggleStopwatch}
            saveRecord={stopwatch.saveRecord}
            resetStopwatch={stopwatch.resetStopwatch}
          />
        )}
      </div>

      {settings.isExpanded && (
        <ControlCenter
          mode={settings.mode}
          safeThemeIndex={settings.safeThemeIndex}
          paletteIndex={settings.paletteIndex}
          bgPaletteIndex={settings.bgPaletteIndex}
          bgOpacity={settings.bgOpacity}
          swRecords={stopwatch.swRecords}
          setThemeIndex={settings.setThemeIndex}
          setPaletteIndex={settings.setPaletteIndex}
          setBgPaletteIndex={settings.setBgPaletteIndex}
          setBgOpacity={settings.setBgOpacity}
          renameRecord={stopwatch.renameRecord}
          deleteRecord={stopwatch.deleteRecord}
          onOpenLibrary={() => setShowLibrary(true)}
          accentColor={accentColor}
        />
      )}

      {showLibrary && (
        <StopwatchLibraryModal 
          onClose={() => setShowLibrary(false)} 
          accentColor={accentColor}
          themeClass={settings.theme.className}
          activeColors={activeColors}
        />
      )}
    </div>
  );
};

export default DateTimeOverlay;
