import React, { useEffect } from 'react'
import { ITodo, IActiveUser } from '../../../services/teamCalendarService'

interface AssignTaskModalProps {
  assigningTask: ITodo
  assignSelectedTodoId: string
  setAssignSelectedTodoId: (val: string) => void
  backlog: ITodo[]
  assignUserId: string
  setAssignUserId: (val: string) => void
  assignEngineerName: string
  setAssignEngineerName: (val: string) => void
  activeUsers: IActiveUser[]
  assignStartDate: string
  setAssignStartDate: (val: string) => void
  assignEndDate: string
  setAssignEndDate: (val: string) => void
  handleAssignTaskSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export default function AssignTaskModal({
  assigningTask,
  assignSelectedTodoId,
  setAssignSelectedTodoId,
  backlog,
  assignUserId,
  setAssignUserId,
  assignEngineerName,
  setAssignEngineerName,
  activeUsers,
  assignStartDate,
  setAssignStartDate,
  assignEndDate,
  setAssignEndDate,
  handleAssignTaskSubmit,
  onClose
}: AssignTaskModalProps) {
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
          <h3>Assign Task to Engineer</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleAssignTaskSubmit}>
          <div className="form-group">
            <label>Task to Assign</label>
            {assigningTask.id === -1 ? (
              <select
                value={assignSelectedTodoId}
                onChange={e => setAssignSelectedTodoId(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--cal-card-border)', borderRadius: '4px', color: 'var(--cal-text-primary)' }}
              >
                <option value="">-- Select Task from Pool --</option>
                {backlog.filter(t => t.status === 'Pending').map(t => (
                  <option key={t.id} value={t.id}>
                    [{t.priority}] {t.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={assigningTask.title}
                disabled
                className="disabled-input"
                style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--cal-card-border)', borderRadius: '4px', color: 'var(--cal-text-muted)' }}
              />
            )}
          </div>

          <div className="form-group">
            <label>Target Engineer</label>
            <select
              value={assignUserId}
              onChange={e => {
                const uId = e.target.value
                setAssignUserId(uId)
                const selectedU = activeUsers.find(u => u.id === Number(uId))
                if (selectedU) {
                  setAssignEngineerName(selectedU.username)
                }
              }}
              required
              style={{ width: '100%', padding: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--cal-card-border)', borderRadius: '4px', color: 'var(--cal-text-primary)' }}
            >
              <option value="">-- Select Engineer --</option>
              {activeUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Engineer Display Name</label>
            <input
              type="text"
              placeholder="Enter display name..."
              value={assignEngineerName}
              onChange={e => setAssignEngineerName(e.target.value)}
              required
            />
          </div>

          <div className="form-group-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={assignStartDate}
                onChange={e => setAssignStartDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={assignEndDate}
                onChange={e => setAssignEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">Confirm & Assign</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
