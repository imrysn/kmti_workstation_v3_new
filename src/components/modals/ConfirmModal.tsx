import React from 'react';
import { useModal } from '../ModalContext';

export const ConfirmModal: React.FC = () => {
  const { confirmationState, closeConfirmation } = useModal();

  if (!confirmationState.isOpen) return null;

  const isDanger = confirmationState.type === 'danger';
  const modalClass = isDanger ? 'danger' : 'info';

  return (
    <div className="modal-overlay" onClick={closeConfirmation}>
      <div className={`modal-container ${modalClass}`} onClick={(e) => e.stopPropagation()}>
        
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
