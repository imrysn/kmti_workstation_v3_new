import React from 'react'
import { createPortal } from 'react-dom'
import { ICalendarEvent } from '../../services/teamCalendarService'
import { GlobeIcon, LockIcon, CheckIcon, TargetIcon } from './Icons'
import { formatLocalDate, formatDisplayDate, formatDisplayDateTime } from '../../utils/teamCalendarUtils'

interface EventTooltipProps {
  event: ICalendarEvent
  position: { x: number; y: number }
  isVisible: boolean
}

export default function EventTooltip({ event, position, isVisible }: EventTooltipProps) {
  if (!isVisible || !event) return null

  const isCompanyEvent = event.event_type === 'Company_Event' && event.leave_type !== 'Holiday'
  const isOffsetHoliday = event.event_type === 'Company_Event' && event.leave_type === 'Holiday'
  const isAbsence = event.event_type === 'Day_Off'
  const isCompleted = event.todo_status === 'Completed'

  return createPortal(
    <div
      className="calendar-tooltip"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`
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
