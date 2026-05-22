import React, { useState, useEffect, useRef } from 'react';
import { useModal } from '../ModalContext';

export const PromptModal: React.FC = () => {
  const { promptState, closePrompt } = useModal();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset value and focus input whenever the modal opens
  useEffect(() => {
    if (promptState.isOpen) {
      setValue(promptState.defaultValue ?? '');
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [promptState.isOpen, promptState.defaultValue]);

  // Global ESC handler
  useEffect(() => {
    if (!promptState.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePrompt();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [promptState.isOpen, closePrompt]);

  if (!promptState.isOpen) return null;

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    promptState.onConfirm(trimmed);
    closePrompt();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
  };

  return (
    <div className="modal-overlay" onClick={closePrompt}>
      <div className="modal-container info" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{promptState.title ?? 'Input Required'}</h3>
        </div>
        <div className="modal-body">
          {promptState.message && (
            <p>{promptState.message}</p>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={promptState.placeholder ?? ''}
          />
        </div>
        <div className="modal-footer">
          <button className="btn-modal btn-modal-secondary" onClick={closePrompt}>Cancel</button>
          <button
            className="btn-modal btn-modal-primary"
            onClick={handleConfirm}
            disabled={!value.trim()}
          >
            {promptState.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
