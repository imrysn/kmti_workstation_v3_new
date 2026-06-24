import React from 'react'

interface TimelineCellProps {
  colIndex: number
  member: string
  assignment: string
  isHighlighted: boolean
  isToday: boolean
  dayClass: string
  isArrow: boolean
  isArrowEnd: boolean
  onMouseDown: (e: React.MouseEvent, member: string, colIndex: number) => void
  onMouseEnter: (member: string, colIndex: number) => void
  onMouseUp: (e: React.MouseEvent, member: string, colIndex: number) => void
}

const TimelineCell: React.FC<TimelineCellProps> = React.memo(({
  colIndex,
  member,
  assignment,
  isHighlighted,
  isToday,
  dayClass,
  isArrow,
  isArrowEnd,
  onMouseDown,
  onMouseEnter,
  onMouseUp
}) => {
  return (
    <td 
      className={`${dayClass} ${isHighlighted ? 'cell-dragging' : ''} ${isToday ? 'cell-today' : ''} ${isArrow ? 'cell-arrow' : ''}`}
      onMouseDown={(e) => onMouseDown(e, member, colIndex)}
      onMouseEnter={() => onMouseEnter(member, colIndex)}
      onMouseUp={(e) => onMouseUp(e, member, colIndex)}
      style={{ userSelect: 'none' }}
    >
      {isArrow ? (
        <div className={`gantt-arrow-line ${isArrowEnd ? 'arrow-end' : ''}`} />
      ) : assignment ? (
        <span className="timeline-assignment-text">
          {assignment}
        </span>
      ) : (
        <span className="timeline-cell-empty" />
      )}
    </td>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to avoid re-rendering cells unless relevant props change
  return (
    prevProps.assignment === nextProps.assignment &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.isToday === nextProps.isToday &&
    prevProps.dayClass === nextProps.dayClass &&
    prevProps.isArrow === nextProps.isArrow &&
    prevProps.isArrowEnd === nextProps.isArrowEnd &&
    prevProps.onMouseDown === nextProps.onMouseDown &&
    prevProps.onMouseEnter === nextProps.onMouseEnter &&
    prevProps.onMouseUp === nextProps.onMouseUp
  )
})

export default TimelineCell
