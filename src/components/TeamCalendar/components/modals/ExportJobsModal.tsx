import { useState, useEffect, useMemo } from 'react'
import { useWorkScheduleContext } from '../../context/WorkScheduleContext'

export default function ExportJobsModal() {
  const {
    isExportModalOpen,
    setIsExportModalOpen,
    jobs,
    handleExport,
    isExporting
  } = useWorkScheduleContext()

  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => b.job_id.localeCompare(a.job_id))
  }, [jobs])

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [fromMonth, setFromMonth] = useState('0')
  const [toMonth, setToMonth] = useState('0')

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ]

  // Parse a deadline into a Date object or null
  const parseDeadline = (deadline: string | null): Date | null => {
    if (!deadline) return null
    let str = deadline
    if (str.startsWith('ASAP')) {
      str = str.replace('ASAP', '').trim()
      if (str.startsWith('-')) str = str.substring(1).trim()
    }
    if (!str) return null
    const ymdMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (ymdMatch) return new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]))
    const mdMatch = str.match(/(\d{1,2})\/(\d{1,2})/)
    if (mdMatch) return new Date(new Date().getFullYear(), parseInt(mdMatch[1]) - 1, parseInt(mdMatch[2]))
    return null
  }

  // When the modal opens, select all by default
  useEffect(() => {
    if (isExportModalOpen) {
      setSelectedJobIds(new Set(jobs.map(j => j.job_id)))
      setFromMonth('0')
      setToMonth('0')
    }
  }, [isExportModalOpen, jobs])

  // Handle month filter changes
  useEffect(() => {
    if (!isExportModalOpen || fromMonth === '0' || toMonth === '0') return
    const fMonth = parseInt(fromMonth)
    const tMonth = parseInt(toMonth)
    
    const newSelected = new Set<string>()
    jobs.forEach(j => {
      const d = parseDeadline(j.deadline)
      if (d) {
        // month is 0-indexed in JS date
        const m = d.getMonth() + 1
        if (m >= fMonth && m <= tMonth) {
          newSelected.add(j.job_id)
        }
      }
    })
    setSelectedJobIds(newSelected)
  }, [fromMonth, toMonth, isExportModalOpen, jobs])

  if (!isExportModalOpen) return null

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(new Set(jobs.map(j => j.job_id)))
    } else {
      setSelectedJobIds(new Set())
    }
  }

  const handleToggleJob = (jobId: string, checked: boolean) => {
    const next = new Set(selectedJobIds)
    if (checked) next.add(jobId)
    else next.delete(jobId)
    setSelectedJobIds(next)
  }

  const onSubmit = () => {
    const selectedMonthsList: string[] = []
    if (fromMonth !== '0' && toMonth !== '0') {
      const f = parseInt(fromMonth)
      const t = parseInt(toMonth)
      for (let i = f; i <= t; i++) {
        selectedMonthsList.push(months[i - 1].label)
      }
    }
    handleExport(Array.from(selectedJobIds), selectedMonthsList)
  }

  // Clean up deadline string if it already contains 'Deadline:'
  const cleanDeadline = (dl: string | null) => {
    if (!dl) return 'Not Specified'
    return dl.replace(/^Deadline:\s*/i, '')
  }

  return (
    <>
      {isExporting && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'color-mix(in srgb, var(--bg-secondary) 70%, transparent)',
            backdropFilter: 'blur(24px) saturate(150%)',
            WebkitBackdropFilter: 'blur(24px) saturate(150%)',
            border: '1px solid var(--border)',
            borderTop: '1px solid color-mix(in srgb, var(--text-primary) 15%, transparent)',
            borderLeft: '1px solid color-mix(in srgb, var(--text-primary) 15%, transparent)',
            borderRadius: '20px',
            padding: '40px 60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '25px' }}>
              <div className="sys-icon" style={{ padding: '14px', background: 'var(--bg-primary)', borderRadius: '12px', color: '#3b82f6', border: '1px solid var(--border)' }}>
                <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                  <line x1="6" y1="6" x2="6.01" y2="6" strokeWidth="3"></line>
                  <line x1="6" y1="18" x2="6.01" y2="18" strokeWidth="3"></line>
                </svg>
              </div>

              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <div className="flow-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }}></div>
                <div className="flow-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', animationDelay: '0.2s' }}></div>
                <div className="flow-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', animationDelay: '0.4s' }}></div>
                
                <div style={{ position: 'absolute', top: '50%', left: '-15px', right: '-15px', height: '1px', background: 'var(--border)', transform: 'translateY(-50%)', zIndex: -1 }}></div>
              </div>

              <div className="xls-icon" style={{ padding: '14px', background: 'var(--bg-primary)', borderRadius: '12px', color: '#10b981', border: '1px solid var(--border)' }}>
                <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <rect x="8" y="12" width="8" height="6" rx="1"></rect>
                  <path d="M10 13.5l4 3"></path>
                  <path d="M14 13.5l-4 3"></path>
                </svg>
              </div>
            </div>

            <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Building Excel File...
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Processing schedule and formatting columns</p>
          </div>
          <style>{`
            @keyframes pulse-blue {
              0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3); transform: scale(1); }
              70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); transform: scale(1.02); }
              100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); transform: scale(1); }
            }
            @keyframes pulse-green {
              0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3); transform: scale(1); }
              70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); transform: scale(1.02); }
              100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); transform: scale(1); }
            }
            @keyframes flow-dots {
              0% { opacity: 0; transform: translateX(-10px) scale(0.8); }
              50% { opacity: 1; transform: translateX(0px) scale(1); }
              100% { opacity: 0; transform: translateX(10px) scale(0.8); }
            }
            .sys-icon { animation: pulse-blue 2.5s infinite ease-in-out; }
            .xls-icon { animation: pulse-green 2.5s infinite ease-in-out; animation-delay: 1.25s; }
            .flow-dot { animation: flow-dots 1s infinite linear; }
          `}</style>
        </div>
      )}
      <div className="schedule-modal-overlay">
      <div className="schedule-modal-card" style={{ maxWidth: '600px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <h3 className="schedule-modal-title">Export Schedule to Excel</h3>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
          
          {/* Month Range Filter */}
          <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Filter by Month</h4>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <select
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px' }}
              >
                <option value="0">-- Select From Month --</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <span>to</span>
              <select
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px' }}
              >
                <option value="0">-- Select To Month --</option>
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              Selecting a month range will automatically check jobs due in those months, and will filter the exported Gantt chart timeline columns.
            </p>
          </div>

          {/* Job Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '14px' }}>Select Jobs to Export</h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={selectedJobIds.size === jobs.length && jobs.length > 0} 
                  onChange={(e) => handleToggleAll(e.target.checked)} 
                />
                Select All
              </label>
            </div>
            
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {jobs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No jobs available.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {sortedJobs.map(j => (
                    <label key={j.job_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedJobIds.has(j.job_id)}
                        onChange={(e) => handleToggleJob(j.job_id, e.target.checked)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{j.job_id}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Deadline: {cleanDeadline(j.deadline)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="schedule-modal-buttons">
          <button className="btn-schedule-action" onClick={() => setIsExportModalOpen(false)}>
            Cancel
          </button>
          <button 
            className="btn-schedule-action primary" 
            onClick={onSubmit}
            disabled={isExporting || selectedJobIds.size === 0}
            style={{ minWidth: '120px', justifyContent: 'center' }}
          >
            {isExporting ? 'Exporting...' : `Export (${selectedJobIds.size}) Jobs`}
          </button>
        </div>
      </div>
      </div>
    </>
  )
}
