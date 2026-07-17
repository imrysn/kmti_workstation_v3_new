import React, { useState, useEffect } from 'react'

interface DayOffModalProps {
  initialEngineerName: string
  handleNameChange: (val: string) => void
  initialStart?: string
  initialEnd?: string
  handleRequestDayOffSubmit: (start: string, end: string, leaveType: string, engName: string) => Promise<void> | void
  onClose: () => void
}

export default function DayOffModal({
  initialEngineerName,
  handleNameChange,
  initialStart = '',
  initialEnd = '',
  handleRequestDayOffSubmit,
  onClose
}: DayOffModalProps) {
  const [engineerName, setEngineerName] = useState(initialEngineerName)
  const [dayOffStart, setDayOffStart] = useState(initialStart)
  const [dayOffEnd, setDayOffEnd] = useState(initialEnd)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNameChange(engineerName); // sync name to parent
    handleRequestDayOffSubmit(dayOffStart, dayOffEnd, 'Vacation', engineerName);
  }
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
          <h3>Request Leave / Day Off</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Your Name (Workstation Engineer)</label>
            <input
              type="text"
              placeholder="Enter engineer name..."
              value={engineerName}
              onChange={e => setEngineerName(e.target.value)}
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
