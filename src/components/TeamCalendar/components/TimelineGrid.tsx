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

  const {
    canWrite,
    loadTimeline,
    handleDeleteEmployee,
    setRenamingEmployee
  } = useWorkScheduleContext()
  const [activePopoverDay, setActivePopoverDay] = useState<ITimelineDay | null>(null)

  React.useEffect(() => {
    const el = timelineScrollRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
    }
  }, [timelineScrollRef])

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
    // ── Timeline Skeleton ───────────────────────────────────────────
    const COLS = 18
    const ROWS = 5
    return (
      <div className="sk-timeline-wrapper">
        {/* Month header row */}
        <div className="sk-timeline-header">
          <div className="skeleton-cell sk-timeline-label" style={{ height: '12px', opacity: 0.5 }} />
          {[0, 1, 2].map((m) => (
            <div
              key={m}
              className="skeleton-cell"
              style={{ flex: m === 1 ? 2 : 1, height: '12px', opacity: 0.35, borderRadius: '4px' }}
            />
          ))}
        </div>
        {/* Day header row */}
        <div className="sk-timeline-row" style={{ padding: '6px 12px' }}>
          <div className="skeleton-cell sk-timeline-label" style={{ height: '11px', opacity: 0.4 }} />
          {Array.from({ length: COLS }).map((_, i) => (
            <div key={i} className="skeleton-cell sk-timeline-cell" style={{ height: '20px', opacity: 0.25 }} />
          ))}
        </div>
        {/* Member rows */}
        {Array.from({ length: ROWS }).map((_, row) => (
          <div key={row} className="sk-timeline-row">
            {/* Member name */}
            <div
              className="skeleton-cell sk-timeline-label"
              style={{ width: `${70 + (row * 13) % 40}px` }}
            />
            {/* Timeline cells */}
            {Array.from({ length: COLS }).map((_, col) => (
              <div
                key={col}
                className="skeleton-cell sk-timeline-cell"
                style={{ opacity: 0.18 + ((row + col) % 3) * 0.06 }}
              />
            ))}
          </div>
        ))}
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
              <td className="timeline-member-col">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
                    {member}
                  </span>
                  {canWrite && (
                    <div className="member-row-actions" style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenamingEmployee(member)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary, rgba(255,255,255,0.6))',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={`Rename ${member}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteEmployee(member)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger, #ef4444)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title={`Remove ${member}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </td>
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
