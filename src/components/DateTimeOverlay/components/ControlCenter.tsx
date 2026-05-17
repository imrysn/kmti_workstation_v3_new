import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { THEMES } from '../constants';
import { StopwatchRecord } from '../types';
import { RecordItem } from './RecordItem';

interface ControlCenterProps {
  mode: 'clock' | 'stopwatch';
  safeThemeIndex: number;
  accentColor: string;
  accentColorValue: string;
  bgColor: string | null;
  bgOpacity: number;
  swRecords: StopwatchRecord[];
  setThemeIndex: (idx: number) => void;
  setAccentColor: (val: string) => void;
  setBgColor: (val: string | null) => void;
  setBgOpacity: (val: number) => void;
  renameRecord: (id: string, name: string) => void;
  deleteRecord: (id: string) => void;
  onOpenLibrary: () => void;
}

/** Small popover color wheel that closes when clicking outside */
const ColorWheelPopover: React.FC<{
  color: string;
  onChange: (hex: string) => void;
  label: string;
  canReset?: boolean;
  onReset?: () => void;
}> = ({ color, onChange, label, canReset, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="findr-cc-wheel-wrap" ref={ref} onMouseDown={(e) => e.stopPropagation()}>
      <div className="findr-cc-wheel-row">
        {/* Swatch button — click to open/close wheel */}
        <button
          className={`findr-cc-wheel-swatch ${open ? 'open' : ''}`}
          style={{ background: color }}
          onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
          title={`${label}: ${color.toUpperCase()}`}
        />
        <span className="findr-cc-color-hex">{color.toUpperCase()}</span>
        {canReset && (
          <button
            className="findr-cc-bg-reset"
            onClick={(e) => { e.stopPropagation(); onReset?.(); setOpen(false); }}
            title="Reset to theme default"
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="findr-cc-wheel-popover" onMouseDown={(e) => e.stopPropagation()}>
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  );
};

export const ControlCenter: React.FC<ControlCenterProps> = ({
  mode,
  safeThemeIndex,
  accentColor,
  accentColorValue,
  bgColor,
  bgOpacity,
  swRecords,
  setThemeIndex,
  setAccentColor,
  setBgColor,
  setBgOpacity,
  renameRecord,
  deleteRecord,
  onOpenLibrary,
}) => {
  const [showMoreThemes, setShowMoreThemes] = useState(false);

  return (
    <div className="findr-control-center">
      {mode === 'clock' ? (
        <>
          {/* ── Themes ── */}
          <div className="findr-cc-group animate-1">
            <div className="findr-cc-header">
              <div className="findr-cc-label">THEMES</div>
              <button
                className="findr-palette-toggle"
                onClick={(e) => { e.stopPropagation(); setShowMoreThemes(!showMoreThemes); }}
                title={showMoreThemes ? 'Show Less' : 'Show All'}
              >
                {showMoreThemes ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                ) : '...'}
              </button>
            </div>
            <div className="findr-cc-track">
              <div className="findr-cc-grid themes" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, width: 'fit-content' }}>
                {(showMoreThemes ? THEMES : THEMES.slice(0, 5)).map((t, idx) => (
                  <div
                    key={t.name}
                    className={`findr-theme-opt-v2 ${safeThemeIndex === idx ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setThemeIndex(idx); }}
                    style={{ backgroundColor: t.bg, borderColor: t.border }}
                    title={t.name}
                  >
                    <div className="findr-theme-preview" style={{ backgroundColor: t.text }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Text Color Wheel ── */}
          <div className="findr-cc-group animate-2">
            <div className="findr-cc-header">
              <div className="findr-cc-label">TEXT COLOR</div>
            </div>
            <ColorWheelPopover
              color={accentColorValue}
              onChange={setAccentColor}
              label="Text Color"
            />
          </div>

          {/* ── BG Color Wheel ── */}
          <div className="findr-cc-group animate-3">
            <div className="findr-cc-header">
              <div className="findr-cc-label">BG COLOR</div>
            </div>
            <ColorWheelPopover
              color={bgColor || '#1e293b'}
              onChange={setBgColor}
              label="BG Color"
              canReset
              onReset={() => setBgColor(null)}
            />

            {/* Opacity slider */}
            <div className="findr-cc-slider-wrap" style={{ marginTop: 8 }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
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
        /* ── Stopwatch Records ── */
        <div className="findr-cc-group">
          <div className="findr-cc-header">
            <div className="findr-cc-label">RECORDS ({swRecords.length})</div>
            <button className="findr-sw-icon-btn" style={{ opacity: 0.6 }} onClick={(e) => { e.stopPropagation(); onOpenLibrary(); }} title="Open Stopwatch Library">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </button>
          </div>
          <div className="findr-sw-records">
            {swRecords.length === 0 ? (
              <div style={{ fontSize: '10px', opacity: 0.3, textAlign: 'center', padding: '10px' }}>NO RECORDS</div>
            ) : (
              swRecords.map((r) => (
                <RecordItem
                  key={r.id}
                  record={r}
                  renameRecord={renameRecord}
                  deleteRecord={deleteRecord}
                  accentColor={accentColor}
                />
              ))
            )}
          </div>
        </div>
      )}

      <div className="findr-cc-footer">RIGHT CLICK TO TOGGLE MODE</div>
    </div>
  );
};
