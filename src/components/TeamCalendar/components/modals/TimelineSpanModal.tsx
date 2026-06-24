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

  if (!addingTimelineSpan) return null

  return (
    <div className="schedule-modal-overlay">
      <form className="schedule-modal-card" onSubmit={handleSaveTimelineSpan}>
        <h3 className="schedule-modal-title">Create Job Duration for {addingTimelineSpan.member}</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
          Selected range: <strong>{getSpanDatesText()}</strong>
        </p>
        
        <div className="schedule-form-group">
          <label>Job Code / ID</label>
          <input
            type="text"
            list="jobs-datalist"
            value={addingTimelineSpan.jobCode}
            onChange={(e) => setAddingTimelineSpan({ ...addingTimelineSpan, jobCode: e.target.value })}
            placeholder="Select or enter job code"
            required
            autoFocus
          />
          <datalist id="jobs-datalist">
            {jobs.map(j => (
              <option key={j.job_id} value={j.job_id} />
            ))}
          </datalist>
        </div>

        <div className="schedule-modal-buttons">
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
            disabled={isSavingTimelineSpan}
          >
            {isSavingTimelineSpan ? 'Saving...' : 'Add Arrow Span'}
          </button>
        </div>
      </form>
    </div>
  )
}
