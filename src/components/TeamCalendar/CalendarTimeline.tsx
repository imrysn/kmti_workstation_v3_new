import React, { useState, useRef, useEffect } from 'react'
import { ICalendarEvent } from '../../services/teamCalendarService'
import { IHoliday, formatLocalDate, inferTaskType, getTaskTypeColor } from '../../utils/teamCalendarUtils'
import { GlobeIcon, LockIcon, CheckIcon, TargetIcon } from './Icons'
import EventTooltip from './EventTooltip'

interface CalendarTimelineProps {
  isLoading?: boolean
  calendarDays: Date[]
  events: ICalendarEvent[]
  phHolidays: Record<string, IHoliday>
  showClaims: boolean
  showAbsences: boolean
  setSelectedEvent: (event: ICalendarEvent | null) => void
}

export default function CalendarTimeline({
  isLoading,
  calendarDays,
  events,
  phHolidays,
  showClaims,
  showAbsences,
  setSelectedEvent
}: CalendarTimelineProps) {
  const [tooltipEvent, setTooltipEvent] = useState<ICalendarEvent | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = timelineRef.current
    if (!el) return

    const handleNativeWheel = (e: WheelEvent) => {
      // If shift is held and there's vertical scroll delta, translate it to horizontal
      if (e.shiftKey && e.deltaY !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }

    el.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleNativeWheel)
  }, [])

  const handleMouseEnter = (e: React.MouseEvent, event: ICalendarEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.left, y: rect.bottom + 4 })
    setTooltipEvent(event)
  }
  const handleMouseLeave = () => setTooltipEvent(null)

  const visibleEvents = events.filter(e => {
    if (e.event_type === 'Task_Claim' && !showClaims) return false
    if (e.event_type === 'Day_Off' && !showAbsences) return false
    return true
  })

  const engineers = Array.from(new Set(visibleEvents.map(e => e.engineer_name || e.username || 'Unassigned'))).sort()

  const getDateIndex = (dateStr: string) => {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    for (let i = 0; i < calendarDays.length; i++) {
      if (calendarDays[i].toDateString() === d.toDateString()) return i
    }
    return -1
  }

  return (
    <div ref={timelineRef} className="timeline-view custom-scrollbar" style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--cal-card-border)' }}>
      <div style={{ minWidth: '1200px', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="timeline-header" style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid var(--cal-card-border)', background: 'var(--bg-secondary)' }}>
          <div className="timeline-engineer-col" style={{ position: 'sticky', left: 0, zIndex: 30, width: '200px', flexShrink: 0, padding: '12px', borderRight: '1px solid var(--cal-card-border)', fontWeight: 600, color: 'var(--cal-text-muted)', background: 'var(--bg-secondary)' }}>
            ENGINEER
          </div>
          <div className="timeline-days-col" style={{ display: 'grid', gridTemplateColumns: `repeat(${calendarDays.length}, 1fr)`, flex: 1 }}>
            {calendarDays.map((day, idx) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const isToday = new Date().toDateString() === day.toDateString()
              return (
                <div key={idx} style={{
                  padding: '8px',
                  borderRight: '1px solid var(--cal-card-border)',
                  textAlign: 'center',
                  fontSize: '12px',
                  background: isToday ? 'var(--cal-accent-bg)' : isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent',
                  color: isToday ? 'var(--cal-accent)' : 'inherit'
                }}>
                  <div style={{ fontWeight: 600 }}>{day.toLocaleDateString('default', { weekday: 'short' }).toUpperCase()}</div>
                  <div style={{ fontSize: '14px', marginTop: '2px' }}>{day.getDate()}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div className="timeline-body">
          {isLoading ? (
            <div className="skeleton-cell" style={{ margin: '20px' }}></div>
          ) : engineers.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--cal-text-muted)' }}>No tasks or events found in this date range.</div>
          ) : (
            engineers.map(eng => {
              const engEvents = visibleEvents.filter(e => (e.engineer_name || e.username || 'Unassigned') === eng)

              return (
                <div key={eng} className="timeline-row" style={{ display: 'flex', borderBottom: '1px solid var(--cal-card-border)' }}>
                  <div className="timeline-engineer-col" style={{
                    position: 'sticky', left: 0, zIndex: 10,
                    width: '200px', flexShrink: 0, padding: '12px',
                    borderRight: '1px solid var(--cal-card-border)',
                    display: 'flex', alignItems: 'center',
                    fontWeight: 600, color: 'var(--cal-text-primary)',
                    background: 'var(--bg-primary)'
                  }}>
                    {eng}
                  </div>
                  <div className="timeline-days-col" style={{ position: 'relative', flex: 1 }}>
                    {/* Background Grid Lines */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: `repeat(${calendarDays.length}, 1fr)`, pointerEvents: 'none' }}>
                      {calendarDays.map((day, idx) => {
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6
                        const isToday = new Date().toDateString() === day.toDateString()
                        return (
                          <div key={idx} style={{
                            borderRight: '1px solid var(--cal-card-border)',
                            height: '100%',
                            background: isToday ? 'var(--cal-accent-bg)' : isWeekend ? 'rgba(0,0,0,0.02)' : 'transparent'
                          }}></div>
                        )
                      })}
                    </div>

                    {/* Event Bars */}
                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${calendarDays.length}, 1fr)`, padding: '12px 0', gap: '6px', gridAutoRows: '28px', minHeight: '60px' }}>
                      {engEvents.map(event => {
                        const startIndex = getDateIndex(event.start_date)
                        const targetDate = event.due_date || event.end_date
                        const endIndex = getDateIndex(targetDate)

                        // If completely outside
                        if (startIndex === -1 && endIndex === -1) {
                          const sDate = new Date(event.start_date)
                          const eDate = new Date(targetDate)
                          if (sDate > calendarDays[calendarDays.length - 1] || eDate < calendarDays[0]) return null
                        }

                        let actualStart = startIndex
                        let actualEnd = endIndex
                        if (startIndex === -1 && new Date(event.start_date) < calendarDays[0]) actualStart = 0
                        if (endIndex === -1 && new Date(targetDate) > calendarDays[calendarDays.length - 1]) actualEnd = calendarDays.length - 1

                        if (actualStart > actualEnd || actualStart === -1 || actualEnd === -1) return null

                        const isAbsence = event.event_type === 'Day_Off'
                        const isCompanyEvent = event.event_type === 'Company_Event'
                        const isCompleted = event.todo_status === 'Completed'
                        const isOffsetHoliday = event.event_type === 'Company_Event' && event.leave_type === 'Holiday'

                        const hasDueDate = event.due_date != null
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const isOverdue = event.event_type === 'Task_Claim' &&
                          event.todo_status === 'Claimed' &&
                          hasDueDate &&
                          new Date(event.due_date!) < today

                        let bgColor = '#ffffff'
                        let textColor = '#334155'
                        let borderColor = '#cbd5e1'

                        if (isAbsence || isOffsetHoliday) {
                          bgColor = 'rgba(239, 68, 68, 0.1)'
                          textColor = '#ef4444'
                          borderColor = 'rgba(239, 68, 68, 0.3)'
                        } else if (isCompanyEvent) {
                          bgColor = 'rgba(168, 85, 247, 0.1)'
                          textColor = '#a855f7'
                          borderColor = 'rgba(168, 85, 247, 0.3)'
                        } else if (event.event_type === 'Task_Claim') {
                          if (isCompleted) {
                            bgColor = '#f0fdf4'
                            textColor = '#16a34a'
                            borderColor = '#bbf7d0'
                          } else if (isOverdue) {
                            bgColor = '#fef2f2'
                            textColor = '#dc2626'
                            borderColor = '#fecaca'
                          }
                        }

                        return (
                          <div
                            key={event.id}
                            className="timeline-task-bar"
                            style={{
                              gridColumn: `${actualStart + 1} / span ${actualEnd - actualStart + 1}`,
                              background: bgColor,
                              color: textColor,
                              border: `1px solid ${borderColor}`,
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '12px',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              margin: '0 4px',
                              transition: 'transform 0.1s ease, filter 0.1s ease'
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (event.event_type !== 'Task_Claim') setSelectedEvent(event)
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.filter = 'brightness(0.95)'
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              handleMouseEnter(e, event)
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.filter = 'none'
                              e.currentTarget.style.transform = 'none'
                              handleMouseLeave()
                            }}
                          >
                            <span style={{ display: 'flex', flexShrink: 0 }}>
                              {isAbsence || isOffsetHoliday ? <LockIcon /> : isCompanyEvent ? <GlobeIcon /> : isCompleted ? <CheckIcon /> : <TargetIcon />}
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isOffsetHoliday ? 'Offset Holiday' : isAbsence ? 'On Leave' : isCompanyEvent ? event.leave_type : event.todo_title}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      <EventTooltip event={tooltipEvent!} position={tooltipPos} isVisible={!!tooltipEvent} />
    </div>
  )
}
