import { useState, useEffect, useRef } from 'react'
import { useWorkScheduleContext } from '../../context/WorkScheduleContext'

export default function TimelineSpanModal() {
  const {
    jobs,
    addingTimelineSpan,
    setAddingTimelineSpan,
    isSavingTimelineSpan,
    getSpanDatesText,
    handleSaveTimelineSpan,
    handleClearTimelineSpan
  } = useWorkScheduleContext()

  const [isOpen, setIsOpen] = useState(false)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [customJob, setCustomJob] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Initialize selected jobs from the current jobCode when modal opens
  useEffect(() => {
    if (addingTimelineSpan) {
      const currentCode = addingTimelineSpan.jobCode || ''
      if (currentCode) {
        const parts = currentCode.split(/[,/]+/).map(p => p.trim()).filter(Boolean)
        const knownJobs = jobs.map(j => j.job_id)
        const selected = parts.filter(p => knownJobs.includes(p))
        const custom = parts.filter(p => !knownJobs.includes(p)).join(', ')
        setSelectedJobs(selected)
        setCustomJob(custom)
      } else {
        setSelectedJobs([])
        setCustomJob('')
      }
      setIsOpen(false)
    }
  }, [addingTimelineSpan, jobs])

  // Sync selected jobs & custom job back to addingTimelineSpan.jobCode
  useEffect(() => {
    if (addingTimelineSpan) {
      const items = [...selectedJobs]
      if (customJob.trim()) {
        const customParts = customJob.split(',').map(p => p.trim()).filter(Boolean)
        items.push(...customParts)
      }
      const newJobCode = items.join(', ')
      if (addingTimelineSpan.jobCode !== newJobCode) {
        setAddingTimelineSpan({
          ...addingTimelineSpan,
          jobCode: newJobCode
        })
      }
    }
  }, [selectedJobs, customJob])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!addingTimelineSpan) return null

  const handleToggleJob = (jobId: string) => {
    setSelectedJobs(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    )
  }

  const selectedText = () => {
    const items = [...selectedJobs]
    if (customJob.trim()) {
      items.push(customJob.trim())
    }
    return items.length > 0 ? items.join(', ') : 'Select or enter job codes'
  }

  return (
    <div className="schedule-modal-overlay">
      <form className="schedule-modal-card" onSubmit={handleSaveTimelineSpan}>
        <h3 className="schedule-modal-title">Create Job Duration for {addingTimelineSpan.member}</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          Selected range: <strong>{getSpanDatesText()}</strong>
        </p>

        <div className="schedule-form-group" style={{ position: 'relative' }} ref={dropdownRef}>
          <label>Job Codes / IDs</label>
          
          {/* Custom Dropdown Trigger */}
          <div
            onClick={() => setIsOpen(!isOpen)}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '10px 12px',
              color: selectedJobs.length > 0 || customJob.trim() ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none',
              minHeight: '42px',
              boxSizing: 'border-box'
            }}
          >
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginRight: '8px'
            }}>
              {selectedText()}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                flexShrink: 0
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {/* Dropdown Menu */}
          {isOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--bg-secondary, #ffffff)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                marginTop: '4px',
                zIndex: 1000,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '260px',
                overflowY: 'auto'
              }}
            >
              {/* Job Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {jobs.map(j => (
                  <label
                    key={j.job_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      textTransform: 'none',
                      fontWeight: 'normal',
                      transition: 'background 0.2s',
                      background: selectedJobs.includes(j.job_id) ? 'rgba(59, 130, 246, 0.15)' : 'transparent'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-primary)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = selectedJobs.includes(j.job_id) ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedJobs.includes(j.job_id)}
                      onChange={() => handleToggleJob(j.job_id)}
                      style={{
                        cursor: 'pointer',
                        width: '15px',
                        height: '15px',
                        accentColor: 'var(--accent, #3b82f6)'
                      }}
                    />
                    <span>{j.job_id}</span>
                  </label>
                ))}
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

              {/* Custom Input Option */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Or enter custom code(s)
                </label>
                <input
                  type="text"
                  value={customJob}
                  onChange={(e) => setCustomJob(e.target.value)}
                  placeholder="e.g. CUSTOM-01, CUSTOM-02"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
        </div>

        {/* Hidden inputs to handle form submission validations if needed */}
        <input type="hidden" value={addingTimelineSpan.jobCode} required name="jobCode" />

        <div className="schedule-modal-buttons" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn-schedule-action danger"
            style={{ marginRight: 'auto' }}
            onClick={handleClearTimelineSpan}
            disabled={isSavingTimelineSpan}
          >
            Clear Range
          </button>
          <button
            type="button"
            className="btn-schedule-action"
            onClick={() => setAddingTimelineSpan(null)}
            disabled={isSavingTimelineSpan}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-schedule-action primary"
            disabled={isSavingTimelineSpan || !addingTimelineSpan.jobCode.trim()}
          >
            {isSavingTimelineSpan ? 'Saving...' : 'Add Job Duration'}
          </button>
        </div>
      </form>
    </div>
  )
}
