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
      <form className="schedule-modal-card" onSubmit={handleEditComponentSubmit} style={{ maxWidth: '1050px', width: '95%' }}>
        <h3 className="schedule-modal-title">Edit Row</h3>

        {/* Postponed Toggle Banner */}
        <div
          onClick={() => setEditCompPostponed(!editCompPostponed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '10px',
            cursor: 'pointer',
            background: editCompPostponed
              ? 'rgba(245, 158, 11, 0.12)'
              : 'rgba(0, 0, 0, 0.03)',
            border: editCompPostponed
              ? '1px solid rgba(245, 158, 11, 0.3)'
              : '1px solid var(--border)',
            transition: 'all 0.2s ease',
            userSelect: 'none',
          }}
        >
          {/* Custom toggle */}
          <div style={{
            width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0,
            background: editCompPostponed ? 'rgba(245, 158, 11, 0.8)' : 'rgba(0, 0, 0, 0.15)',
            position: 'relative', transition: 'background 0.2s ease'
          }}>
            <div style={{
              position: 'absolute', top: '3px',
              left: editCompPostponed ? '19px' : '3px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.2s ease',
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: editCompPostponed ? 'var(--warning, #f59e0b)' : 'var(--text-primary)' }}>
              {editCompPostponed ? 'Marked as POSTPONED' : 'Mark as Postponed'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.6, marginTop: '1px' }}>
              Postponed rows appear under the POSTPONED section header below.
            </div>
          </div>
        </div>

        {/* Spreadsheet Table layout */}
        <div className="components-table-container custom-scrollbar" style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '20px' }}>
          <table className="components-table" style={{ fontSize: '12px', margin: 0, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap', width: '22%' }}>Machine/Unit Code</th>
                <th style={{ whiteSpace: 'nowrap' }}>3D Assembly</th>
                <th style={{ whiteSpace: 'nowrap' }}>3D Parts</th>
                <th style={{ whiteSpace: 'nowrap' }}>2D Assembly</th>
                <th style={{ whiteSpace: 'nowrap' }}>2D Parts</th>
                <th style={{ whiteSpace: 'nowrap', width: '18%' }}>Status</th>
                <th style={{ whiteSpace: 'nowrap' }}>Submitted Date</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '4px' }}>
                  <input
                    type="text"
                    value={editCompCode}
                    onChange={(e) => setEditCompCode(e.target.value)}
                    required
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: '4px' }}>
                  <input
                    type="text"
                    value={editComp3DAssem}
                    onChange={(e) => setEditComp3DAssem(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: '4px' }}>
                  <input
                    type="text"
                    value={editComp3DParts}
                    onChange={(e) => setEditComp3DParts(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: '4px' }}>
                  <input
                    type="text"
                    value={editComp2DAssem}
                    onChange={(e) => setEditComp2DAssem(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: '4px' }}>
                  <input
                    type="text"
                    value={editComp2DParts}
                    onChange={(e) => setEditComp2DParts(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </td>
                <td style={{ padding: '4px' }}>
                  <select
                    value={editCompStatus}
                    onChange={(e) => setEditCompStatus(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box', height: '30px' }}
                  >
                    <option value="Pending/Not Started">Pending/Not Started</option>
                    <option value="Completed">Completed</option>
                    <option value="For Checking">For Checking</option>
                    <option value="Excluded/NA">Excluded/NA</option>
                  </select>
                </td>
                <td style={{ padding: '4px' }}>
                  <input
                    type="date"
                    value={editCompDate || ''}
                    onChange={(e) => setEditCompDate(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box', height: '30px' }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
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
