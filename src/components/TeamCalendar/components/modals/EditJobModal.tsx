import React, { useState, useEffect } from 'react'
import { useWorkScheduleContext } from '../../context/WorkScheduleContext'
import { scheduleApi } from '../../../../services/api'

export default function EditJobModal() {
  const {
    editingJob,
    setEditingJob,
    loadJobs
  } = useWorkScheduleContext()

  const [jobIdInput, setJobIdInput] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAsap, setIsAsap] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (editingJob) {
      setErrorMsg(null)
      setJobIdInput(editingJob.job_id)
      let dl = editingJob.deadline || ''
      if (dl.startsWith('ASAP')) {
        setIsAsap(true)
        const match = dl.match(/ASAP \((.*)\)/)
        if (match) {
          dl = match[1]
        } else {
          dl = ''
        }
      } else {
        setIsAsap(false)
      }
      
      const parts = dl.split(' - ')
      if (parts.length === 2) {
        setStartDate(parts[0].trim())
        setEndDate(parts[1].trim())
      } else {
        setStartDate(dl.trim())
        setEndDate('')
      }
    }
  }, [editingJob])

  if (!editingJob) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobIdInput.trim()) return

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

    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await scheduleApi.updateJob(editingJob.job_id, {
        job_id: jobIdInput.trim(),
        deadline: combinedDeadline || null
      })
      if (res.success) {
        setEditingJob(null)
        loadJobs(true)
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      setErrorMsg(`Failed to update job: ${errMsg}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="schedule-modal-overlay">
      <form className="schedule-modal-card" onSubmit={handleSubmit} style={{ maxWidth: '600px', width: '90%' }}>
        <h3 className="schedule-modal-title">Edit Job Status</h3>

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

        <div className="schedule-form-group" style={{ marginBottom: '20px' }}>
          <label>Job ID / Code</label>
          <input
            type="text"
            value={jobIdInput}
            onChange={(e) => setJobIdInput(e.target.value)}
            required
            placeholder="Enter job code"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
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

        <div className="schedule-modal-buttons">
          <button
            type="button"
            className="btn-schedule-action"
            onClick={() => { setEditingJob(null); setErrorMsg(null); }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-schedule-action primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
