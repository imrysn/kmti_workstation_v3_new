import { TASK_TYPE_COLORS, type TaskType } from '../../utils/teamCalendarUtils'

interface CalendarSidebarProps {
  visibleTaskTypes: TaskType[]
  visibleTeams: Array<{ team: string; color: string }>
  showClaims: boolean
  setShowClaims: (val: boolean) => void
  showAbsences: boolean
  setShowAbsences: (val: boolean) => void
  showSpans: boolean
  setShowSpans: (val: boolean) => void
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  '3D': '3D Modelling',
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
  setShowSpans
}: CalendarSidebarProps) {
  return (
    <aside className="calendar-sidebar">

      {/* Task Type Legend — dynamic, only shows types in current view */}
      {visibleTaskTypes.length > 0 && (
        <div className="sidebar-section-container filter-legend-section" style={{ borderTop: 'none', paddingTop: '0', marginBottom: '16px' }}>
          <h4 className="section-title-label">LEGEND</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {visibleTaskTypes.map(type => {
              const c = TASK_TYPE_COLORS[type]
              return (
                <div key={type} className="legend-chip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      backgroundColor: c.border,
                      flexShrink: 0,
                      opacity: 0.9,
                    }}
                  />
                  <span className="legend-name" style={{ fontSize: '12px', color: 'var(--cal-text-secondary)' }}>
                    {TASK_TYPE_LABELS[type]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team Legend — dynamic, teams present in current view (General excluded) */}
      {visibleTeams.length > 0 && (
        <div className="sidebar-section-container filter-legend-section" style={{ marginBottom: '16px' }}>
          <h4 className="section-title-label">Teams</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {visibleTeams.map(({ team, color }) => (
              <div key={team} className="legend-chip" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                <span className="legend-name" style={{ fontSize: '12px', color: 'var(--cal-text-secondary)' }}>
                  {team}
                </span>
              </div>
            ))}
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
            <span className="checkbox-label">Task Claims</span>
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
            <span className="checkbox-label">Protected Absences</span>
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
            <span className="checkbox-label">Display Task Spans</span>
          </label>
        </div>
      </div>
    </aside>
  )
}
