import React from 'react';
import { useModal } from '../ModalContext';

export const ConfirmModal: React.FC = () => {
  const { confirmationState, closeConfirmation } = useModal();

  if (!confirmationState.isOpen) return null;

  const isDanger = confirmationState.type === 'danger';
  const modalClass = isDanger ? 'danger' : 'info';

  const renderIcon = () => {
    if (isDanger) {
      return (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    }
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  };

  return (
    <div className="modal-overlay" onClick={closeConfirmation}>
      <div className={`modal-container ${modalClass}`} onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-icon-header">
          <div className={`modal-icon-circle ${modalClass}`}>
            {renderIcon()}
          </div>
        </div>

        <div className="modal-header">
          <h3>{confirmationState.title || 'Confirm Action'}</h3>
        </div>
        
        <div className="modal-body">
          <p>{confirmationState.message}</p>
        </div>
        
        <div className="modal-footer">
          <button className="btn-modal btn-modal-secondary" onClick={closeConfirmation}>
            Cancel
          </button>
          <button 
            className={`btn-modal ${isDanger ? 'btn-modal-danger' : 'btn-modal-primary'}`} 
            onClick={() => {
              confirmationState.onConfirm();
              closeConfirmation();
            }}
          >
            {confirmationState.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
