import React, { useState, useEffect } from 'react'

interface CompanyEventModalProps {
  initialStart?: string
  initialEnd?: string
  handleCreateCompanyEventSubmit: (title: string, category: 'Holiday' | 'Birthday' | 'Outing' | 'Meeting' | 'Other', start: string, end: string) => Promise<void> | void
  onClose: () => void
}

export default function CompanyEventModal({
  initialStart = '',
  initialEnd = '',
  handleCreateCompanyEventSubmit,
  onClose
}: CompanyEventModalProps) {
  const [companyEventTitle, setCompanyEventTitle] = useState('')
  const [companyEventCategory, setCompanyEventCategory] = useState<'Holiday' | 'Birthday' | 'Outing' | 'Meeting' | 'Other'>('Other')
  const [companyEventStart, setCompanyEventStart] = useState(initialStart)
  const [companyEventEnd, setCompanyEventEnd] = useState(initialEnd)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateCompanyEventSubmit(companyEventTitle, companyEventCategory, companyEventStart, companyEventEnd);
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
          <h3>Schedule Company Event</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Event Title</label>
            <input
              type="text"
              placeholder="e.g. CEO's Birthday, Team Outing, General Assembly..."
              value={companyEventTitle}
              onChange={e => setCompanyEventTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Event Category</label>
            <select
              value={companyEventCategory}
              onChange={e => setCompanyEventCategory(e.target.value as any)}
              style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--cal-card-border)', borderRadius: '4px', color: 'var(--cal-text-primary)' }}
            >
              <option value="Other">Other Event</option>
              <option value="Holiday">Offset Holiday</option>
              <option value="Birthday">Birthday Celebration</option>
              <option value="Outing">Company Outing / Activity</option>
              <option value="Meeting">Meeting / Assembly</option>
            </select>
          </div>
          <div className="form-group-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={companyEventStart}
                onChange={e => setCompanyEventStart(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={companyEventEnd}
                onChange={e => setCompanyEventEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">Schedule Event</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
