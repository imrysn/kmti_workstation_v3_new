import { useState, useEffect, useRef } from 'react'
import { helpApi, SERVER_BASE } from '../services/api'
import type { Ticket } from '../components/FeedbackWidget'
import ReactMarkdown from 'react-markdown'
import { useModal } from '../components/ModalContext'
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
  const [showResolved, setShowResolved] = useState(false)
  
  const { confirm, alert, notify } = useModal()
  
  const chatEndRef = useRef<HTMLDivElement>(null)

  // MACRO / AUTOCOMPLETE STATE
  const [macroOverlay, setMacroOverlay] = useState({ active: false, filter: '', replaceStart: 0, replaceEnd: 0 })
  const [macroIndex, setMacroIndex] = useState(0)

  // MACROS / CANNED RESPONSES
  const MACROS: Record<string, string> = {
    '/restart': 'Please restart your PC and the main kiosk software. Let us know if the issue persists after rebooting.',
    '/network': 'We are currently experiencing a known network outage. The IT team is investigating. Thanks for your patience.',
    '/ticket': 'We have escalated this issue to a higher tier. A technician will physically inspect your workstation shortly.',
    '/resolved': 'I am glad we could get this sorted out for you! I will now mark this ticket as resolved. Feel free to open a new ticket if you need further assistance.',
    '/screenshot': 'Could you please attach a screenshot showing the exact error message or behavior you are seeing? This will help us diagnose the issue faster.',
    '/investigating': 'Thanks for reporting this. We are currently looking into the issue and will get back to you with an update shortly.',
    '/printer': 'Please check if the physical printer is turned on and loaded with paper. If it still does not print, let us know and we can restart the print spooler remotely.',
    '/brb': 'I need to consult with a senior engineer regarding this exception. Please bear with me, I will be right back with an update.'
  };

  const handleComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let text = e.target.value;
    
    // Auto-expand if the user types the macro immediately followed by a space
    for (const [trigger, macroText] of Object.entries(MACROS)) {
      if (text.endsWith(`${trigger} `) || text.endsWith(`${trigger}\n`)) {
        const lastChar = text.slice(-1);
        text = text.slice(0, -trigger.length - 1) + macroText + lastChar;
      }
    }
    setReplyMessage(text);
    
    // Check for popup menu autocomplete
    const cursor = e.target.selectionStart;
    const textBefore = text.slice(0, cursor);
    const match = textBefore.match(/(?:^|\s)(\/[^\s]*)$/);
    if (match) {
      setMacroOverlay({ 
        active: true, 
        filter: match[1].toLowerCase(), 
        replaceStart: cursor - match[1].length, 
        replaceEnd: cursor 
      });
      setMacroIndex(0);
    } else {
      setMacroOverlay(prev => prev.active ? { ...prev, active: false } : prev);
    }
  }

  const availableMacros = Object.entries(MACROS)
    .filter(([trigger]) => trigger.toLowerCase().startsWith(macroOverlay.filter));

  const applyMacro = (_trigger: string, macroText: string) => {
    const text = replyMessage;
    const newText = text.substring(0, macroOverlay.replaceStart) + macroText + " " + text.substring(macroOverlay.replaceEnd);
    setReplyMessage(newText);
    setMacroOverlay(prev => ({ ...prev, active: false }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (macroOverlay.active && availableMacros.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMacroIndex(prev => (prev + 1) % availableMacros.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMacroIndex(prev => (prev - 1 + availableMacros.length) % availableMacros.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMacro(availableMacros[macroIndex][0], availableMacros[macroIndex][1]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMacroOverlay(prev => ({ ...prev, active: false }));
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  }

  useEffect(() => {
    fetchTickets()
    // Poll every 30 seconds for new tickets & unread counts
    const timer = setInterval(() => {
      fetchTickets(false)
    }, 30000)
    
    // Disregard global padding to make the workspace full-bleed vertically, but maintain horizontal padding to avoid clipping floating widgets
    const appContent = document.querySelector('.app-content') as HTMLElement;
    if (appContent) {
      appContent.style.padding = '0 100px';
    }

    return () => {
      clearInterval(timer)
      if (appContent) {
        appContent.style.padding = '';
      }
    }
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
      
      const rawTickets = res.data as Ticket[];
      const urgencyRank: Record<string, number> = {
        'critical': 4,
        'high': 3,
        'medium': 2,
        'low': 1
      };
      
      const sortedTickets = rawTickets.sort((a, b) => {
        if (a.status === 'resolved' && b.status !== 'resolved') return 1;
        if (a.status !== 'resolved' && b.status === 'resolved') return -1;
        
        const rankA = urgencyRank[a.urgency] || 0;
        const rankB = urgencyRank[b.urgency] || 0;
        
        if (rankA !== rankB) {
          return rankB - rankA;
        }
        
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setTickets(sortedTickets)
      
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
    let finalMessage = replyMessage;
    // Catch cases where the user clicked Send without pressing space
    if (MACROS[finalMessage.trim()]) {
      finalMessage = MACROS[finalMessage.trim()];
    }

    if (!finalMessage.trim() || !activeId) return
    setIsReplying(true)
    try {
      const formData = new FormData()
      formData.append('message', finalMessage)
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

  const handleDeleteTicket = async () => {
    if (!activeId) return
    
    confirm(
      `Are you sure you want to delete ticket #${activeId}? This action cannot be undone.`,
      async () => {
        try {
          await helpApi.deleteTicket(activeId)
          setActiveId(null)
          setActiveTicket(null)
          fetchTickets() // Refresh the queue to silently clear it
          notify(`Ticket #${activeId} was successfully deleted`, 'success')
        } catch (err) {
          console.error('Failed to delete ticket', err)
          alert("Failed to delete ticket. See console for details.", "Deletion Failed")
        }
      },
      undefined,
      "danger"
    )
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

  const activeTickets = tickets.filter(t => t.status !== 'resolved')
  const resolvedTickets = tickets.filter(t => t.status === 'resolved')

  const renderTicket = (t: Ticket) => (
    <div 
      key={t.id} 
      className={`ah-queue-item ${activeId === t.id ? 'active' : ''}`}
      onClick={() => handleSelectTicket(t.id)}
    >
      {t.has_unread_admin && <div className="ah-unread-dot" title="Unread Message"></div>}
      {t.status === 'resolved' ? (
        <div className="ah-queue-urgency-badge urgency-status-resolved">
          RESOLVED
        </div>
      ) : (
        <div className={`ah-queue-urgency-badge urgency-${t.urgency}`}>
          {t.urgency.toUpperCase()}
        </div>
      )}
      <div className="ah-queue-meta">
        <span className="ah-queue-id">#{t.id}</span>
        <span className={`ah-status-dot ${t.status}`}></span>
        <span className="ah-queue-ws">{t.workstation}</span>
        <span className="ah-queue-time">{formatRelative(t.updated_at)}</span>
      </div>
      <div className="ah-queue-subject">{t.subject || 'No Subject'}</div>
      {t.reporter_name && <div className="ah-queue-reporter">from {t.reporter_name}</div>}
    </div>
  )

  return (
    <div className="admin-help-wrapper">
      <div className="ah-layout">
        
        {/* LEFT COMPONENT: TICKET QUEUE */}
        <div className="ah-sidebar">
          <div className="ah-sidebar-header">
            <h2>Ticket Inbox</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="ah-refresh-btn" 
                onClick={handleDeleteTicket} 
                title={activeId ? `Delete Ticket #${activeId}` : "Select a ticket to delete"}
                disabled={!activeId}
                style={{ opacity: activeId ? 1 : 0.4, color: activeId ? '#ef4444' : undefined }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>
                </svg>
              </button>
              <button className="ah-refresh-btn" onClick={() => fetchTickets()} title="Refresh Inbox">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.8l4.25 4.23"/>
                </svg>
              </button>
            </div>
          </div>
          <div className="ah-sidebar-list">
            {isLoading && tickets.length === 0 ? (
              <div className="ah-empty">Loading tickets...</div>
            ) : tickets.length === 0 ? (
              <div className="ah-empty">No active tickets.</div>
            ) : (
              <>
                {activeTickets.map(renderTicket)}

                {resolvedTickets.length > 0 && (
                  <div className="ah-resolved-divider" onClick={() => setShowResolved(!showResolved)}>
                    <span>Resolved Tickets ({resolvedTickets.length})</span>
                    <span className="ah-dropdown-icon">{showResolved ? '▲' : '▼'}</span>
                  </div>
                )}

                {showResolved && resolvedTickets.map(renderTicket)}
              </>
            )}
          </div>
        </div>

        {/* RIGHT COMPONENT: CHAT WORKSPACE */}
        <div className="ah-workspace">
          {activeTicket ? (
            <>
              {/* Workspace Header */}
              <div className={`ah-workspace-header ${activeTicket.status === 'resolved' ? 'bg-status-resolved' : `bg-urgency-${activeTicket.urgency}`}`}>
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
              <div className="ah-composer" style={{ position: 'relative' }}>
                {macroOverlay.active && availableMacros.length > 0 && (
                  <div className="ah-macro-popup">
                    {availableMacros.map(([trigger, macroText], idx) => (
                      <div 
                        key={trigger} 
                        className={`ah-macro-item ${idx === macroIndex ? 'selected' : ''}`}
                        onClick={() => applyMacro(trigger, macroText)}
                        title={macroText}
                      >
                        <strong>{trigger}</strong>
                      </div>
                    ))}
                  </div>
                )}
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
                    placeholder={isInternal ? "Type an internal note (Users cannot see this)..." : "Type a reply to the user... (Tip: type / to open command menu)"}
                    value={replyMessage}
                    onChange={handleComposerChange}
                    onKeyDown={handleKeyDown}
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
