import React from 'react';

interface StopwatchDisplayProps {
  swCurrent: number;
  swRunning: boolean;
  accentColor: string;
  formatStopwatch: (ms: number) => string;
  toggleStopwatch: () => void;
  saveRecord: () => void;
  resetStopwatch: () => void;
}

export const StopwatchDisplay: React.FC<StopwatchDisplayProps> = ({
  swCurrent,
  swRunning,
  accentColor,
  formatStopwatch,
  toggleStopwatch,
  saveRecord,
  resetStopwatch
}) => {
  return (
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
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" /></svg>
        </button>
        <button className="findr-sw-icon-btn" onClick={(e) => { e.stopPropagation(); resetStopwatch(); }} style={{ color: accentColor }} title="Reset">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
          </svg>
        </button>
      </div>
    </div>
  );
};
