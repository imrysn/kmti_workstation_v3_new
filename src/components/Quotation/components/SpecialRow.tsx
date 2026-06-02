/**
 * SpecialRow.tsx
 * ─────────────────────────────────────────────────────────────────
 * Renders the variant-specific table cells for the "Special" layout.
 * Used by TaskRow when layoutVariant === 'special'.
 *
 * Columns: Hours | Minutes | Time Charge | OT Hours | Overtime | Software | Total | Action
 */

import { memo } from 'react'
import type { Task, TaskSubtotals } from '../../../types/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'
import { focusNextInput } from '../utils/focusUtils'

export interface SpecialRowProps {
  task: Task
  subtotals: TaskSubtotals
  isRowLocked: boolean
  onUpdate: (field: keyof Task, value: any) => void
  formatCurrency: (n: number) => string
  isEditing: boolean
  localTotal: string
  setLocalTotal: (v: string) => void
  onEditValueUpdate?: (id: number, field: string, value: number, userModified?: boolean) => void
  onEditToggle: () => void
  onCancelEdit?: () => void
  onRemove: () => void
}

export const SpecialRow = memo(({
  task, subtotals, isRowLocked, onUpdate, formatCurrency,
  isEditing, localTotal, setLocalTotal, onEditValueUpdate,
  onEditToggle, onCancelEdit, onRemove,
}: SpecialRowProps) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Escape') { onCancelEdit?.(); return }
    if (e.key === 'Enter') {
      onEditToggle()
      focusNextInput(e)
    }
  }

  return (
    <>
      {/* DESCRIPTION */}
      <td className="description-cell">
        <div className={`description-container level-${task.level || 0}`}>
          {!task.isMainTask && (
            <span className="sub-task-indicator">↳</span>
          )}
          <CollaborativeField fieldKey={`task.${task.id}.description`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer} className="full-width-collab">
            <input
              type="text"
              value={task.description}
              onChange={e => onUpdate('description', e.target.value)}
              onKeyDown={focusNextInput}
              className="table-input description-input"
              placeholder={task.isMainTask ? 'Assembly Name' : "Part's name"}
            />
          </CollaborativeField>
        </div>
      </td>

      {/* HOURS */}
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.hours`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="text"
            inputMode="numeric"
            value={task.hours || ''}
            onChange={e => onUpdate('hours', parseFloat(e.target.value) || 0)}
            onKeyDown={focusNextInput}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* MINUTES */}
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.minutes`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="text"
            inputMode="numeric"
            value={task.minutes || ''}
            onChange={e => onUpdate('minutes', parseFloat(e.target.value) || 0)}
            onKeyDown={focusNextInput}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* TIME CHARGE */}
      <td className="time-charge-cell">
        {formatCurrency(subtotals.basicLabor)}
      </td>

      {/* OVERTIME HOURS */}
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.overtimeHours`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="text"
            inputMode="numeric"
            value={task.overtimeHours || ''}
            onChange={e => onUpdate('overtimeHours', parseFloat(e.target.value) || 0)}
            onKeyDown={focusNextInput}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* OVERTIME AMOUNT */}
      <td className="overtime-cell">
        {formatCurrency(subtotals.overtime)}
      </td>

      {/* SOFTWARE */}
      <td>
        <div className="software-cell-container">
          <CollaborativeField
            fieldKey={`task.${task.id}.softwareUnits`}
            remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}
            onFocus={() => emitFocus(`task.${task.id}.softwareUnits`)}
            onBlur={() => emitBlur(`task.${task.id}.softwareUnits`)}
          >
            <input
              type="text"
              inputMode="numeric"
              value={task.softwareUnits || ''}
              onChange={e => onUpdate('softwareUnits', parseFloat(e.target.value) || 0)}
              onKeyDown={focusNextInput}
              className="table-input number-input software-units-input"
            />
          </CollaborativeField>
          <span className="software-total">{formatCurrency(subtotals.software)}</span>
        </div>
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

      {/* TOTAL */}
      <td className="total-cell">
        {isEditing ? (
          <CollaborativeField fieldKey={`task.${task.id}.manualTotal`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
            <input
              type="text"
              inputMode="decimal"
              value={localTotal}
              onChange={e => {
                const val = e.target.value
                setLocalTotal(val)
                const num = parseFloat(val.replace(/,/g, ''))
                if (!isNaN(num)) onEditValueUpdate?.(task.id, 'total', num, true)
              }}
              onKeyDown={handleKeyDown}
              className="table-input number-input edit-calculated-input"
            />
          </CollaborativeField>
        ) : formatCurrency(subtotals.total)}
      </td>

      {/* ACTION */}
      <td className="action-cell">
        <div className="action-buttons-container">
          <button
            onClick={onEditToggle}
            className={`edit-task-button ${isEditing ? 'editing' : ''}`}
            disabled={isRowLocked}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={onRemove} className="remove-task-button" disabled={isRowLocked}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </>
  )
})

SpecialRow.displayName = 'SpecialRow'
