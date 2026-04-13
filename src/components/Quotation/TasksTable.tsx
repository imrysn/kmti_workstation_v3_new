import { memo, useMemo, useCallback, useState, useEffect } from 'react'
import type { Task, BaseRates, ManualOverrides } from '../../hooks/quotation'

type NotificationType = 'success' | 'error' | 'info' | 'warning'

interface TaskSubtotals {
  taskId: number
  basicLabor: number
  overtime: number
  software: number
  overhead: number
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
}

const TaskRow = memo(({
  task, subtotals, onUpdate, onRemove, formatCurrency,
  isSelected, onMainTaskSelect, rowNumber,
  isEditing, onEditToggle, onEditValueUpdate,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
}: TaskRowProps) => {
  const handleUpdate = useCallback((field: keyof Task, value: any) => onUpdate(task.id, field, value), [task.id, onUpdate])
  const handleRemove = useCallback(() => onRemove(task.id), [task.id, onRemove])
  const handleEditToggle = useCallback(() => onEditToggle(task.id), [task.id, onEditToggle])
  const handleEditValueChange = useCallback((field: string, value: string) => {
    onEditValueUpdate(task.id, field, parseFloat(value) || 0, true)
  }, [task.id, onEditValueUpdate])
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleEditToggle()
  }, [handleEditToggle])
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
      <td className="row-number-cell"><span className="row-number">{rowNumber}</span></td>
      <td className="reference-cell">
        <input type="text" value={task.referenceNumber || ''} onChange={e => handleUpdate('referenceNumber', e.target.value)}
          className="table-input reference-input" placeholder="Ref No" />
      </td>
      <td className="description-cell">
        <div className={`description-container ${!task.isMainTask ? 'sub-task-description' : ''}`}>
          {!task.isMainTask && <span className="sub-task-indicator">↳</span>}
          <input type="text" value={task.description} onChange={e => handleUpdate('description', e.target.value)}
            className={`table-input description-input ${!task.isMainTask ? 'sub-task-input' : ''}`}
            placeholder={task.isMainTask ? 'Assembly Name' : "Part's name"} />
        </div>
      </td>
      <td>
        <input type="number" value={task.hours || 0} onChange={e => handleUpdate('hours', parseFloat(e.target.value) || 0)}
          className="table-input number-input" min="0" step="0.5" />
      </td>
      <td>
        <input type="number" value={task.minutes || 0} onChange={e => handleUpdate('minutes', parseFloat(e.target.value) || 0)}
          className="table-input number-input" min="0" max="59" step={1} />
      </td>
      <td className="calculated-cell time-charge-bg">
        {isEditing ? (
          <input type="number" value={subtotals.basicLabor} onChange={e => handleEditValueChange('basicLabor', e.target.value)}
            onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input" min="0" step="0.01" />
        ) : formatCurrency(subtotals.basicLabor)}
      </td>
      <td>
        <input type="number" value={task.overtimeHours} onChange={e => handleUpdate('overtimeHours', parseFloat(e.target.value) || 0)}
          className="table-input number-input" min="0" step="0.5" />
      </td>
      <td className="calculated-cell overtime-bg">
        {isEditing ? (
          <input type="number" value={subtotals.overtime} onChange={e => handleEditValueChange('overtime', e.target.value)}
            onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input" min="0" step="0.01" />
        ) : formatCurrency(subtotals.overtime)}
      </td>
      <td className="software-cell">
        <div className="software-input-container">
          <input type="number" value={task.softwareUnits || 0} onChange={e => handleUpdate('softwareUnits', parseFloat(e.target.value) || 0)}
            className="table-input number-input software-units-input" min="0" />
          {isEditing ? (
            <input type="number" value={subtotals.software} onChange={e => handleEditValueChange('software', e.target.value)}
              onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input software-edit-input" min="0" step="0.01" />
          ) : (
            <span className="software-total">{formatCurrency(subtotals.software)}</span>
          )}
        </div>
      </td>
      <td className="calculated-cell overhead-bg">
        {isEditing ? (
          <input type="number" value={subtotals.overhead} onChange={e => handleEditValueChange('overhead', e.target.value)}
            onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input" min="0" step="0.01" />
        ) : formatCurrency(subtotals.overhead)}
      </td>
      <td className="type-cell">
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
      </td>
      <td className="total-cell">
        {isEditing ? (
          <input type="number" value={subtotals.total} onChange={e => handleEditValueChange('total', e.target.value)}
            onKeyDown={handleKeyDown} className="table-input number-input edit-calculated-input" min="0" step="0.01" />
        ) : formatCurrency(subtotals.total)}
      </td>
      <td className="action-cell">
        <div className="action-buttons-container">
          <button onClick={handleEditToggle} className={`edit-task-button ${isEditing ? 'editing' : ''}`}
            title={isEditing ? 'Save changes' : 'Edit values'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="edit-icon">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={handleRemove} className="remove-task-button" title="Remove task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="remove-icon">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
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
  onManualOverridesChange?: (overrides: ManualOverrides) => void
  onOpenRateSettings?: () => void
  notify?: (message: string, type?: NotificationType) => void
}

