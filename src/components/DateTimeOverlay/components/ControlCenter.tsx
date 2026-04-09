import React, { useState } from 'react';
import { THEMES, COLOR_PALETTES } from '../constants';
import { StopwatchRecord } from '../types';
import { RecordItem } from './RecordItem';

interface ControlCenterProps {
  mode: 'clock' | 'stopwatch';
  safeThemeIndex: number;
  paletteIndex: number;
  bgPaletteIndex: number | null;
  bgOpacity: number;
  swRecords: StopwatchRecord[];
  setThemeIndex: (idx: number) => void;
  setPaletteIndex: (idx: number) => void;
  setBgPaletteIndex: (idx: number | null) => void;
  setBgOpacity: (val: number) => void;
  renameRecord: (id: string, name: string) => void;
  deleteRecord: (id: string) => void;
}

export const ControlCenter: React.FC<ControlCenterProps> = ({
  mode,
  safeThemeIndex,
  paletteIndex,
  bgPaletteIndex,
  bgOpacity,
  swRecords,
  setThemeIndex,
  setPaletteIndex,
  setBgPaletteIndex,
  setBgOpacity,
  renameRecord,
  deleteRecord
}) => {
  const [showMoreThemes, setShowMoreThemes] = useState(false);
  const [showMoreColors, setShowMoreColors] = useState(false);
  const [showMoreBgColors, setShowMoreBgColors] = useState(false);

  return (
    <div className="findr-control-center">
      {mode === 'clock' ? (
        <>
          <div className="findr-cc-group animate-1">
            <div className="findr-cc-header">
              <div className="findr-cc-label">THEMES</div>
              <button className="findr-palette-toggle" onClick={(e) => { e.stopPropagation(); setShowMoreThemes(!showMoreThemes); }} title={showMoreThemes ? "Show Less" : "Show All"}>
                {showMoreThemes ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
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
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
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
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
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
        /* --- Stopwatch Records --- */
        <div className="findr-cc-group">
          <div className="findr-cc-header">
            <div className="findr-cc-label">RECORDS ({swRecords.length})</div>
            <button className="findr-sw-icon-btn" style={{ opacity: 0.6 }} onClick={(e) => { e.stopPropagation(); (window as any).electronAPI?.openStopwatchFolder(); }} title="Open Recording Folder">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
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
