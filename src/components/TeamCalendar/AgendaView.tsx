import { ICalendarEvent } from '../../services/teamCalendarService'
import { IHoliday, formatLocalDate, inferTaskType, getTaskTypeColor, getTeamColor, formatDurationRange, formatDisplayDateTime, TASK_TYPE_PILL_LABELS, TASK_TYPE_COLORS } from '../../utils/teamCalendarUtils'
import { GlobeIcon, LockIcon, CheckIcon } from './Icons'

interface AgendaViewProps {
  agendaDays: Date[]
  events: ICalendarEvent[]
  phHolidays: Record<string, IHoliday>
  showClaims: boolean
  showAbsences: boolean
  showSpans: boolean
  setSelectedEvent: (event: ICalendarEvent | null) => void
}

export default function AgendaView({
  agendaDays,
  events,
  phHolidays,
  showClaims,
  showAbsences,
  showSpans,
  setSelectedEvent
}: AgendaViewProps) {
  return (
    <div className="agenda-view-container custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px', minHeight: '0', flex: '1', overflowY: 'auto' }}>
      {agendaDays.map((day) => {
        const isToday = new Date().toDateString() === day.toDateString()
        const dateStr = formatLocalDate(day)
        const dayHoliday = phHolidays[dateStr]
        const isWeekend = day.getDay() === 0 || day.getDay() === 6
        const isFriday = day.getDay() === 5

        // Get events targeting this day
        const dayEvents = events.filter(e => {
          if (e.event_type === 'Task_Claim' && !showSpans) {
            const targetDateStr = e.due_date || e.end_date
            return dateStr === targetDateStr
          }
          const start = new Date(e.start_date)
          const end = new Date(e.end_date)
          start.setHours(0, 0, 0, 0)
          end.setHours(0, 0, 0, 0)
          const current = new Date(day)
          current.setHours(0, 0, 0, 0)
          return current >= start && current <= end
        })

        // Filter by visible toggles and hide weekend tasks/absences
        const visibleEvents = dayEvents.filter(e => {
          if (isWeekend && (e.event_type === 'Task_Claim' || e.event_type === 'Day_Off')) return false
          if (e.event_type === 'Task_Claim' && !showClaims) return false
          if (e.event_type === 'Day_Off' && !showAbsences) return false
          return true
        })

        const dayHeaderStr = day.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })

        return (
          <div key={dateStr} className={`agenda-day-row ${isToday ? 'today-row' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--cal-card-border)', opacity: isWeekend ? 0.75 : 1 }}>
            <div className="agenda-day-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="agenda-day-title" style={{ fontSize: '15px', fontWeight: '750', color: isToday ? 'var(--cal-primary)' : 'var(--cal-text-primary)' }}>{dayHeaderStr}</span>
              {isToday && <span className="today-badge" style={{ backgroundColor: 'var(--cal-primary)', color: '#fff', fontSize: '9.5px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>TODAY</span>}
              {dayHoliday && (
                <span className={`ph-holiday-tag ${dayHoliday.isRegular ? 'regular' : 'special'}`} style={{ fontSize: '9.5px', padding: '2px 8px', borderRadius: '12px' }} title={`${dayHoliday.name} (${dayHoliday.isRegular ? 'Regular' : 'Special Non-Working'} Holiday)`}>
                  {dayHoliday.name}
                </span>
              )}
              {isWeekend ? (
                <span style={{ fontSize: '9.5px', fontWeight: '600', color: 'var(--cal-text-muted)', background: 'var(--bg-surface-subtle)', border: '1px solid var(--cal-card-border)', padding: '2px 8px', borderRadius: '12px' }}>NON-WORKING</span>
              ) : isFriday ? (
                <span style={{ fontSize: '9.5px', fontWeight: '600', color: 'var(--cal-accent)', background: 'var(--bg-danger-subtle)', border: '1px solid var(--cal-accent)', padding: '2px 8px', borderRadius: '12px' }}>SHORT DAY (4PM CUTOFF)</span>
              ) : (
                <span style={{ fontSize: '9.5px', fontWeight: '500', color: 'var(--cal-text-muted)', opacity: 0.7 }}>7 AM – 6 PM</span>
              )}
            </div>
            <div className="agenda-events-list" style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
              {visibleEvents.length === 0 ? (
                <div className="agenda-empty-events" style={{ fontSize: '12.5px', color: 'var(--cal-text-muted)', fontStyle: 'italic' }}>No scheduled tasks or absences.</div>
              ) : (
                visibleEvents.map(event => {
                  const isAbsence = event.event_type === 'Day_Off'
                  const isCompanyEvent = event.event_type === 'Company_Event'
                  const displayName = event.engineer_name || event.username
                  const taskType = inferTaskType(event.todo_title, event.todo_description)
                  const taskColor = getTaskTypeColor(taskType)
                  const teamAccent = getTeamColor(event.team)
                  
                  const isCompleted = event.todo_status === 'Completed'
                  const isOverdue = event.event_type === 'Task_Claim' && event.todo_status === 'Claimed' && event.end_date < formatLocalDate(new Date())

                  const accentColor = isCompleted 
                    ? '#059669' 
                    : isOverdue 
                      ? '#dc2626' 
                      : (!isAbsence && !isCompanyEvent)
                        ? (teamAccent !== 'transparent' ? teamAccent : taskColor.border)
                        : isCompanyEvent ? '#6366f1' : 'var(--cal-text-muted)'

                  return (
                    <div
                      key={event.id}
                      className={`agenda-event-card ${isCompanyEvent ? 'company-card' : isAbsence ? 'absence-card' : 'claim-card'} ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}
                      onClick={() => {
                        if (event.event_type !== 'Task_Claim') {
                          setSelectedEvent(event)
                        }
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${accentColor}`,
                        background: isCompanyEvent
                          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))'
                          : isCompleted
                            ? 'rgba(5, 150, 105, 0.08)'
                            : isOverdue
                              ? 'rgba(220, 38, 38, 0.08)'
                              : (!isAbsence ? taskColor.bg : 'var(--bg-surface-subtle)'),
                        borderLeft: `4.5px solid ${accentColor}`,
                        cursor: isAbsence || isCompanyEvent ? 'pointer' : 'default',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="event-icon" style={{ display: 'flex', alignItems: 'center', color: accentColor, flexShrink: 0 }}>
                            {isCompanyEvent
                              ? <GlobeIcon />
                              : isAbsence
                                ? <LockIcon />
                                : isCompleted
                                  ? <CheckIcon />
                                  : TASK_TYPE_PILL_LABELS[taskType]
                                    ? (
                                      <span style={{
                                        fontSize: '9px',
                                        fontWeight: 800,
                                        letterSpacing: '0.05em',
                                        padding: '2px 5px',
                                        borderRadius: '4px',
                                        background: TASK_TYPE_COLORS[taskType].bg,
                                        color: TASK_TYPE_COLORS[taskType].text,
                                        border: `1px solid ${TASK_TYPE_COLORS[taskType].border}`,
                                        lineHeight: '1.4',
                                        userSelect: 'none',
                                      }}>
                                        {TASK_TYPE_PILL_LABELS[taskType]}
                                      </span>
                                    )
                                    : null}
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--cal-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                          {!isAbsence && !isCompanyEvent && isCompleted && (
                            <span className="priority-badge priority-normal" style={{ background: 'rgba(5, 150, 105, 0.2)', border: '1px solid rgba(5, 150, 105, 0.4)', color: '#10b981' }}>Completed</span>
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
                            Task: <span style={{ fontWeight: 600 }}>{displayName}</span>
                          </p>
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: 'var(--cal-text-muted)', paddingLeft: '22px' }}>
                        Duration: {formatDurationRange(event.start_date, event.end_date)}
                      </div>
                      {event.completed_at && (
                        <div style={{ fontSize: '11px', color: 'var(--cal-text-muted)', paddingLeft: '22px', marginTop: '2px' }}>
                          Completed: {formatDisplayDateTime(event.completed_at)}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
