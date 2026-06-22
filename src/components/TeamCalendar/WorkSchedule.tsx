import React, { useState, useEffect, useRef } from 'react'
import { scheduleApi } from '../../services/api'
import './WorkSchedule.css'

interface IJob {
  id: number
  job_id: string
  deadline: string
  total_components: number
  completed_components: number
  checking_components: number
  progress_percent: number
}

interface IComponent {
  id: number
  job_id: string
  unit_code: string
  assembly_3d: string
  parts_3d: string
  assembly_2d: string
  parts_2d: string
  status: string
  submitted_date: string | null
}

interface ITimelineDay {
  col_index: number
  month: string
  day: number
  weekday: string
  assignments: Record<string, string>
}

export default function WorkSchedule() {
  const [jobs, setJobs] = useState<IJob[]>([])
  const [components, setComponents] = useState<IComponent[]>([])
  const [selectedJob, setSelectedJob] = useState<IJob | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [isLoadingComponents, setIsLoadingComponents] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Timeline State
  const [timelineMembers, setTimelineMembers] = useState<string[]>([])
  const [timelineDays, setTimelineDays] = useState<ITimelineDay[]>([])
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)
  const [editingTimelineCell, setEditingTimelineCell] = useState<{ member: string; colIndex: number; value: string } | null>(null)
  const [isSavingTimelineCell, setIsSavingTimelineCell] = useState(false)
  const timelineScrollRef = useRef<HTMLDivElement>(null)

  // Drag and Drop State
  const [dragStartCell, setDragStartCell] = useState<{ member: string; colIndex: number } | null>(null)
  const [dragHoverCol, setDragHoverCol] = useState<number | null>(null)
  const [addingTimelineSpan, setAddingTimelineSpan] = useState<{ member: string; startCol: number; endCol: number; jobCode: string } | null>(null)
  const [isSavingTimelineSpan, setIsSavingTimelineSpan] = useState(false)

  // Clear drag state globally on mouseup
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setDragStartCell(null)
      setDragHoverCol(null)
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  // CRUD Modals State
  const [isAddingJob, setIsAddingJob] = useState(false)
  const [newJobId, setNewJobId] = useState('')
  const [newJobDeadline, setNewJobDeadline] = useState('')
  const [isSubmittingJob, setIsSubmittingJob] = useState(false)

  const [isAddingComponent, setIsAddingComponent] = useState(false)
  const [newCompCode, setNewCompCode] = useState('')
  const [newComp3DAssem, setNewComp3DAssem] = useState('-')
  const [newComp3DParts, setNewComp3DParts] = useState('-')
  const [newComp2DAssem, setNewComp2DAssem] = useState('-')
  const [newComp2DParts, setNewComp2DParts] = useState('-')
  const [newCompStatus, setNewCompStatus] = useState('Pending/Not Started')
  const [newCompDate, setNewCompDate] = useState('')
  const [isSubmittingComp, setIsSubmittingComp] = useState(false)

  const [editingComponent, setEditingComponent] = useState<IComponent | null>(null)
  const [editCompCode, setEditCompCode] = useState('')
  const [editComp3DAssem, setEditComp3DAssem] = useState('-')
  const [editComp3DParts, setEditComp3DParts] = useState('-')
  const [editComp2DAssem, setEditComp2DAssem] = useState('-')
  const [editComp2DParts, setEditComp2DParts] = useState('-')
  const [editCompStatus, setEditCompStatus] = useState('Pending/Not Started')
  const [editCompDate, setEditCompDate] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Load jobs list
  const loadJobs = async () => {
    setIsLoadingJobs(true)
    try {
      const res = await scheduleApi.getJobs()
      if (res.success) {
        setJobs(res.jobs)
        // Auto-select first job if nothing is selected and jobs exist
        if (res.jobs.length > 0 && !selectedJob) {
          setSelectedJob(res.jobs[0])
        } else if (selectedJob) {
          // Update selected job progress in place
          const updated = res.jobs.find((j: IJob) => j.job_id === selectedJob.job_id)
          if (updated) setSelectedJob(updated)
        }
      }
    } catch (err) {
      console.error('Failed to load schedule jobs:', err)
    } finally {
      setIsLoadingJobs(false)
    }
  }

  // Load components for selected job
  const loadComponents = async (jobId: string) => {
    setIsLoadingComponents(true)
    try {
      const res = await scheduleApi.getComponents(jobId)
      if (res.success) {
        setComponents(res.components)
      }
    } catch (err) {
      console.error('Failed to load components:', err)
    } finally {
      setIsLoadingComponents(false)
    }
  }

  // Load Gantt timeline data
  const loadTimeline = async (silent = false) => {
    if (!silent) setIsLoadingTimeline(true)
    try {
      const res = await scheduleApi.getTimeline()
      if (res.success) {
        setTimelineMembers(res.members)
        
        const monthNames = [
          'january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'
        ]
        const correctedTimeline = res.timeline.map((d: any) => {
          const mIdx = monthNames.indexOf(d.month.toLowerCase())
          if (mIdx !== -1) {
            // Calculate actual weekday for 2026
            const date = new Date(2026, mIdx, d.day)
            const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            return {
              ...d,
              weekday: weekdays[date.getDay()]
            }
          }
          return d
        })
        
        setTimelineDays(correctedTimeline)

        
        // Scroll timeline to today or end after load
        if (!silent) {
          setTimeout(() => {
            if (timelineScrollRef.current) {
              const todayElement = timelineScrollRef.current.querySelector('.cell-today')
              if (todayElement) {
                todayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
              } else {
                timelineScrollRef.current.scrollLeft = timelineScrollRef.current.scrollWidth
              }
            }
          }, 300)
        }
      }
    } catch (err) {
      console.error('Failed to load timeline:', err)
    } finally {
      if (!silent) setIsLoadingTimeline(false)
    }
  }

  useEffect(() => {
    loadJobs()
    loadTimeline()
  }, [])

  useEffect(() => {
    if (selectedJob) {
      loadComponents(selectedJob.job_id)
    } else {
      setComponents([])
    }
  }, [selectedJob])

  // Search filter
  const filteredJobs = jobs.filter(j => 
    j.job_id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handle excel export
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const data = await scheduleApi.exportToExcel()
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'KMTI Work Schedule Monitoring.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Failed to export schedule to Excel.')
    } finally {
      setIsExporting(false)
    }
  }

  // Add Job
  const handleAddJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newJobId.trim()) return

    setIsSubmittingJob(true)
    try {
      const res = await scheduleApi.createJob(newJobId, newJobDeadline || null)
      if (res.success) {
        setIsAddingJob(false)
        setNewJobId('')
        setNewJobDeadline('')
        loadJobs()
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to add Job: ${errMsg}`)
    } finally {
      setIsSubmittingJob(false)
    }
  }

  // Delete Job
  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm(`Are you sure you want to delete Job '${jobId}' and all its drawing components?`)) {
      return
    }
    try {
      await scheduleApi.deleteJob(jobId)
      if (selectedJob?.job_id === jobId) {
        setSelectedJob(null)
      }
      loadJobs()
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to delete Job: ${errMsg}`)
    }
  }

  // Add Component Drawing
  const handleAddComponentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJob || !newCompCode.trim()) return

    setIsSubmittingComp(true)
    try {
      await scheduleApi.createComponent(selectedJob.job_id, {
        unit_code: newCompCode,
        assembly_3d: newComp3DAssem,
        parts_3d: newComp3DParts,
        assembly_2d: newComp2DAssem,
        parts_2d: newComp2DParts,
        status: newCompStatus,
        submitted_date: newCompDate || null
      })
      setIsAddingComponent(false)
      setNewCompCode('')
      setNewComp3DAssem('-')
      setNewComp3DParts('-')
      setNewComp2DAssem('-')
      setNewComp2DParts('-')
      setNewCompStatus('Pending/Not Started')
      setNewCompDate('')
      loadComponents(selectedJob.job_id)
      loadJobs()
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to add component: ${errMsg}`)
    } finally {
      setIsSubmittingComp(false)
    }
  }

  // Edit Component Drawing
  const handleEditComponentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingComponent) return

    setIsSubmittingEdit(true)
    try {
      await scheduleApi.updateComponent(editingComponent.id, {
        unit_code: editCompCode,
        assembly_3d: editComp3DAssem,
        parts_3d: editComp3DParts,
        assembly_2d: editComp2DAssem,
        parts_2d: editComp2DParts,
        status: editCompStatus,
        submitted_date: editCompDate || null
      })
      setEditingComponent(null)
      if (selectedJob) {
        loadComponents(selectedJob.job_id)
      }
      loadJobs()
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to update component: ${errMsg}`)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Delete Component Drawing
  const handleDeleteComponent = async (comp: IComponent) => {
    if (!window.confirm(`Are you sure you want to delete drawing component '${comp.unit_code}'?`)) {
      return
    }
    try {
      await scheduleApi.deleteComponent(comp.id)
      if (selectedJob) {
        loadComponents(selectedJob.job_id)
      }
      loadJobs()
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to delete component: ${errMsg}`)
    }
  }

  // Open edit modal
  const openEditModal = (comp: IComponent) => {
    setEditingComponent(comp)
    setEditCompCode(comp.unit_code)
    setEditComp3DAssem(comp.assembly_3d)
    setEditComp3DParts(comp.parts_3d)
    setEditComp2DAssem(comp.assembly_2d)
    setEditComp2DParts(comp.parts_2d)
    setEditCompStatus(comp.status)
    setEditCompDate(comp.submitted_date || '')
  }

  // Save timeline cell changes
  const handleSaveTimelineCell = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTimelineCell) return

    setIsSavingTimelineCell(true)
    try {
      await scheduleApi.updateTimeline(
        editingTimelineCell.member,
        editingTimelineCell.colIndex,
        editingTimelineCell.value
      )
      setEditingTimelineCell(null)
      loadTimeline(true)
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to update timeline: ${errMsg}`)
    } finally {
      setIsSavingTimelineCell(false)
    }
  }

  const getStatusClass = (statusStr: string) => {
    const s = (statusStr || '').trim().toLowerCase()
    if (s === 'completed' || s === 'complete') return 'completed'
    if (s.includes('checking')) return 'checking'
    if (s === '-') return 'excluded'
    return 'pending'
  }

  const getDayClass = (day: ITimelineDay) => {
    const w = (day.weekday || '').trim().toLowerCase()
    if (w === 'sat') return 'cell-sat'
    if (w === 'sun') return 'cell-sun'
    return ''
  }

  const isToday = (dayObj: ITimelineDay) => {
    const today = new Date()
    const monthNames = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ]
    const todayMonthName = monthNames[today.getMonth()]
    const todayDayNum = today.getDate()

    return (
      dayObj.month.toLowerCase() === todayMonthName &&
      dayObj.day === todayDayNum
    )
  }

  // Mouse drag events for timeline span creation
  const handleMouseDown = (e: React.MouseEvent, member: string, colIndex: number) => {
    if (e.button !== 0) return // Left click only
    setDragStartCell({ member, colIndex })
    setDragHoverCol(colIndex)
  }

  const handleMouseEnter = (member: string, colIndex: number) => {
    if (dragStartCell && dragStartCell.member === member) {
      setDragHoverCol(colIndex)
    }
  }

  const handleMouseUpCell = (e: React.MouseEvent, member: string, colIndex: number) => {
    if (!dragStartCell) return
    e.stopPropagation()

    if (dragStartCell.member === member) {
      const start = Math.min(dragStartCell.colIndex, colIndex)
      const end = Math.max(dragStartCell.colIndex, colIndex)

      if (start !== end) {
        setAddingTimelineSpan({
          member,
          startCol: start,
          endCol: end,
          jobCode: ''
        })
      } else {
        // Simple click -> edit cell value
        const dayObj = timelineDays.find(d => d.col_index === colIndex)
        const assignment = dayObj?.assignments[member] || ''
        setEditingTimelineCell({ member, colIndex, value: assignment })
      }
    }

    setDragStartCell(null)
    setDragHoverCol(null)
  }

  const getSpanDatesText = () => {
    if (!addingTimelineSpan) return ''
    const startDayObj = timelineDays.find(d => d.col_index === addingTimelineSpan.startCol)
    const endDayObj = timelineDays.find(d => d.col_index === addingTimelineSpan.endCol)
    if (!startDayObj || !endDayObj) {
      return `Columns ${addingTimelineSpan.startCol} to ${addingTimelineSpan.endCol}`
    }
    return `${startDayObj.month} ${startDayObj.day} (${startDayObj.weekday}) to ${endDayObj.month} ${endDayObj.day} (${endDayObj.weekday})`
  }

  const handleSaveTimelineSpan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addingTimelineSpan || !addingTimelineSpan.jobCode.trim()) return

    setIsSavingTimelineSpan(true)
    try {
      const res = await scheduleApi.updateTimelineSpan(
        addingTimelineSpan.member,
        addingTimelineSpan.startCol,
        addingTimelineSpan.endCol,
        addingTimelineSpan.jobCode.trim()
      )
      if (res.success) {
        setAddingTimelineSpan(null)
        loadTimeline(true)
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.message
      alert(`Failed to save duration arrow: ${errMsg}`)
    } finally {
      setIsSavingTimelineSpan(false)
    }
  }

  const handleClearTimelineSpan = async () => {
    if (!addingTimelineSpan) return
    setIsSavingTimelineSpan(true)
    try {
      const res = await scheduleApi.updateTimelineSpan(
        addingTimelineSpan.member,
        addingTimelineSpan.startCol,
        addingTimelineSpan.endCol,
        '' // Empty string to clear
      )
      if (res.success) {
        setAddingTimelineSpan(null)
        loadTimeline(true)
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.message
      alert(`Failed to clear range: ${errMsg}`)
    } finally {
      setIsSavingTimelineSpan(false)
    }
  }
  const renderMonthHeaders = () => {
    if (timelineDays.length === 0) return null

    const headers: React.ReactNode[] = []
    let currentMonth = timelineDays[0].month
    let span = 0

    const pushHeader = (month: string, colSpan: number) => {
      headers.push(
        <th key={headers.length} colSpan={colSpan} className="timeline-month-header">
          {month || 'Unknown Month'}
        </th>
      )
    }

    timelineDays.forEach((day, index) => {
      if (day.month !== currentMonth) {
        pushHeader(currentMonth, span)
        currentMonth = day.month
        span = 1
      } else {
        span++
      }
      if (index === timelineDays.length - 1) {
        pushHeader(currentMonth, span)
      }
    })

    return (
      <tr>
        <th className="timeline-member-col" style={{ background: '#1e1e24' }}>Gantt Calendar Timeline</th>
        {headers}
      </tr>
    )
  }

  return (
    <div className="work-schedule-dashboard">
      
      {/* ── TOP TIMELINE CARD ─────────────────────────────────────── */}
      <div className="timeline-card">
        <div className="timeline-card-header">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Member Assignment Timeline (Gantt Chart)
          </h3>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            * Click/Double-click assignment block to edit cell value
          </span>
        </div>

        {isLoadingTimeline ? (
          <div className="schedule-loading-spinner" style={{ height: '120px' }}>
            <svg className="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8"/>
            </svg>
            <span>Loading calendar grid...</span>
          </div>
        ) : (
          <div className="timeline-grid-wrapper custom-scrollbar" ref={timelineScrollRef}>
            <table className="timeline-table">
              <thead>
                {renderMonthHeaders()}
                <tr>
                  <th className="timeline-member-col">Name</th>
                  {timelineDays.map((d, index) => (
                    <th key={index} className={`${getDayClass(d)} ${isToday(d) ? 'cell-today' : ''}`}>
                      {d.weekday}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="timeline-member-col" style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>Day</th>
                  {timelineDays.map((d, index) => (
                    <th key={index} className={`${getDayClass(d)} ${isToday(d) ? 'cell-today' : ''}`} style={{ borderBottom: '2px solid rgba(255,255,255,0.2)' }}>
                      {d.day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timelineMembers.map((member) => (
                  <tr key={member}>
                    <td className="timeline-member-col">{member}</td>
                    {timelineDays.map((d, index) => {
                      const assignment = d.assignments[member] || ''

                      // Check if this cell is currently within the drag range
                      let isHighlighted = false
                      if (dragStartCell && dragStartCell.member === member && dragHoverCol !== null) {
                        const start = Math.min(dragStartCell.colIndex, dragHoverCol)
                        const end = Math.max(dragStartCell.colIndex, dragHoverCol)
                        isHighlighted = d.col_index >= start && d.col_index <= end
                      }

                      const isArrow = assignment === '-->'
                      let isArrowEnd = false
                      if (isArrow) {
                        // Look ahead to check if there are any further arrow segments in the continuous sequence
                        let foundFurtherArrow = false
                        for (let i = index + 1; i < timelineDays.length; i++) {
                          const nextAssign = timelineDays[i].assignments[member] || ''
                          if (nextAssign === '-->') {
                            foundFurtherArrow = true
                            break
                          }
                          if (nextAssign === '') {
                            // Sequence ended
                            break
                          }
                        }
                        if (!foundFurtherArrow) {
                          isArrowEnd = true
                        }
                      }

                      return (
                        <td 
                          key={d.col_index} 
                          className={`${getDayClass(d)} ${isHighlighted ? 'cell-dragging' : ''} ${isToday(d) ? 'cell-today' : ''} ${isArrow ? 'cell-arrow' : ''}`}
                          onMouseDown={(e) => handleMouseDown(e, member, d.col_index)}
                          onMouseEnter={() => handleMouseEnter(member, d.col_index)}
                          onMouseUp={(e) => handleMouseUpCell(e, member, d.col_index)}
                          style={{ userSelect: 'none' }}
                        >
                          {isArrow ? (
                            <div className={`gantt-arrow-line ${isArrowEnd ? 'arrow-end' : ''}`} />
                          ) : assignment ? (
                            <span className="timeline-assignment-text">
                              {assignment}
                            </span>
                          ) : (
                            <span className="timeline-cell-empty" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── BOTTOM SPLIT LAYOUT (JOBS & DRAWINGS) ────────────────── */}
      <div className="work-schedule-container">
        
        {/* Sidebar Panel */}
        <div className="schedule-sidebar-panel">
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <svg className="search-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search Jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              className="btn-schedule-action primary" 
              style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px' }}
              title="Add New Job"
              onClick={() => setIsAddingJob(true)}
            >
              + Job
            </button>
          </div>

          {isLoadingJobs ? (
            <div className="schedule-loading-spinner">
              <svg className="spinner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8"/>
              </svg>
              <span>Loading...</span>
            </div>
          ) : (
            <div className="job-list custom-scrollbar">
              {filteredJobs.map((j) => (
                <div
                  key={j.job_id}
                  className={`job-item${selectedJob?.job_id === j.job_id ? ' active' : ''}`}
                  onClick={() => setSelectedJob(j)}
                >
                  <div className="job-item-header">
                    <span className="job-title-id">{j.job_id}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {j.deadline && <span className="job-deadline-badge">{j.deadline}</span>}
                      <button 
                        className="btn-schedule-action danger" 
                        style={{ padding: '2px 4px', fontSize: '10px', borderRadius: '4px', border: 'none' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteJob(j.job_id)
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${j.progress_percent}%` }}></div>
                  </div>
                  <div className="progress-label-row">
                    <span>{j.progress_percent}% Done</span>
                    <span>{j.completed_components}/{j.total_components} Units</span>
                  </div>
                </div>
              ))}
              {filteredJobs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)' }}>
                  No jobs found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Details Panel */}
        <div className="schedule-main-panel">
          {/* Header actions */}
          <div className="schedule-header-actions">
            <div className="active-job-details">
              {selectedJob ? (
                <>
                  <h2>Job {selectedJob.job_id}</h2>
                  <p>Deadline: {selectedJob.deadline || 'Not Specified'} &bull; Completion: {selectedJob.progress_percent}%</p>
                </>
              ) : (
                <>
                  <h2>Work Schedule Monitor</h2>
                  <p>Select or create a job to get started</p>
                </>
              )}
            </div>

            <div className="action-buttons-group">
              {selectedJob && (
                <button
                  className="btn-schedule-action primary"
                  onClick={() => setIsAddingComponent(true)}
                >
                  + Add Component
                </button>
              )}
              <button
                className="btn-schedule-action"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Export Excel'}
              </button>
            </div>
          </div>

          {selectedJob ? (
            <>
              {isLoadingComponents ? (
                <div className="schedule-loading-spinner" style={{ height: '300px' }}>
                  <svg className="spinner-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8"/>
                  </svg>
                  <span>Loading components...</span>
                </div>
              ) : (
                <div className="components-table-container custom-scrollbar">
                  <table className="components-table">
                    <thead>
                      <tr>
                        <th>Machine/Unit Code</th>
                        <th>3D Assembly</th>
                        <th>3D Parts</th>
                        <th>2D Assembly</th>
                        <th>2D Parts</th>
                        <th>Status</th>
                        <th>Submitted Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((c) => (
                        <tr key={c.id}>
                          <td><strong>{c.unit_code}</strong></td>
                          <td><span className="param-pill">{c.assembly_3d}</span></td>
                          <td><span className="param-pill">{c.parts_3d}</span></td>
                          <td><span className="param-pill">{c.assembly_2d}</span></td>
                          <td><span className="param-pill">{c.parts_2d}</span></td>
                          <td>
                            <span className={`status-badge-schedule ${getStatusClass(c.status)}`}>
                              {c.status}
                            </span>
                          </td>
                          <td>{c.submitted_date || '-'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button
                                className="btn-schedule-action"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => openEditModal(c)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-schedule-action danger"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => handleDeleteComponent(c)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {components.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>
                            No component drawings monitored for this job.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="no-schedule-selected">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <h3>No Job Selected</h3>
              <p>Select or create a job code in the sidebar to view drawing monitoring progress.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── ADD NEW JOB MODAL ────────────────────────────────────── */}
      {isAddingJob && (
        <div className="schedule-modal-overlay">
          <form className="schedule-modal-card" onSubmit={handleAddJobSubmit}>
            <h3 className="schedule-modal-title">Create New Job Group</h3>
            
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

            <div className="schedule-form-group">
              <label>Deadline (e.g. 1/31/2025 or 06/30)</label>
              <input
                type="text"
                value={newJobDeadline}
                onChange={(e) => setNewJobDeadline(e.target.value)}
                placeholder="Enter job deadline"
              />
            </div>

            <div className="schedule-modal-buttons">
              <button
                type="button"
                className="btn-schedule-action"
                onClick={() => setIsAddingJob(false)}
                disabled={isSubmittingJob}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-schedule-action primary"
                disabled={isSubmittingJob}
              >
                {isSubmittingJob ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── ADD NEW COMPONENT MODAL ─────────────────────────────── */}
      {isAddingComponent && (
        <div className="schedule-modal-overlay">
          <form className="schedule-modal-card" onSubmit={handleAddComponentSubmit}>
            <h3 className="schedule-modal-title">Add Component Drawing</h3>
            
            <div className="schedule-form-group">
              <label>Machine/Unit Code</label>
              <input
                type="text"
                value={newCompCode}
                onChange={(e) => setNewCompCode(e.target.value)}
                placeholder="e.g. SW 外形図, FSBT"
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="schedule-form-group">
                <label>3D Assembly</label>
                <input
                  type="text"
                  value={newComp3DAssem}
                  onChange={(e) => setNewComp3DAssem(e.target.value)}
                />
              </div>
              <div className="schedule-form-group">
                <label>3D Parts</label>
                <input
                  type="text"
                  value={newComp3DParts}
                  onChange={(e) => setNewComp3DParts(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="schedule-form-group">
                <label>2D Assembly</label>
                <input
                  type="text"
                  value={newComp2DAssem}
                  onChange={(e) => setNewComp2DAssem(e.target.value)}
                />
              </div>
              <div className="schedule-form-group">
                <label>2D Parts</label>
                <input
                  type="text"
                  value={newComp2DParts}
                  onChange={(e) => setNewComp2DParts(e.target.value)}
                />
              </div>
            </div>

            <div className="schedule-form-group">
              <label>Status</label>
              <select
                value={newCompStatus}
                onChange={(e) => setNewCompStatus(e.target.value)}
              >
                <option value="Pending/Not Started">Pending/Not Started</option>
                <option value="Completed">Completed</option>
                <option value="For Checking">For Checking</option>
                <option value="Excluded/NA">Excluded/NA</option>
              </select>
            </div>

            <div className="schedule-form-group">
              <label>Submitted Date</label>
              <input
                type="date"
                value={newCompDate}
                onChange={(e) => setNewCompDate(e.target.value)}
              />
            </div>

            <div className="schedule-modal-buttons">
              <button
                type="button"
                className="btn-schedule-action"
                onClick={() => setIsAddingComponent(false)}
                disabled={isSubmittingComp}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-schedule-action primary"
                disabled={isSubmittingComp}
              >
                {isSubmittingComp ? 'Adding...' : 'Add Component'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── EDIT DRAWING COMPONENT MODAL ─────────────────────────── */}
      {editingComponent && (
        <div className="schedule-modal-overlay">
          <form className="schedule-modal-card" onSubmit={handleEditComponentSubmit}>
            <h3 className="schedule-modal-title">Edit Drawing Component</h3>
            
            <div className="schedule-form-group">
              <label>Machine/Unit Code</label>
              <input
                type="text"
                value={editCompCode}
                onChange={(e) => setEditCompCode(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="schedule-form-group">
                <label>3D Assembly</label>
                <input
                  type="text"
                  value={editComp3DAssem}
                  onChange={(e) => setEditComp3DAssem(e.target.value)}
                />
              </div>
              <div className="schedule-form-group">
                <label>3D Parts</label>
                <input
                  type="text"
                  value={editComp3DParts}
                  onChange={(e) => setEditComp3DParts(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="schedule-form-group">
                <label>2D Assembly</label>
                <input
                  type="text"
                  value={editComp2DAssem}
                  onChange={(e) => setEditComp2DAssem(e.target.value)}
                />
              </div>
              <div className="schedule-form-group">
                <label>2D Parts</label>
                <input
                  type="text"
                  value={editComp2DParts}
                  onChange={(e) => setEditComp2DParts(e.target.value)}
                />
              </div>
            </div>

            <div className="schedule-form-group">
              <label>Status</label>
              <select
                value={editCompStatus}
                onChange={(e) => setEditCompStatus(e.target.value)}
              >
                <option value="Pending/Not Started">Pending/Not Started</option>
                <option value="Completed">Completed</option>
                <option value="For Checking">For Checking</option>
                <option value="Excluded/NA">Excluded/NA</option>
              </select>
            </div>

            <div className="schedule-form-group">
              <label>Submitted Date</label>
              <input
                type="date"
                value={editCompDate}
                onChange={(e) => setEditCompDate(e.target.value)}
              />
            </div>

            <div className="schedule-modal-buttons">
              <button
                type="button"
                className="btn-schedule-action"
                onClick={() => setEditingComponent(null)}
                disabled={isSubmittingEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-schedule-action primary"
                disabled={isSubmittingEdit}
              >
                {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── EDIT TIMELINE CELL VALUE MODAL ───────────────────────── */}
      {editingTimelineCell && (
        <div className="schedule-modal-overlay">
          <form className="schedule-modal-card" onSubmit={handleSaveTimelineCell}>
            <h3 className="schedule-modal-title">Assign Job for {editingTimelineCell.member}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
              Updating column index: {editingTimelineCell.colIndex}
            </p>
            
            <div className="schedule-form-group">
              <label>Assignment String (e.g. 2810LN, 9324)</label>
              <input
                type="text"
                value={editingTimelineCell.value}
                onChange={(e) => setEditingTimelineCell({ ...editingTimelineCell, value: e.target.value })}
                placeholder="Enter job code / arrows (empty to clear)"
                autoFocus
              />
            </div>

            <div className="schedule-modal-buttons">
              <button
                type="button"
                className="btn-schedule-action"
                onClick={() => setEditingTimelineCell(null)}
                disabled={isSavingTimelineCell}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-schedule-action primary"
                disabled={isSavingTimelineCell}
              >
                {isSavingTimelineCell ? 'Saving...' : 'Update Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* ── ADD TIMELINE SPAN DURATION MODAL ─────────────────────── */}
      {addingTimelineSpan && (
        <div className="schedule-modal-overlay">
          <form className="schedule-modal-card" onSubmit={handleSaveTimelineSpan}>
            <h3 className="schedule-modal-title">Create Job Duration for {addingTimelineSpan.member}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
              Selected range: <strong>{getSpanDatesText()}</strong>
            </p>
            
            <div className="schedule-form-group">
              <label>Job Code / ID</label>
              <input
                type="text"
                list="jobs-datalist"
                value={addingTimelineSpan.jobCode}
                onChange={(e) => setAddingTimelineSpan({ ...addingTimelineSpan, jobCode: e.target.value })}
                placeholder="Select or enter job code"
                required
                autoFocus
              />
              <datalist id="jobs-datalist">
                {jobs.map(j => (
                  <option key={j.job_id} value={j.job_id} />
                ))}
              </datalist>
            </div>

            <div className="schedule-modal-buttons">
              <button
                type="button"
                className="btn-schedule-action danger"
                style={{ marginRight: 'auto' }}
                onClick={handleClearTimelineSpan}
                disabled={isSavingTimelineSpan}
              >
                Clear Range
              </button>
              <button
                type="button"
                className="btn-schedule-action"
                onClick={() => setAddingTimelineSpan(null)}
                disabled={isSavingTimelineSpan}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-schedule-action primary"
                disabled={isSavingTimelineSpan}
              >
                {isSavingTimelineSpan ? 'Saving...' : 'Add Arrow Span'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
