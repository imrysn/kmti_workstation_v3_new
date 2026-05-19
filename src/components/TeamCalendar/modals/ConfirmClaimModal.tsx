import { ITodo } from '../../../services/teamCalendarService'
import { formatDurationRange } from '../../../utils/teamCalendarUtils'

interface ConfirmClaimModalProps {
  confirmingClaim: {
    todo: ITodo
    start: string
    end: string
  }
  engineerName: string
  handleNameChange: (val: string) => void
  handleConfirmClaimSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export default function ConfirmClaimModal({
  confirmingClaim,
  engineerName,
  handleNameChange,
  handleConfirmClaimSubmit,
  onClose
}: ConfirmClaimModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal-content cal-modal-card animated zoomIn">
        <div className="modal-header">
          <h3>Confirm Workstation Claim</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleConfirmClaimSubmit}>
          <div className="claim-confirm-details">
            <p><strong>Task:</strong> {confirmingClaim.todo.title}</p>
            <p><strong>Dates:</strong> {formatDurationRange(confirmingClaim.start, confirmingClaim.end)}</p>
          </div>
          <div className="form-group">
            <label>Your Name (Workstation Engineer)</label>
            <input
              type="text"
              placeholder="Enter engineer name..."
              value={engineerName}
              onChange={e => handleNameChange(e.target.value)}
              required
            />
            <span className="form-tip">Pre-fills automatically on this machine.</span>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">Confirm & Claim</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
