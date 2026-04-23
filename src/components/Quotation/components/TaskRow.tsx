/**
 * TaskRow.tsx
 * ─────────────────────────────────────────────────────────────────
 * Renders a single row in the Computation Table — either a main
 * assembly task or a sub-task (part). Extracted from TasksTable.tsx
 * to keep each file focused and navigable.
 *
 * All mutation callbacks are optional so the row gracefully becomes
 * read-only when the parent is in preview mode (onUpdate === undefined).
 */

import { memo, useCallback, useMemo } from 'react'
import type { Task } from '../../../hooks/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TaskSubtotals {
  taskId: number
  basicLabor: number
  overtime: number
  software: number
  total: number
}

export interface TaskRowProps {
  task: Task
  subtotals: TaskSubtotals
  onUpdate?: (id: number, field: keyof Task, value: any) => void
  onRemove?: (id: number) => void
  formatCurrency: (n: number) => string
  isSelected: boolean
  onMainTaskSelect?: (id: number) => void
  rowNumber: number
  isEditing: boolean
  onEditToggle?: (id: number) => void
  onEditValueUpdate?: (id: number, field: string, value: number, userModified?: boolean) => void
  isDragging: boolean
  isDragOver: boolean
  onDragStart?: (e: React.DragEvent, id: number) => void
  onDragOver?: (e: React.DragEvent, id: number) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent, id: number) => void
  onDragEnd?: () => void
  hasSubTasks?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: (e: React.MouseEvent, id: number) => void
  onCancelEdit?: () => void
}

// ── Component ──────────────────────────────────────────────────────────────

