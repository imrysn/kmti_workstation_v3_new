import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { io } from 'socket.io-client'
import { scheduleApi, SERVER_BASE } from '../services/api'
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

export interface INotification {
  id: number
  job_id: string
  component_id: number
  message: string
  is_read: boolean
  created_at: string
}

export interface ITimelineDay {
  col_index: number
  month: string
  day: number
  weekday: string
  year?: number
  assignments: Record<string, string>
}

// Module-level caches to prevent screen flash on component remounting
let cachedJobs: IJob[] = []
let cachedTimelineMembers: string[] = []
let cachedTimelineDays: ITimelineDay[] = []
let cachedSelectedJob: IJob | null = null
let cachedComponentsByJob: Record<string, IComponent[]> = {}

// Cache freshness timestamps — used for TTL-based skip-fetch logic
const CACHE_TTL_MS = 60_000 // 60 seconds
let cachedJobsAt = 0
let cachedTimelineAt = 0
let isFetchingJobs = false
let isFetchingTimeline = false

/**
 * Standalone prefetch function — can be called outside the hook
 * (e.g., on hover) to warm up the cache before the tab is clicked.
 * Uses the same TTL check so it never double-fetches.
 */
export async function prefetchWorkScheduleData() {
  const now = Date.now()
  const fetchJobs = !isFetchingJobs && (cachedJobs.length === 0 || now - cachedJobsAt > CACHE_TTL_MS)
  const fetchTimeline = !isFetchingTimeline && (cachedTimelineDays.length === 0 || now - cachedTimelineAt > CACHE_TTL_MS)

  if (!fetchJobs && !fetchTimeline) return // cache is warm — nothing to do

  try {
    const { scheduleApi } = await import('../services/api')
    const fetches: Promise<void>[] = []

    if (fetchJobs) {
      isFetchingJobs = true
      fetches.push(
        scheduleApi.getJobs()
          .then((res: any) => {
            if (res.success) {
              cachedJobs = res.jobs
              cachedJobsAt = Date.now()
              if (res.jobs.length > 0 && !cachedSelectedJob) {
                cachedSelectedJob = res.jobs[0]
              }
            }
          })
          .catch((err: any) => console.warn('[prefetch] jobs failed:', err))
          .finally(() => { isFetchingJobs = false })
      )
    }

    if (fetchTimeline) {
      isFetchingTimeline = true
      const monthNames = [
        'january','february','march','april','may','june',
        'july','august','september','october','november','december'
      ]
      fetches.push(
        scheduleApi.getTimeline()
          .then((res: any) => {
            if (res.success) {
              cachedTimelineMembers = res.members
              cachedTimelineDays = res.timeline.map((d: any) => {
                const mIdx = monthNames.indexOf(d.month.toLowerCase())
                if (mIdx !== -1) {
                  const year = d.year || new Date().getFullYear()
                  const date = new Date(year, mIdx, d.day)
                  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                  return { ...d, weekday: weekdays[date.getDay()] }
                }
                return d
              })
              cachedTimelineAt = Date.now()
            }
          })
          .catch((err: any) => console.warn('[prefetch] timeline failed:', err))
          .finally(() => { isFetchingTimeline = false })
      )
    }

    await Promise.all(fetches)
  } catch (err) {
    console.warn('[prefetch] failed to import api:', err)
  }
}

