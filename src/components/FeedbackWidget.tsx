import { useState, useEffect, useRef } from 'react';
import { helpApi } from '../services/api';
import './FeedbackWidget.css';

export interface TicketMsg {
  id: number;
  sender_type: string;
  sender_name: string | null;
  message: string;
  screenshot_paths: string | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  workstation: string;
  reporter_name: string | null;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages?: TicketMsg[];
}

export const SERVER_BASE = import.meta.env.DEV ? 'http://localhost:8000' : 'http://192.168.200.105:8000';

function dataURLToBlob(dataURL: string): Blob {
  const [header, base64Data] = dataURL.split(';base64,');
  const contentType = header.split(':')[1];
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

function formatDate(ds: string) {
  const d = new Date(ds);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'chat'>('list');
  const [workstation, setWorkstation] = useState('');
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  
  // Create / Reply State
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  
  const [showLimitError, setShowLimitError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (view === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view, activeTicket?.messages]);

  useEffect(() => {
    if (isOpen) {
      initApp();
    } else {
      // Reset when closed
      setView('list');
      setActiveTicket(null);
      resetForms();
    }
  }, [isOpen]);

  const initApp = async () => {
    let wsName = workstation;
    if (!wsName) {
      try {
        if (window.electronAPI) {
          const ws = await window.electronAPI.getWorkstationInfo();
          wsName = ws.hostname || 'SYSTEM';
          setWorkstation(wsName);
        }
      } catch (e) {
        console.error(e);
        wsName = 'SYSTEM';
        setWorkstation(wsName);
      }
    }
    loadTickets(wsName);
  };

  const loadTickets = async (wsName: string) => {
    try {
      setIsLoading(true);
      const res = await helpApi.getTickets(wsName);
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTicketDetails = async (id: number) => {
    try {
      setIsLoading(true);
      const res = await helpApi.getTicketDetails(id);
      setActiveTicket(res.data);
      setView('chat');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForms = () => {
    setSubject('');
    setMessage('');
    setScreenshots([]);
    setShowLimitError(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
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

  const handleCreateSubmit = async () => {
    if (!subject.trim() || (!message.trim() && screenshots.length === 0)) return;
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('message', message);
      formData.append('workstation', workstation);
      if (reporterName) formData.append('reporter_name', reporterName);

      for (const s of screenshots) {
        try {
          const blob = dataURLToBlob(s);
          formData.append('screenshots', blob, 'pasted_image.png');
        } catch (e) {
          console.error(e);
        }
      }

      await helpApi.createTicket(formData);
      resetForms();
      await loadTickets(workstation);
      setView('list');
    } catch (err) {
      console.error(err);
      alert('Failed to submit ticket.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!activeTicket || (!message.trim() && screenshots.length === 0)) return;
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', message);
      if (reporterName) formData.append('sender_name', reporterName);

      for (const s of screenshots) {
        try {
          const blob = dataURLToBlob(s);
          formData.append('screenshots', blob, 'pasted_image.png');
        } catch (e) {
          console.error(e);
        }
      }

      await helpApi.reply(activeTicket.id, formData);
      resetForms();
      await loadTicketDetails(activeTicket.id); // Reload chat
    } catch (err) {
      console.error(err);
      alert('Failed to send reply.');
    } finally {
      setIsLoading(false);
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
        <div className="feedback-modal-header">
          <div className="feedback-modal-title">
            {view === 'list' && (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Help Center
              </>
            )}
            {(view === 'create' || view === 'chat') && (
              <button className="feedback-back-btn" onClick={() => { setView('list'); loadTickets(workstation); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back
              </button>
            )}
          </div>
          <button className="feedback-close-modal" onClick={() => setIsOpen(false)}>×</button>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="feedback-list-view">
            <button className="feedback-btn feedback-btn-primary w-full shadow-md" onClick={() => setView('create')}>
              + Create New Ticket
            </button>
            <div className="feedback-tickets-container">
              {isLoading && tickets.length === 0 ? (
                <div className="feedback-empty">Loading tickets...</div>
              ) : tickets.length === 0 ? (
                <div className="feedback-empty">No active tickets for {workstation}</div>
              ) : (
                tickets.map(t => (
                  <div key={t.id} className="feedback-ticket-card" onClick={() => loadTicketDetails(t.id)}>
                    <div className="ticket-card-header">
                      <span className="ticket-card-subject">{t.subject || 'No Subject'}</span>
                      <span className={`ticket-status badge-${t.status === 'open' ? 'danger' : t.status === 'in_progress' ? 'warning' : 'success'}`}>
                        {t.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="ticket-card-meta">
                      <span>#TK-{t.id}</span>
                      <span>•</span>
                      <span>Last updated: {formatDate(t.updated_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CREATE TICKET VIEW */}
        {view === 'create' && (
          <div className="feedback-create-view">
            <div className="form-row">
              <input type="text" className="feedback-input" placeholder="Your Name (Optional)" value={reporterName} onChange={e => setReporterName(e.target.value)} />
            </div>
            <div className="form-row">
              <input type="text" className="feedback-input" placeholder="Issue Subject (e.g., Printer not working)" value={subject} onChange={e => setSubject(e.target.value)} autoFocus />
            </div>
            <div className={`feedback-input-wrapper ${showLimitError ? 'has-error' : ''}`}>
              <textarea 
                className="feedback-textarea" placeholder="Describe the issue in detail... (Ctrl+V to attach up to 3 images)" 
                value={message} onChange={e => setMessage(e.target.value)} onPaste={handlePaste}
              />
              {screenshots.length > 0 && (
                <div className="feedback-multi-previews">
                  {screenshots.map((s, idx) => (
                    <div key={idx} className="feedback-inline-preview">
                      <img src={s} alt="Attachment" className="feedback-pasted-thumb" onClick={() => setPreviewImage(s)} />
                      <button className="feedback-remove-pasted" onClick={() => setScreenshots(prev => prev.filter((_, i) => i !== idx))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {showLimitError && <div className="feedback-error-msg">Maximum of 3 images allowed</div>}
            
            <div className="feedback-modal-actions mt-4">
              <button className="feedback-btn feedback-btn-primary" onClick={handleCreateSubmit} disabled={isLoading || !subject.trim()}>
                {isLoading ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        )}

        {/* CHAT VIEW */}
        {view === 'chat' && activeTicket && (
          <div className="feedback-chat-view">
            <div className="chat-header">
              <div className="chat-title">Ticket #TK-{activeTicket.id}: {activeTicket.subject}</div>
              <div className={`chat-status badge-${activeTicket.status === 'open' ? 'danger' : activeTicket.status === 'in_progress' ? 'warning' : 'success'}`}>
                {activeTicket.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
            
            <div className="chat-history">
              {activeTicket.messages?.map(msg => {
                const isMe = msg.sender_type === 'user';
                const paths = msg.screenshot_paths ? msg.screenshot_paths.split(',') : [];
                return (
                  <div key={msg.id} className={`chat-bubble-wrapper ${isMe ? 'is-me' : 'is-them'}`}>
                    {!isMe && <div className="chat-sender-name">{msg.sender_name || 'IT Support'}</div>}
                    {isMe && <div className="chat-sender-name">{msg.sender_name || 'You'}</div>}
                    
                    <div className="chat-bubble">
                      {msg.message && <div className="chat-text">{msg.message}</div>}
                      {paths.length > 0 && (
                        <div className="chat-attachments">
                          {paths.map((p, idx) => (
                            <img key={idx} src={`${SERVER_BASE}${p}`} alt="Attachment" className="chat-attachment-img" onClick={() => setPreviewImage(`${SERVER_BASE}${p}`)} />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="chat-timestamp">{formatDate(msg.created_at)}</div>
                  </div>
                );
              })}
              {isLoading && <div className="chat-loading">Sending...</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-composer">
               <div className={`feedback-input-wrapper ${showLimitError ? 'has-error' : ''}`} style={{ marginBottom: 0, padding: '8px 12px' }}>
                <textarea 
                  className="feedback-textarea" placeholder="Type a reply... (Ctrl+V to attach)" style={{ minHeight: '60px' }}
                  value={message} onChange={e => setMessage(e.target.value)} onPaste={handlePaste}
                />
                {screenshots.length > 0 && (
                  <div className="feedback-multi-previews">
                    {screenshots.map((s, idx) => (
                      <div key={idx} className="feedback-inline-preview">
                        <img src={s} alt="Attachment" className="feedback-pasted-thumb" onClick={() => setPreviewImage(s)} />
                        <button className="feedback-remove-pasted" onClick={() => setScreenshots(prev => prev.filter((_, i) => i !== idx))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="feedback-btn feedback-btn-primary chat-send-btn" onClick={handleReplySubmit} disabled={isLoading || (!message.trim() && screenshots.length === 0)}>
                Send
              </button>
            </div>
            {showLimitError && <div className="feedback-error-msg">Maximum of 3 images allowed</div>}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="feedback-viewer-overlay" onClick={() => setPreviewImage(null)}>
          <div className="feedback-viewer-content" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Large preview" className="feedback-viewer-img" />
            <button className="feedback-viewer-close" onClick={() => setPreviewImage(null)} title="Close Preview">×</button>
          </div>
        </div>
      )}
    </div>
  );
}
