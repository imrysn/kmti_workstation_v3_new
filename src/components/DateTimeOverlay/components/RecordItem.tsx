import React from 'react';
import { StopwatchRecord } from '../types';

interface RecordItemProps {
  record: StopwatchRecord;
  renameRecord: (id: string, name: string) => void;
  deleteRecord: (id: string) => void;
  accentColor: string;
}

export const RecordItem: React.FC<RecordItemProps> = ({ record, renameRecord, deleteRecord, accentColor }) => {
  return (
    <div className="findr-sw-record-item">
      <div className="findr-sw-record-info">
        <input
          className="findr-sw-record-name"
          defaultValue={record.name}
          style={{ color: accentColor }}
          onBlur={(e) => renameRecord(record.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
        <div className="findr-sw-record-time" style={{ color: accentColor, opacity: 0.8 }}>{record.time}</div>
      </div>
      <div className="findr-sw-record-actions">
        <button className="findr-sw-action-btn" title="Rename" onClick={(e) => {
          const input = (e.currentTarget.closest('.findr-sw-record-item')?.querySelector('.findr-sw-record-name') as HTMLInputElement);
          input?.focus();
        }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
        <button className="findr-sw-action-btn delete" title="Delete" onClick={(e) => { e.stopPropagation(); deleteRecord(record.id); }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      </div>
    </div>
  );
};