export function useWorkSchedule() {
  const { flags } = useFlags()
  const { hasRole, user } = useAuth()
  const { confirm, alert } = useModal()
  const isAdminOrIT = hasRole('admin', 'it')

  const [canWrite, setCanWrite] = useState(isAdminOrIT)
  const [jobs, setJobs] = useState<IJob[]>(cachedJobs)
  const [components, setComponents] = useState<IComponent[]>([])
  const [selectedJob, setSelectedJob] = useState<IJob | null>(cachedSelectedJob)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [isLoadingComponents, setIsLoadingComponents] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  
  // Notification State
  const [notifications, setNotifications] = useState<INotification[]>([])
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await scheduleApi.getNotifications()
      if (res.success) setNotifications(res.notifications)
    } catch (err) {
      console.warn('Failed to fetch notifications', err)
    }
  }, [])

  const markNotificationsRead = async () => {
    try {
      await scheduleApi.markNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.warn('Failed to mark notifications read', err)
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await scheduleApi.deleteNotification(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.warn('Failed to delete notification', err)
    }
  }

  const deleteAllNotifications = async () => {
    try {
      await scheduleApi.deleteAllNotifications()
      setNotifications([])
    } catch (err) {
      console.warn('Failed to delete all notifications', err)
    }
  }

  // Socket Listener for Notifications
  useEffect(() => {
    fetchNotifications()

    const socket = io(SERVER_BASE, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      auth: { username: user?.username ?? '' }
    })

    socket.on('work_schedule_notification', (_data: { member_name: string }) => {
      // Refresh notifications when we receive an event
      fetchNotifications()
      
      // Browser push notification
      if (Notification.permission === 'granted') {
        new Notification('KMTI Work Schedule', { body: 'You have a new work status update!' })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission()
      }

      const isElectron = !!(window as any).electronAPI?.flashWindow

      if (isElectron) {
        // --- Electron: use native BrowserWindow.flashFrame() ---
        ;(window as any).electronAPI.flashWindow(true)

        const stopFlash = () => {
          ;(window as any).electronAPI.flashWindow(false)
          window.removeEventListener('focus', stopFlash)
        }
        window.addEventListener('focus', stopFlash)
      } else {
        // --- Browser fallback: flash the tab title ---
        const originalTitle = document.title
        let flashInterval: ReturnType<typeof setInterval> | null = null
        let isFlashing = false

        const startFlashing = () => {
          if (flashInterval) return
          isFlashing = true
          flashInterval = setInterval(() => {
            document.title = isFlashing ? '🔔 NEW NOTIFICATION!' : originalTitle
            isFlashing = !isFlashing
          }, 700)
        }

        const stopFlashing = () => {
          if (flashInterval) {
            clearInterval(flashInterval)
            flashInterval = null
          }
          document.title = originalTitle
          window.removeEventListener('focus', stopFlashing)
        }

        if (!document.hasFocus()) {
          startFlashing()
        } else {
          const onBlur = () => {
            startFlashing()
            window.removeEventListener('blur', onBlur)
          }
          window.addEventListener('blur', onBlur)
        }

        window.addEventListener('focus', stopFlashing)
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [fetchNotifications])

  // Timeline State
  const [timelineMembers, setTimelineMembers] = useState<string[]>(cachedTimelineMembers)
  const [allTimelineDays, setAllTimelineDays] = useState<ITimelineDay[]>(cachedTimelineDays)
  const [displayYear, setDisplayYear] = useState<number>(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false)
  const [editingTimelineCell, setEditingTimelineCell] = useState<{ member: string; colIndex: number; value: string } | null>(null)
  const [isSavingTimelineCell, setIsSavingTimelineCell] = useState(false)
  const [editingJob, setEditingJob] = useState<IJob | null>(null)
  const timelineScrollRef = useRef<HTMLDivElement>(null)
  const [isAddingEmployee, setIsAddingEmployee] = useState(false)
  const [renamingEmployee, setRenamingEmployee] = useState<string | null>(null)
  const [employeeInputName, setEmployeeInputName] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'name-asc' | 'name-desc' | 'deadline-asc' | 'deadline-desc' | 'status'>('newest')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'checking' | 'pending' | 'excluded'>('all')

  // Compute filtered timelineDays based on chosen year
  const timelineDays = useMemo(() => {
    return allTimelineDays.filter((d: any) => {
      // Filter to only display the chosen display year
      return !d.year || d.year === displayYear
    })
  }, [allTimelineDays, displayYear])

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
  const loadJobs = async (force = false) => {
    const now = Date.now()
    const isFresh = !force && cachedJobs.length > 0 && (now - cachedJobsAt) < CACHE_TTL_MS
    if (isFresh) {
      // Cache is still warm — hydrate from cache immediately, skip network call
      setJobs(cachedJobs)
      if (!selectedJob && cachedJobs.length > 0) setSelectedJob(cachedJobs[0])
      else if (selectedJob) {
        const updated = cachedJobs.find((j: IJob) => j.job_id === selectedJob.job_id)
        if (updated) setSelectedJob(updated)
      }
      return
    }
    if (cachedJobs.length === 0 || force) {
      setIsLoadingJobs(true)
    }
    isFetchingJobs = true
    try {
      const res = await scheduleApi.getJobs()
      if (res.success) {
        setJobs(res.jobs)
        cachedJobs = res.jobs
        cachedJobsAt = Date.now()
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
      isFetchingJobs = false
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
    const now = Date.now()
    const isFresh = cachedTimelineDays.length > 0 && (now - cachedTimelineAt) < CACHE_TTL_MS
    if (isFresh && !silent) {
      // Cache is still warm — hydrate from cache immediately, skip network call
      setTimelineMembers(cachedTimelineMembers)
      setAllTimelineDays(cachedTimelineDays)
      return
    }
    if (!silent && cachedTimelineDays.length === 0) setIsLoadingTimeline(true)
    isFetchingTimeline = true
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
            // Calculate actual weekday for the parsed year
            const year = d.year || 2026
            const date = new Date(year, mIdx, d.day)
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

        // Find which year to display dynamically.
        // Prefer the current calendar year if present in the spreadsheet layout, otherwise default to the maximum year available in the sheet.
        const todayYear = today.getFullYear()
        const yearsInTimeline = Array.from(new Set(correctedTimeline.map((d: any) => d.year).filter(Boolean))) as number[]
        yearsInTimeline.sort((a, b) => a - b)
        if (yearsInTimeline.length > 0) {
          setAvailableYears(yearsInTimeline)
          if (yearsInTimeline.includes(todayYear)) {
            setDisplayYear(todayYear)
          } else {
            setDisplayYear(Math.max(...yearsInTimeline))
          }
        }

        setAllTimelineDays(correctedTimeline)
        cachedTimelineDays = correctedTimeline
        cachedTimelineAt = Date.now()

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
      isFetchingTimeline = false
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
    // Hydrate from prefetch cache instantly if available, then load fresh data
    if (cachedJobs.length > 0) setJobs(cachedJobs)
    if (cachedTimelineMembers.length > 0) setTimelineMembers(cachedTimelineMembers)
    if (cachedTimelineDays.length > 0) setAllTimelineDays(cachedTimelineDays)
    if (cachedSelectedJob && !selectedJob) setSelectedJob(cachedSelectedJob)

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

  // Helpers for sorting
  const parseDeadlineDate = (deadlineStr: string): number => {
    if (!deadlineStr) return Infinity
    // Try matching YYYY-MM-DD first
    const ymdMatch = deadlineStr.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (ymdMatch) {
      return new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3])).getTime()
    }
    // Try matching MM/DD or M/D
    const mdMatch = deadlineStr.match(/(\d{1,2})\/(\d{1,2})/)
    if (mdMatch) {
      const year = new Date().getFullYear()
      return new Date(year, parseInt(mdMatch[1]) - 1, parseInt(mdMatch[2])).getTime()
    }
    return Infinity
  }

  const getJobStatusScore = (j: IJob): number => {
    if (j.total_components > 0 && j.completed_components === j.total_components) {
      return 1 // Complete
    }
    if (j.checking_components > 0) {
      return 2 // For Checking
    }
    if (j.completed_components > 0) {
      return 3 // In Progress
    }
    return 4 // Pending / Not Started
  }

  // Search filter and sort
  const filteredJobs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()
    const result = [...jobs].filter(j => {
      // 1. Search Query filter
      if (query) {
        const matchesJobId = j.job_id.toLowerCase().includes(query)
        const matchesCompCode = j.components?.some(c => 
          c.unit_code.toLowerCase().includes(query)
        )
        if (!matchesJobId && !matchesCompCode) return false
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed') {
          // Completed first/job complete
          const isComplete = j.total_components > 0 && j.completed_components === j.total_components
          if (!isComplete) return false
        } else if (statusFilter === 'checking') {
          // Any checking component
          const isChecking = j.checking_components > 0
          if (!isChecking) return false
        } else if (statusFilter === 'pending') {
          // Any pending/not started component
          const hasPending = j.components?.some(c => {
            const s = (c.status || '').trim().toLowerCase()
            return s !== 'completed' && s !== 'complete' && !s.includes('checking') && s !== '-'
          })
          if (!hasPending) return false
        } else if (statusFilter === 'excluded') {
          // Any excluded/NA component (-)
          const hasExcluded = j.components?.some(c => (c.status || '').trim() === '-')
          if (!hasExcluded) return false
        }
      }

      return true
    })
    if (sortBy === 'deadline-asc') {
      result.sort((a, b) => parseDeadlineDate(a.deadline) - parseDeadlineDate(b.deadline))
    } else if (sortBy === 'deadline-desc') {
      result.sort((a, b) => {
        const valA = parseDeadlineDate(a.deadline)
        const valB = parseDeadlineDate(b.deadline)
        if (valA === Infinity) return 1
        if (valB === Infinity) return -1
        return valB - valA
      })
    } else if (sortBy === 'status') {
      result.sort((a, b) => getJobStatusScore(a) - getJobStatusScore(b))
    } else if (sortBy === 'name-desc') {
      result.sort((a, b) => b.job_id.localeCompare(a.job_id))
    } else if (sortBy === 'name-asc') {
      result.sort((a, b) => a.job_id.localeCompare(b.job_id))
    } else {
      // Default: newest
      result.sort((a, b) => b.id - a.id)
    }
    return result
  }, [jobs, searchQuery, sortBy, statusFilter])

  // Handle excel export
  const handleExport = async (jobIds: string[], targetMonths: string[]) => {
    setIsExporting(true)
    try {
      const data = await scheduleApi.exportToExcel(jobIds, targetMonths)
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'KMTI Work Schedule Monitoring.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
      setIsExportModalOpen(false)
    } catch (err: any) {
      console.error('Export failed:', err)
      const errMsg = err.response?.data?.detail || err.message || 'Unknown error'
      alert(`Failed to export schedule to Excel:\n\n${errMsg}`, 'Export Error', 'warning')
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
        loadJobs(true)
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
          loadJobs(true)
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
      loadJobs(true)
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
    
    // Save previous state for rollback
    const rollbackComponents = [...components]
    const rollbackJobs = [...jobs]
    
    // Construct updated component
    const updatedComp: IComponent = {
      ...editingComponent,
      unit_code: editCompCode,
      assembly_3d: formatPercentInput(editComp3DAssem),
      parts_3d: formatPercentInput(editComp3DParts),
      assembly_2d: formatPercentInput(editComp2DAssem),
      parts_2d: formatPercentInput(editComp2DParts),
      status: editCompStatus,
      submitted_date: editCompDate || null,
      is_postponed: editCompPostponed
    }

    // Optimistically update components state
    setComponents(prev => prev.map(c => c.id === editingComponent.id ? updatedComp : c))
    
    // Optimistically update jobs state so the JobCard changes immediately
    setJobs(prevJobs => prevJobs.map(job => {
      if (job.job_id === editingComponent.job_id) {
        const updatedComps = (job.components || []).map(c => 
          c.id === editingComponent.id ? updatedComp : c
        )
        
        // Re-calculate stats
        const total = updatedComps.filter(c => c.unit_code.toUpperCase().trim() !== "POSTPONED").length
        const completed = updatedComps.filter(c => {
          const s = (c.status || '').trim().toLowerCase()
          return (s === 'completed' || s === 'complete') && c.unit_code.toUpperCase().trim() !== "POSTPONED"
        }).length
        const checking = updatedComps.filter(c => {
          const s = (c.status || '').trim().toLowerCase()
          return s.includes('checking') && c.unit_code.toUpperCase().trim() !== "POSTPONED"
        }).length
        const progress = total > 0 ? (completed / total * 100) : 0.0

        return {
          ...job,
          components: updatedComps,
          total_components: total,
          completed_components: completed,
          checking_components: checking,
          progress_percent: parseFloat(progress.toFixed(1))
        }
      }
      return job
    }))

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
      loadJobs(true)
    } catch (err: any) {
      // Rollback on failure
      setComponents(rollbackComponents)
      setJobs(rollbackJobs)
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
        const rollbackComponents = [...components]
        const rollbackJobs = [...jobs]
        
        // Optimistically update components state
        setComponents(prev => prev.filter(c => c.id !== comp.id))
        
        // Optimistically update jobs state
        setJobs(prevJobs => prevJobs.map(job => {
          if (job.job_id === comp.job_id) {
            const updatedComps = (job.components || []).filter(c => c.id !== comp.id)
            const total = updatedComps.filter(c => c.unit_code.toUpperCase().trim() !== "POSTPONED").length
            const completed = updatedComps.filter(c => {
              const s = (c.status || '').trim().toLowerCase()
              return (s === 'completed' || s === 'complete') && c.unit_code.toUpperCase().trim() !== "POSTPONED"
            }).length
            const checking = updatedComps.filter(c => {
              const s = (c.status || '').trim().toLowerCase()
              return s.includes('checking') && c.unit_code.toUpperCase().trim() !== "POSTPONED"
            }).length
            const progress = total > 0 ? (completed / total * 100) : 0.0

            return {
              ...job,
              components: updatedComps,
              total_components: total,
              completed_components: completed,
              checking_components: checking,
              progress_percent: parseFloat(progress.toFixed(1))
            }
          }
          return job
        }))

        try {
          await scheduleApi.deleteComponent(comp.id)
          if (selectedJob) {
            loadComponents(selectedJob.job_id)
          }
          loadJobs(true)
        } catch (err: any) {
          // Rollback on failure
          setComponents(rollbackComponents)
          setJobs(rollbackJobs)
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
    const rollbackAllTimelineDays = [...allTimelineDays]

    // Optimistically update local state
    setAllTimelineDays(prevDays =>
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
      setAllTimelineDays(rollbackAllTimelineDays)
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
    const todayYear = today.getFullYear()

    return (
      dayObj.month.toLowerCase() === todayMonthName &&
      dayObj.day === todayDayNum &&
      (dayObj.year === undefined || dayObj.year === todayYear)
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
    const rollbackAllTimelineDays = [...allTimelineDays]
    const spanToSave = addingTimelineSpan
    const start = Math.min(spanToSave.startCol, spanToSave.endCol)
    const end = Math.max(spanToSave.startCol, spanToSave.endCol)
    const center = Math.floor((start + end) / 2)

    // Optimistically update local state
    setAllTimelineDays(prevDays =>
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
      setAllTimelineDays(rollbackAllTimelineDays)
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.message
      alert(`Failed to save duration arrow: ${errMsg}`)
    } finally {
      setIsSavingTimelineSpan(false)
    }
  }

  const handleClearTimelineSpan = async () => {
    if (!addingTimelineSpan) return

    setIsSavingTimelineSpan(true)
    const rollbackAllTimelineDays = [...allTimelineDays]
    const spanToClear = addingTimelineSpan
    const start = Math.min(spanToClear.startCol, spanToClear.endCol)
    const end = Math.max(spanToClear.startCol, spanToClear.endCol)

    // Optimistically update local state
    setAllTimelineDays(prevDays =>
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
      setAllTimelineDays(rollbackAllTimelineDays)
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.message
      alert(`Failed to clear range: ${errMsg}`)
    } finally {
      setIsSavingTimelineSpan(false)
    }
  }

  const handleAddEmployee = async (name: string) => {
    const rollbackMembers = [...timelineMembers]
    const rollbackDays = [...allTimelineDays]

    // Optimistic Update
    setTimelineMembers(prev => [...prev, name])
    setAllTimelineDays(prevDays =>
      prevDays.map(day => ({
        ...day,
        assignments: {
          ...day.assignments,
          [name]: ''
        }
      }))
    )

    try {
      const res = await scheduleApi.createMember(name)
      if (res.success) {
        loadTimeline(true)
      } else {
        throw new Error(res.message || "Failed to add employee")
      }
    } catch (err: any) {
      setTimelineMembers(rollbackMembers)
      setAllTimelineDays(rollbackDays)
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to add employee: ${errMsg}`)
    }
  }

  const handleRenameEmployee = async (oldName: string, newName: string) => {
    const rollbackMembers = [...timelineMembers]
    const rollbackDays = [...allTimelineDays]

    // Optimistic Update
    setTimelineMembers(prev => prev.map(m => m === oldName ? newName : m))
    setAllTimelineDays(prevDays =>
      prevDays.map(day => {
        const updatedAss = { ...day.assignments }
        if (oldName in updatedAss) {
          updatedAss[newName] = updatedAss[oldName]
          delete updatedAss[oldName]
        }
        return {
          ...day,
          assignments: updatedAss
        }
      })
    )

    try {
      const res = await scheduleApi.renameMember(oldName, newName)
      if (res.success) {
        loadTimeline(true)
      } else {
        throw new Error(res.message || "Failed to rename employee")
      }
    } catch (err: any) {
      setTimelineMembers(rollbackMembers)
      setAllTimelineDays(rollbackDays)
      const errMsg = err.response?.data?.error || err.message
      alert(`Failed to rename employee: ${errMsg}`)
    }
  }

  const handleDeleteEmployee = async (name: string) => {
    confirm(
      `Are you sure you want to remove employee '${name}' and all their assignments? This cannot be undone.`,
      async () => {
        const rollbackMembers = [...timelineMembers]
        const rollbackDays = [...allTimelineDays]

        // Optimistic Update
        setTimelineMembers(prev => prev.filter(m => m !== name))
        setAllTimelineDays(prevDays =>
          prevDays.map(day => {
            const updatedAss = { ...day.assignments }
            delete updatedAss[name]
            return {
              ...day,
              assignments: updatedAss
            }
          })
        )

        try {
          const res = await scheduleApi.deleteMember(name)
          if (res.success) {
            loadTimeline(true)
          } else {
            throw new Error(res.message || "Failed to delete employee")
          }
        } catch (err: any) {
          setTimelineMembers(rollbackMembers)
          setAllTimelineDays(rollbackDays)
          const errMsg = err.response?.data?.error || err.message
          alert(`Failed to delete employee: ${errMsg}`)
        }
      },
      undefined,
      'danger',
      'Remove Employee',
      'Remove'
    )
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
    isExportModalOpen,
    setIsExportModalOpen,
    timelineMembers,
    timelineDays,
    displayYear,
    setDisplayYear,
    availableYears,
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
    handleClearTimelineSpan,
    handleAddEmployee,
    handleRenameEmployee,
    handleDeleteEmployee,
    isAddingEmployee,
    setIsAddingEmployee,
    renamingEmployee,
    setRenamingEmployee,
    employeeInputName,
    setEmployeeInputName,
    sortBy,
    setSortBy,
    statusFilter,
    setStatusFilter,
    editingJob,
    setEditingJob,
    notifications,
    unreadCount,
    isNotificationPanelOpen,
    setIsNotificationPanelOpen,
    markNotificationsRead,
    deleteNotification,
    deleteAllNotifications
  }
}
