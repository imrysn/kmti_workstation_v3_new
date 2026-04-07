import { useState, useEffect } from 'react';
import { helpApi } from '../services/api';
import './FeedbackWidget.css';

/**
 * Helper to convert Data URLs to Blobs for more reliable multipart/form-data uploads.
 */
function dataURLToBlob(dataURL: string): Blob {
  const [header, base64Data] = dataURL.split(';base64,');
  const contentType = header.split(':')[1];
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: contentType });
}

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showLimitError, setShowLimitError] = useState(false);
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
          setScreenshots([]);
          setShowLimitError(false);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, submitted]);

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
        // Enforce 3-image limit
        if (screenshots.length >= 3) {
          setShowLimitError(true);
          return;
        }

        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setScreenshots(prev => {
              const next = [...prev, dataUrl];
              if (next.length <= 3) setShowLimitError(false);
              return next;
            });
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length < 3) setShowLimitError(false);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!message.trim() && screenshots.length === 0) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('workstation', workstation || 'SYSTEM');

      // Append all screenshots
      for (const s of screenshots) {
        try {
          const blob = dataURLToBlob(s);
          formData.append('screenshots', blob, 'pasted_image.png');
        } catch (e) {
          console.error("Failed to convert screenshot to blob", e);
        }
      }

      await helpApi.submit(formData);

      setSubmitted(true);
      setTimeout(() => setIsOpen(false), 1500);
    } catch (err) {
      console.error('Feedback submission failed:', err);
      setShowLimitError(false);
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
      <div className="feedback-modal light-theme">
        {submitted ? (
          <div className="feedback-success-view">
            <div className="feedback-success-icon">✓</div>
            <h2>Ticket Created</h2>
            <p>IT will review your request shortly.</p>
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

            <div className="feedback-composer">
              <div className={`feedback-input-wrapper ${showLimitError ? 'has-error' : ''}`}>
                <textarea 
                  className="feedback-textarea"
                  placeholder="Describe the issue... (Ctrl+V to paste screenshot, max 3)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onPaste={handlePaste}
                  autoFocus
                />
                
                {screenshots.length > 0 && (
                  <div className="feedback-multi-previews">
                    {screenshots.map((s, idx) => (
                      <div key={idx} className="feedback-inline-preview">
                        <img 
                          src={s} 
                          alt="Attachment" 
                          className="feedback-pasted-thumb" 
                          onClick={() => setPreviewImage(s)}
                          title="Click to preview"
                        />
                        <button 
                          className="feedback-remove-pasted" 
                          onClick={() => removeScreenshot(idx)}
                          title="Remove Attachment"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {showLimitError && (
                <div className="feedback-error-msg">Maximum of 3 images allowed</div>
              )}
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
                disabled={isSubmitting || (!message.trim() && screenshots.length === 0)}
              >
                {isSubmitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="feedback-viewer-overlay" onClick={() => setPreviewImage(null)}>
          <div className="feedback-viewer-content" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Large preview" className="feedback-viewer-img" />
            <button className="feedback-viewer-close" onClick={() => setPreviewImage(null)} title="Close Preview">
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
