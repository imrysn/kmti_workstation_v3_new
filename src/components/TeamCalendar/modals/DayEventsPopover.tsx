import { ICalendarEvent } from '../../../services/teamCalendarService'
import { IHoliday, formatLocalDate, getEngineerColor, formatDurationRange } from '../../../utils/teamCalendarUtils'
import { CalendarIcon, GlobeIcon, LockIcon, BriefcaseIcon } from '../Icons'

interface DayEventsPopoverProps {
  activePopoverDate: Date
  events: ICalendarEvent[]
  phHolidays: Record<string, IHoliday>
  showClaims: boolean
  showAbsences: boolean
  isAdminOrIT: boolean
  setSelectedEvent: (event: ICalendarEvent | null) => void
  setCompanyEventStart: (val: string) => void
  setCompanyEventEnd: (val: string) => void
  setCompanyEventTitle: (val: string) => void
  setCompanyEventCategory: (val: any) => void
  setIsAddingCompanyEvent: (val: boolean) => void
  onClose: () => void
}

export default function DayEventsPopover({
  activePopoverDate,
  events,
  phHolidays,
  showClaims,
  showAbsences,
  isAdminOrIT,
  setSelectedEvent,
  setCompanyEventStart,
  setCompanyEventEnd,
  setCompanyEventTitle,
  setCompanyEventCategory,
  setIsAddingCompanyEvent,
  onClose
}: DayEventsPopoverProps) {
  const formatPopoverDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    })
  }

  const dateStr = formatLocalDate(activePopoverDate)
  const dayHoliday = phHolidays[dateStr]

  const dayEvents = events.filter(e => {
    const start = new Date(e.start_date)
    const end = new Date(e.end_date)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    const current = new Date(activePopoverDate)
    current.setHours(0, 0, 0, 0)
    return current >= start && current <= end
  }).filter(e => {
    const isWeekend = activePopoverDate.getDay() === 0 || activePopoverDate.getDay() === 6
    if (isWeekend && (e.event_type === 'Task_Claim' || e.event_type === 'Day_Off')) return false
    if (e.event_type === 'Task_Claim' && !showClaims) return false
    if (e.event_type === 'Day_Off' && !showAbsences) return false
    return true
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content cal-modal-card animated zoomIn" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon />
            <span>
              {new Date().toDateString() === activePopoverDate.toDateString()
                ? 'Events Today'
                : `Events on ${formatPopoverDate(activePopoverDate)}`}
            </span>
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="event-detail-body custom-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
          {dayHoliday && (
            <div style={{
              background: dayHoliday.isRegular ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
              border: `1px solid ${dayHoliday.isRegular ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px' }}>{dayHoliday.isRegular ? '🗓️' : '✨'}</span>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: dayHoliday.isRegular ? '#ef4444' : '#f59e0b' }}>
                  {dayHoliday.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--cal-text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>
                  {dayHoliday.isRegular ? 'Regular Holiday' : 'Special Non-Working Day'}
                </div>
              </div>
            </div>
          )}

          {dayEvents.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px', fontSize: '12.5px' }}>
              No tasks or absences scheduled for this day.
            </div>
          ) : (
            dayEvents.map(event => {
              const isAbsence = event.event_type === 'Day_Off'
              const isCompanyEvent = event.event_type === 'Company_Event'
              const displayName = event.engineer_name || event.username
              const engColor = getEngineerColor(event.user_id)
              const isOverdue = event.event_type === 'Task_Claim' && event.todo_status === 'Claimed' && event.end_date < formatLocalDate(new Date())

              return (
                <div
                  key={event.id}
                  className={`agenda-event-card ${isCompanyEvent ? 'company-card' : isAbsence ? 'absence-card' : 'claim-card'} ${isOverdue ? 'overdue' : ''}`}
                  onClick={() => {
                    setSelectedEvent(event)
                    onClose()
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '14px',
                    borderRadius: '8px',
                    border: `1px solid ${isCompanyEvent ? '#6366f1' : isAbsence ? 'var(--cal-card-border)' : engColor.border}`,
                    background: isCompanyEvent
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))'
                      : 'var(--bg-surface-subtle)',
                    borderLeft: `5px solid ${isCompanyEvent ? '#6366f1' : isAbsence ? 'var(--cal-text-muted)' : engColor.border}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: isCompanyEvent ? '#6366f1' : isAbsence ? 'var(--cal-text-muted)' : engColor.border, display: 'flex', alignItems: 'center' }}>
                        {isCompanyEvent ? <GlobeIcon /> : isAbsence ? <LockIcon /> : <BriefcaseIcon />}
                      </span>
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--cal-text-primary)', textTransform: isCompanyEvent || isAbsence ? undefined : 'uppercase', letterSpacing: isCompanyEvent || isAbsence ? undefined : '0.3px' }}>
                        {isCompanyEvent
                          ? `Company Event: ${event.engineer_name}`
                          : isAbsence
                            ? displayName
                            : event.todo_title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {isCompanyEvent && (
                        <span className="priority-badge priority-normal" style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc' }}>
                          {event.leave_type || 'Event'}
                        </span>
                      )}
                      {!isAbsence && !isCompanyEvent && isOverdue && (
                        <span className="priority-badge priority-critical" style={{ animation: 'pulse 1.5s infinite' }}>Overdue</span>
                      )}
                    </div>
                  </div>
                  {!isAbsence && !isCompanyEvent && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '22px' }}>
                      {event.todo_description && (
                        <p style={{ margin: '0', fontSize: '12.5px', color: 'var(--cal-text-secondary)' }}>{event.todo_description}</p>
                      )}
                      <p style={{ margin: '0', fontSize: '11px', color: 'var(--cal-text-muted)', fontWeight: 500 }}>
                        by: <span style={{ fontWeight: 600 }}>{displayName}</span>
                      </p>
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: 'var(--cal-text-muted)', paddingLeft: '22px' }}>
                    Duration: {formatDurationRange(event.start_date, event.end_date)}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
          {isAdminOrIT && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px' }}
              onClick={() => {
                const dateStr = formatLocalDate(activePopoverDate)
                setCompanyEventStart(dateStr)
                setCompanyEventEnd(dateStr)
                setCompanyEventTitle('')
                setCompanyEventCategory('Other')
                setIsAddingCompanyEvent(true)
                onClose()
              }}
            >
              <span>+ Add Event</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            style={isAdminOrIT ? undefined : { width: '100%' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
