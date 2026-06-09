import { useState, useMemo } from 'react'
import { TASK_TYPE_COLORS, TASK_TYPE_PILL_LABELS, formatDisplayDate, type TaskType, inferTaskType } from '../../utils/teamCalendarUtils'
import { IPendingApproval, ICalendarEvent } from '../../services/teamCalendarService'

interface CalendarSidebarProps {
  visibleTaskTypes: TaskType[]
  visibleTeams: Array<{ team: string; color: string }>
  showClaims: boolean
  setShowClaims: (val: boolean) => void
  showAbsences: boolean
  setShowAbsences: (val: boolean) => void
  showSpans: boolean
  setShowSpans: (val: boolean) => void
  pendingApprovals?: IPendingApproval[]
  isAdminOrIT?: boolean
  onApproveLeave?: (eventId: number) => void
  onCancelLeave?: (eventId: number, name: string) => void
  isCollapsed: boolean
  onToggle: () => void
  events: ICalendarEvent[]
  selectedTaskType?: TaskType | null
  onSelectTaskType?: (type: TaskType | null) => void
  selectedStatus?: string | null
  onSelectStatus?: (status: string | null) => void
  selectedTeam?: string | null
  onSelectTeam?: (team: string | null) => void
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  '3D': '3D Modeling',
  '2D': '2D Detailing',
  'Checking': 'Checking / Review',
  'Other': 'Other Tasks',
}

