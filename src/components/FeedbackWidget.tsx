import { useState, useEffect } from 'react';
import { helpApi } from '../services/api';
import './FeedbackWidget.css';

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [workstation, setWorkstation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      initFeedback();
    } else {
      if (submitted) {
        const timer = setTimeout(() => {
          setSubmitted(false);
          setMessage('');
          setScreenshot(null);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen]);

  const initFeedback = async () => {
    try {
      if (!window.electronAPI) return;
      const ws = await window.electronAPI.getWorkstationInfo();
      setWorkstation(ws.hostname || 'SYSTEM');
    } catch (err) {
      console.error('Feedback init failed:', err);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setScreenshot(event.target?.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('workstation', workstation || 'SYSTEM');

      if (screenshot) {
        const res = await fetch(screenshot);
        const blob = await res.blob();
        formData.append('screenshot', blob, 'pasted_image.png');
      }

      await helpApi.submit(formData);

      setSubmitted(true);
      setTimeout(() => setIsOpen(false), 1500);
    } catch (err) {
      console.error('Feedback submission failed:', err);
      alert('Failed to submit feedback. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="feedback-fab" onClick={() => setIsOpen(true)} title="Help Center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
    );
  }

  return (
    <div className="feedback-modal-overlay">
      <div className="feedback-modal">
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ color: '#0099FF', fontSize: '48px', marginBottom: '20px' }}>✓</div>
            <h2 style={{ color: '#fff', marginBottom: '10px' }}>Ticket Created</h2>
            <p style={{ color: '#aaa', fontSize: '14px' }}>IT will review your request shortly.</p>
          </div>
        ) : (
          <>
            <div className="feedback-modal-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Help Center
            </div>

            <div className="feedback-form-group">
              <label className="feedback-label">Your Message</label>
              <textarea 
                className="feedback-textarea"
                placeholder="Describe the issue... (You can also paste an image here with Ctrl+V)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                autoFocus
              />
            </div>

            <div className="feedback-form-group">
              <label className="feedback-label">Attached Image (Optional)</label>
              <div className="feedback-screenshot-preview">
                {screenshot ? (
                  <>
                    <img src={screenshot} alt="Pasted" />
                    <div className="feedback-screenshot-overlay">
                      <span>IMAGE ATTACHED FROM {workstation}</span>
                      <button 
                        style={{ marginLeft: '10px', background: 'rgba(255,0,0,0.5)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '9px', padding: '2px 5px' }}
                        onClick={() => setScreenshot(null)}
                      >
                        REMOVE
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontSize: '12px', gap: '8px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Paste image (Ctrl+V) to attach</span>
                  </div>
                )}
              </div>
            </div>

            <div className="feedback-modal-actions">
              <button 
                className="feedback-btn feedback-btn-secondary" 
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                className="feedback-btn feedback-btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !message.trim()}
              >
                {isSubmitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
