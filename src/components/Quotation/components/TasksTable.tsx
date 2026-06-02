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
import type { Task, BaseRates, ManualOverrides } from '../../../types/quotation'
import { calculateTaskTotal, calculateOverhead } from '../../../utils/quotation'
import { useCollaborationContext } from '../../../context/CollaborationContext'
import { useAuth } from '../../../context/AuthContext'
import { CollaborativeField } from './CollaborativeField'
import { TaskRow } from './TaskRow'
import type { TaskSubtotals } from './TaskRow'
import { EngineerBookmark } from './EngineerBookmark'

type NotificationType = 'success' | 'error' | 'info' | 'warning'

// ── Props ──────────────────────────────────────────────────────────────────

interface TasksTableProps {
  tasks: Task[]
  baseRates: BaseRates
  selectedMainTaskId: number | null
  onTaskUpdate?: (id: number, fieldOrUpdates: keyof Task | Partial<Task>, value?: any) => void
  onTaskAdd?: () => void
  onSubTaskAdd?: (mainTaskId: number | null, notify?: (msg: string, type?: NotificationType) => void) => void
  onChildTaskAdd?: (parentId: number, level: number) => void
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
  layoutVariant?: 'special' | 'kemco'
}

// ── Component ──────────────────────────────────────────────────────────────