export default function CalendarSidebar({
  visibleTaskTypes,
  visibleTeams,
  showClaims,
  setShowClaims,
  showAbsences,
  setShowAbsences,
  showSpans,
  setShowSpans,
  pendingApprovals = [],
  isAdminOrIT = false,
  onApproveLeave,
  onCancelLeave,
  isCollapsed,
  onToggle,
  events,
  selectedTaskType = null,
  onSelectTaskType,
  selectedStatus = null,
  onSelectStatus,
  selectedTeam = null,
  onSelectTeam,
}: CalendarSidebarProps) {
  // Sorting states: 'default' | 'alphabetical' | 'count'
  const [legendSort, setLegendSort] = useState<'default' | 'alphabetical' | 'count'>('default')
  const [statusSort, setStatusSort] = useState<'default' | 'alphabetical' | 'count'>('default')
  const [teamSort, setTeamSort] = useState<'default' | 'alphabetical' | 'count'>('default')

  // --- Dynamic Count Calculations from viewed events ---
  const taskTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    events.forEach(e => {
      if (e.event_type !== 'Task_Claim') return
      const type = inferTaskType(e.todo_title || '', e.todo_description || '')
      counts[type] = (counts[type] || 0) + 1
    })
    return counts
  }, [events])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Completed: 0, Overdue: 0, Active: 0 }
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    events.forEach(e => {
      if (e.event_type !== 'Task_Claim') return
      if (e.todo_status === 'Completed') {
        counts['Completed'] += 1
      } else if (e.due_date && new Date(e.due_date) < todayMidnight) {
        counts['Overdue'] += 1
      } else {
        counts['Active'] += 1
      }
    })
    return counts
  }, [events])

  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    events.forEach(e => {
      if (!e.team || e.team.toLowerCase() === 'general') return
      counts[e.team] = (counts[e.team] || 0) + 1
    })
    return counts
  }, [events])

  // --- Sorted Lists based on state ---
  const sortedTaskTypes = useMemo(() => {
    const list = [...visibleTaskTypes]
    if (legendSort === 'alphabetical') {
      return list.sort((a, b) => TASK_TYPE_LABELS[a].localeCompare(TASK_TYPE_LABELS[b]))
    }
    if (legendSort === 'count') {
      return list.sort((a, b) => (taskTypeCounts[b] || 0) - (taskTypeCounts[a] || 0))
    }
    return list
  }, [visibleTaskTypes, legendSort, taskTypeCounts])

  const sortedStatusItems = useMemo(() => {
    const statusItems = [
      { key: 'Completed', label: 'Completed', color: '#059669' },
      { key: 'Overdue', label: 'Overdue', color: '#dc2626' },
      { key: 'Active', label: 'Active', color: 'var(--cal-card-border)', border: true }
    ]
    if (statusSort === 'alphabetical') {
      return [...statusItems].sort((a, b) => a.label.localeCompare(b.label))
    }
    if (statusSort === 'count') {
      return [...statusItems].sort((a, b) => (statusCounts[b.key] || 0) - (statusCounts[a.key] || 0))
    }
    return statusItems
  }, [statusSort, statusCounts])

  const sortedTeams = useMemo(() => {
    const list = [...visibleTeams]
    if (teamSort === 'alphabetical') {
      return list.sort((a, b) => a.team.localeCompare(b.team))
    }
    if (teamSort === 'count') {
      return list.sort((a, b) => (teamCounts[b.team] || 0) - (teamCounts[a.team] || 0))
    }
    return list
  }, [visibleTeams, teamSort, teamCounts])

  // Helper to toggle state
  const cycleSort = (current: 'default' | 'alphabetical' | 'count', setter: (val: 'default' | 'alphabetical' | 'count') => void) => {
    const next: Record<'default' | 'alphabetical' | 'count', 'default' | 'alphabetical' | 'count'> = {
      default: 'alphabetical',
      alphabetical: 'count',
      count: 'default'
    }
    setter(next[current])
  }

  const getSortIndicator = (mode: 'default' | 'alphabetical' | 'count') => {
    if (mode === 'alphabetical') return ' (A-Z)'
    if (mode === 'count') return ' (Density)'
    return ''
  }

  return (
    <aside className={`calendar-sidebar${isCollapsed ? ' collapsed' : ''}`}>
      {!isCollapsed && (
        <button className="sidebar-collapse-btn" onClick={onToggle} title="Collapse">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* ── PENDING LEAVES ─────────────────────────────────── */}
      {pendingApprovals.length > 0 && (
        <div
          className="sidebar-section-container filter-legend-section"
          style={{ borderTop: 'none', paddingTop: '0', marginBottom: '16px' }}
        >
          <h4 className="section-title-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            PENDING LEAVES
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '18px',
              height: '18px',
              borderRadius: '999px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              fontSize: '9.5px',
              fontWeight: 800,
              padding: '0 5px',
              animation: 'critPulse 2s infinite',
            }}>
              {pendingApprovals.length}
            </span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingApprovals.map((leave) => {
              const displayName = leave.engineer_name || leave.username
              const startLabel = formatDisplayDate(leave.start_date)
              const endLabel = formatDisplayDate(leave.end_date)
              const isSameDay = leave.start_date === leave.end_date

              return (
                <div
                  key={leave.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-surface-subtle)',
                    border: '1px dashed var(--cal-card-border)',
                    transition: 'border-color 0.2s ease',
                  }}
                >
                  {/* Name + fixed Leave badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: 'var(--cal-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {displayName}
                    </span>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(220, 38, 38, 0.12)',
                      color: '#dc2626',
                      border: '1px solid rgba(220, 38, 38, 0.35)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      Leave
                    </span>
                  </div>

                  {/* Date range */}
                  <div style={{
                    fontSize: '10.5px',
                    color: 'var(--cal-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <svg
                      width="12" height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ flexShrink: 0, opacity: 0.7 }}
                    >
                      <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span>{isSameDay ? startLabel : `${startLabel} → ${endLabel}`}</span>
                  </div>

                  {/* Admin action buttons */}
                  {isAdminOrIT && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <button
                        onClick={() => onApproveLeave?.(leave.id)}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '5px',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16, 185, 129, 0.2)'
                            ; (e.currentTarget as HTMLButtonElement).style.borderColor = '#10b981'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16, 185, 129, 0.1)'
                            ; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(16, 185, 129, 0.4)'
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => onCancelLeave?.(leave.id, displayName)}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '5px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.06)',
                          color: '#ef4444',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.14)'
                            ; (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.06)'
                            ; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        ✕ Decline
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Task Type Legend — dynamic, only shows types in current view */}
      {sortedTaskTypes.length > 0 && (
        <div className="sidebar-section-container filter-legend-section" style={{ borderTop: 'none', paddingTop: '0', marginBottom: '16px' }}>
          <h4
            className="section-title-label"
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center' }}
            onClick={() => cycleSort(legendSort, setLegendSort)}
            title="Click to change sorting order"
          >
            LEGEND{getSortIndicator(legendSort)}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedTaskTypes.map(type => {
              const c = TASK_TYPE_COLORS[type]
              const pillLabel = TASK_TYPE_PILL_LABELS[type]
              const countVal = taskTypeCounts[type] || 0
              const isSelected = selectedTaskType === type
              const hasAnySelected = selectedTaskType !== null
              const itemOpacity = hasAnySelected && !isSelected ? 0.4 : 1
              return (
                <div
                  key={type}
                  className={`legend-chip-clickable ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectTaskType?.(isSelected ? null : type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    opacity: itemOpacity,
                    transition: 'all 0.2s ease',
                    padding: '4px 6px',
                    margin: '0 -6px',
                    borderRadius: '6px',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(120, 120, 120, 0.08)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {pillLabel ? (
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: c.bg,
                      color: c.text,
                      border: `1px solid ${c.border}`,
                      flexShrink: 0,
                      lineHeight: '1.4',
                      minWidth: '24px',
                      textAlign: 'center',
                    }}>
                      {pillLabel}
                    </span>
                  ) : (
                    <span style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: c.border,
                      flexShrink: 0,
                      opacity: 0.9,
                    }} />
                  )}
                  <span className="legend-name" style={{ fontSize: '12px', color: 'var(--cal-text-secondary)', fontWeight: isSelected ? 700 : 400 }}>
                    {TASK_TYPE_LABELS[type]}
                  </span>
                  {legendSort === 'count' && countVal > 0 && (
                    <span style={{ fontSize: '10.5px', color: 'var(--cal-text-muted)', marginLeft: 'auto', fontWeight: 600 }}>
                      ({countVal})
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Task Status Legend */}
      <div className="sidebar-section-container filter-legend-section" style={{ marginBottom: '16px' }}>
        <h4
          className="section-title-label"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => cycleSort(statusSort, setStatusSort)}
          title="Click to change sorting order"
        >
          Task Status{getSortIndicator(statusSort)}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {sortedStatusItems.map(item => {
            const countVal = statusCounts[item.key] || 0
            const isSelected = selectedStatus === item.key
            const hasAnySelected = selectedStatus !== null
            const itemOpacity = hasAnySelected && !isSelected ? 0.4 : 1
            return (
              <div
                key={item.key}
                className={`legend-chip-clickable ${isSelected ? 'active' : ''}`}
                onClick={() => onSelectStatus?.(isSelected ? null : item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  opacity: itemOpacity,
                  transition: 'all 0.2s ease',
                  padding: '4px 6px',
                  margin: '0 -6px',
                  borderRadius: '6px',
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(120, 120, 120, 0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  backgroundColor: item.border ? 'var(--bg-surface)' : item.color,
                  border: item.border ? `1px solid ${item.color}` : 'none',
                  flexShrink: 0,
                  opacity: 0.9
                }} />
                <span className="legend-name" style={{ fontSize: '12px', color: 'var(--cal-text-secondary)', fontWeight: isSelected ? 700 : 400 }}>
                  {item.label}
                </span>
                {statusSort === 'count' && countVal > 0 && (
                  <span style={{ fontSize: '10.5px', color: 'var(--cal-text-muted)', marginLeft: 'auto', fontWeight: 600 }}>
                    ({countVal})
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Team Legend — dynamic, teams present in current view (General excluded) */}
      {visibleTeams.length > 0 && (
        <div className="sidebar-section-container filter-legend-section" style={{ marginBottom: '16px' }}>
          <h4
            className="section-title-label"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => cycleSort(teamSort, setTeamSort)}
            title="Click to change sorting order"
          >
            Teams{getSortIndicator(teamSort)}
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {sortedTeams.map(({ team, color }) => {
              const countVal = teamCounts[team] || 0
              const isSelected = selectedTeam === team
              const hasAnySelected = selectedTeam !== null
              const itemOpacity = hasAnySelected && !isSelected ? 0.4 : 1
              return (
                <div
                  key={team}
                  className={`legend-chip-clickable ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectTeam?.(isSelected ? null : team)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    opacity: itemOpacity,
                    transition: 'all 0.2s ease',
                    padding: '4px 6px',
                    margin: '0 -6px',
                    borderRadius: '6px',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(120, 120, 120, 0.08)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '4px',
                      height: '16px',
                      borderRadius: '2px',
                      backgroundColor: color,
                      flexShrink: 0,
                    }}
                  />
                  <span className="legend-name" style={{ fontSize: '12px', color: 'var(--cal-text-secondary)', fontWeight: isSelected ? 700 : 400 }}>
                    {team}
                  </span>
                  {teamSort === 'count' && countVal > 0 && (
                    <span style={{ fontSize: '10.5px', color: 'var(--cal-text-muted)', marginLeft: 'auto', fontWeight: 600 }}>
                      ({countVal})
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: '10.5px', color: 'var(--cal-text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
            Left border color on task badges
          </p>
        </div>
      )}

      {/* Show/Hide Toggles */}
      <div className="sidebar-section-container filter-legend-section">
        <h4 className="section-title-label">Visible Events</h4>
        <div className="filter-legend-item">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={showClaims}
              onChange={e => setShowClaims(e.target.checked)}
            />
            <span className="checkbox-custom claim-checkbox"></span>
            <span className="checkbox-label">Deadlines</span>
          </label>
        </div>
        <div className="filter-legend-item">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={showAbsences}
              onChange={e => setShowAbsences(e.target.checked)}
            />
            <span className="checkbox-custom absence-checkbox"></span>
            <span className="checkbox-label">On Leave</span>
          </label>
        </div>
        <div className="filter-legend-item">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={showSpans}
              onChange={e => setShowSpans(e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            <span className="checkbox-label">Task Spans</span>
          </label>
        </div>
      </div>
    </aside>
  )
}
