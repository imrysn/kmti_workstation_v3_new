import React, { useEffect, useState, useRef } from 'react';
import { useModal } from '../ModalContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { RefreshIcon } from '../FileIcons';
import './ScanStatusOverlay.css';

interface ScanStatus {
  isScanning: boolean;
  filesIndexed: number;
  filesSeen?: number;
  message: string;
}

// projectId is passed in when a scan starts so the overlay can subscribe to the SSE stream.
// ModalContext stores it alongside the progress state.
const ScanStatusOverlay: React.FC = () => {
  const { progressState, hideProgress } = useModal();
  const { user } = useAuth();
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!progressState.isOpen) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setStatus(null);
      setIsMinimized(false);
      return;
    }

    const projectId = (progressState as any).projectId as number | undefined;
    if (!projectId) return;

    const es = new EventSource(`http://192.168.200.105:8000/api/parts/projects/${projectId}/scan-status`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ScanStatus = JSON.parse(event.data);
        setStatus(data);
        if (!data.isScanning) {
          es.close();
          esRef.current = null;
          // Auto-dismiss after 1.5s; store ref so it can be cleared on unmount
          timerRef.current = setTimeout(() => {
            hideProgress();
          }, 1500);
        }
      } catch { }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [progressState.isOpen, (progressState as any).projectId]);

  if (!progressState.isOpen || user?.role === 'user') return null;

  return (
    <div 
      className={`scan-status-overlay ${isMinimized ? 'minimized' : ''}`}
      onClick={() => isMinimized && setIsMinimized(false)}
    >
      <div className="scan-status-content">
        <div className="scan-status-header">
          <RefreshIcon size={isMinimized ? 14 : 18} className="spinning" color="var(--accent)" />
          <span className="scan-status-title">
            {isMinimized 
              ? (status ? `Syncing: ${(status.filesSeen && status.filesSeen > status.filesIndexed ? status.filesSeen : status.filesIndexed).toLocaleString()}` : 'Syncing...') 
              : (progressState.message || 'Indexing...')}
          </span>
        </div>
        
        {!isMinimized && (
          <>
            <div className="scan-status-progress">
              <div className="scan-status-bar-indeterminate"></div>
            </div>
            {status ? (
              <p className="scan-status-subtitle">{status.message}</p>
            ) : (
              <p className="scan-status-subtitle">Syncing metadata with NAS. This ensures all workstation indexes are up-to-date.</p>
            )}
            <div className="scan-status-actions">
              <button 
                className="btn-scan-stop" 
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const projectId = (progressState as any).projectId;
                    if (projectId) {
                      await api.post(`/parts/projects/${projectId}/scan/stop`);
                      hideProgress();
                    }
                  } catch (err) {
                    console.error("Failed to stop scan", err);
                  }
                }}
              >
                Stop
              </button>
              <button 
                className="btn-scan-background" 
                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
              >
                Run in Background
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ScanStatusOverlay;
