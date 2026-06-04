import { useEffect } from 'react'
import { ICalendarEvent } from '../../../services/teamCalendarService'
import { IHoliday, formatLocalDate, inferTaskType, getTaskTypeColor, getTeamColor, formatDurationRange, formatDisplayDateTime, TASK_TYPE_PILL_LABELS, TASK_TYPE_COLORS } from '../../../utils/teamCalendarUtils'
import { CalendarIcon, GlobeIcon, LockIcon, CheckIcon } from '../Icons'

interface DayEventsPopoverProps {
  activePopoverDate: Date
  events: ICalendarEvent[]
  phHolidays: Record<string, IHoliday>
  showClaims: boolean
  showAbsences: boolean
  showSpans: boolean
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
  showSpans,
  isAdminOrIT,
  setSelectedEvent,
  setCompanyEventStart,
  setCompanyEventEnd,
  setCompanyEventTitle,
  setCompanyEventCategory,
  setIsAddingCompanyEvent,
  onClose
}: DayEventsPopoverProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
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
    if (e.event_type === 'Task_Claim' && !showSpans) {
      const targetDateStr = e.due_date || e.end_date
      return dateStr === targetDateStr
    }
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
              No tasks or on-leave scheduled for this day.
            </div>
          ) : (
            dayEvents.map(event => {
              const isAbsence = event.event_type === 'Day_Off'
              const isPendingAbsence = isAbsence && event.status === 'Pending'
              const isOffsetHoliday = event.event_type === 'Company_Event' && event.leave_type === 'Holiday'
              const isCompanyEvent = event.event_type === 'Company_Event' && event.leave_type !== 'Holiday'
              const displayName = event.engineer_name || event.username
              const taskType = inferTaskType(event.todo_title, event.todo_description)
              const taskColor = getTaskTypeColor(taskType)
              const teamAccent = getTeamColor(event.team)
              const hasDueDate = event.due_date != null
              const isCompleted = event.todo_status === 'Completed'
              const todayMidnight = new Date()
              todayMidnight.setHours(0, 0, 0, 0)
              const isOverdue = event.event_type === 'Task_Claim' && event.todo_status === 'Claimed' && hasDueDate && new Date(event.due_date!) < todayMidnight

              const accentColor = isPendingAbsence
                ? '#dc2626'
                : isCompleted
                  ? '#059669'
                  : isOverdue
                    ? '#dc2626'
                    : (!isAbsence && !isCompanyEvent && !isOffsetHoliday)
                      ? (teamAccent !== 'transparent' ? teamAccent : taskColor.border)
                      : isCompanyEvent ? '#6366f1' : 'var(--cal-text-muted)'

              return (
                <div
                  key={event.id}
                  className={`agenda-event-card ${isCompanyEvent ? 'company-card' : isOffsetHoliday || isAbsence ? 'absence-card' : 'claim-card'} ${isOverdue ? 'overdue' : ''}`}
                  onClick={() => {
                    if (event.event_type !== 'Task_Claim') {
                      setSelectedEvent(event)
                      onClose()
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '14px',
                    borderRadius: '8px',
                    border: isPendingAbsence
                      ? '1.5px dashed rgba(220, 38, 38, 0.6)'
                      : `1px solid ${accentColor}`,
                    background: isPendingAbsence
                      ? 'rgba(220, 38, 38, 0.07)'
                      : isCompanyEvent
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))'
                        : isOffsetHoliday
                          ? 'var(--bg-surface-subtle)'
                          : isCompleted
                            ? 'rgba(5, 150, 105, 0.08)'
                            : isOverdue
                              ? 'rgba(220, 38, 38, 0.08)'
                              : (!isAbsence ? 'var(--bg-surface-subtle)' : 'var(--bg-surface-subtle)'),
                    borderLeft: isPendingAbsence
                      ? '5px dashed rgba(220, 38, 38, 0.6)'
                      : `5px solid ${accentColor}`,
                    cursor: isAbsence || isCompanyEvent || isOffsetHoliday ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                    animation: isPendingAbsence ? 'pendingPulse 2.5s ease-in-out infinite' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: accentColor, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {isOffsetHoliday ? <LockIcon /> : isCompanyEvent ? <GlobeIcon /> : isAbsence ? <LockIcon /> : isCompleted
                            ? <CheckIcon />
                            : TASK_TYPE_PILL_LABELS[taskType]
                              ? (
                                <span style={{
                                  fontSize: '9px', fontWeight: 800, letterSpacing: '0.05em',
                                  padding: '2px 5px', borderRadius: '4px',
                                  background: TASK_TYPE_COLORS[taskType].bg,
                                  color: TASK_TYPE_COLORS[taskType].text,
                                  border: `1px solid ${TASK_TYPE_COLORS[taskType].border}`,
                                  lineHeight: '1.4', userSelect: 'none',
                                }}>
                                  {TASK_TYPE_PILL_LABELS[taskType]}
                                </span>
                              ) : null}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: '700', color: isPendingAbsence ? '#dc2626' : 'var(--cal-text-primary)' }}>
                          {isOffsetHoliday
                            ? `Holiday: ${event.engineer_name}`
                            : isCompanyEvent
                              ? `Company Event: ${event.engineer_name}`
                              : isAbsence
                                ? displayName
                                : event.todo_title}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {isPendingAbsence && (
                          <span style={{
                            fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.04em',
                            padding: '2px 7px', borderRadius: '4px',
                            background: 'rgba(220, 38, 38, 0.12)',
                            color: '#dc2626',
                            border: '1px dashed rgba(220, 38, 38, 0.5)',
                          }}>
                            Pending
                          </span>
                        )}
                      {isCompanyEvent && (
                        <span className="priority-badge priority-normal" style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#a5b4fc' }}>
                          {event.leave_type || 'Event'}
                        </span>
                      )}
                      {isOffsetHoliday && (
                        <span className="priority-badge priority-normal" style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#d97706' }}>
                          Offset Holiday
                        </span>
                      )}
                      {!isAbsence && !isCompanyEvent && !isOffsetHoliday && isCompleted && (
                        <span className="priority-badge priority-normal" style={{ background: 'rgba(5, 150, 105, 0.2)', border: '1px solid rgba(5, 150, 105, 0.4)', color: '#10b981' }}>Completed</span>
                      )}
                      {!isAbsence && !isCompanyEvent && !isOffsetHoliday && isOverdue && (
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
