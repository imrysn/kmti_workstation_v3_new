import { useState, useEffect, useRef, useCallback } from 'react';
import { helpApi } from '../services/api';
import helpCenterIcon from '../assets/help-center-icon.png';
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
  category: string;
  urgency: string;
  sys_ram: string | null;
  sys_res: string | null;
  sys_app: string | null;
  has_unread_user: boolean;
  has_unread_admin: boolean;
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

function urgencyClass(urgency: string) {
  switch (urgency) {
    case 'critical': return 'priority-badge priority-critical';
    case 'high':     return 'priority-badge priority-high';
    case 'medium':   return 'priority-badge priority-medium';
    default:         return 'priority-badge priority-low';
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'open':        return 'status-badge status-open';
    case 'in_progress': return 'status-badge status-in-progress';
    case 'resolved':    return 'status-badge status-resolved';
    default:            return 'status-badge';
  }
}

const formatRelative = (ds: string) => {
  const d = new Date(ds);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'chat'>('list');
  const [workstation, setWorkstation] = useState('');
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  
  // Unread Polling State
  const [unreadCount, setUnreadCount] = useState(0);

  // Create State
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [category, setCategory] = useState('General');
  const [urgency, setUrgency] = useState('low');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  
  const [showLimitError, setShowLimitError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Resize state
  const MIN_W = 320, MAX_W = 800, MIN_H = 300, MAX_H = 900;
  const [panelSize, setPanelSize] = useState({ w: 440, h: 560 });
  const resizeRef = useRef<{ edge: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent, edge: string) => {
    e.preventDefault();
    resizeRef.current = { edge, startX: e.clientX, startY: e.clientY, startW: panelSize.w, startH: panelSize.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const { edge, startX, startY, startW, startH } = resizeRef.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setPanelSize(prev => {
        let w = prev.w, h = prev.h;
        if (edge.includes('left'))  w = Math.min(MAX_W, Math.max(MIN_W, startW - dx));
        if (edge.includes('top'))   h = Math.min(MAX_H, Math.max(MIN_H, startH - dy));
        if (edge.includes('right')) w = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
        return { w, h };
      });
    };

    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [panelSize]);

  // Global polling for unread notifications
  useEffect(() => {
    const checkUnread = async () => {
      let wsName = workstation;
      if (!wsName) {
        if (window.electronAPI) {
          try {
            const ws = await window.electronAPI.getWorkstationInfo();
            wsName = ws.hostname || 'SYSTEM';
          } catch (e) {
            wsName = 'SYSTEM';
          }
        } else {
          wsName = 'SYSTEM';
        }
      }
      
      try {
        const res = await helpApi.getUnreadCount(wsName);
        if (res.data.unread_count > unreadCount) {
          if (Notification.permission === 'granted') {
             new Notification('IT Support Update', {
               body: 'You have a new message from IT Support regarding your ticket.',
             });
          } else if (Notification.permission !== 'denied') {
             Notification.requestPermission();
          }
        }
        setUnreadCount(res.data.unread_count);
      } catch (e) {
        // fail silently
      }
    };

    const poller = setInterval(checkUnread, 30000);
    checkUnread();
    return () => clearInterval(poller);
  }, [workstation, unreadCount]);

  useEffect(() => {
    if (view === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view, activeTicket?.messages]);

  useEffect(() => {
    if (isOpen) {
      initApp();
      // If we open, we visually are clearing the badge if we view the ticket, but unread logic handles it on fetch.
    } else {
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
      // Auto-refresh unread badge by recalculating from tickets
      const newUnread = res.data.filter((t: Ticket) => t.has_unread_user).length;
      setUnreadCount(newUnread);
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
      // Opening details naturally clears its unread state, refresh inbox in bg
      loadTickets(workstation);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForms = () => {
    setSubject('');
    setMessage('');
    setCategory('General');
    setUrgency('low');
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
      formData.append('category', category);
      formData.append('urgency', urgency);
      formData.append('workstation', workstation);
      if (reporterName) formData.append('reporter_name', reporterName);

      // Telemetry: System Memory, Resolution, App
      // @ts-ignore
      const ram = navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown';
      const res = `${window.innerWidth}x${window.innerHeight}`;
      const appVer = navigator.userAgent;
      formData.append('sys_ram', ram);
      formData.append('sys_res', res);
      formData.append('sys_app', appVer);

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
      setMessage('');
      setScreenshots([]);
      await loadTicketDetails(activeTicket.id); 
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
        {unreadCount > 0 && <span className="feedback-fab-badge">{unreadCount}</span>}
        <img src={helpCenterIcon} alt="Help" className="feedback-fab-img" />
      </div>
    );
  }

  return (
    <div className="feedback-panel-wrapper">
      <div
        ref={panelRef}
        className="feedback-panel light-theme"
        style={{ width: panelSize.w, height: panelSize.h, display: 'flex', flexDirection: 'column' }}
      >
        {/* Resize handles */}
        <div className="resize-handle resize-handle--top"    onMouseDown={e => onResizeMouseDown(e, 'top')} />
        <div className="resize-handle resize-handle--left"   onMouseDown={e => onResizeMouseDown(e, 'left')} />
        <div className="resize-handle resize-handle--right"  onMouseDown={e => onResizeMouseDown(e, 'right')} />
        <div className="resize-handle resize-handle--top-left"  onMouseDown={e => onResizeMouseDown(e, 'top-left')} />
        <div className="resize-handle resize-handle--top-right" onMouseDown={e => onResizeMouseDown(e, 'top-right')} />
        <div className="feedback-modal-header">
          <div className="feedback-modal-title">
            {view === 'list' && (
              <>
                <img src={helpCenterIcon} alt="Icon" className="feedback-header-img" />
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
          <button className="feedback-close-modal" onClick={() => setIsOpen(false)} title="Minimize">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
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
                      <span className="ticket-card-subject">
                        {t.subject || 'No Subject'}
                        {t.has_unread_user && <span className="ticket-unread-dot" title="New Message"></span>}
                      </span>
                      <span className={statusClass(t.status)}>
                        {t.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="ticket-card-meta">
                      <span className={urgencyClass(t.urgency)}>
                        #{t.id} • {t.urgency.toUpperCase()}
                      </span>
                      <span>•</span>
                      <span>{t.category}</span>
                      <span>•</span>
                      <span>{formatRelative(t.updated_at)}</span>
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
            <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
              <input type="text" className="feedback-input" placeholder="Your Name (Optional)" value={reporterName} onChange={e => setReporterName(e.target.value)} style={{flex: 1}} />
            </div>
            
            <div className="form-row" style={{ display: 'flex', gap: '12px' }}>
              <select className="feedback-input" value={category} onChange={e => setCategory(e.target.value)} style={{flex: 1}}>
                <option value="General">General Support</option>
                <option value="Bug">Software Bug</option>
                <option value="Hardware">Hardware Issue</option>
                <option value="Request">Feature Request</option>
              </select>
              <select className="feedback-input" value={urgency} onChange={e => setUrgency(e.target.value)} style={{flex: 1}}>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical</option>
              </select>
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
          <div className="feedback-chat-view" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="chat-header">
              <div className="chat-title">Ticket #{activeTicket.id}: {activeTicket.subject}</div>
              <div className={statusClass(activeTicket.status)}>
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
                    
                    {msg.message && (
                      <div className="chat-bubble">
                        <div className="chat-text" style={{whiteSpace: 'pre-wrap'}}>{msg.message}</div>
                      </div>
                    )}
                    {paths.length > 0 && (
                      <div className="chat-attachments">
                        {paths.map((p, idx) => (
                          <img key={idx} src={`${SERVER_BASE}${p}`} alt="Attachment" className="chat-attachment-img" onClick={() => setPreviewImage(`${SERVER_BASE}${p}`)} />
                        ))}
                      </div>
                    )}
                    <div className="chat-timestamp">{formatRelative(msg.created_at)}</div>
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

      {/* FAB trigger */}
      <div className="feedback-fab feedback-fab--inline" onClick={() => setIsOpen(false)} title="Minimize Help Center">
        {unreadCount > 0 && <span className="feedback-fab-badge">{unreadCount}</span>}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
