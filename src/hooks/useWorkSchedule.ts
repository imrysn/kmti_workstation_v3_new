import { useState, useEffect, useRef, useCallback } from 'react'
import { scheduleApi } from '../services/api'
import { useFlags } from '../context/FlagsContext'
import { useAuth } from '../context/AuthContext'
import { useModal } from '../components/ModalContext'

function formatPercentDisplay(val: string): string {
  if (!val || val === '-') return '-'
  const num = parseFloat(val)
  if (!isNaN(num) && num >= 0 && num <= 1) {
    return `${Math.round(num * 100)}%`
  }
  return val
}

function formatPercentInput(val: string): string {
  if (!val || val.trim() === '-') return '-'
  const cleanVal = val.replace('%', '').trim()
  const num = parseFloat(cleanVal)
  if (!isNaN(num)) {
    return (num / 100).toFixed(2).replace(/\.?0+$/, '')
  }
  return val
}


export interface IJob {
  id: number
  job_id: string
  deadline: string
  total_components: number
  completed_components: number
  checking_components: number
  progress_percent: number
  components?: IComponent[]
}

export interface IComponent {
  id: number
  job_id: string
  unit_code: string
  assembly_3d: string
  parts_3d: string
  assembly_2d: string
  parts_2d: string
  status: string
  submitted_date: string | null
  is_postponed?: boolean
}

export interface ITimelineDay {
  col_index: number
  month: string
  day: number
  weekday: string
  assignments: Record<string, string>
}

// Module-level caches to prevent screen flash on component remounting
let cachedJobs: IJob[] = []
let cachedTimelineMembers: string[] = []
let cachedTimelineDays: ITimelineDay[] = []
let cachedSelectedJob: IJob | null = null
let cachedComponentsByJob: Record<string, IComponent[]> = {}

