import { useState, useEffect, useCallback } from 'react'
import Users from './Users'
import { telemetryApi, activityLogsApi, SERVER_BASE } from '../services/api'
import { useAuth } from '../context/AuthContext'
import AdminBroadcastModal from '../components/modals/AdminBroadcastModal'
import './Dashboard.css'

type DashboardTab = 'overview' | 'activity' | 'users'
type WorkstationFilter = 'all' | 'active' | 'idle'

interface WorkstationStatus {
  computer_name: string
  ip_address: string
  current_user?: string
  display_name?: string
  profile_picture?: string
  active_module?: string
  version?: string
  status_message?: string
  last_ping?: string
  achievements?: Record<string, boolean>
}

interface ActivityLog {
  id: number
  username: string
  action: string
  details?: string
  ip_address?: string
  created_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function isOnline(ws: WorkstationStatus): boolean {
  if (!ws.last_ping) return false
  const mod = ws.active_module || ''
  if (mod === 'offline' || mod.toLowerCase().includes('offline')) return false
  return Date.now() - new Date(ws.last_ping).getTime() <= 300000
}

function cleanModule(raw: string | undefined): string {
  if (!raw) return 'Overview'
  let cleaned = raw.replace(/💤/g, '').replace(/^[\p{Emoji}\p{So}\p{Sk}\s]+/u, '').replace(/[\p{Emoji}\p{So}\p{Sk}\s]+$/u, '').trim()
  if (!cleaned) return 'Overview'

  const lower = cleaned.toLowerCase().replace(/[-_]/g, ' ')
  if (lower.includes('quotation')) return 'Quotation'
  if (lower.includes('calculator')) return 'Calculator'
  if (lower.includes('drafting')) return 'Drafting Notes'
  if (lower.includes('findr')) return 'Findr'
  if (lower.includes('special') || lower.includes('heat')) return 'Special Process'
  if (lower.includes('billing')) return 'Billing Monitoring'
  if (lower.includes('help')) return 'Help Center'
  if (lower.includes('calendar')) return 'Team Calendar'
  if (lower.includes('material')) return 'Materials'
  if (lower.includes('designer')) return 'Designers'
  if (lower.includes('part')) return 'Purchased Parts'
  if (lower.includes('character')) return 'Character Search'
  if (lower.includes('setting')) return 'Settings'
  if (lower.includes('overview') || lower.includes('home')) return 'Overview'
  return cleaned
}

function isMinimized(raw: string | undefined): boolean {
  return !!(raw && raw.includes('💤'))
}

const MODULE_META: Record<string, { color: string; emoji: string }> = {
  'Quotation':          { color: '#3b82f6', emoji: '📄' },
  'Calculator':         { color: '#06b6d4', emoji: '🔢' },
  'Drafting Notes':     { color: '#a855f7', emoji: '📝' },
  'Findr':              { color: '#ec4899', emoji: '🔍' },
  'Special Process':    { color: '#f59e0b', emoji: '🔥' },
  'Billing Monitoring': { color: '#10b981', emoji: '💰' },
  'Help Center':        { color: '#ef4444', emoji: '🎫' },
  'Team Calendar':      { color: '#6366f1', emoji: '📅' },
  'Materials':          { color: '#8b5cf6', emoji: '🧱' },
  'Designers':          { color: '#14b8a6', emoji: '👥' },
  'Purchased Parts':    { color: '#f97316', emoji: '📦' },
  'Character Search':   { color: '#84cc16', emoji: '🔤' },
  'Overview':           { color: '#64748b', emoji: '🏠' },
  'Settings':           { color: '#475569', emoji: '⚙️' },
  'Active':             { color: '#22c55e', emoji: '💻' },
}

function getMeta(mod: string) {
  return MODULE_META[mod] || { color: '#6b7280', emoji: '💻' }
}

function avatarUrl(profilePicture?: string): string | null {
  if (!profilePicture) return null
  if (profilePicture.startsWith('http')) return profilePicture
  return `${SERVER_BASE}/api/fms/avatar-file/${encodeURIComponent(profilePicture)}`
}

function InitialAvatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(/[\s_]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="dash-avatar-initials" style={{ background: color + '33', color, borderColor: color + '55' }}>
      {initials}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, color, icon, pulse }: {
  value: number | string; label: string; color: string; icon: React.ReactNode; pulse?: boolean
}) {
  return (
    <div className="dash-stat-card" style={{ '--stat-color': color } as React.CSSProperties}>
      <div className="dash-stat-icon">{icon}</div>
      <div className="dash-stat-body">
        <div className="dash-stat-value">{value}</div>
        <div className="dash-stat-label">{label}</div>
      </div>
      {pulse && <div className="dash-stat-pulse" />}
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [workstations, setWorkstations] = useState<WorkstationStatus[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWs, setSelectedWs] = useState<WorkstationStatus | null>(null)
  const [wsSearch, setWsSearch] = useState('')
  const [wsFilter, setWsFilter] = useState<WorkstationFilter>('all')
  const [actionFeedback, setActionFeedback] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchAll = useCallback(async () => {
    try {
      const [wsRes, statRes] = await Promise.all([
        telemetryApi.getStatuses({ params: { include_offline: true } }),
        telemetryApi.getStats(),
      ])
      if (wsRes.data?.data) setWorkstations(wsRes.data.data)
      if (statRes.data) setStats(statRes.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 15000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const onlineWs = workstations.filter(isOnline)
  const offlineWs = workstations.filter(w => !isOnline(w))
  const minimizedWs = onlineWs.filter(w => isMinimized(w.active_module))
  const activeWs = onlineWs.filter(w => !isMinimized(w.active_module))

  // App version breakdown across online workstations
  const versionCounts: Record<string, number> = {}
  onlineWs.forEach(w => {
    const v = w.version || 'v3.8.8'
    versionCounts[v] = (versionCounts[v] || 0) + 1
  })

  // Module usage counts from ONLINE workstations (normalized canonical names)
  const moduleCounts: Record<string, number> = {}
  onlineWs.forEach(ws => {
    const mod = cleanModule(ws.active_module)
    if (mod && mod !== 'offline') {
      moduleCounts[mod] = (moduleCounts[mod] || 0) + 1
    }
  })
  const topModules = Object.entries(moduleCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
  const maxModuleCount = topModules[0]?.[1] || 1

  // Filtered workstation list
  const filteredWorkstations = onlineWs.filter(ws => {
    const displayName = (ws.display_name || ws.current_user || ws.computer_name || '').toLowerCase()
    const compName = (ws.computer_name || '').toLowerCase()
    const matchSearch = !wsSearch || displayName.includes(wsSearch.toLowerCase()) || compName.includes(wsSearch.toLowerCase())
    const mini = isMinimized(ws.active_module)
    const matchFilter = wsFilter === 'all' || (wsFilter === 'active' && !mini) || (wsFilter === 'idle' && mini)
    return matchSearch && matchFilter
  })

  const handleWave = async (targetComp: string) => {
    const sender = user?.username || 'Admin'
    try {
      await telemetryApi.wave(sender, targetComp)
      setActionFeedback(`Wave 👋 sent to ${targetComp}`)
      setTimeout(() => setActionFeedback(null), 3000)
    } catch {
      setActionFeedback(`Failed to send wave`)
      setTimeout(() => setActionFeedback(null), 3000)
    }
  }

  const handleNudge = async (targetComp: string) => {
    try {
      await telemetryApi.nudge(targetComp, 'v3.8.8')
      setActionFeedback(`Update Nudge 🚀 sent to ${targetComp}`)
      setTimeout(() => setActionFeedback(null), 3000)
    } catch {
      setActionFeedback(`Failed to send nudge`)
      setTimeout(() => setActionFeedback(null), 3000)
    }
  }

  return (
    <div className="dashboard-overview">
      {actionFeedback && (
        <div className="dash-toast-feedback">
          {actionFeedback}
        </div>
      )}

      {/* ── Hero Stats ─────────────────────────── */}
      <div className="dash-stats-grid">
        <StatCard
          value={onlineWs.length}
          label="Online Now"
          color="#10b981"
          pulse
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard
          value={activeWs.length}
          label="Actively Working"
          color="#3b82f6"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        />
        <StatCard
          value={minimizedWs.length}
          label="Idle / Minimized"
          color="#f59e0b"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 12h-5l-5-8"/><path d="M17 12h-5l4 8"/><circle cx="12" cy="12" r="10"/></svg>}
        />
        <StatCard
          value={offlineWs.length}
          label="Offline"
          color="#ef4444"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>}
        />
        <StatCard
          value={workstations.length}
          label="Total Workstations"
          color="#8b5cf6"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <StatCard
          value={cleanModule(stats?.most_active_module) || 'Overview'}
          label="Top Module Today"
          color="#ec4899"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        />
      </div>

      <div className="dash-two-col">
        {/* ── Live Workstation Cards ─────────────── */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title">
              <span className="dash-panel-live-dot" />
              Live Workstations ({filteredWorkstations.length})
            </div>
            <div className="dash-ws-controls">
              <input
                className="dash-ws-search-input"
                placeholder="Filter stations..."
                value={wsSearch}
                onChange={e => setWsSearch(e.target.value)}
              />
              <div className="dash-ws-filter-pills">
                {(['all', 'active', 'idle'] as WorkstationFilter[]).map(f => (
                  <button
                    key={f}
                    className={`dash-filter-pill${wsFilter === f ? ' active' : ''}`}
                    onClick={() => setWsFilter(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="dash-ws-grid">
            {loading && workstations.length === 0 ? (
              <div className="dash-skeleton-list">
                {[1,2,3,4].map(i => <div key={i} className="dash-skeleton-card" />)}
              </div>
            ) : filteredWorkstations.length === 0 ? (
              <div className="dash-empty-state">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
                <p>No workstations match filter</p>
              </div>
            ) : (
              filteredWorkstations.map(ws => {
                const mod = cleanModule(ws.active_module)
                const meta = getMeta(mod)
                const mini = isMinimized(ws.active_module)
                const imgUrl = avatarUrl(ws.profile_picture)
                const displayName = ws.display_name || ws.current_user || ws.computer_name || ws.ip_address
                return (
                  <div
                    key={ws.computer_name || ws.ip_address}
                    className={`dash-ws-card${mini ? ' minimized' : ''}`}
                    onClick={() => setSelectedWs(ws)}
                    title="Click to view details"
                  >
                    <div className="dash-ws-card-avatar">
                      {imgUrl ? (
                        <img src={imgUrl} alt={displayName} className="dash-avatar-img"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : (
                        <InitialAvatar name={displayName || '?'} color={meta.color} />
                      )}
                      <div className={`dash-ws-card-status-dot ${mini ? 'idle' : 'active'}`} />
                    </div>
                    <div className="dash-ws-card-info">
                      <div className="dash-ws-card-name-row">
                        <span className="dash-ws-card-name">{displayName}</span>
                        {ws.version && <span className="dash-ws-version-badge">{ws.version}</span>}
                      </div>
                      <div className="dash-ws-card-module" style={{ color: meta.color }}>
                        <span>{meta.emoji}</span>
                        <span>{mini ? `${mod} (idle)` : mod}</span>
                      </div>
                    </div>

                    <div className="dash-ws-card-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="dash-ws-action-btn wave"
                        title="Send 👋 Wave"
                        onClick={() => handleWave(ws.computer_name || ws.ip_address)}
                      >
                        👋
                      </button>
                    </div>

                    <div className="dash-ws-card-time">{ws.last_ping ? timeAgo(ws.last_ping) : ''}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Module Usage Chart & System Health ───── */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Module Distribution
            </div>
            <span className="dash-panel-meta">Live · {onlineWs.length} active</span>
          </div>

          {topModules.length === 0 ? (
            <div className="dash-empty-state">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <p>No active modules</p>
            </div>
          ) : (
            <div className="dash-bar-chart">
              {topModules.map(([mod, count]) => {
                const meta = getMeta(mod)
                const pct = (count / maxModuleCount) * 100
                return (
                  <div key={mod} className="dash-bar-row">
                    <div className="dash-bar-emoji">{meta.emoji}</div>
                    <div className="dash-bar-label">{mod}</div>
                    <div className="dash-bar-track">
                      <div
                        className="dash-bar-fill"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${meta.color}cc, ${meta.color})` }}
                      />
                    </div>
                    <div className="dash-bar-count" style={{ color: meta.color }}>{count}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* System Version Distribution Panel */}
          {Object.keys(versionCounts).length > 0 && (
            <div className="dash-version-panel">
              <div className="dash-version-header">App Version Adoption</div>
              <div className="dash-version-pills">
                {Object.entries(versionCounts).map(([ver, cnt]) => (
                  <div key={ver} className={`dash-ver-chip ${ver === 'v3.8.8' ? 'current' : 'outdated'}`}>
                    <span className="dash-ver-tag">{ver}</span>
                    <span className="dash-ver-cnt">{cnt} workstation{cnt > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Pulse row */}
          {stats && (
            <div className="dash-system-row">
              <div className="dash-sys-item">
                <span className="dash-sys-label">Peak (24h)</span>
                <span className="dash-sys-value">{stats.peak_users}</span>
              </div>
              <div className="dash-sys-item">
                <span className="dash-sys-label">Waves Today</span>
                <span className="dash-sys-value">👋 {stats.waves_exchanged}</span>
              </div>
              <div className="dash-sys-item">
                <span className="dash-sys-label">Wave Leader</span>
                <span className="dash-sys-value">{stats.wave_leader !== 'None' ? stats.wave_leader : '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Workstation Detail Inspector Modal */}
      {selectedWs && (
        <div className="dash-modal-overlay" onClick={() => setSelectedWs(null)}>
          <div className="dash-modal-card" onClick={e => e.stopPropagation()}>
            <div className="dash-modal-header">
              <div className="dash-modal-user-info">
                {avatarUrl(selectedWs.profile_picture) ? (
                  <img src={avatarUrl(selectedWs.profile_picture)!} className="dash-modal-avatar" alt="User" />
                ) : (
                  <InitialAvatar name={selectedWs.display_name || selectedWs.current_user || '?'} color="#3b82f6" />
                )}
                <div>
                  <h3 className="dash-modal-title">{selectedWs.display_name || selectedWs.current_user || 'Workstation'}</h3>
                  <span className="dash-modal-sub">{selectedWs.computer_name} · {selectedWs.ip_address}</span>
                </div>
              </div>
              <button className="dash-modal-close" onClick={() => setSelectedWs(null)}>✕</button>
            </div>

            <div className="dash-modal-body">
              <div className="dash-modal-grid">
                <div className="dash-modal-field">
                  <span className="dash-field-label">Active Focus</span>
                  <span className="dash-field-val">
                    {getMeta(cleanModule(selectedWs.active_module)).emoji} {cleanModule(selectedWs.active_module)} {isMinimized(selectedWs.active_module) ? '(Idle)' : ''}
                  </span>
                </div>
                <div className="dash-modal-field">
                  <span className="dash-field-label">Client App Version</span>
                  <span className="dash-field-val">{selectedWs.version || 'v3.8.8'}</span>
                </div>
                <div className="dash-modal-field">
                  <span className="dash-field-label">Last Heartbeat</span>
                  <span className="dash-field-val">{selectedWs.last_ping ? timeAgo(selectedWs.last_ping) : 'Unknown'}</span>
                </div>
                <div className="dash-modal-field">
                  <span className="dash-field-label">Status Message</span>
                  <span className="dash-field-val">{selectedWs.status_message || '—'}</span>
                </div>
              </div>

              <div className="dash-modal-actions">
                <button
                  className="dash-modal-btn wave"
                  onClick={() => {
                    handleWave(selectedWs.computer_name || selectedWs.ip_address)
                    setSelectedWs(null)
                  }}
                >
                  👋 Send Wave Ping
                </button>
                <button
                  className="dash-modal-btn nudge"
                  onClick={() => {
                    handleNudge(selectedWs.computer_name || selectedWs.ip_address)
                    setSelectedWs(null)
                  }}
                >
                  🚀 Send Update Nudge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Activity Logs Tab ─────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, string> = {
  LOGIN:    '#10b981',
  LOGOUT:   '#ef4444',
  CREATE:   '#3b82f6',
  UPDATE:   '#f59e0b',
  DELETE:   '#ef4444',
  VIEW:     '#8b5cf6',
  EXPORT:   '#06b6d4',
  IMPORT:   '#06b6d4',
  BROADCAST:'#ec4899',
  RESET:    '#f97316',
}

function getActionColor(action: string): string {
  const key = action?.toUpperCase().split('_')[0] || ''
  return ACTION_COLORS[key] || '#6b7280'
}

function ActivityLogsTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await activityLogsApi.list({ limit: 200 })
      if (res.data?.logs) setLogs(res.data.logs)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 30000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  const actions = ['all', ...Array.from(new Set(logs.map(l => l.action))).sort()]

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.username?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase())
    const matchAction = actionFilter === 'all' || l.action === actionFilter
    return matchSearch && matchAction
  })

  return (
    <div className="dashboard-activity">
      <div className="dash-toolbar">
        <div className="dash-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="dash-search" placeholder="Search by user, action, details..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="dash-search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>
        <select className="dash-filter-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          {actions.map(a => <option key={a} value={a}>{a === 'all' ? 'All Actions' : a}</option>)}
        </select>
        <button className="dash-refresh-btn" onClick={fetchLogs} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
        <span className="dash-count">{filtered.length} of {logs.length}</span>
      </div>

      <div className="dash-log-table-wrap">
        <table className="dash-log-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>IP Address</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={5}><div className="dash-skeleton-row" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5}>
                <div className="dash-empty-state">
                  <p>No logs match your search</p>
                </div>
              </td></tr>
            ) : (
              filtered.map(log => (
                <tr key={log.id}>
                  <td>
                    <div className="dash-log-user-cell">
                      <InitialAvatar name={log.username || '?'} color={getActionColor(log.action)} />
                      <span className="dash-log-user">{log.username}</span>
                    </div>
                  </td>
                  <td>
                    <span className="dash-log-action-badge" style={{ background: getActionColor(log.action) + '18', color: getActionColor(log.action) }}>
                      {log.action}
                    </span>
                  </td>
                  <td className="dash-log-details">{log.details || '—'}</td>
                  <td className="dash-log-ip">{log.ip_address || '—'}</td>
                  <td className="dash-log-time">{timeAgo(log.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview')
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const { hasRole, user } = useAuth()

  const tabs = [
    {
      id: 'overview' as DashboardTab,
      label: 'Overview',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    },
    {
      id: 'activity' as DashboardTab,
      label: 'Activity Logs',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    },
    {
      id: 'users' as DashboardTab,
      label: 'User Accounts',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
  ]

  return (
    <div className="dashboard-page">
      {/* Gradient banner header */}
      <div className="dash-header-banner">
        <div className="dash-header-content">
          <div>
            <h1 className="dash-title">Command Center</h1>
            <p className="dash-subtitle">Logged in as <strong>{user?.username}</strong> · {new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="dash-header-badges">
            <button
              className="dash-broadcast-header-btn"
              onClick={() => setShowBroadcastModal(true)}
              title="Broadcast Announcement to Workstations"
            >
              📢 Broadcast Announcement
            </button>
            <div className={`dash-role-badge ${hasRole('admin') ? 'admin' : 'it'}`}>
              {hasRole('admin') ? '🛡️ ADMIN' : '🖥️ IT'}
            </div>
          </div>
        </div>

        {/* Tab Bar inside banner */}
        <div className="dash-tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`dashboard-tab-${tab.id}`}
              className={`dash-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-content">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'activity' && <ActivityLogsTab />}
        {activeTab === 'users' && <div className="dash-users-tab"><Users /></div>}
      </div>

      {/* Admin Broadcast Announcement Modal */}
      <AdminBroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
      />
    </div>
  )
}
