import React, { useState } from 'react'
import type { ITimelineDay } from '../../../hooks/useWorkSchedule'
import { useWorkScheduleContext } from '../context/WorkScheduleContext'
import { scheduleApi } from '../../../services/api'
import TimelineCell from './TimelineCell'

interface TimelineGridProps {
  timelineMembers: string[]
  timelineDays: ITimelineDay[]
  isLoadingTimeline: boolean
  timelineScrollRef: React.RefObject<HTMLDivElement>
  dragStartCell: { member: string; colIndex: number } | null
  dragHoverCol: number | null
  getDayClass: (day: ITimelineDay) => string
  isToday: (day: ITimelineDay) => boolean
  handleMouseDown: (e: React.MouseEvent, member: string, colIndex: number) => void
  handleMouseEnter: (member: string, colIndex: number) => void
  handleMouseUpCell: (e: React.MouseEvent, member: string, colIndex: number) => void
}

export default function TimelineGrid({
  timelineMembers,
  timelineDays,
  isLoadingTimeline,
  timelineScrollRef,
  dragStartCell,
  dragHoverCol,
  getDayClass,
  isToday,
  handleMouseDown,
  handleMouseEnter,
  handleMouseUpCell
}: TimelineGridProps) {

  const { canWrite, loadTimeline } = useWorkScheduleContext()
  const [activePopoverDay, setActivePopoverDay] = useState<ITimelineDay | null>(null)

  const handleHeaderClick = (day: ITimelineDay) => {
    if (!canWrite) return
    setActivePopoverDay(day)
  }

  const handleSelectStatus = async (status: string) => {
    if (!activePopoverDay) return
    try {
      await scheduleApi.updateTimeline('__day_status__', activePopoverDay.col_index, status)
      loadTimeline(true)
    } catch (err: any) {
      alert(`Failed to set day status: ${err.message}`)
    } finally {
      setActivePopoverDay(null)
    }
  }

  const renderMonthHeaders = () => {
    if (timelineDays.length === 0) return null

    const headers: React.ReactNode[] = []
    let currentMonth = timelineDays[0].month
    let span = 0

    const pushHeader = (month: string, colSpan: number) => {
      headers.push(
        <th key={headers.length} colSpan={colSpan} className="timeline-month-header">
          {month || 'Unknown Month'}
        </th>
      )
    }

    timelineDays.forEach((day, index) => {
      if (day.month !== currentMonth) {
        pushHeader(currentMonth, span)
        currentMonth = day.month
        span = 1
      } else {
        span++
      }
      if (index === timelineDays.length - 1) {
        pushHeader(currentMonth, span)
      }
    })

    return (
      <tr>
        <th className="timeline-member-col" style={{ background: '#1e1e24' }}>Month</th>
        {headers}
      </tr>
    )
  }

  if (isLoadingTimeline) {
    return (
      <div className="schedule-loading-spinner" style={{ height: '120px' }}>
        <svg className="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
        </svg>
        <span>Loading calendar grid...</span>
      </div>
    )
  }

  return (
    <div className="timeline-grid-wrapper custom-scrollbar" ref={timelineScrollRef}>
      <table className="timeline-table">
        <thead>
          {renderMonthHeaders()}
          <tr>
            <th className="timeline-member-col">Name</th>
            {timelineDays.map((d, index) => {
              const dayStatus = d.assignments['__day_status__'] || ''
              const statusClass = dayStatus ? `col-status-${dayStatus.toLowerCase()}` : ''
              return (
                <th
                  key={index}
                  className={`${getDayClass(d)} ${isToday(d) ? 'cell-today' : ''} ${statusClass}`}
                  onClick={() => handleHeaderClick(d)}
                  style={canWrite ? { cursor: 'pointer' } : undefined}
                  title={canWrite ? 'Click to set day status' : undefined}
                >
                  {d.weekday}
                </th>
              )
            })}
          </tr>
          <tr>
            <th className="timeline-member-col" style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}></th>
            {timelineDays.map((d, index) => {
              const dayStatus = d.assignments['__day_status__'] || ''
              const statusClass = dayStatus ? `col-status-${dayStatus.toLowerCase()}` : ''
              return (
                <th
                  key={index}
                  className={`${getDayClass(d)} ${isToday(d) ? 'cell-today' : ''} ${statusClass}`}
                  style={{ borderBottom: '2px solid rgba(255,255,255,0.2)', cursor: canWrite ? 'pointer' : undefined }}
                  onClick={() => handleHeaderClick(d)}
                  title={canWrite ? 'Click to set day status' : undefined}
                >
                  {d.day}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {timelineMembers.map((member) => (
            <tr key={member}>
              <td className="timeline-member-col">{member}</td>
              {timelineDays.map((d, index) => {
                const assignment = d.assignments[member] || ''
                const dayStatus = d.assignments['__day_status__'] || ''
                const statusClass = dayStatus ? `col-status-${dayStatus.toLowerCase()}` : ''

                // Check if this cell is currently within the drag range
                let isHighlighted = false
                if (dragStartCell && dragStartCell.member === member && dragHoverCol !== null) {
                  const start = Math.min(dragStartCell.colIndex, dragHoverCol)
                  const end = Math.max(dragStartCell.colIndex, dragHoverCol)
                  isHighlighted = d.col_index >= start && d.col_index <= end
                }

                const isArrow = assignment === '-->'
                let isArrowEnd = false
                if (isArrow) {
                  // Look ahead to check if there are any further arrow segments
                  let foundFurtherArrow = false
                  for (let i = index + 1; i < timelineDays.length; i++) {
                    const nextAssign = timelineDays[i].assignments[member] || ''
                    if (nextAssign === '-->') {
                      foundFurtherArrow = true
                      break
                    }
                    if (nextAssign === '') {
                      break
                    }
                  }
                  if (!foundFurtherArrow) {
                    isArrowEnd = true
                  }
                }

                return (
                  <TimelineCell
                    key={d.col_index}
                    colIndex={d.col_index}
                    member={member}
                    assignment={assignment}
                    isHighlighted={isHighlighted}
                    isToday={isToday(d)}
                    dayClass={`${getDayClass(d)} ${statusClass}`}
                    isArrow={isArrow}
                    isArrowEnd={isArrowEnd}
                    onMouseDown={handleMouseDown}
                    onMouseEnter={handleMouseEnter}
                    onMouseUp={handleMouseUpCell}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Day Status Selection Popover/Modal */}
      {activePopoverDay && (
        <div
          className="schedule-modal-overlay"
          onClick={() => setActivePopoverDay(null)}
          style={{ zIndex: 9999 }}
        >
          <div
            className="schedule-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '320px', gap: '12px', padding: '20px' }}
          >
            <h3 className="schedule-modal-title" style={{ fontSize: '15px' }}>
              Set status for {activePopoverDay.month} {activePopoverDay.day}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn-schedule-action"
                style={{ justifyContent: 'flex-start', background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
                onClick={() => handleSelectStatus('')}
              >
                ⚪ Normal Day
              </button>
              <button
                type="button"
                className="btn-schedule-action"
                style={{ justifyContent: 'flex-start', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                onClick={() => handleSelectStatus('Deadline')}
              >
                🔴 Deadline
              </button>
              <button
                type="button"
                className="btn-schedule-action"
                style={{ justifyContent: 'flex-start', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                onClick={() => handleSelectStatus('Delivered')}
              >
                🟠 Delivered
              </button>
              <button
                type="button"
                className="btn-schedule-action"
                style={{ justifyContent: 'flex-start', background: 'rgba(0, 166, 255, 0.1)', color: '#00a6ff', border: '1px solid rgba(0, 166, 255, 0.3)' }}
                onClick={() => handleSelectStatus('3D')}
              >
                🔵 3D Phase
              </button>
              <button
                type="button"
                className="btn-schedule-action"
                style={{ justifyContent: 'flex-start', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)' }}
                onClick={() => handleSelectStatus('2D')}
              >
                🟡 2D Phase
              </button>
              <button
                type="button"
                className="btn-schedule-action"
                style={{ justifyContent: 'flex-start', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.3)' }}
                onClick={() => handleSelectStatus('Holiday')}
              >
                🌸 Holiday / Day Off
              </button>
            </div>

            <button
              type="button"
              className="btn-schedule-action"
              style={{ marginTop: '10px' }}
              onClick={() => setActivePopoverDay(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