export function useWorkSchedule() {
  const { flags } = useFlags()
  const { hasRole } = useAuth()
  const { confirm } = useModal()
  const isAdminOrIT = hasRole('admin', 'it')

  const [canWrite, setCanWrite] = useState(isAdminOrIT)
  const [jobs, setJobs] = useState<IJob[]>(cachedJobs)
  const [components, setComponents] = useState<IComponent[]>([])
  const [selectedJob, setSelectedJob] = useState<IJob | null>(cachedSelectedJob)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [isLoadingComponents, setIsLoadingComponents] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Timeline State
  const [timelineMembers, setTimelineMembers] = useState<string[]>(cachedTimelineMembers)
  const [timelineDays, setTimelineDays] = useState<ITimelineDay[]>(cachedTimelineDays)
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

  // Sync selected job to cached module-level variable
  useEffect(() => {
    cachedSelectedJob = selectedJob
  }, [selectedJob])

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
  const [editCompPostponed, setEditCompPostponed] = useState(false)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Load jobs list
  const loadJobs = async () => {
    if (cachedJobs.length === 0) {
      setIsLoadingJobs(true)
    }
    try {
      const res = await scheduleApi.getJobs()
      if (res.success) {
        setJobs(res.jobs)
        cachedJobs = res.jobs
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
    if (!cachedComponentsByJob[jobId]) {
      setIsLoadingComponents(true)
    }
    try {
      const res = await scheduleApi.getComponents(jobId)
      if (res.success) {
        setComponents(res.components)
        cachedComponentsByJob[jobId] = res.components
      }
    } catch (err) {
      console.error('Failed to load components:', err)
    } finally {
      setIsLoadingComponents(false)
    }
  }

  // Load Gantt timeline data
  const loadTimeline = async (silent = false) => {
    if (!silent && cachedTimelineDays.length === 0) setIsLoadingTimeline(true)
    try {
      const res = await scheduleApi.getTimeline()
      if (res.success) {
        setTimelineMembers(res.members)
        cachedTimelineMembers = res.members
        
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
        
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(today.getDate() - 7)

        const filteredTimeline = correctedTimeline.filter((d: any) => {
          const mIdx = monthNames.indexOf(d.month.toLowerCase())
          if (mIdx !== -1) {
            const dayDate = new Date(2026, mIdx, d.day)
            return dayDate >= sevenDaysAgo
          }
          return true
        })

        setTimelineDays(filteredTimeline)
        cachedTimelineDays = filteredTimeline

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

  const loadPermissions = async () => {
    try {
      const res = await scheduleApi.getPermissions()
      setCanWrite(res.can_write)
    } catch (err) {
      console.error('Failed to load schedule permissions:', err)
      setCanWrite(false)
    }
  }

  useEffect(() => {
    loadPermissions()
    loadJobs()
    loadTimeline()
  }, [])

  useEffect(() => {
    if (selectedJob) {
      setComponents(cachedComponentsByJob[selectedJob.job_id] || [])
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
    confirm(
      `Are you sure you want to delete Job '${jobId}' and all its drawing components? This cannot be undone.`,
      async () => {
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
      },
      undefined,
      'danger',
      'Delete Job Group',
      'Delete'
    )
  }

  // Add Component Drawing
  const handleAddComponentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJob || !newCompCode.trim()) return

    setIsSubmittingComp(true)
    try {
      await scheduleApi.createComponent(selectedJob.job_id, {
        unit_code: newCompCode,
        assembly_3d: formatPercentInput(newComp3DAssem),
        parts_3d: formatPercentInput(newComp3DParts),
        assembly_2d: formatPercentInput(newComp2DAssem),
        parts_2d: formatPercentInput(newComp2DParts),
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
        assembly_3d: formatPercentInput(editComp3DAssem),
        parts_3d: formatPercentInput(editComp3DParts),
        assembly_2d: formatPercentInput(editComp2DAssem),
        parts_2d: formatPercentInput(editComp2DParts),
        status: editCompStatus,
        submitted_date: editCompDate || null,
        is_postponed: editCompPostponed
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
    confirm(
      `Are you sure you want to delete drawing component '${comp.unit_code}'?`,
      async () => {
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
      },
      undefined,
      'danger',
      'Delete Drawing Component',
      'Delete'
    )
  }

  // Open edit modal
  const openEditModal = (comp: IComponent) => {
    setEditingComponent(comp)
    setEditCompCode(comp.unit_code)
    setEditComp3DAssem(formatPercentDisplay(comp.assembly_3d))
    setEditComp3DParts(formatPercentDisplay(comp.parts_3d))
    setEditComp2DAssem(formatPercentDisplay(comp.assembly_2d))
    setEditComp2DParts(formatPercentDisplay(comp.parts_2d))
    setEditCompStatus(comp.status)
    setEditCompDate(comp.submitted_date || '')
    setEditCompPostponed(!!comp.is_postponed)
  }

  // Save timeline cell changes
  const handleSaveTimelineCell = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTimelineCell) return

    setIsSavingTimelineCell(true)
    // Save previous state for rollback
    const rollbackTimelineDays = [...timelineDays]

    // Optimistically update local state
    setTimelineDays(prevDays =>
      prevDays.map(day => {
        if (day.col_index === editingTimelineCell.colIndex) {
          return {
            ...day,
            assignments: {
              ...day.assignments,
              [editingTimelineCell.member]: editingTimelineCell.value
            }
          }
        }
        return day
      })
    )

    const cellToSave = editingTimelineCell
    setEditingTimelineCell(null)

    try {
      await scheduleApi.updateTimeline(
        cellToSave.member,
        cellToSave.colIndex,
        cellToSave.value
      )
      loadTimeline(true)
    } catch (err: any) {
      // Rollback on failure
      setTimelineDays(rollbackTimelineDays)
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
  const handleMouseDown = useCallback((e: React.MouseEvent, member: string, colIndex: number) => {
    if (!canWrite) return
    if (e.button !== 0) return // Left click only
    setDragStartCell({ member, colIndex })
    setDragHoverCol(colIndex)
  }, [canWrite])

  const handleMouseEnter = useCallback((member: string, colIndex: number) => {
    if (!canWrite) return
    if (dragStartCell && dragStartCell.member === member) {
      setDragHoverCol(colIndex)
    }
  }, [canWrite, dragStartCell])

  const handleMouseUpCell = useCallback((e: React.MouseEvent, member: string, colIndex: number) => {
    if (!canWrite) return
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
  }, [canWrite, dragStartCell, timelineDays])

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
    const rollbackTimelineDays = [...timelineDays]
    const spanToSave = addingTimelineSpan
    const start = Math.min(spanToSave.startCol, spanToSave.endCol)
    const end = Math.max(spanToSave.startCol, spanToSave.endCol)
    const center = Math.floor((start + end) / 2)

    // Optimistically update local state
    setTimelineDays(prevDays =>
      prevDays.map(day => {
        if (day.col_index >= start && day.col_index <= end) {
          const val = day.col_index === center ? spanToSave.jobCode.trim() : '-->'
          return {
            ...day,
            assignments: {
              ...day.assignments,
              [spanToSave.member]: val
            }
          }
        }
        return day
      })
    )

    setAddingTimelineSpan(null)

    try {
      const res = await scheduleApi.updateTimelineSpan(
        spanToSave.member,
        spanToSave.startCol,
        spanToSave.endCol,
        spanToSave.jobCode.trim()
      )
      if (res.success) {
        loadTimeline(true)
      } else {
        throw new Error(res.message || "Failed to update span")
      }
    } catch (err: any) {
      setTimelineDays(rollbackTimelineDays)
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.message
      alert(`Failed to save duration arrow: ${errMsg}`)
    } finally {
      setIsSavingTimelineSpan(false)
    }
  }

  const handleClearTimelineSpan = async () => {
    if (!addingTimelineSpan) return

    setIsSavingTimelineSpan(true)
    const rollbackTimelineDays = [...timelineDays]
    const spanToClear = addingTimelineSpan
    const start = Math.min(spanToClear.startCol, spanToClear.endCol)
    const end = Math.max(spanToClear.startCol, spanToClear.endCol)

    // Optimistically update local state
    setTimelineDays(prevDays =>
      prevDays.map(day => {
        if (day.col_index >= start && day.col_index <= end) {
          return {
            ...day,
            assignments: {
              ...day.assignments,
              [spanToClear.member]: ''
            }
          }
        }
        return day
      })
    )

    setAddingTimelineSpan(null)

    try {
      const res = await scheduleApi.updateTimelineSpan(
        spanToClear.member,
        spanToClear.startCol,
        spanToClear.endCol,
        '' // Empty string to clear
      )
      if (res.success) {
        loadTimeline(true)
      } else {
        throw new Error(res.message || "Failed to clear span")
      }
    } catch (err: any) {
      setTimelineDays(rollbackTimelineDays)
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.message
      alert(`Failed to clear range: ${errMsg}`)
    } finally {
      setIsSavingTimelineSpan(false)
    }
  }

  return {
    flags,
    isAdminOrIT,
    canWrite,
    jobs,
    setJobs,
    components,
    setComponents,
    selectedJob,
    setSelectedJob,
    searchQuery,
    setSearchQuery,
    isLoadingJobs,
    isLoadingComponents,
    isExporting,
    timelineMembers,
    timelineDays,
    isLoadingTimeline,
    editingTimelineCell,
    setEditingTimelineCell,
    isSavingTimelineCell,
    timelineScrollRef,
    dragStartCell,
    dragHoverCol,
    addingTimelineSpan,
    setAddingTimelineSpan,
    isSavingTimelineSpan,
    isAddingJob,
    setIsAddingJob,
    newJobId,
    setNewJobId,
    newJobDeadline,
    setNewJobDeadline,
    isSubmittingJob,
    isAddingComponent,
    setIsAddingComponent,
    newCompCode,
    setNewCompCode,
    newComp3DAssem,
    setNewComp3DAssem,
    newComp3DParts,
    setNewComp3DParts,
    newComp2DAssem,
    setNewComp2DAssem,
    newComp2DParts,
    setNewComp2DParts,
    newCompStatus,
    setNewCompStatus,
    newCompDate,
    setNewCompDate,
    isSubmittingComp,
    editingComponent,
    setEditingComponent,
    editCompCode,
    setEditCompCode,
    editComp3DAssem,
    setEditComp3DAssem,
    editComp3DParts,
    setEditComp3DParts,
    editComp2DAssem,
    setEditComp2DAssem,
    editComp2DParts,
    setEditComp2DParts,
    editCompStatus,
    setEditCompStatus,
    editCompDate,
    setEditCompDate,
    editCompPostponed,
    setEditCompPostponed,
    isSubmittingEdit,
    loadJobs,
    loadComponents,
    loadTimeline,
    filteredJobs,
    handleExport,
    handleAddJobSubmit,
    handleDeleteJob,
    handleAddComponentSubmit,
    handleEditComponentSubmit,
    handleDeleteComponent,
    openEditModal,
    handleSaveTimelineCell,
    getStatusClass,
    getDayClass,
    isToday,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUpCell,
    getSpanDatesText,
    handleSaveTimelineSpan,
    handleClearTimelineSpan
  }
}
