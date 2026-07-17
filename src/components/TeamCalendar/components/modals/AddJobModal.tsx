import { useState } from 'react'
import { useWorkScheduleContext, formatPercentInput } from '../../context/WorkScheduleContext'
import { scheduleApi } from '../../../../services/api'

interface ITempComponent {
  unit_code: string
  assembly_3d: string
  parts_3d: string
  assembly_2d: string
  parts_2d: string
  status: string
  submitted_date: string | null
}

const createDefaultRow = (): ITempComponent => ({
  unit_code: '',
  assembly_3d: '-',
  parts_3d: '-',
  assembly_2d: '-',
  parts_2d: '-',
  status: 'Pending/Not Started',
  submitted_date: null
})

export default function AddJobModal() {
  const {
    isAddingJob,
    setIsAddingJob,
    loadJobs
  } = useWorkScheduleContext()

  const [newJobId, setNewJobId] = useState('')

  const [componentsList, setComponentsList] = useState<ITempComponent[]>([
    createDefaultRow()
  ])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAsap, setIsAsap] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isAddingJob) return null

  const handleAddRow = (e: React.MouseEvent) => {
    e.preventDefault()
    setComponentsList(prev => [...prev, createDefaultRow()])
  }

  const handleRemoveRow = (e: React.MouseEvent, index: number) => {
    e.preventDefault()
    setComponentsList(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleInputChange = (index: number, field: keyof ITempComponent, value: string | null) => {
    setComponentsList(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value
      } as ITempComponent
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newJobId.trim()) return

    // Filter out rows that are entirely blank or have no unit code, and format percentage inputs to decimals
    const validComponents = componentsList
      .filter(comp => comp.unit_code.trim() !== '')
      .map(comp => ({
        ...comp,
        assembly_3d: formatPercentInput(comp.assembly_3d),
        parts_3d: formatPercentInput(comp.parts_3d),
        assembly_2d: formatPercentInput(comp.assembly_2d),
        parts_2d: formatPercentInput(comp.parts_2d)
      }))

    let datePart = ''
    if (startDate && endDate) {
      datePart = `${startDate} - ${endDate}`
    } else if (startDate) {
      datePart = startDate
    } else if (endDate) {
      datePart = endDate
    }

    let combinedDeadline = ''
    if (isAsap) {
      combinedDeadline = datePart ? `ASAP (${datePart})` : 'ASAP'
    } else {
      combinedDeadline = datePart
    }

    setErrorMsg(null)
    setIsSubmitting(true)
    try {
      // 1. Create the job group
      const res = await scheduleApi.createJob(newJobId, combinedDeadline || null)
      if (res.success) {
        // 2. Create all components in the list
        for (const comp of validComponents) {
          await scheduleApi.createComponent(newJobId, comp)
        }
        // 3. Reset and close
        setIsAddingJob(false)
        setNewJobId('')
        setStartDate('')
        setEndDate('')
        setIsAsap(false)
        setComponentsList([createDefaultRow()])
        setErrorMsg(null)
        loadJobs(true)
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      setErrorMsg(`Failed to create, ${errMsg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="schedule-modal-overlay">
      <form className="schedule-modal-card" onSubmit={handleSubmit} style={{ maxWidth: '1050px', width: '95%' }}>
        <h3 className="schedule-modal-title">Create New Job Group</h3>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div className="schedule-form-group">
            <label>Job ID / Code (e.g. 2809)</label>
            <input
              type="text"
              value={newJobId}
              onChange={(e) => setNewJobId(e.target.value)}
              placeholder="Enter unique job code"
              required
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="schedule-form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="schedule-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Deadline (End Date)</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold', color: '#ef4444' }}>
                  <input
                    type="checkbox"
                    checked={isAsap}
                    onChange={(e) => setIsAsap(e.target.checked)}
                    style={{ accentColor: '#ef4444' }}
                  />
                  ASAP
                </label>
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid var(--border-subtle)', margin: '20px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 className="schedule-modal-title" style={{ fontSize: '15px', margin: 0 }}>
            Add Row
          </h4>
          <button
            type="button"
            className="btn-schedule-action primary"
            style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px' }}
            onClick={handleAddRow}
          >
            + Add Row
          </button>
        </div>

        {/* Spreadsheet Table layout */}
        <div className="components-table-container custom-scrollbar" style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '20px' }}>
          <table className="components-table" style={{ fontSize: '12px', margin: 0, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap', width: '22%' }}>Machine/Unit Code</th>
                <th style={{ whiteSpace: 'nowrap' }}>3D Assembly</th>
                <th style={{ whiteSpace: 'nowrap' }}>3D Parts</th>
                <th style={{ whiteSpace: 'nowrap' }}>2D Assembly</th>
                <th style={{ whiteSpace: 'nowrap' }}>2D Parts</th>
                <th style={{ whiteSpace: 'nowrap', width: '18%' }}>Status</th>
                <th style={{ whiteSpace: 'nowrap' }}>Submitted Date</th>
                <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {componentsList.map((comp, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={comp.unit_code}
                      onChange={(e) => handleInputChange(idx, 'unit_code', e.target.value)}
                      placeholder="e.g. DFMU"
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={comp.assembly_3d}
                      onChange={(e) => handleInputChange(idx, 'assembly_3d', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={comp.parts_3d}
                      onChange={(e) => handleInputChange(idx, 'parts_3d', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={comp.assembly_2d}
                      onChange={(e) => handleInputChange(idx, 'assembly_2d', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="text"
                      value={comp.parts_2d}
                      onChange={(e) => handleInputChange(idx, 'parts_2d', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '4px' }}>
                    <select
                      value={comp.status}
                      onChange={(e) => handleInputChange(idx, 'status', e.target.value)}
                      style={{ width: '100%', padding: '5px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    >
                      <option value="Pending/Not Started">Pending/Not Started</option>
                      <option value="Completed">Completed</option>
                      <option value="For Checking">For Checking</option>
                      <option value="Excluded/NA">Excluded/NA</option>
                    </select>
                  </td>
                  <td style={{ padding: '4px' }}>
                    <input
                      type="date"
                      value={comp.submitted_date || ''}
                      onChange={(e) => handleInputChange(idx, 'submitted_date', e.target.value || null)}
                      style={{ width: '100%', padding: '5px 8px', fontSize: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </td>
                  <td style={{ padding: '4px', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-schedule-action danger"
                      style={{ padding: '6px', fontSize: '11px', width: '100%', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}
                      disabled={componentsList.length <= 1}
                      onClick={(e) => handleRemoveRow(e, idx)}
                      title="Remove row"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="schedule-modal-buttons">
          <button
            type="button"
            className="btn-schedule-action"
            onClick={() => { setIsAddingJob(false); setErrorMsg(null); }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-schedule-action primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
