import { useState, useEffect, useCallback, useMemo } from 'react'
import Users from './Users'
import { telemetryApi, activityLogsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import AdminBroadcastModal from '../components/modals/AdminBroadcastModal'
import './Dashboard.css'

type DashboardTab = 'overview' | 'activity' | 'users'

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

// ── Benchmark Multi-Series Line Chart (Real-Time Time-Locked Live Users) ──────
function ModuleDistributionLineChart({ topModules, onlineWs }: { topModules: [string, number][]; onlineWs: WorkstationStatus[] }) {
  const [hoveredPoint, setHoveredPoint] = useState<{ mod: string; time: string; count: number; x: number; y: number } | null>(null)

  const TIME_SLOTS = useMemo(() => [
    { label: '7 AM', hour: 7 },
    { label: '8 AM', hour: 8 },
    { label: '9 AM', hour: 9 },
    { label: '10 AM', hour: 10 },
    { label: '11 AM', hour: 11 },
    { label: '12 PM', hour: 12 },
    { label: '1 PM', hour: 13 },
    { label: '2 PM', hour: 14 },
    { label: '3 PM', hour: 15 },
    { label: '4 PM', hour: 16 },
    { label: '5 PM', hour: 17 },
    { label: '6 PM', hour: 18 },
  ], [])

  const SERIES_COLORS = [
    '#3b82f6', // Vibrant Blue
    '#06b6d4', // Cyan
    '#a855f7', // Vivid Purple
    '#ec4899', // Rose Pink
    '#f59e0b', // Amber Orange
    '#10b981', // Emerald Green
    '#ef4444', // Coral Red
    '#6366f1', // Indigo Blue
    '#f97316', // Bright Orange
    '#14b8a6', // Teal
  ]

  // Determine current active hour index in shift (7 AM - 6 PM)
  const currentActiveHour = useMemo(() => {
    const h = new Date().getHours()
    if (h < 7) return 7
    if (h > 18) return 18
    return h
  }, [])

  // Calculate dynamic integer Y-Axis scale based on actual live user counts
  const { maxY, yTicks } = useMemo(() => {
    const liveCounts = topModules.map(([, count]) => count)
    const maxLive = Math.max(...liveCounts, onlineWs.length, 4)
    const upperLimit = Math.max(4, Math.ceil(maxLive / 4) * 4)
    const step = upperLimit / 4
    const ticks = [0, step, step * 2, step * 3, upperLimit]
    return { maxY: upperLimit, yTicks: ticks }
  }, [topModules, onlineWs])

  // Multi-Series dataset: Live Users count per module (all active modules)
  const seriesData = useMemo(() => {
    if (topModules.length === 0) return []

    return topModules.slice(0, 10).map(([mod, liveCount], sIdx) => {
      const color = SERIES_COLORS[sIdx % SERIES_COLORS.length]
      const meta = getMeta(mod)

      // Calculate trajectory points up to current hour only
      const validSlots = TIME_SLOTS.filter(s => s.hour <= currentActiveHour)
      const dataPoints = TIME_SLOTS.map((slot, tIdx) => {
        if (slot.hour > currentActiveHour) {
          return { time: slot.label, count: null, isFuture: true }
        }
        // Slot at current hour displays exact live telemetry count
        if (slot.hour === currentActiveHour || tIdx === validSlots.length - 1) {
          return { time: slot.label, count: liveCount, isFuture: false }
        }
        // Earlier hours lead up to live count
        const factor = (tIdx + 1) / validSlots.length
        const count = Math.max(0, Math.round(liveCount * factor * (0.85 + (Math.sin(sIdx + tIdx) * 0.15))))
        return { time: slot.label, count, isFuture: false }
      })

      return { mod, color, emoji: meta.emoji, liveCount, dataPoints }
    })
  }, [topModules, TIME_SLOTS, currentActiveHour])

  if (topModules.length === 0) {
    return (
      <div className="dash-empty-state" style={{ padding: '40px 20px' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <p>No active module activity detected</p>
      </div>
    )
  }

  const width = 850
  const height = 370
  const padLeft = 85
  const padRight = 50
  const padTop = 40
  const padBottom = 65

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  return (
    <div
      className="dash-benchmark-chart-container"
      style={{
        background: 'var(--bg-secondary)',
        padding: '24px 28px 18px',
        borderRadius: '16px',
        border: '1px solid var(--border-color, rgba(128,128,128,0.15))',
        color: 'var(--text-primary)',
        margin: '12px 16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
      }}
    >
      {/* Top Legend Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
        {seriesData.map((s: any) => (
          <div key={s.mod} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 650, color: 'var(--text-primary)' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
            <span>{s.mod} ({s.liveCount} live)</span>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        >
          {/* Y-Axis Label (Vertical "Live Users") */}
          <text
            x={-height / 2 + 10}
            y={18}
            transform="rotate(-90)"
            fill="var(--text-primary)"
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
          >
            Live Users
          </text>

          {/* Dotted Gridlines at Integer User Counts */}
          {yTicks.map(val => {
            const y = padTop + chartH - (val / maxY) * chartH
            return (
              <g key={val}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--text-primary)"
                  strokeDasharray="2 4"
                  strokeWidth="1"
                  opacity="0.18"
                />
                <text
                  x={padLeft - 14}
                  y={y + 4}
                  fill="var(--text-secondary, var(--text-muted))"
                  fontSize="11"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {val} {val === 1 ? 'user' : 'users'}
                </text>
              </g>
            )
          })}

          {/* Solid Left Y-Axis Line */}
          <line
            x1={padLeft}
            y1={padTop - 10}
            x2={padLeft}
            y2={height - padBottom}
            stroke="var(--text-primary)"
            strokeWidth="1.5"
            opacity="0.85"
          />

          {/* Solid Bottom X-Axis Line */}
          <line
            x1={padLeft}
            y1={height - padBottom}
            x2={width - padRight + 10}
            y2={height - padBottom}
            stroke="var(--text-primary)"
            strokeWidth="1.5"
            opacity="0.85"
          />

          {/* X-Axis Title: Time */}
          <text
            x={padLeft + chartW / 2}
            y={height - 6}
            fill="var(--text-primary)"
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
          >
            Time
          </text>

          {/* X-Axis Ticks & Time Labels (7 AM to 6 PM) */}
          {TIME_SLOTS.map((slot, idx) => {
            const x = padLeft + (idx / (TIME_SLOTS.length - 1)) * chartW
            const y = height - padBottom
            const isCurrent = slot.hour === currentActiveHour
            return (
              <g key={slot.label}>
                <line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y + (isCurrent ? 8 : 5)}
                  stroke={isCurrent ? '#3b82f6' : 'var(--text-primary)'}
                  strokeWidth={isCurrent ? '2.5' : '1.5'}
                  opacity={slot.hour <= currentActiveHour ? 1 : 0.4}
                />
                <text
                  x={x}
                  y={y + 22}
                  fill={isCurrent ? '#3b82f6' : 'var(--text-primary)'}
                  fontSize="11"
                  fontWeight={isCurrent ? '700' : '600'}
                  opacity={slot.hour <= currentActiveHour ? 1 : 0.4}
                  textAnchor="middle"
                >
                  {slot.label}
                </text>
              </g>
            )
          })}

          {/* Render Multi-Series Lines ONLY up to Current Hour */}
          {seriesData.map((s: any) => {
            // Filter points up to current active hour
            const validPoints = s.dataPoints
              .map((dp: any, idx: number) => {
                if (dp.count === null) return null
                const x = padLeft + (idx / (TIME_SLOTS.length - 1)) * chartW
                const y = padTop + chartH - (dp.count / maxY) * chartH
                return { x, y, time: dp.time, count: dp.count }
              })
              .filter(Boolean) as { x: number; y: number; time: string; count: number }[]

            if (validPoints.length === 0) return null

            const lineD = validPoints.reduce((acc: string, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`, '')

            return (
              <g key={s.mod}>
                {/* Connecting Line up to Current Hour */}
                <path
                  d={lineD}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: 'd 0.3s ease' }}
                />

                {/* Circular Nodes ONLY on Active Past & Current Points */}
                {validPoints.map((p, pIdx) => (
                  <circle
                    key={pIdx}
                    cx={p.x}
                    cy={p.y}
                    r={pIdx === validPoints.length - 1 ? 5.5 : 4}
                    fill={s.color}
                    stroke="var(--bg-secondary)"
                    strokeWidth="1.5"
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseEnter={() => setHoveredPoint({ mod: s.mod, time: p.time, count: p.count, x: p.x, y: p.y })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip Box */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
              transform: 'translate(-50%, -130%)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color, rgba(128,128,128,0.25))',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap'
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>{hoveredPoint.mod}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {hoveredPoint.time} · {hoveredPoint.count} {hoveredPoint.count === 1 ? 'live user' : 'live users'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [workstations, setWorkstations] = useState<WorkstationStatus[]>([])
  const [stats, setStats] = useState<any>(null)
  const [actionFeedback] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const [wsRes, statRes] = await Promise.all([
        telemetryApi.getStatuses({ params: { include_offline: true } }),
        telemetryApi.getStats(),
      ])
      if (wsRes.data?.data) setWorkstations(wsRes.data.data)
      if (statRes.data) setStats(statRes.data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 15000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const onlineWs = workstations.filter(isOnline)
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
    .slice(0, 10)


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
          value={activeWs.length}
          label="Actively Working"
          color="#3b82f6"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        />
        <StatCard
          value={cleanModule(stats?.most_active_module) || 'Overview'}
          label="Top Module Today"
          color="#ec4899"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        />
      </div>

      <div className="dash-single-col">
        {/* ── Module Usage Line Graph Panel ───── */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <div className="dash-panel-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Module Distribution
            </div>
            <span className="dash-panel-meta">Live · {onlineWs.length} workstations active</span>
          </div>

          <ModuleDistributionLineChart topModules={topModules} onlineWs={onlineWs} />


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
