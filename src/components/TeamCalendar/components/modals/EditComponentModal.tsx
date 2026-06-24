import { useWorkScheduleContext } from '../../context/WorkScheduleContext'

export default function EditComponentModal() {
  const {
    editingComponent,
    setEditingComponent,
    editCompCode,
    setEditCompCode,
    editComp3DAssem,
    setEditComp3DAssem,
    editComp3DParts,
    setEditComp3DParts,
    editComp2DAssem,
    setEditComp2DAssem,
    editComp2DParts,
    setEditComp2DParts,
    editCompStatus,
    setEditCompStatus,
    editCompDate,
    setEditCompDate,
    editCompPostponed,
    setEditCompPostponed,
    isSubmittingEdit,
    handleEditComponentSubmit
  } = useWorkScheduleContext()

  if (!editingComponent) return null

  return (
    <div className="schedule-modal-overlay">
      <form className="schedule-modal-card" onSubmit={handleEditComponentSubmit}>
        <h3 className="schedule-modal-title">Edit Drawing Component</h3>
        
        {/* Postponed Toggle Banner */}
        <div
          onClick={() => setEditCompPostponed(!editCompPostponed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '4px',
            cursor: 'pointer',
            background: editCompPostponed
              ? 'rgba(245,158,11,0.15)'
              : 'rgba(255,255,255,0.04)',
            border: editCompPostponed
              ? '1px solid rgba(245,158,11,0.4)'
              : '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.2s ease',
            userSelect: 'none',
          }}
        >
          {/* Custom toggle */}
          <div style={{
            width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0,
            background: editCompPostponed ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.15)',
            position: 'relative', transition: 'background 0.2s ease'
          }}>
            <div style={{
              position: 'absolute', top: '3px',
              left: editCompPostponed ? '19px' : '3px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: editCompPostponed ? '#fff' : 'rgba(255,255,255,0.5)',
              transition: 'left 0.2s ease',
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: editCompPostponed ? 'var(--warning, #f59e0b)' : 'var(--text-secondary)' }}>
              {editCompPostponed ? '⏸ Marked as POSTPONED' : 'Mark as Postponed'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>
              Postponed components appear under the POSTPONED section header
            </div>
          </div>
        </div>

        <div className="schedule-form-group">
          <label>Machine/Unit Code</label>
          <input
            type="text"
            value={editCompCode}
            onChange={(e) => setEditCompCode(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="schedule-form-group">
            <label>3D Assembly</label>
            <input
              type="text"
              value={editComp3DAssem}
              onChange={(e) => setEditComp3DAssem(e.target.value)}
            />
          </div>
          <div className="schedule-form-group">
            <label>3D Parts</label>
            <input
              type="text"
              value={editComp3DParts}
              onChange={(e) => setEditComp3DParts(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="schedule-form-group">
            <label>2D Assembly</label>
            <input
              type="text"
              value={editComp2DAssem}
              onChange={(e) => setEditComp2DAssem(e.target.value)}
            />
          </div>
          <div className="schedule-form-group">
            <label>2D Parts</label>
            <input
              type="text"
              value={editComp2DParts}
              onChange={(e) => setEditComp2DParts(e.target.value)}
            />
          </div>
        </div>

        <div className="schedule-form-group">
          <label>Status</label>
          <select
            value={editCompStatus}
            onChange={(e) => setEditCompStatus(e.target.value)}
          >
            <option value="Pending/Not Started">Pending/Not Started</option>
            <option value="Completed">Completed</option>
            <option value="For Checking">For Checking</option>
            <option value="Excluded/NA">Excluded/NA</option>
          </select>
        </div>

        <div className="schedule-form-group">
          <label>Submitted Date</label>
          <input
            type="date"
            value={editCompDate}
            onChange={(e) => setEditCompDate(e.target.value)}
          />
        </div>

        <div className="schedule-modal-buttons">
          <button
            type="button"
            className="btn-schedule-action"
            onClick={() => setEditingComponent(null)}
            disabled={isSubmittingEdit}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-schedule-action primary"
            disabled={isSubmittingEdit}
          >
            {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
