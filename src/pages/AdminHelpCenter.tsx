import { useState, useEffect, useRef } from 'react'
import { helpApi, SERVER_BASE } from '../services/api'
import type { Ticket } from '../components/FeedbackWidget'
import ReactMarkdown from 'react-markdown'
import './AdminHelpCenter.css'

export default function AdminHelpCenter() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [activeId, setActiveId] = useState<number | null>(null)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const [replyMessage, setReplyMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  // MACROS / CANNED RESPONSES
  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let text = e.target.value;
    if (text.endsWith('/restart ')) {
      text = text.replace('/restart ', 'Please restart your PC and the main kiosk software. Let us know if the issue persists after rebooting.');
    } else if (text.endsWith('/network ')) {
      text = text.replace('/network ', 'We are currently experiencing a known network outage. The IT team is investigating. Thanks for your patience.');
    } else if (text.endsWith('/ticket ')) {
       text = text.replace('/ticket ', 'We have escalated this issue to a higher tier. A technician will physically inspect your workstation shortly.');
    }
    setReplyMessage(text);
  }

  useEffect(() => {
    fetchTickets()
    // Poll every 30 seconds for new tickets & unread counts
    const timer = setInterval(() => {
      fetchTickets(false)
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({behavior: 'smooth'})
    }
  }, [activeTicket?.messages])

  const fetchTickets = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const res = await helpApi.getTickets()
      setTickets(res.data)
      
      // If we have an active ticket, and we just refreshed, we should ideally fetch its details to see if someone else replied, 
      // but to optimize we could just rely on manual refresh. We'll do a quick silent fetch if active.
      if (activeId) {
        const tReq = await helpApi.getTicketDetails(activeId)
        setActiveTicket(tReq.data)
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectTicket = async (id: number) => {
    setActiveId(id)
    try {
      const res = await helpApi.getTicketDetails(id)
      setActiveTicket(res.data)
      // Visual clearance of unread
      setTickets(prev => prev.map(t => t.id === id ? { ...t, has_unread_admin: false } : t))
    } catch (err) {
      console.error(err)
    }
  }

  const handleReply = async () => {
    if (!replyMessage.trim() || !activeId) return
    setIsReplying(true)
    try {
      const formData = new FormData()
      formData.append('message', replyMessage)
      formData.append('is_internal', isInternal ? "true" : "false")
      
      await helpApi.reply(activeId, formData)
      setReplyMessage('')
      
      // Reload ticket specifics
      const res = await helpApi.getTicketDetails(activeId)
      setActiveTicket(res.data)
      fetchTickets(false)
      
    } catch (err) {
      console.error('Reply failed:', err)
    } finally {
      setIsReplying(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!activeId) return
    try {
      await helpApi.updateStatus(activeId, newStatus)
      if (activeTicket) {
        setActiveTicket({ ...activeTicket, status: newStatus })
      }
      fetchTickets(false)
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  // Formatting helpers
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
    })
  }

  const formatRelative = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000) 
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${diff}m ago`
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`
    return `${Math.floor(diff/1440)}d ago`
  }

  return (
    <div className="admin-help-wrapper">
      <div className="ah-layout">
        
        {/* LEFT COMPONENT: TICKET QUEUE */}
        <div className="ah-sidebar">
          <div className="ah-sidebar-header">
            <h2>Ticket Inbox</h2>
            <button className="ah-refresh-btn" onClick={() => fetchTickets()} title="Refresh Inbox">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
          </div>
          <div className="ah-sidebar-list">
            {isLoading && tickets.length === 0 ? (
              <div className="ah-empty">Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="ah-empty">No active tickets.</div>
            ) : (
              tickets.map(t => (
                <div 
                  key={t.id} 
                  className={`ah-queue-item ${activeId === t.id ? 'active' : ''}`}
                  onClick={() => handleSelectTicket(t.id)}
                >
                  {t.has_unread_admin && <div className="ah-unread-dot" title="Unread Message"></div>}
                  <div className={`ah-queue-urgency-badge urgency-${t.urgency}`}>
                    {t.urgency.toUpperCase()}
                  </div>
                  <div className="ah-queue-meta">
                    <span className="ah-queue-id">#{t.id}</span>
                    <span className={`ah-status-dot ${t.status}`}></span>
                    <span className="ah-queue-ws">{t.workstation}</span>
                    <span className="ah-queue-time">{formatRelative(t.updated_at)}</span>
                  </div>
                  <div className="ah-queue-subject">{t.subject || 'No Subject'}</div>
                  {t.reporter_name && <div className="ah-queue-reporter">from {t.reporter_name}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COMPONENT: CHAT WORKSPACE */}
        <div className="ah-workspace">
          {activeTicket ? (
            <>
              {/* Workspace Header */}
              <div className={`ah-workspace-header bg-urgency-${activeTicket.urgency}`}>
                <div>
                  <div className="ah-ws-title">
                    #{activeTicket.id}: {activeTicket.subject || 'No Subject'}
                    <span className={`ah-badge ${activeTicket.status}`}>{activeTicket.status.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <div className="ah-ws-subtitle">
                    Reported by <strong>{activeTicket.reporter_name || 'Workstation User'}</strong> 
                    from workstation <strong>{activeTicket.workstation}</strong>
                    
                    {/* Telemetry Data */}
                    {(activeTicket.sys_ram || activeTicket.sys_res) && (
                      <span className="ah-device-badge" title={activeTicket.sys_app || undefined}>
                        {activeTicket.sys_ram && `${activeTicket.sys_ram} RAM `} 
                        {activeTicket.sys_res && `| ${activeTicket.sys_res}`}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="ah-ws-actions">
                  {activeTicket.status !== 'resolved' ? (
                     <button className="ah-btn ah-btn-success" onClick={() => handleStatusChange('resolved')}>
                       Mark Resolved
                     </button>
                  ) : (
                    <button className="ah-btn ah-btn-outline" onClick={() => handleStatusChange('open')}>
                      Reopen Ticket
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Thread */}
              <div className="ah-chat-thread">
                {activeTicket.messages?.map(msg => {
                  const isIt = msg.sender_type !== 'user'
                  // @ts-ignore - is_internal comes from new backend schema
                  const isWhisper = msg.is_internal;
                  const paths = msg.screenshot_paths ? msg.screenshot_paths.split(',') : []
                  return (
                    <div key={msg.id} className={`ah-bubble-wrapper ${isIt ? 'is-it' : 'is-user'} ${isWhisper ? 'is-internal' : ''}`}>
                      <div className="ah-sender">
                        {isWhisper && '🤫 Internal Note • '}{msg.sender_name || (isIt ? 'IT Support' : 'User')} • {formatDate(msg.created_at)}
                      </div>
                      <div className="ah-bubble">
                        <ReactMarkdown>{msg.message}</ReactMarkdown>
                        {paths.length > 0 && (
                          <div className="ah-attachments">
                            {paths.map(p => (
                              <img 
                                key={p} 
                                src={`${SERVER_BASE}${p}`} 
                                alt="Attachment" 
                                className="ah-attachment-img" 
                                onClick={() => setPreviewImage(`${SERVER_BASE}${p}`)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Composer */}
              <div className="ah-composer">
                <div className="ah-composer-actions">
                   <label className="ah-toggle-wrapper">
                      Public Reply
                      <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                      <div className="ah-toggle-switch"></div>
                      Whisper (Internal)
                   </label>
                </div>
                <div className="ah-composer-row">
                  <textarea 
                    className={`ah-composer-input ${isInternal ? 'internal-mode' : ''}`}
                    placeholder={isInternal ? "Type an internal note (Users cannot see this)..." : "Type a reply to the user... (Tip: type /restart for quick macro)"}
                    value={replyMessage}
                    onChange={handleComposerChange}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <button 
                    className={`ah-send-btn ${isInternal ? 'internal-mode' : ''}`}
                    disabled={!replyMessage.trim() || isReplying}
                    onClick={handleReply}
                    title={isInternal ? "Save Internal Note" : "Send Reply"}
                  >
                    {isReplying ? '...' : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="ah-no-selection">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <h3>Select a ticket</h3>
              <p>Choose a ticket from the inbox to view the conversation</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="ah-viewer-overlay" onClick={() => setPreviewImage(null)}>
          <div className="ah-viewer-content" onClick={e => e.stopPropagation()}>
            <img src={previewImage} alt="Large preview" className="ah-viewer-img" />
            <button className="ah-viewer-close" onClick={() => setPreviewImage(null)} title="Close Preview">×</button>
          </div>
        </div>
      )}
    </div>
  )
}
