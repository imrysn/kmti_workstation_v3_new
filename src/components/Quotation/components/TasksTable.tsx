import { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react'
import type { Task, BaseRates, ManualOverrides } from '../../../hooks/quotation'
import { calculateTaskTotal, calculateOverhead } from '../../../utils/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'

type NotificationType = 'success' | 'error' | 'info' | 'warning'

interface TaskSubtotals {
  taskId: number
  basicLabor: number
  overtime: number
  software: number
  total: number
}

// ── TaskRow ───────────────────────────────────────────────────────────────────
interface TaskRowProps {
  task: Task
  subtotals: TaskSubtotals
  onUpdate: (id: number, field: keyof Task, value: any) => void
  onRemove: (id: number) => void
  formatCurrency: (n: number) => string
  isSelected: boolean
  onMainTaskSelect: (id: number) => void
  rowNumber: number
  isEditing: boolean
  onEditToggle: (id: number) => void
  onEditValueUpdate: (id: number, field: string, value: number, userModified?: boolean) => void
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (e: React.DragEvent, id: number) => void
  onDragOver: (e: React.DragEvent, id: number) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, id: number) => void
  onDragEnd: () => void
  hasSubTasks?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: (e: React.MouseEvent, id: number) => void
  onCancelEdit?: () => void
}