const TasksTable = memo(({
  tasks, baseRates, selectedMainTaskId,
  onTaskUpdate, onTaskAdd, onSubTaskAdd, onTaskRemove, onTaskReorder,
  onMainTaskSelect, onBaseRateUpdate, onManualOverridesChange, onOpenRateSettings, notify
}: TasksTableProps) => {
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editedValues, setEditedValues] = useState<Record<number, Partial<TaskSubtotals>>>({})
  const [modifiedFields, setModifiedFields] = useState<Record<number, Record<string, boolean>>>({})
  const [manualOverrides, setManualOverrides] = useState<ManualOverrides>({})
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null)

  const { taskTotals, grandTotal, mainTaskCount } = useMemo(() => {
    const mainTaskCount = tasks.filter(t => t.isMainTask).length

    const totals: TaskSubtotals[] = tasks.map(task => {
      const totalHours = (task.hours || 0) + (task.minutes || 0) / 60
      const timeChargeRate = task.type === '2D' ? baseRates.timeChargeRate2D
        : task.type === '3D' || !task.type ? baseRates.timeChargeRate3D
        : baseRates.timeChargeRateOthers || 0
      const basicLabor = totalHours * timeChargeRate
      const overtime = task.overtimeHours * baseRates.overtimeRate
      const software = (task.softwareUnits || 0) * baseRates.softwareRate

      let aggBasicLabor = basicLabor, aggOvertime = overtime, aggSoftware = software

      if (task.isMainTask) {
        tasks.filter(t => t.parentId === task.id).forEach(sub => {
          const subHours = (sub.hours || 0) + (sub.minutes || 0) / 60
          const subRate = sub.type === '2D' ? baseRates.timeChargeRate2D
            : sub.type === '3D' || !sub.type ? baseRates.timeChargeRate3D
            : baseRates.timeChargeRateOthers || 0
          aggBasicLabor += subHours * subRate
          aggOvertime += sub.overtimeHours * baseRates.overtimeRate
          aggSoftware += (sub.softwareUnits || 0) * baseRates.softwareRate
        })
      }

      const subtotal = aggBasicLabor + aggOvertime + aggSoftware
      const overhead = subtotal * (baseRates.overheadPercentage / 100)
      let fBasicLabor = task.isMainTask ? aggBasicLabor : basicLabor
      let fOvertime = task.isMainTask ? aggOvertime : overtime
      let fSoftware = task.isMainTask ? aggSoftware : software
      let fOverhead = task.isMainTask ? overhead : (basicLabor + overtime + software) * (baseRates.overheadPercentage / 100)
      let fTotal = task.isMainTask
        ? aggBasicLabor + aggOvertime + aggSoftware + overhead
        : basicLabor + overtime + software + (basicLabor + overtime + software) * (baseRates.overheadPercentage / 100)

      const override = manualOverrides[task.id]
      if (override) {
        fBasicLabor = override.basicLabor !== undefined ? override.basicLabor : fBasicLabor
        fOvertime = override.overtime !== undefined ? override.overtime : fOvertime
        fSoftware = override.software !== undefined ? override.software : fSoftware
        if (override.overhead !== undefined) { fOverhead = override.overhead }
        else if (override.basicLabor !== undefined || override.overtime !== undefined || override.software !== undefined) {
          fOverhead = (fBasicLabor + fOvertime + fSoftware) * (baseRates.overheadPercentage / 100)
        }
        fTotal = override.total !== undefined ? override.total : fBasicLabor + fOvertime + fSoftware + fOverhead
      }

      return { taskId: task.id, basicLabor: fBasicLabor, overtime: fOvertime, software: fSoftware, overhead: fOverhead, total: fTotal }
    })

    const grand = totals.filter((_, i) => tasks[i].isMainTask).reduce((s, t) => s + t.total, 0)
    return { taskTotals: totals, grandTotal: grand, mainTaskCount }
  }, [tasks, baseRates, manualOverrides])

  const handleEditToggle = useCallback((taskId: number) => {
    if (editingTaskId === taskId) {
      const fieldsToSave = modifiedFields[taskId]
      if (fieldsToSave && Object.keys(fieldsToSave).length > 0) {
        const valuesToSave: any = {}
        Object.keys(fieldsToSave).forEach(field => {
          valuesToSave[field] = (editedValues[taskId] as any)?.[field]
        })
        setManualOverrides(prev => ({ ...prev, [taskId]: { ...prev[taskId], ...valuesToSave } }))
      }
      setEditingTaskId(null)
      setEditedValues({})
      setModifiedFields({})
    } else {
      setEditingTaskId(taskId)
      const taskSubtotals = taskTotals.find(t => t.taskId === taskId)
      if (taskSubtotals) {
        setEditedValues({ [taskId]: { basicLabor: taskSubtotals.basicLabor, overtime: taskSubtotals.overtime, software: taskSubtotals.software, overhead: taskSubtotals.overhead, total: taskSubtotals.total } })
      }
    }
  }, [editingTaskId, taskTotals, editedValues, modifiedFields])

  const handleEditValueUpdate = useCallback((taskId: number, field: string, value: number, userModified = false) => {
    setEditedValues(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: value } }))
    if (userModified) {
      setModifiedFields(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: true } }))
      setManualOverrides(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: parseFloat(String(value)) || 0 } }))
    }
  }, [])

  const formatCurrency = useCallback((amount: number) => `¥${amount.toLocaleString()}`, [])

  const getTaskSubtotals = useCallback((taskId: number): TaskSubtotals => {
    const calculated = taskTotals.find(t => t.taskId === taskId) || { taskId, basicLabor: 0, overtime: 0, software: 0, overhead: 0, total: 0 }
    if (editingTaskId === taskId && editedValues[taskId]) {
      return { ...calculated, ...editedValues[taskId] }
    }
    return calculated
  }, [taskTotals, editingTaskId, editedValues])

  const taskIds = useMemo(() => new Set(tasks.map(t => t.id)), [tasks])
  useEffect(() => {
    setManualOverrides(prev => {
      const f: ManualOverrides = {}
      Object.keys(prev).forEach(id => { if (taskIds.has(Number(id))) f[Number(id)] = prev[Number(id)] })
      return f
    })
    setModifiedFields(prev => {
      const f: Record<number, Record<string, boolean>> = {}
      Object.keys(prev).forEach(id => { if (taskIds.has(Number(id))) f[Number(id)] = prev[Number(id)] })
      return f
    })
  }, [taskIds])

  useEffect(() => {
    if (onManualOverridesChange) onManualOverridesChange(manualOverrides)
  }, [manualOverrides, onManualOverridesChange])

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
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <line x1="8" y1="6" x2="16" y2="6"/>
              <line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/>
              <line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>
              <line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>
            </svg>
          </div>
          <h2 className="section-title">Computation Table</h2>
        </div>
        <div className="computation-buttons">
          {/* Rate Settings button — opens BaseRatesPanel */}
          {onOpenRateSettings && (
            <button className="add-button rate-settings-btn" onClick={onOpenRateSettings} title="Configure base rates">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              </svg>
              Rate Settings
            </button>
          )}
          <button className="add-button primary" onClick={onTaskAdd}
            disabled={mainTaskCount >= 27} title={mainTaskCount >= 27 ? 'Maximum 27 assembly tasks reached' : 'Add assembly task'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Assembly
          </button>
          <button className="add-button secondary" onClick={() => onSubTaskAdd(selectedMainTaskId, notify)}
            disabled={!selectedMainTaskId} title={!selectedMainTaskId ? 'Select a main task first' : 'Add sub-task'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
                <th>NO.</th><th>REF NO</th><th>DESCRIPTION</th><th>HOURS</th><th>MINUTES</th>
                <th>TIME CHARGE</th><th>OT RATE</th><th>OVERTIME</th><th>SOFTWARE</th>
                <th>OH</th><th>TYPE</th><th>TOTAL</th><th>ACTION</th>
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
                  />
                )
              })}
              {tasks.length === 0 && (
                <tr className="empty-table-row">
                  <td colSpan={13}>
                    <span className="empty-table-hint">No tasks yet — click Add Assembly to start</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grand-total-section">
        <div className="grand-total-label">Grand Total:</div>
        <div className="grand-total-value">¥{grandTotal.toLocaleString()}</div>
      </div>
    </div>
  )
})

TaskRow.displayName = 'TaskRow'
TasksTable.displayName = 'TasksTable'

export default TasksTable
