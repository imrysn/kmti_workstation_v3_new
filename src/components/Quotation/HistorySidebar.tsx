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
import { interpretAudit } from './utils/auditUtils'
import './HistorySidebar.css'

// Internal Premium Icons (Replaces missing lucide-react dependency)
const ClockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const RefreshIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

interface Snapshot {
  timestamp: string
  label: string
  description?: string // Added for descriptive summaries
}


/**
 * Robust date parser for backend formats
 */
function safeParseDate(ts: string | undefined): Date {
  if (!ts) return new Date()

  // Format: 20231027_100000 (Custom from backend snapshots)
  if (ts.includes('_') && ts.length >= 15) {
    const [datePart, timePart] = ts.split('_')
    const y = datePart.substring(0, 4)
    const m = datePart.substring(4, 6)
    const d = datePart.substring(6, 8)
    const hh = timePart.substring(0, 2)
    const mm = timePart.substring(2, 4)
    const ss = timePart.substring(4, 6)
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}`)
  }

  const d = new Date(ts)
  return isNaN(d.getTime()) ? new Date() : d
}

/** 
 * Simple relative time helper
 */
function formatTimeAgo(dateStr: string) {
  const date = safeParseDate(dateStr)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return 'just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** 
 * Buckets items by day (Today, Yesterday, etc.)
 */
function groupItemsByDate<T extends { timestamp: string }>(items: T[]) {
  const groups: Record<string, T[]> = {}

  const today = new Date().toLocaleDateString()
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()

  items.forEach(item => {
    const dt = safeParseDate(item.timestamp)
    const date = dt.toLocaleDateString()

    let key = date
    if (date === today) key = 'Today'
    else if (date === yesterday) key = 'Yesterday'
    else {
      key = dt.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
    }

    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })

  return groups
}

interface Props {
  quotNo: string | null
  onRestore: (data: any) => void
  onPreview?: (data: any, ts: string) => void
  previewingTs?: string | null
  auditLogs: any[]
  workstationName?: string
}

export function HistorySidebar({ quotNo, onRestore, onPreview, previewingTs, auditLogs, workstationName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'activity'>('history')
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [localLogs, setLocalLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [restoringTs, setRestoringTs] = useState<string | null>(null)
  const [previewLoadingTs, setPreviewLoadingTs] = useState<string | null>(null)

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

  // Reset local sidebar state when quotNo changes
  useEffect(() => {
    setSnapshots([])
    setLocalLogs([])
    setPreviewLoadingTs(null)
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

  const handlePreview = async (ts: string) => {
    if (!quotNo || !onPreview) return
    if (previewingTs === ts) return // already previewing
    setPreviewLoadingTs(ts)
    try {
      const res = await api.get(`/quotations/${encodeURIComponent(quotNo)}/history/${ts}`)
      onPreview(res.data, ts)
    } catch (e) {
      console.error('Failed to fetch preview:', e)
    } finally {
      setPreviewLoadingTs(null)
    }
  }

  return (
    <aside className={`history-sidebar ${expanded ? 'history-sidebar--expanded' : ''}`}>
      {/* Toggle strip */}
      <button
        className="history-sidebar__toggle"
        onClick={() => setExpanded(v => !v)}
        title={expanded ? 'Collapse history' : 'Version History'}
      >
        <ClockIcon size={16} />
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
                {loading && snapshots.length === 0 && <p className="history-sidebar__empty">Loading versions…</p>}
                {!loading && snapshots.length === 0 && <p className="history-sidebar__empty">No snapshots yet.</p>}

                {Object.entries(groupItemsByDate(snapshots)).map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <div className="history-group-header">{dateKey}</div>
                    {items.map(snap => {
                      const snapDt = safeParseDate(snap.timestamp)
                      const timeStr = snapDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      const isPreviewing = previewingTs === snap.timestamp
                      const isPreLoading = previewLoadingTs === snap.timestamp

                      return (
                        <div
                          key={snap.timestamp}
                          className={`timeline-item ${isPreviewing ? 'timeline-item--previewing' : ''} ${isPreLoading ? 'timeline-item--loading' : ''}`}
                          onClick={() => handlePreview(snap.timestamp)}
                        >
                          <div className="timeline-node" />
                          <div className="timeline-content">
                            <div className="timeline-label">
                              <span>{timeStr}</span>
                              <button
                                className="restore-ghost-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRestore(snap.timestamp)
                                }}
                                disabled={restoringTs === snap.timestamp}
                                title="Restore this version permanently"
                              >
                                {restoringTs === snap.timestamp ? '...' : 'Restore'}
                              </button>
                            </div>
                            <div className="timeline-desc">
                              {snap.description
                                ? snap.description.replace('{hostname}', workstationName || 'Workstation')
                                : `${workstationName || 'Workstation'} made some changes`}
                            </div>
                            <div className="timeline-meta">{formatTimeAgo(snap.timestamp)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </>
            )}

            {quotNo && activeTab === 'activity' && (
              <>
                {loading && displayLogs.length === 0 && <p className="history-sidebar__empty">Loading activity…</p>}
                {!loading && displayLogs.length === 0 && <p className="history-sidebar__empty">No activity yet.</p>}

                {Object.entries(groupItemsByDate(displayLogs)).map(([dateKey, logs]) => (
                  <div key={dateKey}>
                    <div className="history-group-header">{dateKey}</div>
                    {logs.map(log => {
                      const initials = log.userName ? log.userName.charAt(0).toUpperCase() : '?'
                      return (
                        <div key={log.id} className="activity-card">
                          <div className="activity-user-badge">
                            <div className="activity-avatar" style={{ backgroundColor: log.userColor }}>
                              {initials}
                            </div>
                            <span className="activity-username">{log.userName}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '9px', opacity: 0.5 }}>
                              {safeParseDate(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="activity-body">
                            {log.action || (log.patch ? interpretAudit(log.patch.path, log.patch.value) : 'Updated field')}
                          </div>
                          <div className="timeline-meta">{formatTimeAgo(log.timestamp)}</div>
                        </div>
                      )
                    })}
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
              <RefreshIcon size={12} style={{ marginRight: '6px' }} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}
        </div>
      )}
    </aside>
  )
}
