import React from 'react';
import { useModal } from '../ModalContext';

export const AlertModal: React.FC = () => {
  const { alertState, closeAlert } = useModal();

  if (!alertState.isOpen) return null;

  const isRestricted = alertState.type === 'restricted';
  const isWarning = alertState.type === 'warning';
  
  const modalClass = isRestricted ? 'danger' : isWarning ? 'warning' : 'info';

  const renderIcon = () => {
    if (isRestricted) {
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    }
    if (isWarning) {
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    }
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    );
  };

  return (
    <div className="modal-overlay" onClick={closeAlert}>
      <div 
        className={`modal-container ${modalClass}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon-header">
          <div className={`modal-icon-circle ${modalClass}`}>
            {renderIcon()}
          </div>
        </div>

        <div className="modal-header">
          <h3>{alertState.title}</h3>
        </div>

        <div className="modal-body">
          <p>{alertState.message}</p>
          
          {isRestricted && (
            <div className="restricted-warning-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Requested action requires elevated Administrator privileges.
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className={`btn-modal ${isRestricted ? 'btn-modal-danger' : 'btn-modal-primary'}`} 
            onClick={closeAlert}
          >
            {isRestricted ? 'Dismiss' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
