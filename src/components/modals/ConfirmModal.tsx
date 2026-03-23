import React from 'react';
import { useModal } from '../ModalContext';

export const ConfirmModal: React.FC = () => {
  const { confirmationState, closeConfirmation } = useModal();

  if (!confirmationState.isOpen) return null;

  const confirmBtnClass = confirmationState.type === 'danger' ? 'btn-modal-danger' : 'btn-modal-primary';

  return (
    <div className="modal-overlay">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirm Action</h3>
        </div>
        <div className="modal-body">
          {confirmationState.message}
        </div>
        <div className="modal-footer">
          <button className="btn-modal btn-modal-secondary" onClick={closeConfirmation}>Cancel</button>
          <button className={`btn-modal ${confirmBtnClass}`} onClick={confirmationState.onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
};
