import React from 'react';
import { useModal } from '../ModalContext';

export const AlertModal: React.FC = () => {
  const { alertState, closeAlert } = useModal();

  if (!alertState.isOpen) return null;

  return (
    <div className="modal-overlay" onClick={closeAlert}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{alertState.title}</h3>
          <button onClick={closeAlert} style={{fontSize: '20px', color: 'var(--text-muted)'}}>&times;</button>
        </div>
        <div className="modal-body">
          {alertState.message}
        </div>
        <div className="modal-footer">
          <button className="btn-modal btn-modal-primary" onClick={closeAlert}>OK</button>
        </div>
      </div>
    </div>
  );
};
