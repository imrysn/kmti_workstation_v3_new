import React, { useEffect, useState, useRef } from 'react';
import { useModal } from '../ModalContext';
import { RefreshIcon } from '../FileIcons';

interface ScanStatus {
  isScanning: boolean;
  filesIndexed: number;
  message: string;
}

// projectId is passed in when a scan starts so the overlay can subscribe to the SSE stream.
// ModalContext stores it alongside the progress state.
const ScanStatusOverlay: React.FC = () => {
  const { progressState, hideProgress } = useModal();
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!progressState.isOpen) {
      // Clean up SSE connection when progress is dismissed
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setStatus(null);
      return;
    }

    const projectId = (progressState as any).projectId as number | undefined;
    if (!projectId) return;

    // Open SSE stream for this project
    const es = new EventSource(`http://127.0.0.1:8000/api/parts/projects/${projectId}/scan-status`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: ScanStatus = JSON.parse(event.data);
        setStatus(data);
        // When scan finishes, the backend sends isScanning=false as the last event.
        // We let the parent polling handle the final UI refresh — just close the stream here.
        if (!data.isScanning) {
          es.close();
          esRef.current = null;
        }
      } catch {
        // Malformed event — ignore
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [progressState.isOpen, (progressState as any).projectId]);

  if (!progressState.isOpen) return null;

  return (
    <div className="scan-status-overlay">
      <div className="scan-status-content">
        <div className="scan-status-header">
          <RefreshIcon size={18} className="spinning" color="var(--accent)" />
          <span className="scan-status-title">{progressState.message || 'Indexing...'}</span>
        </div>
        <div className="scan-status-progress">
          <div className="scan-status-bar-indeterminate"></div>
        </div>
        {status ? (
          <p className="scan-status-subtitle">{status.message}</p>
        ) : (
          <p className="scan-status-subtitle">You can continue working while we sync.</p>
        )}
      </div>
    </div>
  );
};

export default ScanStatusOverlay;
