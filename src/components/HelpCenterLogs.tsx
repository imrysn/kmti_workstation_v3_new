import { useState, useEffect } from 'react'
import { helpApi, SERVER_BASE } from '../services/api'

export interface FeedbackLog {
  id: number
  workstation: string
  message: string
  screenshot_path: string | null
  status: string
  created_at: string
}

interface HelpCenterLogsProps {
  onOpenLogsCountChange?: (count: number) => void
  isTerminalMode?: boolean
}

export default function HelpCenterLogs({ onOpenLogsCountChange, isTerminalMode = true }: HelpCenterLogsProps) {
  const [logs, setLogs] = useState<FeedbackLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  const fetchLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const res = await helpApi.getLogs()
      const data: FeedbackLog[] = res.data
      setLogs(data)
      // Notify parent of the count of 'open' status logs
      const openCount = data.filter(l => l.status === 'open').length
      onOpenLogsCountChange?.(openCount)
    } catch (err) {
      console.error('Failed to fetch help logs:', err)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const handleResolve = async (id: number) => {
    try {
      await helpApi.resolve(id)
      fetchLogs()
    } catch (err) {
      console.error('Failed to resolve feedback:', err)
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
      <div className={isTerminalMode ? "itc-logs" : "help-logs-container"}>
        {logs.length === 0 ? (
          <div className={isTerminalMode ? "itc-no-logs" : "help-no-logs"}>NO ACTIVE REPORTS</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className={isTerminalMode 
              ? `itc-log-item ${log.status === 'resolved' ? 'itc-log-item--resolved' : ''}`
              : `help-log-card ${log.status === 'resolved' ? 'resolved' : ''}`
            }>
              <div className={isTerminalMode ? "itc-log-main" : "help-log-content"}>
                <div className={isTerminalMode ? "itc-log-meta" : "help-log-meta"}>
                  <span className={isTerminalMode ? "itc-log-badge" : "badge badge-blue"}>{log.workstation}</span>
                  <span className={isTerminalMode ? "itc-log-time" : "help-log-date"}> · {new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div className={isTerminalMode ? "itc-log-msg" : "help-log-message"}>{log.message}</div>
                {log.screenshot_path && (
                  <div className="help-log-attachments" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {log.screenshot_path.split(',').map((path, idx) => (
                      <a 
                        key={idx}
                        href={`${SERVER_BASE}${path}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className={isTerminalMode ? "itc-log-link" : "help-attachment-link"}
                      >
                        {isTerminalMode ? `ATTACHMENT_${idx + 1}.PNG` : `Screenshot ${idx + 1}`}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {log.status === 'open' && (
                <button 
                  className={isTerminalMode ? "itc-resolve-btn" : "btn btn-primary"} 
                  onClick={() => handleResolve(log.id)}
                >
                  {isTerminalMode ? 'RESOLVE' : 'Mark Resolved'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
