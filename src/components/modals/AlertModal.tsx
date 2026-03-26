import React from 'react';
import { useModal } from '../ModalContext';
import { StatusIcon } from '../FileIcons';

export const AlertModal: React.FC = () => {
  const { alertState, closeAlert } = useModal();

  if (!alertState.isOpen) return null;

  const isRestricted = alertState.type === 'restricted';
  const isWarning = alertState.type === 'warning';
  
  const modalClass = isRestricted ? 'danger' : isWarning ? 'warning' : 'info';
  const iconType = isRestricted ? 'error' : isWarning ? 'warning' : 'info';

  return (
    <div className="modal-overlay" onClick={closeAlert}>
      <div 
        className={`modal-container ${modalClass}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon-header">
          <div className={`modal-icon-circle ${modalClass}`}>
            <StatusIcon type={iconType} size={32} />
          </div>
        </div>

        <div className="modal-header">
          <h3>{alertState.title}</h3>
        </div>

        <div className="modal-body">
          <p>{alertState.message}</p>
          
          {isRestricted && (
            <div style={{ 
              marginTop: 20, 
              padding: '12px', 
              background: '#fff1f2', 
              borderRadius: '8px',
              fontSize: '12px', 
              color: '#991b1b',
              border: '1px solid #fecaca',
              fontWeight: 600
            }}>
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
