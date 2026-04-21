/**
 * HistorySidebar.tsx
 * ─────────────────────────────────────────────────────────────────
 * A collapsible left panel showing the version history snapshots
 * of the currently open shared quotation.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { quotationApi } from '../../services/api'
import { IQuotationHistory } from '../../types'
import { interpretAudit } from './utils/auditUtils'
import './HistorySidebar.css'

// Internal Premium Icons
const ClockIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const RefreshIcon = ({ size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

/**
 * Robust date parser for backend formats
 */
function safeParseDate(ts: string | undefined): Date {
  if (!ts) return new Date()
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
  quotId: number | undefined
  quotNo: string | null
  onRestore: (data: any) => void
  onPreview?: (data: any, ts: string) => void
  previewingTs?: string | null
  auditLogs: any[]
  workstationName?: string
}

export function HistorySidebar({ quotId, quotNo, onRestore, onPreview, previewingTs, auditLogs, workstationName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'activity'>('history')
  const [snapshots, setSnapshots] = useState<IQuotationHistory[]>([])
  const [localLogs, setLocalLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null)

  const fetchHistory = useCallback(async (isSilent = false) => {
    if (!quotId) return
    if (!isSilent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const res = await quotationApi.getHistory(quotId)
      setSnapshots(res.data.history || [])
    } catch {
      setSnapshots([])
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [quotId])

  // Reset local sidebar state when quotNo changes
  useEffect(() => {
    setSnapshots([])
    setLocalLogs([])
    setPreviewLoadingId(null)
  }, [quotId])

  // Fetch whenever the sidebar expands or quotNo changes
  useEffect(() => {
    if (expanded && quotId) {
      if (activeTab === 'history') fetchHistory()
      // else fetchLogs() // Activity logs currently simplified to Socket-only for this version
    }
  }, [expanded, quotId, activeTab, fetchHistory])

  // Listen for background refresh events (triggered by collaboration socket)
  useEffect(() => {
    if (!quotId) return
    const handleRefresh = (e: any) => {
      if (e.detail?.quotId === quotId && activeTab === 'history') {
        fetchHistory(true) // silent refresh
      }
    }
    window.addEventListener('quot:history-refresh' as any, handleRefresh)
    return () => window.removeEventListener('quot:history-refresh' as any, handleRefresh)
  }, [quotId, activeTab, fetchHistory])

  // Merge local logs with live audit logs from prop (Memoized for performance)
  const displayLogs = useMemo(() => {
    return [...auditLogs, ...localLogs]
      .filter(log => log && log.id)
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
  }, [auditLogs, localLogs])

  const handleRestore = async (snap: IQuotationHistory) => {
    if (!quotId) return
    setRestoringId(snap.id)
    try {
      const res = await quotationApi.restoreHistory(quotId, snap.id)
      onRestore(res.data)
    } catch (e) {
      alert('Failed to restore snapshot.')
    } finally {
      setRestoringId(null)
    }
  }

  const handlePreview = async (snap: IQuotationHistory) => {
    if (!quotId || !onPreview) return
    if (previewingTs === snap.timestamp) return // already previewing
    setPreviewLoadingId(snap.id)
    try {
      const res = await quotationApi.restoreHistory(quotId, snap.id)
      onPreview(res.data, snap.timestamp)
    } catch (e) {
      console.error('Failed to fetch preview:', e)
    } finally {
      setPreviewLoadingId(null)
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
            {!quotId && (
              <p className="history-sidebar__empty">Waiting for database connection...</p>
            )}

            {quotId && activeTab === 'history' && (
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
                      const isPreLoading = previewLoadingId === snap.id

                      return (
                        <div
                          key={snap.id}
                          className={`timeline-item ${isPreviewing ? 'timeline-item--previewing' : ''} ${isPreLoading ? 'timeline-item--loading' : ''}`}
                          onClick={() => handlePreview(snap)}
                        >
                          <div className="timeline-node" />
                          <div className="timeline-content">
                            <div className="timeline-label">
                              <span>{timeStr}</span>
                              <button
                                className="restore-ghost-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRestore(snap)
                                }}
                                disabled={restoringId === snap.id}
                                title="Restore this version permanently"
                              >
                                {restoringId === snap.id ? '...' : 'Restore'}
                              </button>
                            </div>
                            <div className="timeline-desc">
                              {snap.label || 'Modified system snapshot'}
                              <span className="timeline-author">by {snap.author}</span>
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

            {quotId && activeTab === 'activity' && (
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

          {quotId && activeTab === 'history' && !loading && snapshots.length > 0 && (
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
