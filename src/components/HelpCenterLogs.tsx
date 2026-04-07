import { useState, useEffect } from 'react'
import { helpApi, SERVER_BASE } from '../services/api'
import type { Ticket } from './FeedbackWidget'

interface HelpCenterLogsProps {
  onOpenLogsCountChange?: (count: number) => void
  isTerminalMode?: boolean
}

export default function HelpCenterLogs({ onOpenLogsCountChange, isTerminalMode = true }: HelpCenterLogsProps) {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  
  // Expanded thread state
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [expandedTicket, setExpandedTicket] = useState<Ticket | null>(null)
  
  // Reply state
  const [replyMessage, setReplyMessage] = useState('')
  const [isReplying, setIsReplying] = useState(false)

  const fetchLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const res = await helpApi.getTickets() // IT gets all
      const data: Ticket[] = res.data
      setTickets(data)
      const openCount = data.filter(l => l.status === 'open').length
      onOpenLogsCountChange?.(openCount)
    } catch (err) {
      console.error('Failed to fetch tickets:', err)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const loadTicketDetails = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedTicket(null)
      return
    }
    
    setExpandedId(id)
    try {
      const res = await helpApi.getTicketDetails(id)
      setExpandedTicket(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleResolve = async (id: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'resolved' ? 'open' : 'resolved'
      await helpApi.updateStatus(id, newStatus)
      if (expandedTicket && expandedTicket.id === id) {
        setExpandedTicket({ ...expandedTicket, status: newStatus })
      }
      fetchLogs()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handleReply = async (id: number) => {
    if (!replyMessage.trim()) return
    setIsReplying(true)
    try {
      const formData = new FormData()
      formData.append('message', replyMessage)
      await helpApi.reply(id, formData)
      setReplyMessage('')
      // Reload thread
      const res = await helpApi.getTicketDetails(id)
      setExpandedTicket(res.data)
      // fetchLogs not fully needed unless status changed, but safe to call
      fetchLogs()
    } catch (err) {
      console.error('Failed to send reply:', err)
      alert("Failed to send reply to ticket")
    } finally {
      setIsReplying(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  return (
    <section className={isTerminalMode ? "itc-section" : "help-section"}>
      <div className={isTerminalMode ? "itc-section-header" : "help-section-header"}>
        <span className={isTerminalMode ? "itc-section-label" : "help-section-label"}>HELP CENTER LOGS</span>
        <span className={isTerminalMode ? "itc-section-note" : "help-section-note"}>user feedback and system reports</span>
        <button 
          className={isTerminalMode ? "itc-refresh-btn" : "btn btn-ghost"} 
          onClick={fetchLogs} 
          disabled={isLoadingLogs}
        >
          {isLoadingLogs ? '...' : (isTerminalMode ? 'REFRESH' : 'Refresh List')}
        </button>
      </div>
      
      <div className={isTerminalMode ? "itc-logs" : "help-logs-container"} style={{maxHeight: '100%', overflowY: 'auto'}}>
        {tickets.length === 0 ? (
          <div className={isTerminalMode ? "itc-no-logs" : "help-no-logs"}>NO ACTIVE REPORTS</div>
        ) : (
          tickets.map(ticket => (
            <div key={ticket.id} className={isTerminalMode 
              ? `itc-log-item ${ticket.status === 'resolved' ? 'itc-log-item--resolved' : ''}`
              : `help-log-card ${ticket.status === 'resolved' ? 'resolved' : ''}`
            }>
              
              <div 
                className={isTerminalMode ? "itc-log-main" : "help-log-content"} 
                style={{ cursor: 'pointer', flex: 1 }}
                onClick={() => loadTicketDetails(ticket.id)}
              >
                <div className={isTerminalMode ? "itc-log-meta" : "help-log-meta"}>
                  <strong style={{ color: isTerminalMode ? '#0f0' : 'inherit' }}>#{ticket.id}</strong> 
                  <span className={isTerminalMode ? "itc-log-badge" : "badge badge-blue"} style={{marginLeft: 8}}>{ticket.workstation}</span>
                  {ticket.reporter_name && <span style={{marginLeft: 8, opacity: 0.7}}>({ticket.reporter_name})</span>}
                  <span className={isTerminalMode ? "itc-log-time" : "help-log-date"}> · {new Date(ticket.created_at).toLocaleString()}</span>
                </div>
                <div className={isTerminalMode ? "itc-log-msg" : "help-log-message"} style={{ fontWeight: 600 }}>
                  {ticket.subject || 'No Subject'}
                </div>
              </div>
              
              <button 
                className={isTerminalMode ? "itc-resolve-btn" : `btn ${ticket.status === 'resolved' ? 'btn-ghost' : 'btn-primary'}`} 
                onClick={(e) => { e.stopPropagation(); handleResolve(ticket.id, ticket.status); }}
                style={{ marginLeft: 'auto' }}
              >
                {ticket.status === 'resolved' ? (isTerminalMode ? 'REOPEN' : 'Reopen') : (isTerminalMode ? 'RESOLVE' : 'Mark Resolved')}
              </button>

              {/* EXPANDED THREAD VIEW */}
              {expandedId === ticket.id && expandedTicket && (
                <div style={{ width: '100%', padding: '16px', marginTop: '12px', background: isTerminalMode ? 'rgba(0,255,0,0.05)' : '#f8fafc', border: isTerminalMode ? '1px solid #0f0' : '1px solid #e2e8f0', borderRadius: '8px' }}>
                   <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     {expandedTicket.messages?.map(msg => {
                        const isIt = msg.sender_type !== 'user';
                        const paths = msg.screenshot_paths ? msg.screenshot_paths.split(',') : [];
                        return (
                          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: isIt ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                            <small style={{ color: isTerminalMode ? '#0f0' : '#718096', opacity: 0.8, marginBottom: 4 }}>
                              {msg.sender_name || (isIt ? 'IT Support' : 'User')} • {new Date(msg.created_at).toLocaleTimeString()}
                            </small>
                            <div style={{ 
                              padding: '10px 14px', 
                              borderRadius: '8px',
                              background: isIt ? (isTerminalMode ? '#003300' : '#0099FF') : (isTerminalMode ? 'transparent' : '#fff'),
                              color: isIt ? (isTerminalMode ? '#0f0' : '#fff') : (isTerminalMode ? '#ccc' : '#1a202c'),
                              border: isTerminalMode ? '1px solid #0f0' : (isIt ? 'none' : '1px solid #cbd5e0')
                            }}>
                              {msg.message}
                              {paths.length > 0 && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                  {paths.map(p => (
                                    <a key={p} href={`${SERVER_BASE}${p}`} target="_blank" rel="noreferrer">
                                      <img src={`${SERVER_BASE}${p}`} alt="Attachment" style={{ height: 60, borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }} />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                     })}
                   </div>
                   
                   {/* REPLY BOX */}
                   <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        value={replyMessage}
                        onChange={e => setReplyMessage(e.target.value)}
                        placeholder="Type a reply to the user..."
                        className="input"
                        style={{ flex: 1, background: isTerminalMode ? '#000' : '#fff', color: isTerminalMode ? '#0f0' : '#000', border: isTerminalMode ? '1px solid #0f0' : '1px solid #cbd5e0' }}
                        onKeyDown={e => e.key === 'Enter' && handleReply(ticket.id)}
                      />
                      <button 
                        className={isTerminalMode ? "itc-refresh-btn" : "btn btn-primary"}
                        onClick={() => handleReply(ticket.id)}
                        disabled={isReplying || !replyMessage.trim()}
                      >
                        {isReplying ? '...' : 'Send Reply'}
                      </button>
                   </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