const TaskRow = memo(({
  task, subtotals, onUpdate, onRemove, formatCurrency,
  isSelected, onMainTaskSelect, rowNumber,
  isEditing, onEditToggle, onEditValueUpdate,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  hasSubTasks, isCollapsed, onToggleCollapse,
  onCancelEdit
}: TaskRowProps) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()

  const handleUpdate = useCallback((field: keyof Task, value: any) => onUpdate(task.id, field, value), [task.id, onUpdate])
  const handleRemove = useCallback(() => onRemove(task.id), [task.id, onRemove])
  const handleEditToggle = useCallback(() => onEditToggle(task.id), [task.id, onEditToggle])
  const handleEditValueChange = useCallback((field: string, value: string) => {
    onEditValueUpdate(task.id, field, parseFloat(value) || 0, true)
  }, [task.id, onEditValueUpdate])
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEditToggle()
    if (e.key === 'Escape') onCancelEdit?.()
  }, [handleEditToggle, onCancelEdit])
  const handleMainTaskClick = useCallback(() => {
    if (task.isMainTask && onMainTaskSelect) onMainTaskSelect(task.id)
  }, [task.isMainTask, task.id, onMainTaskSelect])

  return (
    <tr
      className={`${task.isMainTask ? 'main-task-row' : 'sub-task-row'} ${isSelected ? 'selected-main-task' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={handleMainTaskClick}
      style={{ cursor: task.isMainTask ? 'pointer' : 'default' }}
      draggable={task.isMainTask}
      onDragStart={e => onDragStart(e, task.id)}
      onDragOver={e => onDragOver(e, task.id)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, task.id)}
      onDragEnd={onDragEnd}
    >
      <td className="row-number-cell">
        <div className="row-number-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          {task.isMainTask && hasSubTasks && (
            <button className="collapse-toggle-btn" onClick={(e) => onToggleCollapse?.(e, task.id)} title={isCollapsed ? 'Expand parts' : 'Collapse parts'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}
          <span className="row-number">{rowNumber}</span>
        </div>
      </td>
      <td className="reference-cell">
        <CollaborativeField
          fieldKey={`task.${task.id}.referenceNumber`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.referenceNumber`)}
          onBlur={() => emitBlur(`task.${task.id}.referenceNumber`)}
        >
          <input type="text" value={task.referenceNumber || ''} onChange={e => handleUpdate('referenceNumber', e.target.value)}
            className="table-input reference-input" placeholder="Ref No" />
        </CollaborativeField>
      </td>
      <td className="description-cell">
        <div className={`description-container ${!task.isMainTask ? 'sub-task-description' : ''}`}>
          {!task.isMainTask && <span className="sub-task-indicator" style={{ color: '#9ca3af', fontWeight: 'bold' }}>↳</span>}
          <CollaborativeField
            fieldKey={`task.${task.id}.description`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.description`)}
            onBlur={() => emitBlur(`task.${task.id}.description`)}
            className="full-width-collab"
          >
            <input type="text" value={task.description} onChange={e => handleUpdate('description', e.target.value)}
              className={`table-input description-input ${!task.isMainTask ? 'sub-task-input' : ''}`}
              placeholder={task.isMainTask ? 'Assembly Name' : "Part's name"} />
          </CollaborativeField>
        </div>
      </td>
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.hours`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.hours`)}
          onBlur={() => emitBlur(`task.${task.id}.hours`)}
        >
          <input type="number" value={task.hours || ''} onChange={e => handleUpdate('hours', Math.min(24, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="table-input number-input" min="0" max="24" step="0.5" />
        </CollaborativeField>
      </td>
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.minutes`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.minutes`)}
          onBlur={() => emitBlur(`task.${task.id}.minutes`)}
        >
          <input type="number" value={task.minutes || ''} onChange={e => handleUpdate('minutes', Math.min(59, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="table-input number-input" min="0" max="59" step={1} />
        </CollaborativeField>
      </td>
      <td className="calculated-cell time-charge-bg">
        {isEditing ? (
          <CollaborativeField
            fieldKey={`task.${task.id}.manualBasicLabor`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.manualBasicLabor`)}
            onBlur={() => emitBlur(`task.${task.id}.manualBasicLabor`)}
          >
            <input type="number" value={subtotals.basicLabor || ''} onChange={e => handleEditValueChange('basicLabor', e.target.value)}
              onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input" min="0" step="0.01" />
          </CollaborativeField>
        ) : formatCurrency(subtotals.basicLabor)}
      </td>
      <td>
        <CollaborativeField
          fieldKey={`task.${task.id}.overtimeHours`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.overtimeHours`)}
          onBlur={() => emitBlur(`task.${task.id}.overtimeHours`)}
        >
          <input type="number" value={task.overtimeHours || ''} onChange={e => handleUpdate('overtimeHours', parseFloat(e.target.value) || 0)}
            className="table-input number-input" min="0" step="0.5" />
        </CollaborativeField>
      </td>
      <td className="calculated-cell overtime-bg">
        {isEditing ? (
          <CollaborativeField
            fieldKey={`task.${task.id}.manualOvertime`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.manualOvertime`)}
            onBlur={() => emitBlur(`task.${task.id}.manualOvertime`)}
          >
            <input type="number" value={subtotals.overtime || ''} onChange={e => handleEditValueChange('overtime', e.target.value)}
              onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input" min="0" step="0.01" />
          </CollaborativeField>
        ) : formatCurrency(subtotals.overtime)}
      </td>
      <td className="software-cell">
        <div className="software-input-container">
          <CollaborativeField
            fieldKey={`task.${task.id}.softwareUnits`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.softwareUnits`)}
            onBlur={() => emitBlur(`task.${task.id}.softwareUnits`)}
            className="software-collab-wrapper"
          >
            <input type="number" value={task.softwareUnits || ''} onChange={e => handleUpdate('softwareUnits', parseFloat(e.target.value) || 0)}
              className="table-input number-input software-units-input" min="0" />
          </CollaborativeField>
          {isEditing ? (
            <CollaborativeField
              fieldKey={`task.${task.id}.manualSoftware`}
              remoteUsers={remoteUsers}
              onFocus={() => emitFocus(`task.${task.id}.manualSoftware`)}
              onBlur={() => emitBlur(`task.${task.id}.manualSoftware`)}
            >
              <input type="number" value={subtotals.software || ''} onChange={e => handleEditValueChange('software', e.target.value)}
                onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input software-edit-input" min="0" step="0.01" />
            </CollaborativeField>
          ) : (
            <span className="software-total">{formatCurrency(subtotals.software)}</span>
          )}
        </div>
      </td>
      <td className="type-cell">
        <CollaborativeField
          fieldKey={`task.${task.id}.type`}
          remoteUsers={remoteUsers}
          onFocus={() => emitFocus(`task.${task.id}.type`)}
          onBlur={() => emitBlur(`task.${task.id}.type`)}
          className="type-collab-wrapper"
        >
          {task.type === '2D' || task.type === '3D' || !task.type ? (
            <select value={task.type || '3D'} onChange={e => handleUpdate('type', e.target.value === 'Others' ? 'Custom' : e.target.value)}
              className="table-input type-select">
              <option value="2D">2D</option>
              <option value="3D">3D</option>
              <option value="Others">Others...</option>
            </select>
          ) : (
            <div className="custom-type-container">
              <input type="text" value={task.type === 'Custom' ? '' : task.type}
                onChange={e => handleUpdate('type', e.target.value)}
                className="table-input custom-type-input" placeholder="Specify type" autoFocus />
              <button type="button" onClick={() => handleUpdate('type', '3D')} className="reset-type-button" title="Back to dropdown">↺</button>
            </div>
          )}
        </CollaborativeField>
      </td>
      <td className="total-cell">
        {isEditing ? (
          <CollaborativeField
            fieldKey={`task.${task.id}.manualTotal`}
            remoteUsers={remoteUsers}
            onFocus={() => emitFocus(`task.${task.id}.manualTotal`)}
            onBlur={() => emitBlur(`task.${task.id}.manualTotal`)}
          >
            <input type="number" value={subtotals.total} onChange={e => handleEditValueChange('total', e.target.value)}
              onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input" min="0" step="0.01" />
          </CollaborativeField>
        ) : formatCurrency(subtotals.total)}
      </td>
      <td className="action-cell">
        <div className="action-buttons-container">
          <button onClick={handleEditToggle} className={`edit-task-button ${isEditing ? 'editing' : ''}`}
            title={isEditing ? 'Save changes' : 'Edit values'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="edit-icon">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={handleRemove} className="remove-task-button" title="Remove task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="remove-icon">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
})

// ── Main TasksTable ──────────────────────────────────────────────────────────
interface TasksTableProps {
  tasks: Task[]
  baseRates: BaseRates
  selectedMainTaskId: number | null
  onTaskUpdate: (id: number, field: keyof Task, value: any) => void
  onTaskAdd: () => void
  onSubTaskAdd: (mainTaskId: number | null, notify?: (msg: string, type?: NotificationType) => void) => void
  onTaskRemove: (id: number) => void
  onTaskReorder: (draggedId: number, targetId: number) => void
  onMainTaskSelect: (id: number) => void
  onBaseRateUpdate: (field: keyof BaseRates, value: number) => void
  onOpenRateSettings?: () => void
  notify?: (message: string, type?: NotificationType) => void
  manualOverrides: ManualOverrides
  setManualOverrides: (updater: (prev: ManualOverrides) => ManualOverrides) => void
  onFooterUpdate: (key: string, value: any) => void
  collapsedTasks?: Set<number>
  onCollapsedTasksChange?: (collapsed: Set<number>) => void
}

const TasksTable = memo(({
  tasks, baseRates, selectedMainTaskId,
  onTaskUpdate, onTaskAdd, onSubTaskAdd, onTaskRemove, onTaskReorder,
  onMainTaskSelect, onBaseRateUpdate: _onBaseRateUpdate, onOpenRateSettings, notify,
  manualOverrides, setManualOverrides, onFooterUpdate,
  collapsedTasks = new Set(), onCollapsedTasksChange
}: TasksTableProps) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editedValues, setEditedValues] = useState<Record<number, Partial<TaskSubtotals>>>({})
  const [modifiedFields, setModifiedFields] = useState<Record<number, Record<string, boolean>>>({})
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null)
  const [editingOverhead, setEditingOverhead] = useState(false)
  const [editingGrandTotal, setEditingGrandTotal] = useState(false)
  const [overheadDraft, setOverheadDraft] = useState<string>('')
  const [grandTotalDraft, setGrandTotalDraft] = useState<string>('')

  const toggleCollapse = useCallback((e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    const next = new Set(collapsedTasks)
    if (next.has(taskId)) next.delete(taskId)
    else next.add(taskId)
    onCollapsedTasksChange?.(next)
  }, [collapsedTasks, onCollapsedTasksChange])

  const { taskTotals, overheadTotal, subtotal, grandTotal, mainTaskCount } = useMemo(() => {
    const mainTaskCount = tasks.filter(t => t.isMainTask).length

    const totals: TaskSubtotals[] = tasks.map(task => {
      const { basicLabor, overtime, software, total } = calculateTaskTotal(task, tasks, baseRates, manualOverrides)
      return { taskId: task.id, basicLabor, overtime, software, total }
    })

    const sub = totals.filter((_, i) => tasks[i].isMainTask).reduce((s, t) => s + t.total, 0)
    const footer = manualOverrides?.footer || {}

    const overheadTotal = footer.overhead !== undefined
      ? footer.overhead
      : calculateOverhead(sub, baseRates.overheadPercentage)

    const grand = sub + overheadTotal + (footer.adjustment || 0)

    return { taskTotals: totals, overheadTotal, subtotal: sub, grandTotal: grand, mainTaskCount }
  }, [tasks, baseRates, manualOverrides])

  // Track previous subtotal with a ref so we only reset footer overrides when the
  // computed subtotal actually changes numerically — not on every unrelated re-render.
  const prevSubtotalRef = useRef<number | null>(null)
  useEffect(() => {
    if (prevSubtotalRef.current === null) {
      prevSubtotalRef.current = subtotal
      return
    }
    if (prevSubtotalRef.current === subtotal) return
    prevSubtotalRef.current = subtotal

    // Subtotal changed — clear footer overrides so overhead/grand total revert to auto
    setManualOverrides(prev => {
      if (!prev.footer.overhead && !prev.footer.adjustment) return prev
      return { ...prev, footer: {} }
    })
  }, [subtotal, setManualOverrides])

  const formatValue = (val: number): string => {
    if (val === 0) return ''
    const str = val.toFixed(2)
    return str.endsWith('.00') ? Math.round(val).toString() : str
  }

  const handleOverheadBlur = useCallback((draft: string) => {
    if (draft.trim() === '') {
      onFooterUpdate('overhead', undefined)
    } else {
      const val = parseFloat(draft)
      if (!isNaN(val) && val >= 0) {
        onFooterUpdate('overhead', val)
      }
    }
    setEditingOverhead(false)
  }, [onFooterUpdate])

  const handleGrandTotalBlur = useCallback((draft: string) => {
    if (draft.trim() === '') {
      onFooterUpdate('adjustment', undefined)
    } else {
      const val = parseFloat(draft)
      if (!isNaN(val) && val >= 0) {
        const currentBaseSum = subtotal + overheadTotal
        const roundingAdjustment = val - currentBaseSum
        onFooterUpdate('adjustment', roundingAdjustment)
      }
    }
    setEditingGrandTotal(false)
  }, [onFooterUpdate, subtotal, overheadTotal])

  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null)
    setEditedValues({})
    setModifiedFields({})
  }, [])

  const handleEditToggle = useCallback((taskId: number) => {
    if (editingTaskId === taskId) {
      const fieldsToSave = modifiedFields[taskId]
      if (fieldsToSave && Object.keys(fieldsToSave).length > 0) {
        const valuesToSave: Record<string, number> = {}
        Object.keys(fieldsToSave).forEach(field => {
          const val = (editedValues[taskId] as any)?.[field]
          if (val !== undefined) valuesToSave[field] = val
        })
        setManualOverrides(prev => ({
          ...prev,
          tasks: { ...prev.tasks, [taskId]: { ...prev.tasks[taskId], ...valuesToSave } },
        }))
      }
      setEditingTaskId(null)
      setEditedValues({})
      setModifiedFields({})
    } else {
      setEditingTaskId(taskId)
      const taskSubtotal = taskTotals.find(t => t.taskId === taskId)
      if (taskSubtotal) {
        setEditedValues({ [taskId]: { basicLabor: taskSubtotal.basicLabor, overtime: taskSubtotal.overtime, software: taskSubtotal.software, total: taskSubtotal.total } })
      }
    }
  }, [editingTaskId, taskTotals, editedValues, modifiedFields])

  const handleEditValueUpdate = useCallback((taskId: number, field: string, value: number, userModified = false) => {
    setEditedValues(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: value } }))
    if (userModified) {
      setModifiedFields(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: true } }))
    }
  }, [])

  const formatCurrency = useCallback((amount: number) => `¥${amount.toLocaleString()}`, [])

  const getTaskSubtotals = useCallback((taskId: number): TaskSubtotals => {
    const calculated = taskTotals.find(t => t.taskId === taskId) || { taskId, basicLabor: 0, overtime: 0, software: 0, total: 0 }
    if (editingTaskId === taskId && editedValues[taskId]) {
      return { ...calculated, ...editedValues[taskId] }
    }
    return calculated
  }, [taskTotals, editingTaskId, editedValues])

  const taskIds = useMemo(() => new Set(tasks.map(t => t.id)), [tasks])

  // Prune stale task overrides when tasks are removed
  useEffect(() => {
    const staleIds = Object.keys(manualOverrides?.tasks || {})
      .map(Number)
      .filter(id => !taskIds.has(id))
    if (staleIds.length === 0) return

    setManualOverrides(prev => {
      const tasks = { ...prev.tasks }
      staleIds.forEach(id => delete tasks[id])
      return { ...prev, tasks }
    })

    setModifiedFields(prev => {
      const next = { ...prev }
      staleIds.forEach(id => delete next[id])
      return next
    })
  }, [taskIds, manualOverrides?.tasks, setManualOverrides])

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, taskId: number) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task?.isMainTask) return
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', String(taskId))
  }, [tasks])
  const handleDragOver = useCallback((e: React.DragEvent, taskId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const task = tasks.find(t => t.id === taskId)
    if (!task?.isMainTask || taskId === draggedTaskId) return
    setDragOverTaskId(taskId)
  }, [tasks, draggedTaskId])
  const handleDragLeave = useCallback(() => setDragOverTaskId(null), [])
  const handleDrop = useCallback((e: React.DragEvent, targetTaskId: number) => {
    e.preventDefault()
    if (!draggedTaskId || !targetTaskId || draggedTaskId === targetTaskId) {
      setDraggedTaskId(null); setDragOverTaskId(null); return
    }
    onTaskReorder(draggedTaskId, targetTaskId)
    setDraggedTaskId(null); setDragOverTaskId(null)
  }, [draggedTaskId, onTaskReorder])
  const handleDragEnd = useCallback(() => { setDraggedTaskId(null); setDragOverTaskId(null) }, [])

  return (
    <div className="computation-section">
      <div className="computation-header">
        <div className="section-header" style={{ height: '32px' }}>
          <div className="section-icon computation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="8" y1="6" x2="16" y2="6" />
              <line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="14" />
              <line x1="8" y1="18" x2="8" y2="18" /><line x1="12" y1="18" x2="12" y2="18" /><line x1="16" y1="18" x2="16" y2="18" />
            </svg>
          </div>
          <h2 className="section-title">Computation Table</h2>
        </div>
        <div className="computation-buttons">
          {onOpenRateSettings && (
            <button className="add-button rate-settings-btn" onClick={onOpenRateSettings} title="Configure base rates">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
              Rate Settings
            </button>
          )}
          <button className="add-button primary" onClick={onTaskAdd}
            disabled={mainTaskCount >= 27} title={mainTaskCount >= 27 ? 'Maximum 27 assembly tasks reached' : 'Add assembly task'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Assembly
          </button>
          <button className="add-button secondary" onClick={() => onSubTaskAdd(selectedMainTaskId, notify)}
            disabled={!selectedMainTaskId} title={!selectedMainTaskId ? 'Select a main task first' : 'Add sub-task'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Parts
          </button>
        </div>
      </div>

      <div className="tasks-table-container">
        <div className="tasks-table-header">
          <table className="tasks-table">
            <thead>
              <tr>
                <th>NO.</th><th>REFERENCE NO</th><th>DESCRIPTION</th><th>HOURS</th><th>MINUTES</th>
                <th>TIME CHARGE</th><th>OT RATE</th><th>OVERTIME</th><th>SOFTWARE</th>
                <th>TYPE</th><th>TOTAL</th><th>ACTION</th>
              </tr>
            </thead>
          </table>
        </div>

        <div className="tasks-table-body">
          <table className="tasks-table">
            <tbody>
              {tasks.map((task, index) => {
                let rowNumber: number
                if (task.isMainTask) {
                  rowNumber = tasks.slice(0, index).filter(t => t.isMainTask).length + 1
                } else {
                  rowNumber = tasks.slice(0, index).filter(t => t.parentId === task.parentId).length + 1
                }

                if (!task.isMainTask && collapsedTasks.has(task.parentId!)) return null

                const hasSubTasks = task.isMainTask && tasks.some(t => t.parentId === task.id)
                const isCollapsed = collapsedTasks.has(task.id)

                return (
                  <TaskRow
                    key={task.id} task={task} subtotals={getTaskSubtotals(task.id)}
                    onUpdate={onTaskUpdate} onRemove={onTaskRemove}
                    formatCurrency={formatCurrency}
                    isSelected={task.isMainTask && task.id === selectedMainTaskId}
                    onMainTaskSelect={onMainTaskSelect} rowNumber={rowNumber}
                    isEditing={editingTaskId === task.id}
                    onEditToggle={handleEditToggle} onEditValueUpdate={handleEditValueUpdate}
                    isDragging={draggedTaskId === task.id} isDragOver={dragOverTaskId === task.id}
                    onDragStart={handleDragStart} onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave} onDrop={handleDrop} onDragEnd={handleDragEnd}
                    hasSubTasks={hasSubTasks} isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse}
                    onCancelEdit={handleCancelEdit}
                  />
                )
              })}
              {tasks.length === 0 && (
                <tr className="empty-table-row">
                  <td colSpan={12}>
                    <span className="empty-table-hint">No tasks yet — click Add Assembly to start</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grand-total-section">
        <div className="grand-total-row">
          <div className="grand-total-label">Total:</div>
          <div className="grand-total-value">{formatCurrency(subtotal)}</div>
        </div>
        <div className="grand-total-row">
          <div className="grand-total-label">Administrative Overhead:</div>
          <div className="grand-total-value">
            {editingOverhead ? (
              <div className="footer-input-wrapper">
                <span className="footer-currency-symbol">¥</span>
                <CollaborativeField
                  fieldKey="footer.overhead"
                  remoteUsers={remoteUsers}
                  onFocus={() => emitFocus('footer.overhead')}
                  onBlur={() => emitBlur('footer.overhead')}
                >
                  <input
                    type="number"
                    value={overheadDraft}
                    onChange={e => setOverheadDraft(e.target.value)}
                    onBlur={e => handleOverheadBlur(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleOverheadBlur((e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setEditingOverhead(false)
                    }}
                    className="footer-input amount-input"
                    step="0.01"
                    min="0"
                    autoFocus
                  />
                </CollaborativeField>
              </div>
            ) : (
              <span
                className="footer-value-display"
                onClick={() => { setOverheadDraft(formatValue(overheadTotal)); setEditingOverhead(true) }}
                title="Click to edit"
              >
                {formatCurrency(overheadTotal)}
              </span>
            )}
          </div>
        </div>
        <div className="grand-total-row grand-total-final">
          <div className="grand-total-label">Grand Total:</div>
          <div className="grand-total-value">
            {editingGrandTotal ? (
              <div className="footer-input-wrapper final-total">
                <span className="footer-currency-symbol">¥</span>
                <CollaborativeField
                  fieldKey="footer.adjustment"
                  remoteUsers={remoteUsers}
                  onFocus={() => emitFocus('footer.adjustment')}
                  onBlur={() => emitBlur('footer.adjustment')}
                >
                  <input
                    type="number"
                    value={grandTotalDraft}
                    onChange={e => setGrandTotalDraft(e.target.value)}
                    onBlur={e => handleGrandTotalBlur(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleGrandTotalBlur((e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setEditingGrandTotal(false)
                    }}
                    className="footer-input amount-input total-input"
                    step="0.01"
                    min="0"
                    autoFocus
                  />
                </CollaborativeField>
              </div>
            ) : (
              <span
                className="footer-value-display grand-total-display"
                onClick={() => { setGrandTotalDraft(formatValue(grandTotal)); setEditingGrandTotal(true) }}
                title="Click to edit"
              >
                {formatCurrency(grandTotal)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

TaskRow.displayName = 'TaskRow'
TasksTable.displayName = 'TasksTable'

export default TasksTable
