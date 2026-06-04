/**
 * KemcoRow.tsx
 * ─────────────────────────────────────────────────────────────────
 * Renders the variant-specific table cells for the "KEMCO" layout.
 * Used by TaskRow when layoutVariant === 'kemco'.
 *
 * Columns: Machine Code | Unit Code | DWG No. | Start Date | End Date | Time | Action
 *
 * NOTE: This is the isolated component for upcoming KEMCO-specific
 * layout modifications.
 */

import { memo } from 'react'
import type { Task } from '../../../types/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'
import { focusNextInput } from '../utils/focusUtils'

export interface KemcoRowProps {
  task: Task
  isRowLocked: boolean
  onUpdate: (field: keyof Task, value: any) => void
  onRemove: () => void
}

export const KemcoRow = memo(({
  task, isRowLocked, onUpdate, onRemove,
}: KemcoRowProps) => {
  const { remoteUsers } = useCollaborationContext()

  return (
    <>
      {/* MACHINE CODE — Assembly only (level 0) */}
      <td>
        {task.level === 0 && (
          <CollaborativeField fieldKey={`task.${task.id}.machineCode`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
            <input
              type="text"
              value={task.machineCode || ''}
              onChange={e => onUpdate('machineCode', e.target.value)}
              onKeyDown={focusNextInput}
              className="table-input"
            />
          </CollaborativeField>
        )}
      </td>

      {/* UNIT CODE — Unit only (level 1) */}
      <td>
        {task.level === 1 && (
          <CollaborativeField fieldKey={`task.${task.id}.unitCode`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
            <input
              type="text"
              value={task.unitCode || ''}
              onChange={e => onUpdate('unitCode', e.target.value)}
              onKeyDown={focusNextInput}
              className="table-input"
            />
          </CollaborativeField>
        )}
      </td>

      {/* DWG No. — Parts only (level 2) */}
      <td>
        {task.level === 2 && (
          <CollaborativeField fieldKey={`task.${task.id}.dwgNo`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
            <input
              type="text"
              value={task.dwgNo || ''}
              onChange={e => onUpdate('dwgNo', e.target.value)}
              onKeyDown={focusNextInput}
              onMouseDown={e => e.stopPropagation()}
              className="table-input"
            />
          </CollaborativeField>
        )}
      </td>

      {/* DESCRIPTION */}
      <td className="description-cell">
        <div className={`description-container level-${task.level || 0}`}>
          {(task.level || 0) > 0 && (
            <span className="sub-task-indicator">↳</span>
          )}
          <CollaborativeField fieldKey={`task.${task.id}.description`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer} className="full-width-collab">
            <input
              type="text"
              value={task.description}
              onChange={e => onUpdate('description', e.target.value)}
              onKeyDown={focusNextInput}
              className="table-input description-input"
              placeholder={task.level === 0 ? 'Assembly Name' : task.level === 1 ? 'Sub-assembly name' : "Part's name"}
            />
          </CollaborativeField>
        </div>
      </td>

      {/* START DATE */}
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.startDate`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="date"
            value={task.startDate || ''}
            onChange={e => onUpdate('startDate', e.target.value)}
            onKeyDown={focusNextInput}
            className="table-input date-input"
          />
        </CollaborativeField>
      </td>

      {/* END DATE */}
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.endDate`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="date"
            value={task.endDate || ''}
            onChange={e => onUpdate('endDate', e.target.value)}
            onKeyDown={focusNextInput}
            className="table-input date-input"
          />
        </CollaborativeField>
      </td>

      {/* TIME */}
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.time`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="text"
            value={task.time || ''}
            onChange={e => onUpdate('time', parseFloat(e.target.value) || 0)}
            onKeyDown={focusNextInput}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* TYPE */}
      <td className="type-cell">
        <CollaborativeField fieldKey={`task.${task.id}.type`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <select
            value={task.type || '3D'}
            onChange={e => onUpdate('type', e.target.value)}
            onKeyDown={focusNextInput}
            className="table-input type-select"
          >
            <option value="2D">2D</option>
            <option value="3D">3D</option>
            <option value="3D/2D">3D/2D</option>
          </select>
        </CollaborativeField>
      </td>

      {/* ACTION */}
      <td className="action-cell">
        <div className="action-buttons-container">
          <button onClick={onRemove} className="remove-task-button" disabled={isRowLocked}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </>
  )
})

KemcoRow.displayName = 'KemcoRow'
