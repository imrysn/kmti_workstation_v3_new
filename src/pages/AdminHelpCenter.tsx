import { useState, useEffect, useRef, useMemo } from 'react'
import { helpApi, telemetryApi, SERVER_BASE } from '../services/api'
import type { Ticket } from '../components/FeedbackWidget'
import ReactMarkdown from 'react-markdown'
import { useModal } from '../components/ModalContext'
import { 
  BarChart, Bar, XAxis, YAxis, Cell, 
  ResponsiveContainer, Tooltip 
} from 'recharts'
import './AdminHelpCenter.css'

function dataURLToBlob(dataURL: string): Blob {
  const [header, base64Data] = dataURL.split(';base64,');
  const contentType = header.split(':')[1];
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

interface WorkstationStatus {
  ip_address: string;
  active_module: string;
  current_user: string;
  version: string;
  last_ping: string;
}

export default function AdminHelpCenter() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeWorkstations, setActiveWorkstations] = useState<WorkstationStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'analytics' | 'terminals'>('analytics')

  const [activeId, setActiveId] = useState<number | null>(null)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const [replyMessage, setReplyMessage] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [screenshots, setScreenshots] = useState<string[]>([])
  const [showLimitError, setShowLimitError] = useState(false)

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

  const fetchWorkstations = async () => {
    try {
      const res = await telemetryApi.getStatuses()
      setActiveWorkstations(res.data)
    } catch (err) {
      console.error('Failed to fetch workstation statuses:', err)
    }
  }

  useEffect(() => {
    fetchTickets()
    fetchWorkstations()
    // Poll every 15 seconds for live telemetry & new tickets
    const timer = setInterval(() => {
      fetchTickets(false)
      fetchWorkstations()
    }, 15000)

    return () => {
      clearInterval(timer)
    }
  }, [activeId])

  // Optimized Analytics Calculations
  const stats = useMemo(() => {
    const open = tickets.filter(t => t.status !== 'resolved').length;
    const resolved = tickets.filter(t => t.status === 'resolved').length;
    
    // Urgency distribution for horizontal chart
    const urgencies = [
      { name: 'Critical', key: 'critical', color: '#ef4444' },
      { name: 'High',     key: 'high',     color: '#f97316' },
      { name: 'Medium',   key: 'medium',   color: '#fbbf24' },
      { name: 'Low',      key: 'low',      color: '#3b82f6' }
    ];
    
    const chartData = urgencies.map(u => ({
      name: u.name,
      value: tickets.filter(t => t.urgency === u.key).length,
      fill: u.color
    }));

    // Category distribution
    const categories = ['General', 'Bug', 'Hardware', 'Request'];
    const categoryData = categories.map(c => ({
      name: c,
      value: tickets.filter(t => t.category === c).length,
      fill: '#06b6d4' // Cyan/Teal
    }));

    // Top Workstations (Top 5)
    const wsMap: Record<string, number> = {};
    tickets.forEach(t => {
      wsMap[t.workstation] = (wsMap[t.workstation] || 0) + 1;
    });
    const workstationData = Object.entries(wsMap)
      .map(([name, value]) => ({ name, value, fill: '#8b5cf6' })) // Purple
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { open, resolved, chartData, categoryData, workstationData };
  }, [tickets]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeTicket?.messages])

  const fetchTickets = async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const res = await helpApi.getTickets()

      const rawTickets = res as Ticket[];
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
        setActiveTicket(tReq)
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
      setActiveTicket(res)
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
      formData.append('is_support', "true")

      for (const s of screenshots) {
        try {
          const blob = dataURLToBlob(s);
          formData.append('screenshots', blob, 'pasted_image.png');
        } catch (e) {
          console.error(e);
        }
      }

      await helpApi.reply(activeId, formData)
      setReplyMessage('')
      setScreenshots([])

      // Reload ticket specifics
      const res = await helpApi.getTicketDetails(activeId)
      setActiveTicket(res)
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
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return `${Math.floor(diff / 1440)}d ago`
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
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                </svg>
              </button>
              <button className="ah-refresh-btn" onClick={() => fetchTickets()} title="Refresh Inbox">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.8l4.25 4.23" />
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
                        {isWhisper && '🤫 '}{msg.sender_name || (isIt ? 'IT Support' : 'User')} • {formatDate(msg.created_at)}
                      </div>
                      {msg.message && (
                        <div className="ah-bubble">
                          <ReactMarkdown>{msg.message}</ReactMarkdown>
                        </div>
                      )}
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
                  <div className={`ah-input-container ${isInternal ? 'internal-mode' : ''}`}>
                    <textarea
                      className="ah-composer-input"
                      placeholder={isInternal ? "Type an internal note (Users cannot see this)..." : "Type a reply to the user... (Tip: type / to open command menu)"}
                      value={replyMessage}
                      onChange={handleComposerChange}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                    />
                    {screenshots.length > 0 && (
                      <div className="ah-multi-previews">
                        {screenshots.map((s, idx) => (
                          <div key={idx} className="ah-inline-preview">
                            <img src={s} alt="Attachment" className="ah-pasted-thumb" onClick={() => setPreviewImage(s)} />
                            <button className="ah-remove-pasted" onClick={() => setScreenshots(prev => prev.filter((_, i) => i !== idx))}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {showLimitError && <div className="ah-error-msg">Maximum of 3 images allowed</div>}
                  </div>
                  <button
                    className={`ah-send-btn ${isInternal ? 'internal-mode' : ''}`}
                    disabled={!replyMessage.trim() || isReplying}
                    onClick={handleReply}
                    title={isInternal ? "Save Internal Note" : "Send Reply"}
                  >
                    {isReplying ? '...' : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="ah-no-selection">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
              <h3>Select a ticket</h3>
              <p>Choose a ticket from the inbox to view the conversation</p>
            </div>
          )}
        </div>

        {/* RIGHT COMPONENT: SUPPORT ANALYTICS & TELEMETRY */}
        <div className="ah-info-sidebar">
          <div className="ah-info-header-tabs">
            <button 
              className={`ah-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button 
              className={`ah-tab-btn ${activeTab === 'terminals' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminals')}
            >
              Terminals ({activeWorkstations.length})
            </button>
          </div>
          
          <div className="ah-analytics-content">
            {activeTab === 'analytics' ? (
              <>
                {/* 1. Global Stats Cards */}
                <div className="ah-stats-grid">
                  <div className="ah-stat-card open">
                    <span className="ah-stat-value">{stats.open}</span>
                    <span className="ah-stat-label">OPEN</span>
                  </div>
                  <div className="ah-stat-card resolved">
                    <span className="ah-stat-value">{stats.resolved}</span>
                    <span className="ah-stat-label">FIXED</span>
                  </div>
                </div>

                {/* 2. Recharts Horizontal Bar Charts */}
                <div className="ah-charts-stack">
                  {/* Urgency Chart */}
                  <div className="ah-chart-section">
                    <div className="ah-graph-label">Priority Volume</div>
                    <div style={{ width: '100%', height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={stats.chartData}
                          margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            stroke="#64748b" 
                            fontSize={10} 
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            width={65}
                          />
                          <Tooltip cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12} animationDuration={800}>
                            {stats.chartData.map((e, index) => <Cell key={index} fill={e.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Category Chart */}
                  <div className="ah-chart-section">
                    <div className="ah-graph-label">Issue Categories</div>
                    <div style={{ width: '100%', height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={stats.categoryData}
                          margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            stroke="#64748b" 
                            fontSize={10} 
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            width={65}
                          />
                          <Tooltip cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12} fill="#06b6d4" animationDuration={800} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Workstations Chart */}
                  <div className="ah-chart-section">
                    <div className="ah-graph-label">Top Problematic PCs</div>
                    <div style={{ width: '100%', height: 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={stats.workstationData}
                          margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            stroke="#64748b" 
                            fontSize={10} 
                            fontWeight={600}
                            tickLine={false}
                            axisLine={false}
                            width={65}
                          />
                          <Tooltip cursor={{ fill: 'transparent' }} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12} fill="#8b5cf6" animationDuration={800} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* 3. Active Context Specs (If ticket selected) */}
                {activeTicket && (
                  <div className="ah-sidebar-telemetry">
                    <div className="ah-tel-header">Active Machine</div>
                    <div className="ah-tel-ws">{activeTicket.workstation}</div>
                    <div className="ah-tel-row">
                      <span>Memory</span>
                      <strong>{activeTicket.sys_ram || 'N/A'}</strong>
                    </div>
                    <div className="ah-tel-row">
                      <span>Display</span>
                      <strong>{activeTicket.sys_res || 'N/A'}</strong>
                    </div>
                  </div>
                )}

                {!activeTicket && (
                  <div className="ah-info-empty-msg">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <p>Select a ticket to see<br/>workstation details</p>
                  </div>
                )}
              </>
            ) : (
              <div className="ah-terminal-list">
                {activeWorkstations.length === 0 ? (
                  <div className="ah-no-terminals">No active workstations seen in the last 5 minutes.</div>
                ) : (
                  activeWorkstations.map((ws) => (
                    <div key={ws.ip_address} className="ah-terminal-card">
                      <div className="ah-terminal-main">
                        <div className="ah-term-status-indicator active"></div>
                        <div className="ah-term-ip">{ws.ip_address}</div>
                        <div className="ah-term-time">{formatRelative(ws.last_ping)}</div>
                      </div>
                      <div className="ah-term-details">
                        <div className="ah-term-user">👤 {ws.current_user || 'Guest'}</div>
                        <div className="ah-term-module">📍 {ws.active_module || 'Idle'}</div>
                      </div>
                      <div className="ah-term-version">v{ws.version || 'unknown'}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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
