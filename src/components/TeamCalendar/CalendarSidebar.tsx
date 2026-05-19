
interface CalendarSidebarProps {
  visibleEngineers: Array<{
    userId: number
    name: string
    color: { bg: string; border: string; text: string }
  }>
  showClaims: boolean
  setShowClaims: (val: boolean) => void
  showAbsences: boolean
  setShowAbsences: (val: boolean) => void
}

export default function CalendarSidebar({
  visibleEngineers,
  showClaims,
  setShowClaims,
  showAbsences,
  setShowAbsences
}: CalendarSidebarProps) {
  return (
    <aside className="calendar-sidebar">
      {/* Employee Legend */}
      {visibleEngineers.length > 0 && (
        <div className="sidebar-section-container filter-legend-section" style={{ borderTop: 'none', paddingTop: '0', marginBottom: '16px' }}>
          <h4 className="section-title-label">Employee Legend</h4>
          <div className="engineer-legend-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px 12px', maxHeight: '360px', overflowY: 'auto' }}>
            {visibleEngineers.map(eng => (
              <div key={eng.userId} className="legend-chip" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  className="legend-color-dot"
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: eng.color.border,
                    flexShrink: 0
                  }}
                />
                <span className="legend-name" title={eng.name} style={{ fontSize: '12px', color: 'var(--cal-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {eng.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show/Hide Toggles (Calendar Legends) */}
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
      </div>
    </aside>
  )
}
