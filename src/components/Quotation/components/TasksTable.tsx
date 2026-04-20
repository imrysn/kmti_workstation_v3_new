/**
 * TasksTable.tsx
 * ─────────────────────────────────────────────────────────────────
 * Computation Table — renders all assembly tasks, manages manual
 * value overrides, drag-to-reorder, collapse/expand, and the
 * grand total / overhead footer.
 *
 * TaskRow has been extracted to ./TaskRow.tsx for maintainability.
 */

import { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react'
import type { Task, BaseRates, ManualOverrides } from '../../../hooks/quotation'
import { calculateTaskTotal, calculateOverhead } from '../../../utils/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { CollaborativeField } from './CollaborativeField'
import { TaskRow } from './TaskRow'
import type { TaskSubtotals } from './TaskRow'

type NotificationType = 'success' | 'error' | 'info' | 'warning'

// ── Props ──────────────────────────────────────────────────────────────────

interface TasksTableProps {
  tasks: Task[]
  baseRates: BaseRates
  selectedMainTaskId: number | null
  onTaskUpdate?: (id: number, field: keyof Task, value: any) => void
  onTaskAdd?: () => void
  onSubTaskAdd?: (mainTaskId: number | null, notify?: (msg: string, type?: NotificationType) => void) => void
  onTaskRemove?: (id: number) => void
  onTaskReorder?: (draggedId: number, targetId: number) => void
  onMainTaskSelect?: (id: number) => void
  onBaseRateUpdate?: (field: keyof BaseRates, value: number) => void
  onOpenRateSettings?: () => void
  notify?: (message: string, type?: NotificationType) => void
  manualOverrides: ManualOverrides
  setManualOverrides?: (updater: (prev: ManualOverrides) => ManualOverrides) => void
  onFooterUpdate?: (key: string, value: any) => void
  collapsedTasks?: Set<number>
  onCollapsedTasksChange?: (collapsed: Set<number>) => void
}

// ── Component ──────────────────────────────────────────────────────────────

const TasksTable = memo(({
  tasks, baseRates, selectedMainTaskId,
  onTaskUpdate, onTaskAdd, onSubTaskAdd, onTaskRemove, onTaskReorder,
  onMainTaskSelect, onBaseRateUpdate: _onBaseRateUpdate, onOpenRateSettings, notify,
  manualOverrides, setManualOverrides, onFooterUpdate,
  collapsedTasks = new Set(), onCollapsedTasksChange,
}: TasksTableProps) => {
  const { remoteUsers, emitFocus, emitBlur } = useCollaborationContext()

  // ── Local UI state ─────────────────────────────────────────────
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editedValues, setEditedValues] = useState<Record<number, Partial<TaskSubtotals>>>({})
  const [modifiedFields, setModifiedFields] = useState<Record<number, Record<string, boolean>>>({})
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<number | null>(null)
  const [editingOverhead, setEditingOverhead] = useState(false)
  const [editingGrandTotal, setEditingGrandTotal] = useState(false)
  const [overheadDraft, setOverheadDraft] = useState<string>('')
  const [grandTotalDraft, setGrandTotalDraft] = useState<string>('')

  // ── Collapse / expand ──────────────────────────────────────────
  const toggleCollapse = useCallback((e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    const next = new Set(collapsedTasks)
    if (next.has(taskId)) next.delete(taskId)
    else next.add(taskId)
    onCollapsedTasksChange?.(next)
  }, [collapsedTasks, onCollapsedTasksChange])

  // ── Totals memo ────────────────────────────────────────────────
  const { taskTotals, overheadTotal, subtotal, grandTotal, mainTaskCount } = useMemo(() => {
    const mainTaskCount = tasks.filter(t => t.isMainTask).length

    const totals: TaskSubtotals[] = tasks.map(task => {
      const { basicLabor, overtime, software, total } = calculateTaskTotal(task, tasks, baseRates, manualOverrides)
      return { taskId: task.id, basicLabor, overtime, software, total }
    })

    const sub = totals.filter((_, i) => tasks[i].isMainTask).reduce((s, t) => s + t.total, 0)
    const footer = manualOverrides?.footer || {}

    const overhead = footer.overhead !== undefined
      ? footer.overhead
      : calculateOverhead(sub, baseRates.overheadPercentage)

    const grand = sub + overhead + (footer.adjustment || 0)

    return { taskTotals: totals, overheadTotal: overhead, subtotal: sub, grandTotal: grand, mainTaskCount }
  }, [tasks, baseRates, manualOverrides])

  // Reset footer overrides when the subtotal changes so overhead auto-recalculates
  const prevSubtotalRef = useRef<number | null>(null)
  useEffect(() => {
    if (prevSubtotalRef.current === null) { prevSubtotalRef.current = subtotal; return }
    if (prevSubtotalRef.current === subtotal) return
    prevSubtotalRef.current = subtotal
    setManualOverrides?.(prev => {
      if (!prev.footer.overhead && !prev.footer.adjustment) return prev
      return { ...prev, footer: {} }
    })
  }, [subtotal, setManualOverrides])

  // ── Footer helpers ─────────────────────────────────────────────
  const formatValue = (val: number): string => {
    if (val === 0) return ''
    const str = val.toFixed(2)
    return str.endsWith('.00') ? Math.round(val).toString() : str
  }

  const handleOverheadBlur = useCallback((draft: string) => {
    if (draft.trim() === '') {
      onFooterUpdate?.('overhead', undefined)
    } else {
      const val = parseFloat(draft)
      if (!isNaN(val) && val >= 0) onFooterUpdate?.('overhead', val)
    }
    setEditingOverhead(false)
  }, [onFooterUpdate])

  const handleGrandTotalBlur = useCallback((draft: string) => {
    if (draft.trim() === '') {
      onFooterUpdate?.('adjustment', undefined)
    } else {
      const val = parseFloat(draft)
      if (!isNaN(val) && val >= 0) {
        onFooterUpdate?.('adjustment', val - (subtotal + overheadTotal))
      }
    }
    setEditingGrandTotal(false)
  }, [onFooterUpdate, subtotal, overheadTotal])

  // ── Manual override editing ────────────────────────────────────
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
        setManualOverrides?.(prev => ({
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
        setEditedValues({ [taskId]: { ...taskSubtotal } })
      }
    }
  }, [editingTaskId, taskTotals, editedValues, modifiedFields, setManualOverrides])

  const handleEditValueUpdate = useCallback((taskId: number, field: string, value: number, userModified = false) => {
    setEditedValues(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: value } }))
    if (userModified) {
      setModifiedFields(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: true } }))
    }
  }, [])

  const formatCurrency = useCallback((amount: number) => `¥${amount.toLocaleString()}`, [])

  const getTaskSubtotals = useCallback((taskId: number): TaskSubtotals => {
    const calculated = taskTotals.find(t => t.taskId === taskId)
      || { taskId, basicLabor: 0, overtime: 0, software: 0, total: 0 }
    if (editingTaskId === taskId && editedValues[taskId]) {
      return { ...calculated, ...editedValues[taskId] }
    }
    return calculated
  }, [taskTotals, editingTaskId, editedValues])

  // Prune stale manual overrides when tasks are removed
  const taskIds = useMemo(() => new Set(tasks.map(t => t.id)), [tasks])
  useEffect(() => {
    const staleIds = Object.keys(manualOverrides?.tasks || {}).map(Number).filter(id => !taskIds.has(id))
    if (staleIds.length === 0) return
    setManualOverrides?.(prev => {
      const next = { ...prev.tasks }
      staleIds.forEach(id => delete next[id])
      return { ...prev, tasks: next }
    })
    setModifiedFields(prev => {
      const next = { ...prev }
      staleIds.forEach(id => delete next[id])
      return next
    })
  }, [taskIds, manualOverrides?.tasks, setManualOverrides])

  // ── Drag handlers ──────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, taskId: number) => {
    if (!tasks.find(t => t.id === taskId)?.isMainTask) return
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
    onTaskReorder?.(draggedTaskId, targetTaskId)
    setDraggedTaskId(null); setDragOverTaskId(null)
  }, [draggedTaskId, onTaskReorder])

  const handleDragEnd = useCallback(() => { setDraggedTaskId(null); setDragOverTaskId(null) }, [])

  // ── Render ─────────────────────────────────────────────────────
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
          <button
            className="add-button primary" onClick={onTaskAdd}
            disabled={mainTaskCount >= 99}
            title={mainTaskCount >= 99 ? 'Maximum tasks reached' : 'Add assembly task'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Assembly
          </button>
          <button
            className="add-button secondary"
            onClick={() => onSubTaskAdd?.(selectedMainTaskId, notify)}
            disabled={!selectedMainTaskId}
            title={!selectedMainTaskId ? 'Select a main task first' : 'Add sub-task'}
          >
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
                if (!task.isMainTask && collapsedTasks.has(task.parentId!)) return null

                const rowNumber = task.isMainTask
                  ? tasks.slice(0, index).filter(t => t.isMainTask).length + 1
                  : tasks.slice(0, index).filter(t => t.parentId === task.parentId).length + 1

                const hasSubTasks = task.isMainTask && tasks.some(t => t.parentId === task.id)

                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    subtotals={getTaskSubtotals(task.id)}
                    onUpdate={onTaskUpdate}
                    onRemove={onTaskRemove}
                    formatCurrency={formatCurrency}
                    isSelected={task.isMainTask && task.id === selectedMainTaskId}
                    onMainTaskSelect={onMainTaskSelect}
                    rowNumber={rowNumber}
                    isEditing={editingTaskId === task.id}
                    onEditToggle={handleEditToggle}
                    onEditValueUpdate={handleEditValueUpdate}
                    isDragging={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    hasSubTasks={hasSubTasks}
                    isCollapsed={collapsedTasks.has(task.id)}
                    onToggleCollapse={toggleCollapse}
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

      {/* ── Footer: Totals ───────────────────────────────────────── */}
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
                    type="number" value={overheadDraft}
                    onChange={e => setOverheadDraft(e.target.value)}
                    onBlur={e => handleOverheadBlur(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleOverheadBlur((e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setEditingOverhead(false)
                    }}
                    className="footer-input amount-input" step="0.01" min="0" autoFocus
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
                    type="number" value={grandTotalDraft}
                    onChange={e => setGrandTotalDraft(e.target.value)}
                    onBlur={e => handleGrandTotalBlur(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleGrandTotalBlur((e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setEditingGrandTotal(false)
                    }}
                    className="footer-input amount-input total-input" step="0.01" min="0" autoFocus
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

TasksTable.displayName = 'TasksTable'

export default TasksTable
