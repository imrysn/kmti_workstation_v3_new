import { useState, useMemo, useEffect } from 'react'
import type { Task, BaseRates, ManualOverrides } from '../../hooks/quotation'
import { calculateTaskTotal as calculateTaskSubtotal, calculateOverhead } from '../../utils/quotation'

interface Props {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  baseRates: BaseRates
  manualOverrides: ManualOverrides
  onApplyChanges: (editedTasks: Partial<Task>[], editedOverrides: ManualOverrides) => void
}

interface EditedTask {
  id: number
  referenceNumber: string
  description: string
  type: string
  hours: number
  minutes: number
  overtimeHours: number
  softwareUnits: number
}

const QuickEditModal = ({
  isOpen, onClose, tasks, baseRates, manualOverrides, onApplyChanges
}: Props) => {
  const [editedTasks, setEditedTasks] = useState<EditedTask[]>([])
  const [editedOverrides, setEditedOverrides] = useState<ManualOverrides>({})
  const [unitPageOverrides, setUnitPageOverrides] = useState<Record<number, number>>({})


  // Initialize / sync state when the modal opens
  useEffect(() => {
    if (isOpen) {
      const mainTasks = tasks.filter(t => t.isMainTask)
      setEditedTasks(mainTasks.map(task => ({
        id: task.id,
        referenceNumber: task.referenceNumber || '',
        description: task.description || '',
        type: task.type || '3D',
        hours: task.hours || 0,
        minutes: task.minutes || 0,
        overtimeHours: task.overtimeHours || 0,
        softwareUnits: task.softwareUnits || 0,
      })))
      setEditedOverrides({ ...manualOverrides })
      setUnitPageOverrides({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const calculateTaskTotal = (task: EditedTask): number => {
    // Map EditedTask back to a format compatible with the utility
    const taskAsTask: Task = {
      ...tasks.find(t => t.id === task.id)!,
      ...task
    }
    return calculateTaskSubtotal(taskAsTask, tasks, baseRates, editedOverrides).total
  }

  const { overhead, grandTotal } = useMemo(() => {
    const sub = editedTasks.reduce((s, t) => s + calculateTaskTotal(t), 0)
    const over = calculateOverhead(sub, baseRates.overheadPercentage)
    return { overhead: over, grandTotal: sub + over }
  }, [editedTasks, editedOverrides, baseRates])

  const updateTask = (taskId: number, field: keyof EditedTask, value: any) => {
    setEditedTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: value } : t))
  }

  const updatePrice = (taskId: number, newPrice: string) => {
    const numPrice = parseFloat(newPrice) || 0
    setEditedOverrides(prev => ({ ...prev, [taskId]: { ...prev[taskId], total: numPrice } }))
  }

  const getUnitPageCount = (taskId: number): number => {
    if (unitPageOverrides[taskId] !== undefined) return unitPageOverrides[taskId]
    const subTaskCount = tasks.filter(t => t.parentId === taskId).length
    return 1 + subTaskCount
  }

  const updateUnitPage = (taskId: number, newCount: string) => {
    setUnitPageOverrides(prev => ({ ...prev, [taskId]: parseInt(newCount) || 1 }))
  }

  const handleApply = () => {
    const combinedOverrides: ManualOverrides = { ...editedOverrides }
    Object.keys(unitPageOverrides).forEach(id => {
      const taskId = Number(id)
      combinedOverrides[taskId] = { ...combinedOverrides[taskId], unitPage: unitPageOverrides[taskId] }
    })
    onApplyChanges(editedTasks, combinedOverrides)
    onClose()
  }

  const handleReset = () => {
    const mainTasks = tasks.filter(t => t.isMainTask)
    setEditedTasks(mainTasks.map(task => ({
      id: task.id, referenceNumber: task.referenceNumber || '',
      description: task.description || '', type: task.type || '3D',
      hours: task.hours || 0, minutes: task.minutes || 0,
      overtimeHours: task.overtimeHours || 0, softwareUnits: task.softwareUnits || 0,
    })))
    setEditedOverrides({ ...manualOverrides })
    setUnitPageOverrides({})
  }

  const formatCurrency = (amount: number) => `¥${amount.toLocaleString()}`

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="quick-edit-modal">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-title">
            {/* RefreshCw icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="title-icon">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <h2>Quick Edit Quotation Values</h2>
          </div>
          <div className="modal-header-actions">
            <button onClick={handleReset} className="action-button secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Reset
            </button>
            <button onClick={handleApply} className="action-button primary">
              {/* Save icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
              </svg>
              Apply Changes
            </button>
            <button onClick={onClose} className="close-button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="edit-instructions">
            <p>Edit the values below. Changes will update the quotation preview and PDF export.</p>
          </div>
          <div className="edit-table-container">
            <table className="edit-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>NO.</th>
                  <th style={{ width: '15%' }}>Reference No.</th>
                  <th style={{ width: '30%' }}>Description</th>
                  <th style={{ width: '10%' }}>Unit Page</th>
                  <th style={{ width: '10%' }}>Type</th>
                  <th style={{ width: '15%' }}>Price</th>
                  <th style={{ width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {editedTasks.map((task, index) => {
                  const currentPrice = calculateTaskTotal(task)
                  const unitPageCount = getUnitPageCount(task.id)
                  const isUnitPageOverridden = unitPageOverrides[task.id] !== undefined
                  return (
                    <tr key={task.id}>
                      <td className="center">{index + 1}</td>
                      <td>
                        <input type="text" value={task.referenceNumber}
                          onChange={e => updateTask(task.id, 'referenceNumber', e.target.value)}
                          className="edit-input" />
                      </td>
                      <td>
                        <input type="text" value={task.description}
                          onChange={e => updateTask(task.id, 'description', e.target.value)}
                          className="edit-input" />
                      </td>
                      <td>
                        <input type="number" value={unitPageCount || ''}
                          onChange={e => updateUnitPage(task.id, e.target.value)}
                          className="edit-input" min="1"
                          style={{ backgroundColor: isUnitPageOverridden ? '#fff3cd' : 'white', textAlign: 'center' }} />
                      </td>
                      <td className="center">
                        <select value={task.type} onChange={e => updateTask(task.id, 'type', e.target.value)} className="edit-select">
                          <option value="2D">2D</option>
                          <option value="3D">3D</option>
                        </select>
                      </td>
                      <td>
                        <input type="number" value={currentPrice || ''}
                          onChange={e => updatePrice(task.id, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') updatePrice(task.id, (e.target as HTMLInputElement).value) }}
                          className="edit-input price-input" step={1000} />
                      </td>
                      <td className="center">
                        <button
                          onClick={() => {
                            setEditedOverrides(prev => { const n = { ...prev }; delete (n as any)[task.id]; return n })
                            setUnitPageOverrides(prev => { const n = { ...prev }; delete n[task.id]; return n })
                          }}
                          className="reset-price-btn" title="Reset to calculated values">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}

                {baseRates.overheadPercentage > 0 && (
                  <tr className="summary-row">
                    <td></td>
                    <td colSpan={4} className="summary-label">Administrative Overhead ({baseRates.overheadPercentage}%)</td>
                    <td className="summary-value">{formatCurrency(overhead)}</td>
                    <td></td>
                  </tr>
                )}
                <tr className="total-row">
                  <td></td>
                  <td colSpan={4} className="total-label">TOTAL AMOUNT</td>
                  <td className="total-value">{formatCurrency(grandTotal)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickEditModal
