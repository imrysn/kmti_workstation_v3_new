import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { stopwatchApi } from '../../../services/api';
import { StopwatchRecord } from '../types';
import './StopwatchLibraryModal.css';

interface Props {
  onClose: () => void;
  accentColor: string;
  themeClass: string;
  activeColors: {
    bg: string;
    text: string;
    sub: string;
    border: string;
    contrastRgb: string;
    isLight?: boolean;
  };
}

export default function StopwatchLibraryModal({ onClose, accentColor, themeClass, activeColors }: Props) {
  const [records, setRecords] = useState<StopwatchRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [myWorkstation, setMyWorkstation] = useState<string | undefined>(undefined);
  const [myUsername, setMyUsername] = useState<string | undefined>(undefined);

  const fetchRecords = useCallback(async (workstation?: string, user_name?: string) => {
    const ws = workstation || myWorkstation;
    const un = user_name || myUsername;
    
    if (!ws) return;
    setLoading(true);
    try {
      const res = await stopwatchApi.list(ws, un, 100);
      setRecords(res || []);
    } catch (e) {
      console.error('[sw-library] Failed to fetch records:', e);
    } finally {
      setLoading(false);
    }
  }, [myWorkstation, myUsername]);

  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron?.getWorkstationInfo) {
      electron.getWorkstationInfo().then((info: any) => {
        if (info?.computerName) {
          setMyWorkstation(info.computerName);
          setMyUsername(info.username || undefined);
          fetchRecords(info.computerName, info.username);
        }
      });
    }
  }, [fetchRecords]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this stopwatch record?')) return;
    
    try {
      await stopwatchApi.delete(id);
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('[sw-library] Deletion failed:', err);
    }
  };

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return records.filter(r => 
      r.name.toLowerCase().includes(s) || 
      (r.workstation || '').toLowerCase().includes(s)
    );
  }, [records, search]);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const modalStyle = {
    '--accent-color': accentColor,
    '--bg': activeColors.bg,
    '--text': activeColors.text,
    '--sub': activeColors.sub,
    '--border': activeColors.border,
    '--contrast-rgb': activeColors.contrastRgb
  } as React.CSSProperties;

  return createPortal(
    <div className={`sw-library-overlay ${themeClass}`} onClick={onClose}>
      <div className="sw-library-modal" onClick={e => e.stopPropagation()} style={modalStyle}>
        <header className="sw-library-header">
          <div className="sw-library-header-main">
            <h2>Stopwatch Recording Library</h2>
            <p>View and manage all recorded stopwatch sessions</p>
          </div>
          <button className="sw-library-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="sw-library-toolbar">
          <div className="sw-library-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or workstation..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <button className="sw-library-close" style={{ opacity: 0.6 }} onClick={() => fetchRecords()} title="Refresh Library">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>

        <div className="sw-library-content">
          {loading ? (
            <div className="sw-library-loading">
              <div className="spinner"></div>
              <p>Loading records...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sw-library-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" />
              </svg>
              <p>No records found.</p>
            </div>
          ) : (
            <table className="sw-library-table">
              <thead>
                <tr>
                  <th>Record Name</th>
                  <th>Duration</th>
                  <th>Workstation</th>
                  <th>Recorded At</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="record-name-cell">{r.name}</td>
                    <td className="record-time-cell">{r.time}</td>
                    <td><span className="workstation-badge">{r.workstation || 'Legacy'}</span></td>
                    <td style={{ opacity: 0.5, fontSize: '12px' }}>{formatDate(r.timestamp)}</td>
                    <td>
                      <button 
                        className="btn-delete-record"
                        onClick={() => handleDelete(r.id)}
                        title="Delete Record"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="sw-library-footer">
          <span>Showing {filtered.length} records</span>
          {myWorkstation && <span>Current: {myWorkstation}</span>}
        </footer>
      </div>
    </div>,
    document.body
  );
}
