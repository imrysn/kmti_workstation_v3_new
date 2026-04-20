/**
 * HistorySidebar.tsx
 * ─────────────────────────────────────────────────────────────────
 * A collapsible left panel showing the version history snapshots
 * of the currently open shared quotation.
 *
 * Behavior:
 * - Collapsed by default (shows only a thin strip with an icon)
 * - Expands to a 220px panel on click
 * - Fetches snapshot list from the backend (/api/quotations/{quotNo}/history)
 * - Lets users restore a previous version
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'
import './HistorySidebar.css'

interface Snapshot {
  timestamp: string
  label: string
}

interface Props {
  quotNo: string | null
  onRestore: (data: any) => void
  auditLogs: any[]
}

export function HistorySidebar({ quotNo, onRestore, auditLogs }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'activity'>('history')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [localLogs, setLocalLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [restoringTs, setRestoringTs] = useState<string | null>(null)

  const fetchHistory = useCallback(async (isSilent = false) => {
    if (!quotNo) return
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const res = await api.get<{ history: Snapshot[] }>(`/quotations/${encodeURIComponent(quotNo)}/history`)
      setSnapshots(res.data.history || [])
    } catch {
      setSnapshots([])
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [quotNo])

  // Fetch whenever the sidebar expands or quotNo changes
  useEffect(() => {
    if (expanded && quotNo) {
      if (activeTab === 'history') fetchHistory()
      else fetchLogs()
    }
  }, [expanded, quotNo, activeTab, fetchHistory])

  const fetchLogs = async () => {
    if (!quotNo) return
    setLoading(true)
    try {
      const res = await api.get<{ logs: any[] }>(`/quotations/${encodeURIComponent(quotNo)}/logs`)
      setLocalLogs(res.data.logs || [])
    } catch {
      setLocalLogs([])
    } finally {
      setLoading(false)
    }
  }

  // Merge local logs with live audit logs from prop (Memoized for performance)
  const displayLogs = useMemo(() => {
    return [...auditLogs, ...localLogs]
      .filter(log => log && log.id)
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
  }, [auditLogs, localLogs])

  const handleRestore = async (ts: string) => {
    if (!quotNo) return
    setRestoringTs(ts)
    try {
      const res = await api.get(`/quotations/${encodeURIComponent(quotNo)}/history/${ts}`)
      onRestore(res.data)
    } catch (e) {
      alert('Failed to restore snapshot.')
    } finally {
      setRestoringTs(null)
    }
  }

  return (
    <div className={`history-sidebar ${expanded ? 'history-sidebar--expanded' : ''}`}>
      {/* Toggle strip */}
      <button
        className="history-sidebar__toggle"
        onClick={() => setExpanded(v => !v)}
        title={expanded ? 'Collapse history' : 'Version History'}
      >
        {/* History / Clock icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        {expanded && <span className="history-sidebar__title">Version History</span>}
      </button>

      {/* Panel content */}
      {expanded && (
        <div className="history-sidebar__content">
          <div className="history-sidebar__tabs">
            <button 
              className={`history-sidebar__tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Versions
            </button>
            <button 
              className={`history-sidebar__tab ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              Activity
            </button>
          </div>

          <div className="history-sidebar__scroll-area">
            {!quotNo && (
              <p className="history-sidebar__empty">Open a shared quotation to see its history.</p>
            )}
            
            {quotNo && activeTab === 'history' && (
              <>
                {loading && snapshots.length === 0 && <p className="history-sidebar__empty">Loading…</p>}
                {!loading && snapshots.length === 0 && <p className="history-sidebar__empty">No snapshots yet.</p>}
                {snapshots.map(snap => (
                  <div key={snap.timestamp} className="history-sidebar__item">
                    <span className="history-sidebar__item-label">{snap.label}</span>
                    <button
                      className="history-sidebar__restore-btn"
                      onClick={() => handleRestore(snap.timestamp)}
                      disabled={restoringTs === snap.timestamp}
                    >
                      {restoringTs === snap.timestamp ? '…' : 'Restore'}
                    </button>
                  </div>
                ))}
              </>
            )}

            {quotNo && activeTab === 'activity' && (
              <>
                {loading && displayLogs.length === 0 && <p className="history-sidebar__empty">Loading…</p>}
                {!loading && displayLogs.length === 0 && <p className="history-sidebar__empty">No activity yet.</p>}
                {displayLogs.map(log => (
                  <div key={log.id} className="history-sidebar__log">
                    <div className="history-sidebar__log-header">
                      <span className="history-sidebar__log-user" style={{ color: log.userColor }}>
                        {log.userName}
                      </span>
                      <span className="history-sidebar__log-time">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="history-sidebar__log-action">{log.action}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          {quotNo && activeTab === 'history' && !loading && snapshots.length > 0 && (
            <button 
              className={`history-sidebar__refresh ${isRefreshing ? 'history-sidebar__refresh--active' : ''}`} 
              onClick={() => fetchHistory(true)}
              disabled={isRefreshing}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