const TasksTable = memo(({
  tasks, baseRates, selectedMainTaskId,
  onTaskUpdate, onTaskAdd, onSubTaskAdd, onTaskRemove, onTaskReorder,
  onMainTaskSelect, onBaseRateUpdate: _onBaseRateUpdate, onOpenRateSettings, notify,
  manualOverrides, setManualOverrides, onFooterUpdate,
  collapsedTasks = new Set(), onCollapsedTasksChange,
  layoutVariant = 'special',
  onChildTaskAdd,
}: TasksTableProps) => {
  const { hasRole } = useAuth()
  const { remoteUsers, emitFocus, emitBlur, myName } = useCollaborationContext()

  // ── Ancestor-chain-aware lock computation ─────────────────────
  // A task is locked if IT or any of its ancestors has an engineer assigned
  // that does not match the current user's identity.
  const lockedTaskIds = useMemo(() => {
    if (hasRole('admin', 'it')) return new Set<number>()

    const byId = new Map(tasks.map(t => [t.id, t]))
    const myWorkstation = myName.trim().toLowerCase()

    const isTaskLocked = (task: Task, visited = new Set<number>()): boolean => {
      if (visited.has(task.id)) return false
      visited.add(task.id)

      const ownerWorkstation = task.engineerWorkstation?.trim().toLowerCase() || ''

      if (ownerWorkstation) {
        // ✅ Workstation-based ownership — matches how bookmark color sync works
        if (ownerWorkstation !== myWorkstation) return true
      } else if (task.engineer?.trim()) {
        // ⚠️ Legacy: no engineerWorkstation recorded yet
        // Fall back to lastEditorName if the engineer field has a value
        const editorWorkstation = task.lastEditorName?.trim().toLowerCase() || ''
        if (editorWorkstation && editorWorkstation !== myWorkstation) return true
      }

      if (task.parentId != null) {
        const parent = byId.get(task.parentId)
        if (parent) return isTaskLocked(parent, visited)
      }
      return false
    }

    const locked = new Set<number>()
    tasks.forEach(t => { if (isTaskLocked(t)) locked.add(t.id) })
    return locked
  }, [tasks, myName, hasRole])

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

  // ── Engineer bookmark row refs & positions ─────────────────────
  const bodyRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  // ── Engineer bookmark row refs & positions ─────────────────────
  const [bookmarkPositions, setBookmarkPositions] = useState<Record<number, { top: number; height: number }>>({})
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())

  const recomputeBookmarks = useCallback(() => {
    const body = bodyRef.current
    if (!body) return
    const bodyRect = body.getBoundingClientRect()
    const next: Record<number, { top: number; height: number }> = {}
    rowRefs.current.forEach((el, taskId) => {
      const rect = el.getBoundingClientRect()
      next[taskId] = {
        top: (rect.top - bodyRect.top) + body.scrollTop,
        height: rect.height,
      }
    })
    setBookmarkPositions(next)
  }, [])

  // Recompute on tasks/collapse change and on scroll
  useEffect(() => {
    recomputeBookmarks()
  }, [tasks, collapsedTasks, recomputeBookmarks])


  const setRowRef = useCallback((taskId: number, el: HTMLTableRowElement | null) => {
    if (el) rowRefs.current.set(taskId, el)
    else rowRefs.current.delete(taskId)
  }, [])

  // ── Collapse / expand ──────────────────────────────────────────
  const toggleCollapse = useCallback((e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    const next = new Set(collapsedTasks)
    if (next.has(taskId)) next.delete(taskId)
    else next.add(taskId)
    onCollapsedTasksChange?.(next)
  }, [collapsedTasks, onCollapsedTasksChange])

  // ── Totals memo ────────────────────────────────────────────────
  const { taskTotals, overheadTotal, subtotal, rawSubtotal, grandTotal, mainTaskCount } = useMemo(() => {
    const mainTaskCount = tasks.filter(t => t.isMainTask).length

    const totals: TaskSubtotals[] = tasks.map(task => {
      const { basicLabor, overtime, software, total } = calculateTaskTotal(task, tasks, baseRates, manualOverrides, layoutVariant)
      return { taskId: task.id, basicLabor, overtime, software, total }
    })

    const rawSub = totals.filter((_, i) => tasks[i].isMainTask).reduce((s, t) => s + t.total, 0)
    const sub = rawSub

    const overhead = manualOverrides.footer?.overhead !== undefined
      ? manualOverrides.footer.overhead
      : calculateOverhead(sub, baseRates.overheadPercentage)

    const grand = sub + overhead + (manualOverrides.footer?.adjustment || 0)

    return { taskTotals: totals, overheadTotal: overhead, subtotal: sub, rawSubtotal: rawSub, grandTotal: grand, mainTaskCount }
  }, [tasks, baseRates, manualOverrides])

  // Reset footer overrides when the underlying sum of tasks changes
  // so that overhead and adjustments auto-recalculate from the new base.
  const prevRawSubtotalRef = useRef<number | null>(null)
  useEffect(() => {
    // Initial mount: capture current raw subtotal
    if (prevRawSubtotalRef.current === null) {
      prevRawSubtotalRef.current = rawSubtotal
      return
    }

    // Only reset if the underlying task values actually changed
    // (e.g. adding/removing tasks or changing task hours/types)
    if (prevRawSubtotalRef.current === rawSubtotal) return
    prevRawSubtotalRef.current = rawSubtotal

    // Clear footer overrides to force re-computation
    setManualOverrides?.(prev => {
      if (Object.keys(prev.footer || {}).length === 0) return prev
      return { ...prev, footer: {} }
    })
  }, [rawSubtotal, setManualOverrides])

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

  const handleEngineerChange = useCallback((taskId: number, value: string) => {
    if (value.trim()) {
      // Claim: store the display label + the workstation name as the owner identity
      // myName is the workstation name from CollaborationContext — same one used for bookmark colors
      onTaskUpdate?.(taskId, {
        engineer: value,
        engineerWorkstation: myName,
      })
    } else {
      // Release: clear both fields to fully relinquish ownership
      onTaskUpdate?.(taskId, { engineer: '', engineerWorkstation: '' })
    }
  }, [onTaskUpdate, myName])

  const handleEditToggle = useCallback((taskId: number) => {
    if (editingTaskId === taskId) {
      const fieldsToSave = modifiedFields[taskId]
      const edited = editedValues[taskId]

      if (fieldsToSave?.total && edited?.total !== undefined) {
        // BACK-CALCULATION LOGIC (Sync Hours/Minutes to Price)
        const task = tasks.find(t => t.id === taskId)
        if (task) {
          const { overtime, software } = calculateTaskTotal(task, tasks, baseRates, manualOverrides, layoutVariant)
          const laborPart = edited.total - overtime - software

          const getRate = (type: string) => {
            if (type === '2D') return baseRates.timeChargeRate2D || baseRates.timeChargeRate3D
            if (type === '3D' || !type) return baseRates.timeChargeRate3D
            return baseRates.timeChargeRateOthers || baseRates.timeChargeRate3D || 0
          }
          const rate = getRate(task.type)

          if (rate > 0 && laborPart > 0) {
            const subTasks = task.isMainTask ? tasks.filter(t => t.parentId === task.id) : []
            const subHours = subTasks.reduce((sum, sub) => sum + (sub.hours || 0) + (sub.minutes || 0) / 60, 0)

            const totalHoursNeeded = laborPart / rate
            const ownHoursNeeded = Math.max(0, totalHoursNeeded - subHours)

            if (!isNaN(ownHoursNeeded) && isFinite(ownHoursNeeded)) {
              const newHours = Math.floor(ownHoursNeeded)
              const newMinutes = parseFloat(((ownHoursNeeded - newHours) * 60).toFixed(2))

              // Update task properties directly
              onTaskUpdate?.(taskId, { hours: newHours, minutes: newMinutes })

              // Explicitly remove total from manualOverrides so the calculated hours take over
              setManualOverrides?.(prev => {
                const newTaskOverrides = { ...(prev.tasks?.[taskId] || {}) }
                delete newTaskOverrides.total
                return {
                  ...prev,
                  tasks: { ...prev.tasks, [taskId]: newTaskOverrides }
                }
              })

              // Remove 'total' from fields to save
              delete fieldsToSave.total
            }
          }
        }
      }

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
  }, [editingTaskId, taskTotals, editedValues, modifiedFields, setManualOverrides, tasks, baseRates, layoutVariant, onTaskUpdate, manualOverrides])

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
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', String(taskId))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, taskId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (taskId === draggedTaskId) return

    const draggedTask = tasks.find(t => Number(t.id) === Number(draggedTaskId))
    const targetTask = tasks.find(t => Number(t.id) === Number(taskId))
    if (!draggedTask || !targetTask) return

    const draggedParentId = draggedTask.parentId ? Number(draggedTask.parentId) : null
    const targetParentId = targetTask.parentId ? Number(targetTask.parentId) : null
    if (draggedParentId !== targetParentId || draggedTask.level !== targetTask.level) return

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

  // ── Helper to sync column widths ─────────────────────────────
  const renderColGroup = () => (
    <colgroup>
      {layoutVariant === 'kemco' ? (
        <>
          <col style={{ width: '4%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '21%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          {/* Amount hidden for KEMCO */}
          <col style={{ width: '0%', display: 'none' }} />
          <col style={{ width: '9%' }} />
        </>
      ) : (
        <>
          <col style={{ width: '4%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
        </>
      )}
    </colgroup>
  )

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="computation-section" ref={sectionRef} style={{ position: 'relative' }}>
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
          {onOpenRateSettings && layoutVariant !== 'kemco' && (
            <button className="add-button rate-settings-btn" onClick={onOpenRateSettings} title="Configure base rates">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
              Rate Settings
            </button>
          )}
          <button
            className={`add-button ${layoutVariant === 'kemco' ? 'primary' : 'primary'}`} onClick={onTaskAdd}
            disabled={mainTaskCount >= 99}
            title={mainTaskCount >= 99 ? 'Maximum tasks reached' : 'Add assembly task'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Assembly
          </button>
          {layoutVariant === 'kemco' ? (
            <div className="kemco-add-buttons-group">
              <button
                className="add-button secondary"
                onClick={() => {
                  if (selectedMainTaskId) {
                    const task = tasks.find(t => t.id === selectedMainTaskId)
                    if (task?.level === 0) {
                      onChildTaskAdd?.(selectedMainTaskId, 1)
                    } else if (notify) {
                      notify('Select an Assembly to add a Unit (Sub-Assembly)', 'warning')
                    }
                  } else if (notify) {
                    notify('Select an Assembly first', 'warning')
                  }
                }}
                disabled={!selectedMainTaskId || tasks.find(t => t.id === selectedMainTaskId)?.level !== 0}
                title="Add Unit to selected Assembly"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Unit
              </button>
              <button
                className="add-button primary"
                onClick={() => {
                  if (selectedMainTaskId) {
                    const task = tasks.find(t => t.id === selectedMainTaskId)
                    if (task?.level === 1) {
                      onChildTaskAdd?.(selectedMainTaskId, 2)
                    } else if (notify) {
                      notify('Select a Unit to add Parts', 'warning')
                    }
                  } else if (notify) {
                    notify('Select a Unit first', 'warning')
                  }
                }}
                disabled={!selectedMainTaskId || tasks.find(t => t.id === selectedMainTaskId)?.level !== 1}
                title="Add Parts to selected Unit"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="add-icon">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Parts
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
      <div className="tasks-table-container">
        <div className="tasks-table-header">
          <table className={`tasks-table tasks-table--${layoutVariant}`}>
            {renderColGroup()}
            <thead>
              <tr>
                {layoutVariant === 'kemco' ? (
                  <>
                    <th style={{ width: '4%' }}>NO.</th>
                    <th style={{ width: '6%' }}>CONST NO</th>
                    <th style={{ width: '6%' }}>MACHINE <br /> CODE</th>
                    <th style={{ width: '6%' }}>UNIT <br /> CODE</th>
                    <th style={{ width: '18%' }}>DWG No.</th>
                    <th style={{ width: '21%' }}>DESCRIPTION</th>
                    <th style={{ width: '9%' }}>START DATE</th>
                    <th style={{ width: '9%' }}>FINISHED</th>
                    <th style={{ width: '7%' }}>TIME</th>
                    <th style={{ width: '7%' }}>TYPE</th>
                    {/* Amount hidden for KEMCO */}
                    <th style={{ width: '7%' }}>ACTION</th>
                  </>
                ) : (
                  <>
                    <th>NO.</th><th>REFERENCE NO</th><th>DESCRIPTION</th><th>HOURS</th><th>MINUTES</th>
                    <th>TIME CHARGE</th><th>OT HOURS</th><th>OVERTIME</th><th>SOFTWARE</th>
                    <th>TYPE</th><th>TOTAL</th><th>ACTION</th>
                  </>
                )}
              </tr>
            </thead>
          </table>
        </div>

        {/* Engineer Bookmark gutter — floats over the right edge of the table content */}
        <div className="tasks-table-body" ref={bodyRef}>
          <table className={`tasks-table tasks-table--${layoutVariant}`}>
            {renderColGroup()}
            <tbody>
              {tasks.map((task, index) => {
                // Check if any ancestor is collapsed
                let currParentId = task.parentId
                while (currParentId) {
                  if (collapsedTasks.has(currParentId)) return null
                  const parent = tasks.find(t => t.id === currParentId)
                  currParentId = parent?.parentId || null
                }

                const rowNumber = task.isMainTask
                  ? tasks.slice(0, index).filter(t => t.isMainTask).length + 1
                  : tasks.slice(0, index).filter(t => t.parentId === task.parentId).length + 1

                const hasSubTasks = tasks.some(t => t.parentId === task.id)

                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    subtotals={getTaskSubtotals(task.id)}
                    onUpdate={onTaskUpdate}
                    onRemove={onTaskRemove}
                    formatCurrency={formatCurrency}
                    isSelected={layoutVariant === 'kemco' ? (task.id === selectedMainTaskId) : (task.isMainTask && task.id === selectedMainTaskId)}
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
                    layoutVariant={layoutVariant}
                    trRef={(el: HTMLTableRowElement | null) => setRowRef(task.id, el)}
                    isRowLocked={lockedTaskIds.has(task.id)}
                  />
                )
              })}
              {tasks.length === 0 && (
                <tr className="empty-table-row">
                  <td colSpan={layoutVariant === 'kemco' ? 11 : 12}>
                    <span className="empty-table-hint">No tasks yet — click Add Assembly to start</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Engineer Bookmark gutter — now inside the scrollable body to handle clipping automatically */}
          <div
            className="eng-bookmark-gutter"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 52,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            {tasks.map(task => {
              const pos = bookmarkPositions[task.id]
              if (!pos) return null
              return (
                <EngineerBookmark
                  key={task.id}
                  taskId={task.id}
                  engineer={task.engineer}
                  top={pos.top}
                  height={pos.height}
                  lastEditorName={task.lastEditorName}
                  lastEditorColor={task.lastEditorColor}
                  onChange={handleEngineerChange}
                  isLocked={lockedTaskIds.has(task.id)}
                />
              )
            })}
          </div>
        </div>

      </div>


      {/* ── Footer: Totals (Hidden for KEMCO) ─────────────────────── */}
      {layoutVariant !== 'kemco' && (
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
                      type="text"
                      inputMode="decimal"
                      value={overheadDraft}
                      onChange={e => setOverheadDraft(e.target.value)}
                      onBlur={e => handleOverheadBlur(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleOverheadBlur((e.target as HTMLInputElement).value)
                        if (e.key === 'Escape') setEditingOverhead(false)
                      }}
                      className="footer-input amount-input" autoFocus
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
                      type="text"
                      inputMode="decimal"
                      value={grandTotalDraft}
                      onChange={e => setGrandTotalDraft(e.target.value)}
                      onBlur={e => handleGrandTotalBlur(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleGrandTotalBlur((e.target as HTMLInputElement).value)
                        if (e.key === 'Escape') setEditingGrandTotal(false)
                      }}
                      className="footer-input amount-input total-input" autoFocus
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
      )}
    </div>
  )
})

TasksTable.displayName = 'TasksTable'

export default TasksTable
