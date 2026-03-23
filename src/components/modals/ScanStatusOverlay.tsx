import React from 'react';
import { useModal } from '../ModalContext';
import { RefreshIcon } from '../FileIcons';

const ScanStatusOverlay: React.FC = () => {
  const { progressState } = useModal();

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
        <p className="scan-status-subtitle">You can continue working while we sync.</p>
      </div>
    </div>
  );
};

export default ScanStatusOverlay;
