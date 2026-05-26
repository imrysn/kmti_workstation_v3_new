import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import { useModal } from '../components/ModalContext'
import { teamCalendarApi, ICalendarEvent, ITodo, IActiveUser, IPendingApproval } from '../services/teamCalendarService'
import {
  formatLocalDate,
  getPhilippineHolidays,
  inferTaskType,
  getTeamColor,
  TASK_TYPE_COLORS,
  type TaskType
} from '../utils/teamCalendarUtils'

export function useTeamCalendar() {
  const { user, hasRole } = useAuth()
  const { notify, confirm } = useModal()

  const isAdminOrIT = hasRole('admin', 'it')

  // --- Layout & Network State ---
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda' | 'timeline'>('month')
  const [activeSidebarTab, setActiveSidebarTab] = useState<'backlog' | 'claims' | 'completed'>('backlog')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [events, setEvents] = useState<ICalendarEvent[]>([])
  const [backlog, setBacklog] = useState<ITodo[]>([])

  // --- Workstation Identity Persistence ---
  const [engineerName, setEngineerName] = useState<string>(
    localStorage.getItem('kmti_engineer_name') || ''
  )

  // --- Search & Filters State ---
  const [searchTerm, setSearchTerm] = useState('')
  const [showClaims, setShowClaims] = useState(true)
  const [showAbsences, setShowAbsences] = useState(true)
  const [showSpans, setShowSpans] = useState(false)

  // --- Modals Form State ---
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoDesc, setNewTodoDesc] = useState('')
  const [newTodoPriority, setNewTodoPriority] = useState<'Low' | 'Normal' | 'High' | 'Critical'>('Normal')
  const [dayOffLeaveType, setDayOffLeaveType] = useState<string>('Vacation')
  const [isAddingTodo, setIsAddingTodo] = useState(false)
  const [isAddingDayOff, setIsAddingDayOff] = useState(false)
  const [isAddingCompanyEvent, setIsAddingCompanyEvent] = useState(false)
  const [companyEventTitle, setCompanyEventTitle] = useState('')
  const [companyEventCategory, setCompanyEventCategory] = useState<'Holiday' | 'Birthday' | 'Outing' | 'Meeting' | 'Other'>('Other')
  const [companyEventStart, setCompanyEventStart] = useState('')
  const [companyEventEnd, setCompanyEventEnd] = useState('')

  // --- Admin Assignment & Approvals State ---
  const [activeUsers, setActiveUsers] = useState<IActiveUser[]>([])
  const [assigningTask, setAssigningTask] = useState<ITodo | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignEngineerName, setAssignEngineerName] = useState('')
  const [assignStartDate, setAssignStartDate] = useState('')
  const [assignEndDate, setAssignEndDate] = useState('')
  const [assignSelectedTodoId, setAssignSelectedTodoId] = useState('')
  const [pendingApprovals, setPendingApprovals] = useState<IPendingApproval[]>([])

  // --- Modals Selection State ---
  const [selectedEvent, setSelectedEvent] = useState<ICalendarEvent | null>(null)

  // Interactive Claim Mode State
  const [claimingTask, setClaimingTask] = useState<ITodo | null>(null)
  const [claimStartDate, setClaimStartDate] = useState<string | null>(null)
  const [activePopoverDate, setActivePopoverDate] = useState<Date | null>(null)
  const lastScrollTime = useRef<number>(0)

  // Claim Confirmation Modal State
  const [confirmingClaim, setConfirmingClaim] = useState<{
    todo: ITodo
    start: string
    end: string
  } | null>(null)

  // Day Off Dates
  const [dayOffStart, setDayOffStart] = useState('')
  const [dayOffEnd, setDayOffEnd] = useState('')

  const phHolidays = useMemo(() => {
    return getPhilippineHolidays(currentDate.getFullYear())
  }, [currentDate])

  // Sync engineer name input directly into localStorage
  const handleNameChange = (val: string) => {
    setEngineerName(val)
    localStorage.setItem('kmti_engineer_name', val)
  }

  // --- Fetch date range derived from current grid ---
  const fetchRange = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    if (viewMode === 'month') {
      const dow = currentDate.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      start.setDate(currentDate.getDate() - dow - 21) // Go back 3 weeks from Sunday of current week
      end.setTime(start.getTime())
      end.setDate(start.getDate() + 41) // 6 full weeks (42 days)
    } else if (viewMode === 'week') {
      const dow = currentDate.getDay()
      start.setDate(currentDate.getDate() - dow) // Sunday of current week
      end.setTime(start.getTime())
      end.setDate(start.getDate() + 6) // Sunday to Saturday (7 days)
    } else if (viewMode === 'timeline') {
      end.setDate(currentDate.getDate() + 13) // Rolling 14 days
    } else {
      // Agenda: 14 calendar days from currentDate
      end.setDate(currentDate.getDate() + 13)
    }

    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end)
    }
  }, [currentDate, viewMode])

  // --- API Load Data ---
  const isFirstLoad = useRef(true)
  
  const loadData = useCallback(async () => {
    if (isFirstLoad.current) {
      setIsLoading(true)
    }
    
    try {
      const gridRes = await teamCalendarApi.getGrid(fetchRange.start, fetchRange.end)
      if (gridRes.success) {
        setEvents(gridRes.events)
      }

      const todoRes = await teamCalendarApi.getTodos()
      if (todoRes.success) {
        setBacklog(todoRes.todos)
      }

      if (isAdminOrIT) {
        const pendingRes = await teamCalendarApi.getPendingApprovals()
        if (pendingRes.success) {
          setPendingApprovals(pendingRes.pending)
        }
      }
    } catch (err: any) {
      console.error(err)
      notify('Failed to load team calendar data.', 'error')
    } finally {
      setIsLoading(false)
      isFirstLoad.current = false
    }
  }, [fetchRange, notify, isAdminOrIT])

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const socket = io(API_URL, { path: '/socket.io' })

    socket.on('calendar_updated', () => {
      loadData()
    })

    return () => {
      socket.disconnect()
    }
  }, [loadData])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (isAdminOrIT) {
      teamCalendarApi.getActiveUsers()
        .then(res => {
          if (res.success) {
            setActiveUsers(res.users)
          }
        })
        .catch(err => console.error("Error loading active users:", err))
    }
  }, [isAdminOrIT])

  // --- Actions ---

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoTitle.trim()) return

    try {
      const res = await teamCalendarApi.createTodo(newTodoTitle, newTodoDesc, newTodoPriority)
      if (res.success) {
        notify('Task added to backlog pool.', 'success')
        setNewTodoTitle('')
        setNewTodoDesc('')
        setNewTodoPriority('Normal')
        setIsAddingTodo(false)
        loadData()
      }
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Failed to create task.', 'error')
    }
  }

  const handleDeleteTodo = async (todoId: number, title: string) => {
    confirm(
      `Permanently delete "${title}" from history? This cannot be undone.`,
      async () => {
        try {
          const res = await teamCalendarApi.deleteTodo(todoId)
          if (res.success) {
            notify('Task record permanently deleted.', 'success')
            loadData()
          }
        } catch (err: any) {
          notify(err.response?.data?.detail || 'Failed to delete task.', 'error')
        }
      },
      undefined,
      'danger',
      'Delete Task Record'
    )
  }

  const handleCompleteTodo = async (todoId: number, title: string) => {
    confirm(`Mark "${title}" as Completed?`, async () => {
      try {
        const res = await teamCalendarApi.completeTodo(todoId)
        if (res.success) {
          notify('Task marked as completed!', 'success')
          loadData()
        }
      } catch (err: any) {
        notify(err.response?.data?.detail || 'Failed to complete task.', 'error')
      }
    })
  }

  const handleRequestDayOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dayOffStart || !dayOffEnd) return

    try {
      const res = await teamCalendarApi.requestDayOff(
        dayOffStart,
        dayOffEnd,
        dayOffLeaveType,
        undefined, // user_id will default to server's authenticated token
        engineerName || undefined
      )
      if (res.success) {
        if (isAdminOrIT) {
          notify('Absence scheduled and locked successfully!', 'success')
        } else {
          notify('Absence request submitted to Admin for approval.', 'success')
        }
        setDayOffStart('')
        setDayOffEnd('')
        setDayOffLeaveType('Vacation')
        setIsAddingDayOff(false)
        loadData()
      }
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Failed to request day off.', 'error')
    }
  }

  const handleCreateCompanyEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyEventTitle.trim() || !companyEventStart || !companyEventEnd) return

    try {
      const res = await teamCalendarApi.createCompanyEvent(
        companyEventTitle.trim(),
        companyEventCategory,
        companyEventStart,
        companyEventEnd
      )
      if (res.success) {
        notify('Company Event scheduled successfully!', 'success')
        setCompanyEventTitle('')
        setCompanyEventCategory('Other')
        setCompanyEventStart('')
        setCompanyEventEnd('')
        setIsAddingCompanyEvent(false)
        loadData()
      }
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Failed to schedule company event.', 'error')
    }
  }

  const handleAssignTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningTask || !assignUserId || !assignStartDate || !assignEndDate) return

    const targetTaskId = assigningTask.id === -1 ? Number(assignSelectedTodoId) : assigningTask.id
    if (!targetTaskId) {
      notify('Please select a task to assign.', 'warning')
      return
    }

    try {
      const res = await teamCalendarApi.assignTask(
        targetTaskId,
        Number(assignUserId),
        assignStartDate,
        assignEndDate,
        assignEngineerName || undefined
      )
      if (res.success) {
        notify(`Task successfully assigned to ${assignEngineerName || 'engineer'}!`, 'success')
        setAssigningTask(null)
        setAssignUserId('')
        setAssignEngineerName('')
        setAssignStartDate('')
        setAssignEndDate('')
        setAssignSelectedTodoId('')
        loadData()
      }
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Could not assign task.', 'error')
    }
  }

  const handleConfirmClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmingClaim) return

    try {
      const res = await teamCalendarApi.claimTask(
        confirmingClaim.todo.id,
        confirmingClaim.start,
        confirmingClaim.end,
        undefined, // user_id defaults to token
        engineerName || undefined
      )
      if (res.success) {
        notify(`Task "${confirmingClaim.todo.title}" successfully self-claimed!`, 'success')
        setConfirmingClaim(null)
        loadData()
      }
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Could not claim task.', 'error')
    }
  }

  const handleCancelEvent = async (event: ICalendarEvent) => {
    const term = event.event_type === 'Task_Claim'
      ? 'task claim'
      : event.event_type === 'Company_Event'
        ? 'company event'
        : 'day off lockout'
    confirm(`Cancel this ${term}?`, async () => {
      try {
        const res = await teamCalendarApi.deleteEvent(event.id)
        if (res.success) {
          notify(res.message, 'success')
          setSelectedEvent(null)
          loadData()
        }
      } catch (err: any) {
        notify(err.response?.data?.detail || 'Failed to cancel event.', 'error')
      }
    })
  }

  const handleApproveEvent = async (eventId: number) => {
    try {
      const res = await teamCalendarApi.approveEvent(eventId)
      if (res.success) {
        notify('Absence request approved successfully!', 'success')
        setSelectedEvent(null)
        loadData()
      }
    } catch (err: any) {
      notify(err.response?.data?.detail || 'Failed to approve event.', 'error')
    }
  }

  // --- Click Grid Cell ---
  const handleCellClick = (day: Date, _dateStr: string) => {
    setActivePopoverDate(day)
  }

  const cancelClaimMode = () => {
    setClaimingTask(null)
    setClaimStartDate(null)
  }

  // --- Calendar Date Grid List ---
  const calendarDays = useMemo(() => {
    const days: Date[] = []
    const start = new Date(fetchRange.start)
    const end = new Date(fetchRange.end)
    let current = new Date(start)
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }, [fetchRange])

  const displayDate = useMemo(() => {
    if (viewMode === 'month' && calendarDays.length > 0) {
      const monthCounts: Record<string, { count: number; date: Date }> = {}

      calendarDays.forEach(day => {
        const key = `${day.getFullYear()}-${day.getMonth()}`
        if (!monthCounts[key]) {
          monthCounts[key] = { count: 0, date: day }
        }
        monthCounts[key].count++
      })

      let dominantKey = ''
      let maxCount = -1

      Object.keys(monthCounts).forEach(key => {
        if (monthCounts[key].count > maxCount) {
          maxCount = monthCounts[key].count
          dominantKey = key
        }
      })

      return monthCounts[dominantKey]?.date || currentDate
    }
    return currentDate
  }, [calendarDays, currentDate, viewMode])

  const monthName = displayDate.toLocaleString('default', { month: 'long' })
  const yearNum = displayDate.getFullYear()

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate)
    if (direction === 'today') {
      setCurrentDate(new Date())
      return
    }

    if (viewMode === 'month') {
      if (direction === 'prev') newDate.setMonth(currentDate.getMonth() - 1)
      else newDate.setMonth(currentDate.getMonth() + 1)
    } else {
      newDate.setDate(currentDate.getDate() + (direction === 'prev' ? -7 : 7))
    }
    setCurrentDate(newDate)
  }

  const handleCalendarWheel = (e: React.WheelEvent) => {
    if (viewMode !== 'month') return

    const now = Date.now()
    if (now - lastScrollTime.current < 200) {
      return
    }

    if (Math.abs(e.deltaY) < 15) {
      return
    }

    const newDate = new Date(currentDate)
    if (e.deltaY > 0) {
      newDate.setDate(currentDate.getDate() + 7)
      setCurrentDate(newDate)
      lastScrollTime.current = now
    } else if (e.deltaY < 0) {
      newDate.setDate(currentDate.getDate() - 7)
      setCurrentDate(newDate)
      lastScrollTime.current = now
    }
  }

  const visibleTaskTypes = useMemo(() => {
    const seen = new Set<TaskType>()
    events.forEach(e => {
      if (e.event_type !== 'Task_Claim') return
      seen.add(inferTaskType(e.todo_title, e.todo_description))
    })
    return (Object.keys(TASK_TYPE_COLORS) as TaskType[]).filter(t => seen.has(t))
  }, [events])

  const visibleTeams = useMemo(() => {
    const map = new Map<string, string>()
    events.forEach(e => {
      if (!e.team || e.team.toLowerCase() === 'general') return
      if (!map.has(e.team)) map.set(e.team, getTeamColor(e.team))
    })
    return Array.from(map.entries()).map(([team, color]) => ({ team, color }))
  }, [events])

  const agendaDays = useMemo(() => {
    const days: Date[] = []
    const start = new Date(currentDate)
    let checked = new Date(start)
    while (days.length < 14) {
      days.push(new Date(checked))
      checked.setDate(checked.getDate() + 1)
    }
    return days
  }, [currentDate])

  const filteredBacklogPending = useMemo(() => {
    const list = backlog.filter(
      t =>
        t.status === 'Pending' &&
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    const priorityWeights: Record<string, number> = { Critical: 4, High: 3, Normal: 2, Low: 1 }
    return list.sort((a, b) => {
      const wa = priorityWeights[a.priority] || 2
      const wb = priorityWeights[b.priority] || 2
      if (wa !== wb) return wb - wa
      const da = a.created_at ? new Date(a.created_at).getTime() : 0
      const db = b.created_at ? new Date(b.created_at).getTime() : 0
      return db - da
    })
  }, [backlog, searchTerm])

  const filteredBacklogClaimed = useMemo(() => {
    return backlog.filter(
      t =>
        t.status === 'Claimed' &&
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [backlog, searchTerm])

  const filteredBacklogCompleted = useMemo(() => {
    return backlog.filter(
      t =>
        t.status === 'Completed' &&
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [backlog, searchTerm])

  return {
    user,
    hasRole,
    isAdminOrIT,
    isLoading,
    viewMode,
    setViewMode,
    activeSidebarTab,
    setActiveSidebarTab,
    currentDate,
    setCurrentDate,
    events,
    setEvents,
    backlog,
    setBacklog,
    engineerName,
    handleNameChange,
    searchTerm,
    setSearchTerm,
    showClaims,
    setShowClaims,
    showAbsences,
    setShowAbsences,
    showSpans,
    setShowSpans,
    newTodoTitle,
    setNewTodoTitle,
    newTodoDesc,
    setNewTodoDesc,
    newTodoPriority,
    setNewTodoPriority,
    dayOffLeaveType,
    setDayOffLeaveType,
    isAddingTodo,
    setIsAddingTodo,
    isAddingDayOff,
    setIsAddingDayOff,
    isAddingCompanyEvent,
    setIsAddingCompanyEvent,
    companyEventTitle,
    setCompanyEventTitle,
    companyEventCategory,
    setCompanyEventCategory,
    companyEventStart,
    setCompanyEventStart,
    companyEventEnd,
    setCompanyEventEnd,
    activeUsers,
    setActiveUsers,
    assigningTask,
    setAssigningTask,
    assignUserId,
    setAssignUserId,
    assignEngineerName,
    setAssignEngineerName,
    assignStartDate,
    setAssignStartDate,
    assignEndDate,
    setAssignEndDate,
    assignSelectedTodoId,
    setAssignSelectedTodoId,
    pendingApprovals,
    setPendingApprovals,
    selectedEvent,
    setSelectedEvent,
    claimingTask,
    setClaimingTask,
    claimStartDate,
    setClaimStartDate,
    activePopoverDate,
    setActivePopoverDate,
    confirmingClaim,
    setConfirmingClaim,
    dayOffStart,
    setDayOffStart,
    dayOffEnd,
    setDayOffEnd,
    phHolidays,
    fetchRange,
    calendarDays,
    displayDate,
    monthName,
    yearNum,
    visibleTaskTypes,
    visibleTeams,
    agendaDays,
    filteredBacklogPending,
    filteredBacklogClaimed,
    filteredBacklogCompleted,
    loadData,
    handleCreateTodo,
    handleDeleteTodo,
    handleCompleteTodo,
    handleRequestDayOffSubmit,
    handleCreateCompanyEventSubmit,
    handleAssignTaskSubmit,
    handleConfirmClaimSubmit,
    handleCancelEvent,
    handleApproveEvent,
    handleCellClick,
    cancelClaimMode,
    navigateDate,
    handleCalendarWheel,
    notify
  }
}