export const TaskRow = memo(({
  task, subtotals, onUpdate, onRemove, formatCurrency,
  isSelected, onMainTaskSelect, rowNumber,
  isEditing, onEditToggle, onEditValueUpdate,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  hasSubTasks, isCollapsed, onToggleCollapse,
  onCancelEdit,
}: TaskRowProps) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()

  const handleUpdate = useCallback(
    (field: keyof Task, value: any) => onUpdate?.(task.id, field, value),
    [task.id, onUpdate],
  )
  const handleRemove = useCallback(() => onRemove?.(task.id), [task.id, onRemove])
  const handleEditToggle = useCallback(() => onEditToggle?.(task.id), [task.id, onEditToggle])
  const handleEditValueChange = useCallback(
    (field: string, value: string) => onEditValueUpdate?.(task.id, field, parseFloat(value) || 0, true),
    [task.id, onEditValueUpdate],
  )
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleEditToggle()
      if (e.key === 'Escape') onCancelEdit?.()
    },
    [handleEditToggle, onCancelEdit],
  )
  const handleMainTaskClick = useCallback(() => {
    if (task.isMainTask && onMainTaskSelect) onMainTaskSelect(task.id)
  }, [task.isMainTask, task.id, onMainTaskSelect])

  return (
    <tr
      className={[
        task.isMainTask ? 'main-task-row' : 'sub-task-row',
        isSelected   ? 'selected-main-task' : '',
        isDragging   ? 'dragging'  : '',
        isDragOver   ? 'drag-over' : '',
      ].filter(Boolean).join(' ')}
      onClick={handleMainTaskClick}
      style={{ cursor: task.isMainTask ? 'pointer' : 'default' }}
      draggable={task.isMainTask}
      onDragStart={e => onDragStart?.(e, task.id)}
      onDragOver={e => onDragOver?.(e, task.id)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop?.(e, task.id)}
      onDragEnd={onDragEnd}
    >
      {/* NO. */}
      <td className="row-number-cell">
        <div className="row-number-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          {task.isMainTask && hasSubTasks && (
            <button
              className="collapse-toggle-btn"
              onClick={e => onToggleCollapse?.(e, task.id)}
              title={isCollapsed ? 'Expand parts' : 'Collapse parts'}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          <span className="row-number">{rowNumber}</span>
        </div>
      </td>

      {/* REFERENCE NO */}
      <td className="reference-cell">
        <CollaborativeField
          fieldKey={`task.${task.id}.referenceNumber`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.referenceNumber`)}
          onBlur={() => emitBlur(`task.${task.id}.referenceNumber`)}
        >
          <input
            type="text" value={task.referenceNumber || ''}
            onChange={e => handleUpdate('referenceNumber', e.target.value)}
            className="table-input reference-input" placeholder="Ref No"
          />
        </CollaborativeField>
      </td>

      {/* DESCRIPTION */}
      <td className="description-cell">
        <div className={`description-container ${!task.isMainTask ? 'sub-task-description' : ''}`}>
          {!task.isMainTask && (
            <span className="sub-task-indicator" style={{ color: '#9ca3af', fontWeight: 'bold' }}>↳</span>
          )}
          <CollaborativeField
            fieldKey={`task.${task.id}.description`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.description`)}
            onBlur={() => emitBlur(`task.${task.id}.description`)}
            className="full-width-collab"
          >
            <input
              type="text" value={task.description}
              onChange={e => handleUpdate('description', e.target.value)}
              className={`table-input description-input ${!task.isMainTask ? 'sub-task-input' : ''}`}
              placeholder={task.isMainTask ? 'Assembly Name' : "Part's name"}
            />
          </CollaborativeField>
        </div>
      </td>

      {/* HOURS */}
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.hours`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.hours`)}
          onBlur={() => emitBlur(`task.${task.id}.hours`)}
        >
          <input
            type="text"
            inputMode="decimal"
            value={task.hours || ''}
            onChange={e => handleUpdate('hours', Math.min(999, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* MINUTES */}
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.minutes`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.minutes`)}
          onBlur={() => emitBlur(`task.${task.id}.minutes`)}
        >
          <input
            type="text"
            inputMode="numeric"
            value={task.minutes || ''}
            onChange={e => handleUpdate('minutes', Math.min(59, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* TIME CHARGE (calculated - read only) */}
      <td className="calculated-cell time-charge-bg">
        {formatCurrency(subtotals.basicLabor)}
      </td>

      {/* OT RATE (hours input) */}
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.overtimeHours`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.overtimeHours`)}
          onBlur={() => emitBlur(`task.${task.id}.overtimeHours`)}
        >
          <input
            type="text"
            inputMode="decimal"
            value={task.overtimeHours || ''}
            onChange={e => handleUpdate('overtimeHours', parseFloat(e.target.value) || 0)}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* OVERTIME (calculated - read only) */}
      <td className="calculated-cell overtime-bg">
        {formatCurrency(subtotals.overtime)}
      </td>

      {/* SOFTWARE (units input + calculated total) */}
      <td className="software-cell">
        <div className="software-input-container">
          <CollaborativeField
            fieldKey={`task.${task.id}.softwareUnits`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.softwareUnits`)}
            onBlur={() => emitBlur(`task.${task.id}.softwareUnits`)}
            className="software-collab-wrapper"
          >
            <input
              type="text"
              inputMode="decimal"
              value={task.softwareUnits || ''}
              onChange={e => handleUpdate('softwareUnits', parseFloat(e.target.value) || 0)}
              className="table-input number-input software-units-input"
            />
          </CollaborativeField>
          <span className="software-total">{formatCurrency(subtotals.software)}</span>
        </div>
      </td>

      {/* TYPE */}
      <td className="type-cell">
          <CollaborativeField
            fieldKey={`task.${task.id}.type`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.type`)}
            onBlur={() => emitBlur(`task.${task.id}.type`)}
            className="type-collab-wrapper"
          >
            {task.type === '2D' || task.type === '3D' || !task.type ? (
              <select
                value={task.type || '3D'}
                onChange={e => handleUpdate('type', e.target.value === 'Others' ? 'Custom' : e.target.value)}
                className="table-input type-select"
              >
                <option value="2D">2D</option>
                <option value="3D">3D</option>
                <option value="Others">Others...</option>
              </select>
            ) : (
              <div className="custom-type-container">
                <input
                  type="text" value={task.type === 'Custom' ? '' : task.type}
                  onChange={e => handleUpdate('type', e.target.value)}
                  className="table-input custom-type-input" placeholder="Specify type" autoFocus
                />
                <button type="button" onClick={() => handleUpdate('type', '3D')} className="reset-type-button" title="Back to dropdown">↺</button>
              </div>
            )}
          </CollaborativeField>
      </td>

      {/* TOTAL (calculated / editable) */}
      <td className="total-cell">
        {isEditing ? (
          <CollaborativeField
            fieldKey={`task.${task.id}.manualTotal`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.manualTotal`)}
            onBlur={() => emitBlur(`task.${task.id}.manualTotal`)}
          >
            <input
              type="text"
              inputMode="decimal"
              value={subtotals.total}
              onChange={e => handleEditValueChange('total', e.target.value)}
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
            onClick={handleEditToggle}
            className={`edit-task-button ${isEditing ? 'editing' : ''}`}
            title={isEditing ? 'Save changes' : 'Edit values'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="edit-icon">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={handleRemove} className="remove-task-button" title="Remove task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="remove-icon">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
})

TaskRow.displayName = 'TaskRow'
