import React from 'react'

interface DayOffModalProps {
  engineerName: string
  handleNameChange: (val: string) => void
  dayOffStart: string
  setDayOffStart: (val: string) => void
  dayOffEnd: string
  setDayOffEnd: (val: string) => void
  handleRequestDayOffSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export default function DayOffModal({
  engineerName,
  handleNameChange,
  dayOffStart,
  setDayOffStart,
  dayOffEnd,
  setDayOffEnd,
  handleRequestDayOffSubmit,
  onClose
}: DayOffModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="modal-content cal-modal-card animated zoomIn">
        <div className="modal-header">
          <h3>Request Leave / Day Off</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleRequestDayOffSubmit}>
          <div className="form-group">
            <label>Your Name (Workstation Engineer)</label>
            <input
              type="text"
              placeholder="Enter engineer name..."
              value={engineerName}
              onChange={e => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={dayOffStart}
                onChange={e => setDayOffStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={dayOffEnd}
                onChange={e => setDayOffEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-accent">Submit Leave Request</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
