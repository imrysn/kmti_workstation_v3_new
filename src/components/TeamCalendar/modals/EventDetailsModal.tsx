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

  const isLeave = selectedEvent.event_type === 'Day_Off'
  const isPending = isLeave && selectedEvent.status === 'Pending'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content cal-modal-card animated zoomIn" onClick={e => e.stopPropagation()}
        style={isPending ? {
          border: '1.5px dashed rgba(220, 38, 38, 0.5)',
          boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.06), 0 20px 40px -10px rgba(0,0,0,0.2)',
        } : undefined}
      >
        {/* Pending banner strip */}
        {isPending && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.08)',
            borderBottom: '1px dashed rgba(220, 38, 38, 0.35)',
            padding: '7px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'pendingPulse 2.5s ease-in-out infinite',
          }}>
            {/* Pulsing dot */}
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#dc2626',
              display: 'inline-block',
              animation: 'critPulse 1.5s infinite',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', letterSpacing: '0.04em' }}>
              AWAITING ADMIN APPROVAL
            </span>
          </div>
        )}

        <div className="modal-header" style={isPending ? {
          background: 'rgba(220, 38, 38, 0.05)',
          borderBottom: '1px solid rgba(220, 38, 38, 0.15)',
        } : undefined}>
          <h3 style={{ color: isPending ? '#dc2626' : undefined }}>
            {isLeave
              ? 'Leave Request'
              : selectedEvent.event_type === 'Company_Event'
                ? 'Company Event'
                : 'Task Details'}
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

          {isLeave && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong>Status:</strong>
              {isPending ? (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '3px 9px',
                  borderRadius: '5px',
                  background: 'rgba(220, 38, 38, 0.12)',
                  color: '#dc2626',
                  border: '1px dashed rgba(220, 38, 38, 0.5)',
                  animation: 'pendingPulse 2.5s ease-in-out infinite',
                }}>
                  Pending Approval
                </span>
              ) : (
                <span className={`status-badge ${selectedEvent.status.toLowerCase()}`}>
                  Approved
                </span>
              )}
            </p>
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

          {/* Actions */}
          <div className="modal-actions" style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isPending && isAdminOrIT && (
              <button
                className="btn btn-accent btn-block"
                onClick={() => handleApproveEvent(selectedEvent.id)}
                style={{ fontWeight: 700 }}
              >
                ✓ Approve Leave
              </button>
            )}
            {isAdminOrIT && (
              <button
                className="btn btn-danger btn-block"
                onClick={() => handleCancelEvent(selectedEvent)}
              >
                {isPending ? '✕ Decline Request' : 'Delete Event'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
