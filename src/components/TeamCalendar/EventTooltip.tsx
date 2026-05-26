import { createPortal } from 'react-dom'
import { ICalendarEvent } from '../../services/teamCalendarService'
import { GlobeIcon, LockIcon, CheckIcon, TargetIcon } from './Icons'
import { formatDisplayDate, formatDisplayDateTime } from '../../utils/teamCalendarUtils'
import { useState, useRef, useLayoutEffect } from 'react'

interface EventTooltipProps {
  event: ICalendarEvent
  position: { x: number; y: number }
  anchorRect?: DOMRect | { left: number; top: number; bottom: number; right: number } | null
  isVisible: boolean
}

export default function EventTooltip({ event, position, anchorRect, isVisible }: EventTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!isVisible || !ref.current) {
      setCoords(null)
      return
    }

    const tooltipHeight = ref.current.offsetHeight
    const tooltipWidth = ref.current.offsetWidth

    let left = position.x
    let top = position.y

    if (anchorRect) {
      top = anchorRect.bottom + 4
      left = anchorRect.left
      if (top + tooltipHeight > window.innerHeight) {
        top = anchorRect.top - tooltipHeight - 4
      }
    } else {
      if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight - 12
      }
    }

    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - 12
    }
    if (left < 0) left = 12

    setCoords({ left, top })
  }, [isVisible, position.x, position.y, anchorRect, event])

  if (!isVisible || !event) return null

  const isCompanyEvent = event.event_type === 'Company_Event' && event.leave_type !== 'Holiday'
  const isOffsetHoliday = event.event_type === 'Company_Event' && event.leave_type === 'Holiday'
  const isAbsence = event.event_type === 'Day_Off'
  const isCompleted = event.todo_status === 'Completed'

  const displayCoords = coords || { left: position.x, top: position.y }

  return createPortal(
    <div
      ref={ref}
      className="calendar-tooltip"
      style={{
        left: `${displayCoords.left}px`,
        top: `${displayCoords.top}px`,
        opacity: coords ? 1 : 0,
        transition: 'opacity 0.15s ease'
      }}
    >
      <div className="calendar-tooltip-header">
        <span className="calendar-tooltip-icon">
          {isOffsetHoliday ? <LockIcon /> : isCompanyEvent ? <GlobeIcon /> : isAbsence ? <LockIcon /> : isCompleted ? <CheckIcon /> : <TargetIcon />}
        </span>
        <span className="calendar-tooltip-title">
          {isOffsetHoliday
            ? `Offset Holiday: ${event.engineer_name}`
            : isCompanyEvent
              ? `Company Event: ${event.engineer_name} (${event.leave_type || 'Other'})`
              : isAbsence
                ? `On Leave: ${event.engineer_name || event.username}`
                : event.todo_title}
        </span>
      </div>
      
      {!isCompanyEvent && !isOffsetHoliday && !isAbsence && (
        <div className="calendar-tooltip-body">
          <div className="calendar-tooltip-row">
            <span className="calendar-tooltip-label">Assignee:</span>
            <span className="calendar-tooltip-value">{event.engineer_name || event.username}</span>
          </div>
          {event.due_date && (
            <div className="calendar-tooltip-row">
              <span className="calendar-tooltip-label">Due Date:</span>
              <span className="calendar-tooltip-value">{formatDisplayDate(event.due_date)}</span>
            </div>
          )}
          {event.completed_at && (
            <div className="calendar-tooltip-row">
              <span className="calendar-tooltip-label">Completed At:</span>
              <span className="calendar-tooltip-value">{formatDisplayDateTime(event.completed_at)}</span>
            </div>
          )}

          {event.todo_description && (
            <div className="calendar-tooltip-row" style={{ marginTop: '8px' }}>
              <span className="calendar-tooltip-desc">
                {event.todo_description.length > 100 ? `${event.todo_description.substring(0, 100)}...` : event.todo_description}
              </span>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
