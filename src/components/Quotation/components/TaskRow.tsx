import { memo, useCallback, useState, useEffect, useMemo } from 'react'
import type { Task } from '../../../hooks/quotation/useInvoiceState'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { useAuth } from '../../../context/AuthContext'
import { CollaborativeField } from './CollaborativeField'

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
  onUpdate?: (id: number, fieldOrUpdates: keyof Task | Partial<Task>, value?: any) => void
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
  layoutVariant?: 'special' | 'kemco'
  trRef?: React.Ref<HTMLTableRowElement>
  /** Provided by TasksTable with full ancestor-chain lock awareness */
  isRowLocked?: boolean
}

export const TaskRow = memo(({
  task, subtotals, onUpdate, onRemove, formatCurrency,
  isSelected, onMainTaskSelect, rowNumber,
  isEditing, onEditToggle, onEditValueUpdate,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  hasSubTasks, isCollapsed, onToggleCollapse,
  onCancelEdit, layoutVariant, trRef,
  isRowLocked: isRowLockedProp,
}: TaskRowProps) => {
  const { hasRole } = useAuth()
  const { remoteUsers, emitFocus, emitBlur, myName } = useCollaborationContext()
  const [localTotal, setLocalTotal] = useState<string>('')

  const isRowLockedComputed = useMemo(() => {
    const ownerWorkstation = task.engineerWorkstation?.trim().toLowerCase() || ''
    if (!ownerWorkstation && !task.engineer?.trim()) return false
    if (hasRole('admin', 'it')) return false

    const myWorkstation = myName.trim().toLowerCase()
    if (ownerWorkstation) {
      // Workstation-based ownership (same system as bookmark colors)
      return ownerWorkstation !== myWorkstation
    }
    // Legacy fallback: use lastEditorName if available
    const editorWorkstation = task.lastEditorName?.trim().toLowerCase() || ''
    if (editorWorkstation) return editorWorkstation !== myWorkstation
    return false
  }, [task.engineer, task.engineerWorkstation, task.lastEditorName, myName, hasRole])

  // Prop takes priority (TasksTable resolves the full ancestor chain)
  const isRowLocked = isRowLockedProp ?? isRowLockedComputed

  useEffect(() => {
    if (isEditing) {
      setLocalTotal(subtotals.total.toString())
    }
  }, [isEditing, subtotals.total])

  const handleUpdate = useCallback(
    (field: keyof Task, value: any) => onUpdate?.(task.id, field, value),
    [task.id, onUpdate],
  )
  const handleRemove = useCallback(() => onRemove?.(task.id), [task.id, onRemove])
  const handleEditToggle = useCallback(() => onEditToggle?.(task.id), [task.id, onEditToggle])
  
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleEditToggle()
      if (e.key === 'Escape') onCancelEdit?.()
    },
    [handleEditToggle, onCancelEdit],
  )

  const handleMainTaskClick = useCallback(() => {
    // In KEMCO, selection works on any row. In Special, only on main tasks.
    if (layoutVariant === 'kemco') {
      if (onMainTaskSelect) onMainTaskSelect(task.id)
    } else {
      if (task.isMainTask && onMainTaskSelect) onMainTaskSelect(task.id)
    }
  }, [layoutVariant, task.isMainTask, task.id, onMainTaskSelect])

  const renderSpecialCells = () => (
    <>
      {/* HOURS */}
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.hours`}
          remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}
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
          remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}
          onFocus={() => emitFocus(`task.${task.id}.minutes`)}
          onBlur={() => emitBlur(`task.${task.id}.minutes`)}
        >
          <input
            type="text"
            inputMode="decimal"
            value={task.minutes || ''}
            onChange={e => handleUpdate('minutes', Math.min(59.99, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>

      {/* TIME CHARGE (calculated - read only) */}
      <td className="calculated-cell time-charge-bg">
        {formatCurrency(subtotals.basicLabor)}
      </td>

      {/* OT HOURS */}
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.overtimeHours`}
          remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}
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
            remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}
            onFocus={() => emitFocus(`task.${task.id}.softwareUnits`)}
            onBlur={() => emitBlur(`task.${task.id}.softwareUnits`)}
          >
            <input
              type="text"
              inputMode="numeric"
              value={task.softwareUnits || ''}
              onChange={e => handleUpdate('softwareUnits', parseFloat(e.target.value) || 0)}
              className="table-input number-input software-units-input"
            />
          </CollaborativeField>
          <span className="software-total">{formatCurrency(subtotals.software)}</span>
        </div>
      </td>
    </>
  )

  const renderKemcoCells = () => (
    <>
      {/* MACHINE CODE */}
      <td>
        {task.level === 0 && (
          <CollaborativeField fieldKey={`task.${task.id}.machineCode`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
            <input
              type="text"
              value={task.machineCode || ''}
              onChange={e => handleUpdate('machineCode', e.target.value)}
              className="table-input"
            />
          </CollaborativeField>
        )}
      </td>

      {/* UNIT CODE */}
      <td>
        {task.level !== 2 && (
          <CollaborativeField fieldKey={`task.${task.id}.unitCode`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
            <input
              type="text"
              value={task.unitCode || ''}
              onChange={e => handleUpdate('unitCode', e.target.value)}
              className="table-input"
            />
          </CollaborativeField>
        )}
      </td>

      {/* DWG No */}
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.dwgNo`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="text"
            value={task.dwgNo || ''}
            onChange={e => handleUpdate('dwgNo', e.target.value)}
            className="table-input"
          />
        </CollaborativeField>
      </td>

      {/* DESCRIPTION (already in common column, so this space is just for layout alignment if needed) */}
      {/* Actually, KEMCO has START DATE and END DATE instead of hours/minutes */}
      
      <td>
        <CollaborativeField fieldKey={`task.${task.id}.startDate`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="date"
            value={task.startDate || ''}
            onChange={e => handleUpdate('startDate', e.target.value)}
            className="table-input date-input"
          />
        </CollaborativeField>
      </td>

      <td>
        <CollaborativeField fieldKey={`task.${task.id}.endDate`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="date"
            value={task.endDate || ''}
            onChange={e => handleUpdate('endDate', e.target.value)}
            className="table-input date-input"
          />
        </CollaborativeField>
      </td>

      <td>
        <CollaborativeField fieldKey={`task.${task.id}.time`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="text"
            value={task.time || ''}
            onChange={e => handleUpdate('time', parseFloat(e.target.value) || 0)}
            className="table-input number-input"
          />
        </CollaborativeField>
      </td>
    </>
  )

  return (
    <tr
      ref={trRef}
      className={[
        task.isMainTask ? 'main-task-row' : 'sub-task-row',
        isSelected ? 'selected-main-task' : '',
        isDragging ? 'dragging' : '',
        isDragOver ? 'drag-over' : '',
        isRowLocked ? 'row-locked' : '',
        `layout-${layoutVariant}`,
        `level-${task.level || 0}`
      ].filter(Boolean).join(' ')}
      onClick={handleMainTaskClick}
      draggable={!isRowLocked && (task.isMainTask || layoutVariant === 'kemco')}
      onDragStart={e => onDragStart?.(e, task.id)}
      onDragOver={e => onDragOver?.(e, task.id)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop?.(e, task.id)}
      onDragEnd={onDragEnd}
    >
      {/* NO. */}
      <td className="row-number-cell">
        <div className="row-number-container">
          {task.isMainTask && hasSubTasks && (
            <button
              className="collapse-toggle-btn"
              onClick={e => onToggleCollapse?.(e, task.id)}
              title={isCollapsed ? 'Expand parts' : 'Collapse parts'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transformOrigin: 'center', transition: 'transform 0.2s' }} />
              </svg>
            </button>
          )}
          <span className="row-number">{rowNumber}</span>
        </div>
      </td>

      {/* REFERENCE NO / CONST NO */}
      <td className="reference-cell">
        <CollaborativeField fieldKey={`task.${task.id}.referenceNumber`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <input
            type="text"
            value={task.referenceNumber || ''}
            onChange={e => handleUpdate('referenceNumber', e.target.value)}
            className="table-input reference-input"
          />
        </CollaborativeField>
      </td>

      {/* DESCRIPTION */}
      <td className="description-cell">
        <div className={`description-container level-${task.level || 0}`}>
          {(layoutVariant === 'kemco' ? (task.level || 0) > 0 : !task.isMainTask) && (
            <span className="sub-task-indicator">↳</span>
          )}
          <CollaborativeField fieldKey={`task.${task.id}.description`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer} className="full-width-collab">
            <input
              type="text"
              value={task.description}
              onChange={e => handleUpdate('description', e.target.value)}
              className="table-input description-input"
              placeholder={task.isMainTask ? 'Assembly Name' : "Part's name"}
            />
          </CollaborativeField>
        </div>
      </td>

      {layoutVariant === 'kemco' ? renderKemcoCells() : renderSpecialCells()}

      {/* TYPE */}
      <td className="type-cell">
        <CollaborativeField fieldKey={`task.${task.id}.type`} remoteUsers={remoteUsers} hardLocked={isRowLocked} lockOwnerName={task.engineer}>
          <select
            value={task.type || '3D'}
            onChange={e => handleUpdate('type', e.target.value)}
            className="table-input type-select"
          >
            <option value="2D">2D</option>
            <option value="3D">3D</option>
            <option value="Others">Others...</option>
          </select>
        </CollaborativeField>
      </td>

      {/* TOTAL / ACTION (Special only has editable Total) */}
      {layoutVariant === 'special' && (
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
      )}

      {/* ACTION */}
      <td className="action-cell">
        <div className="action-buttons-container">
          {layoutVariant === 'special' && (
            <button
              onClick={handleEditToggle}
              className={`edit-task-button ${isEditing ? 'editing' : ''}`}
              disabled={isRowLocked}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          <button
            onClick={handleRemove}
            className="remove-task-button"
            disabled={isRowLocked}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  )
})

TaskRow.displayName = 'TaskRow'
