import { useWorkScheduleContext } from '../../context/WorkScheduleContext'

export default function TimelineCellModal() {
  const {
    editingTimelineCell,
    setEditingTimelineCell,
    isSavingTimelineCell,
    handleSaveTimelineCell
  } = useWorkScheduleContext()

  if (!editingTimelineCell) return null

  return (
    <div className="schedule-modal-overlay">
      <form className="schedule-modal-card" onSubmit={handleSaveTimelineCell}>
        <h3 className="schedule-modal-title">Assign Job for {editingTimelineCell.member}</h3>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
          Updating column index: {editingTimelineCell.colIndex}
        </p>
        
        <div className="schedule-form-group">
          <label>Assignment String (e.g. 2810LN, 9324)</label>
          <input
            type="text"
            value={editingTimelineCell.value}
            onChange={(e) => setEditingTimelineCell({ ...editingTimelineCell, value: e.target.value })}
            placeholder="Enter job code / arrows (empty to clear)"
            autoFocus
          />
        </div>

        <div className="schedule-modal-buttons">
          <button
            type="button"
            className="btn-schedule-action"
            onClick={() => setEditingTimelineCell(null)}
            disabled={isSavingTimelineCell}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-schedule-action primary"
            disabled={isSavingTimelineCell}
          >
            {isSavingTimelineCell ? 'Saving...' : 'Update Assignment'}
          </button>
        </div>
      </form>
    </div>
  )
}
