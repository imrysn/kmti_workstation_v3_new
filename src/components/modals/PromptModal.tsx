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

  if (!promptState.isOpen) return null;

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    promptState.onConfirm(trimmed);
    closePrompt();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') closePrompt();
  };

  return (
    <div className="modal-overlay" onClick={closePrompt}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{promptState.title ?? 'Input Required'}</h3>
        </div>
        <div className="modal-body">
          {promptState.message && (
            <p style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              {promptState.message}
            </p>
          )}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={promptState.placeholder ?? ''}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
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
