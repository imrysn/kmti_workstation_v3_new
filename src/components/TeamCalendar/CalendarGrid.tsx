import React, { useState, useEffect } from 'react'
import { ICalendarEvent } from '../../services/teamCalendarService'
import { IHoliday, formatLocalDate, inferTaskType, getTaskTypeColor, getTeamColor } from '../../utils/teamCalendarUtils'
import { GlobeIcon, LockIcon, CheckIcon, TargetIcon } from './Icons'
import EventTooltip from './EventTooltip'

interface CalendarGridProps {
  isLoading?: boolean
  viewMode: 'month' | 'week'
  calendarDays: Date[]
  displayDate: Date
  events: ICalendarEvent[]
  phHolidays: Record<string, IHoliday>
  showClaims: boolean
  showAbsences: boolean
  showSpans: boolean
  handleCellClick: (day: Date, dateStr: string) => void
  setSelectedEvent: (event: ICalendarEvent | null) => void
  setActivePopoverDate: (day: Date | null) => void
}

export default function CalendarGrid({
  isLoading,
  viewMode,
  calendarDays,
  displayDate,
  events,
  phHolidays,
  showClaims,
  showAbsences,
  showSpans,
  handleCellClick,
  setSelectedEvent,
  setActivePopoverDate
}: CalendarGridProps) {
  const [tooltipEvent, setTooltipEvent] = useState<ICalendarEvent | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null)
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= 1024)

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMouseEnter = (e: React.MouseEvent, event: ICalendarEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // position tooltip slightly below and right of the badge
    setTooltipPos({ x: rect.left, y: rect.bottom + 4 })
    setTooltipRect(rect)
    setTooltipEvent(event)
  }

  const handleMouseLeave = () => {
    setTooltipEvent(null)
    setTooltipRect(null)
  }

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

          // Check if this day has a protected company holiday block
          const hasCompanyHoliday = visibleEvents.some(e => e.event_type === 'Company_Event' && e.leave_type === 'Holiday')

          // Cell class computation
          const cellClasses = [
            "grid-cell",
            !isCurrentMonth ? "outside-month" : "",
            isToday ? "today-cell" : "",
            isWeekend ? "weekend-cell" : "",
            isFriday ? "friday-cell" : "",
            hasCompanyHoliday ? "company-holiday-block" : ""
          ].filter(Boolean).join(" ")


          // Small screen: 2 tasks → show both (good UI); 3+ → collapse to 1 + n more
          const maxVisible = (isSmallScreen && visibleEvents.length > 2) ? 1 : 2
          const shouldTruncate = viewMode === 'month' && visibleEvents.length > maxVisible
          const renderedEvents = shouldTruncate ? visibleEvents.slice(0, maxVisible) : visibleEvents
          const overflowCount = visibleEvents.length - renderedEvents.length

          const isFirstOfMonth = day.getDate() === 1
          const dayLabelText = isFirstOfMonth
            ? `${day.toLocaleDateString('default', { month: 'short' })} 1`
            : day.getDate()

          return (
            <div
              key={idx}
              className={cellClasses}
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
                {isLoading ? (
                  <div className="skeleton-cell" />
                ) : (
                  renderedEvents.map(event => {
                    const isAbsence = event.event_type === 'Day_Off'
                    const isOffsetHoliday = event.event_type === 'Company_Event' && event.leave_type === 'Holiday'
                    const isCompanyEvent = event.event_type === 'Company_Event' && event.leave_type !== 'Holiday'
                    const displayName = event.engineer_name || event.username
                    const taskType = inferTaskType(event.todo_title, event.todo_description)
                    const taskColor = getTaskTypeColor(taskType)
                    const teamAccent = getTeamColor(event.team)
                    
                    const hasDueDate = event.due_date != null
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)

                    const isOverdue = event.event_type === 'Task_Claim' && 
                                     event.todo_status === 'Claimed' && 
                                     hasDueDate &&
                                     new Date(event.due_date!) < today
                    
                    const isCompleted = event.todo_status === 'Completed'

                    return (
                      <div
                        key={event.id}
                        className={`event-badge ${
                          isOffsetHoliday
                            ? 'absence-badge leave-absence'
                            : isCompanyEvent
                              ? 'company-event-badge'
                              : isAbsence
                                ? event.status === 'Pending'
                                  ? 'absence-badge pending-absence-badge leave-absence'
                                  : 'absence-badge leave-absence'
                                : isCompleted
                                ? 'claim-badge completed-claim-badge'
                                : isOverdue
                                  ? 'claim-badge overdue-claim-badge'
                                  : 'claim-badge'
                        }`}
                        style={(!isAbsence && !isCompanyEvent && !isOffsetHoliday && !isCompleted && !isOverdue) ? {
                          background: taskColor.bg,
                          borderLeftColor: teamAccent !== 'transparent' ? teamAccent : taskColor.border,
                          color: taskColor.text,
                          cursor: 'default'
                        } : undefined}
                        onClick={(e) => {
                          if (event.event_type !== 'Task_Claim') {
                            e.stopPropagation()
                            setSelectedEvent(event)
                          }
                        }}
                        onMouseEnter={(e) => handleMouseEnter(e, event)}
                        onMouseLeave={handleMouseLeave}
                      >
                        <span className="event-badge-icon">
                          {isOffsetHoliday
                            ? <LockIcon />
                            : isCompanyEvent 
                              ? <GlobeIcon /> 
                              : isAbsence 
                                ? <LockIcon /> 
                                : isCompleted
                                  ? <CheckIcon />
                                  : <TargetIcon />}
                        </span>
                        <span className="event-badge-text">
                          {isOffsetHoliday
                            ? `Holiday: ${event.engineer_name}`
                            : isCompanyEvent 
                              ? `Event: ${event.engineer_name}` 
                              : isAbsence 
                              ? displayName 
                              : (event.todo_title && event.todo_title.length > 25 
                                ? `${event.todo_title.substring(0, 25)}...` 
                                : event.todo_title)}
                        </span>
                      </div>
                    )
                  })
                )}

                {shouldTruncate && !isLoading && (
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
      <EventTooltip event={tooltipEvent!} position={tooltipPos} anchorRect={tooltipRect} isVisible={!!tooltipEvent} />
    </>
  )
}
