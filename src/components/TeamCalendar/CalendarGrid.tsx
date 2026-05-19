import { ICalendarEvent } from '../../services/teamCalendarService'
import { IHoliday, formatLocalDate, getEngineerColor } from '../../utils/teamCalendarUtils'
import { GlobeIcon, LockIcon, BriefcaseIcon } from './Icons'

interface CalendarGridProps {
  viewMode: 'month' | 'week'
  calendarDays: Date[]
  displayDate: Date
  events: ICalendarEvent[]
  phHolidays: Record<string, IHoliday>
  showClaims: boolean
  showAbsences: boolean
  claimingTask: any
  claimStartDate: string | null
  handleCellClick: (day: Date, dateStr: string) => void
  setSelectedEvent: (event: ICalendarEvent | null) => void
  setActivePopoverDate: (day: Date | null) => void
}

export default function CalendarGrid({
  viewMode,
  calendarDays,
  displayDate,
  events,
  phHolidays,
  showClaims,
  showAbsences,
  claimingTask,
  claimStartDate,
  handleCellClick,
  setSelectedEvent,
  setActivePopoverDate
}: CalendarGridProps) {
  return (
    <>
      {/* Day Headers (Sun - Sat) */}
      <div className="calendar-grid-header">
        <div className="header-cell weekend-header">SUN</div>
        <div className="header-cell">MON</div>
        <div className="header-cell">TUE</div>
        <div className="header-cell">WED</div>
        <div className="header-cell">THU</div>
        <div className="header-cell friday-header" title="Friday is a short day: 7am - 4pm">FRI <span className="short-day-dot"></span></div>
        <div className="header-cell weekend-header">SAT</div>
      </div>

      <div className={`calendar-grid-body ${viewMode}-view custom-scrollbar`}>
        {calendarDays.map((day, idx) => {
          const dateStr = formatLocalDate(day)
          const cellHoliday = phHolidays[dateStr]
          const isCurrentMonth = day.getMonth() === displayDate.getMonth()
          const isToday = new Date().toDateString() === day.toDateString()
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          const isFriday = day.getDay() === 5

          // Find events targeting this day
          const dayEvents = events.filter(e => {
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

          // Cell class computation
          const cellClasses = [
            "grid-cell",
            !isCurrentMonth ? "outside-month" : "",
            isToday ? "today-cell" : "",
            claimingTask ? "claim-mode-cell" : "",
            claimStartDate === dateStr ? "claim-start-cell" : "",
            isWeekend ? "weekend-cell" : "",
            isFriday ? "friday-cell" : ""
          ].filter(Boolean).join(" ")

          // Check if this day has a protected absence block
          const hasAbsence = visibleEvents.some(e => e.event_type === 'Day_Off')

          const shouldTruncate = viewMode === 'month' && visibleEvents.length > 2
          const renderedEvents = shouldTruncate ? visibleEvents.slice(0, 2) : visibleEvents
          const overflowCount = visibleEvents.length - renderedEvents.length

          const isFirstOfMonth = day.getDate() === 1
          const dayLabelText = isFirstOfMonth
            ? `${day.toLocaleDateString('default', { month: 'short' })} 1`
            : day.getDate()

          return (
            <div
              key={idx}
              className={`${cellClasses} ${hasAbsence ? 'absence-block' : ''}`}
              onClick={() => handleCellClick(day, dateStr)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '4px' }}>
                <span className={`day-number-label ${isFirstOfMonth ? 'first-of-month-label' : ''}`}>{dayLabelText}</span>
                {cellHoliday && (
                  <span className={`ph-holiday-tag ${cellHoliday.isRegular ? 'regular' : 'special'}`} title={`${cellHoliday.name} (${cellHoliday.isRegular ? 'Regular' : 'Special Non-Working'} Holiday)`}>
                    {cellHoliday.name}
                  </span>
                )}
              </div>

              <div className="cell-events custom-scrollbar">
                {renderedEvents.map(event => {
                  const isAbsence = event.event_type === 'Day_Off'
                  const isCompanyEvent = event.event_type === 'Company_Event'
                  const displayName = event.engineer_name || event.username
                  const engColor = getEngineerColor(event.user_id)
                  const isOverdue = event.event_type === 'Task_Claim' && event.todo_status === 'Claimed' && event.end_date < formatLocalDate(new Date())
                  return (
                    <div
                      key={event.id}
                      className={`event-badge ${isCompanyEvent
                        ? 'company-event-badge'
                        : isAbsence
                          ? event.status === 'Pending'
                            ? 'absence-badge pending-absence-badge leave-absence'
                            : 'absence-badge leave-absence'
                          : isOverdue
                            ? 'claim-badge overdue-claim-badge'
                            : 'claim-badge'
                        }`}
                      style={(!isAbsence && !isCompanyEvent) ? {
                        background: engColor.bg,
                        borderLeftColor: engColor.border,
                        color: engColor.text
                      } : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedEvent(event)
                      }}
                      title={isCompanyEvent ? `Company Event: ${event.engineer_name} (${event.leave_type || 'Other'})` : isAbsence ? 'On Leave' : `${displayName}: ${event.todo_title}`}
                    >
                      <span className="event-badge-icon">
                        {isCompanyEvent ? <GlobeIcon /> : isAbsence ? <LockIcon /> : <BriefcaseIcon />}
                      </span>
                      <span className="event-badge-text">
                        {isCompanyEvent 
                          ? `Event: ${event.engineer_name}` 
                          : isAbsence 
                            ? displayName 
                            : (event.todo_title && event.todo_title.length > 25 
                              ? `${event.todo_title.substring(0, 25)}...` 
                              : event.todo_title)}
                      </span>
                    </div>
                  )
                })}

                {shouldTruncate && (
                  <div
                    className="more-events-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActivePopoverDate(day)
                    }}
                  >
                    +{overflowCount} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
