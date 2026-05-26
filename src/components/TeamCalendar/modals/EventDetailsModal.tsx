import { useEffect } from 'react'
import { ICalendarEvent } from '../../../services/teamCalendarService'
import { formatDurationRange, formatDisplayDate, formatDisplayDateTime } from '../../../utils/teamCalendarUtils'

interface EventDetailsModalProps {
  selectedEvent: ICalendarEvent
  isAdminOrIT: boolean
  currentUser: any
  handleApproveEvent: (eventId: number) => void
  handleCancelEvent: (event: ICalendarEvent) => void
  onClose: () => void
}

export default function EventDetailsModal({
  selectedEvent,
  isAdminOrIT,
  currentUser: _currentUser,
  handleApproveEvent,
  handleCancelEvent,
  onClose
}: EventDetailsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content cal-modal-card animated zoomIn" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {selectedEvent.event_type === 'Day_Off'
              ? "Protected Absence"
              : selectedEvent.event_type === 'Company_Event'
                ? "Company Event"
                : "Task Claim Details"}
          </h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="event-detail-body">
          {selectedEvent.event_type !== 'Company_Event' && (
            <p>
              <strong>Engineer:</strong> {selectedEvent.engineer_name || selectedEvent.username}
            </p>
          )}
          <p>
            <strong>Duration:</strong> {formatDurationRange(selectedEvent.start_date, selectedEvent.end_date)}
          </p>

          {selectedEvent.event_type === 'Company_Event' && (
            <>
              <p>
                <strong>Event Name:</strong> {selectedEvent.engineer_name}
              </p>
              <p>
                <strong>Category:</strong> {selectedEvent.leave_type || 'Other'}
              </p>
            </>
          )}

          {selectedEvent.event_type === 'Day_Off' && (
            <>
              <p>
                <strong>Status:</strong>{' '}
                <span className={`status-badge ${selectedEvent.status.toLowerCase()}`}>
                  {selectedEvent.status === 'Approved' ? 'Approved' : 'Pending Approval'}
                </span>
              </p>
            </>
          )}

          {selectedEvent.event_type === 'Task_Claim' && (
            <>
              <p>
                <strong>Task Title:</strong> {selectedEvent.todo_title}
              </p>
              <p>
                <strong>Due Date:</strong> {formatDisplayDate(selectedEvent.due_date || selectedEvent.end_date)}
              </p>
              {selectedEvent.completed_at && (
                <p>
                  <strong>Completed At:</strong> {formatDisplayDateTime(selectedEvent.completed_at)}
                </p>
              )}

              {selectedEvent.todo_description && (
                <p>
                  <strong>Description:</strong> {selectedEvent.todo_description}
                </p>
              )}
            </>
          )}

          {/* Cancel claims / absences */}
          <div className="modal-actions" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selectedEvent.event_type === 'Day_Off' && selectedEvent.status === 'Pending' && isAdminOrIT && (
              <button
                className="btn btn-accent btn-block"
                onClick={() => handleApproveEvent(selectedEvent.id)}
              >
                ✓ Approve Leave / Absence
              </button>
            )}

            {isAdminOrIT && (
              <button
                className="btn btn-danger btn-block"
                onClick={() => handleCancelEvent(selectedEvent)}
              >
                Delete Event
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
