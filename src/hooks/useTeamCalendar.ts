import { useEffect, useCallback, useMemo, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import { useModal } from '../components/ModalContext'
import { teamCalendarApi } from '../services/teamCalendarService'
import { useTeamCalendarState } from './useTeamCalendarState'
import { useTeamCalendarActions } from './useTeamCalendarActions'
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

  // Coordinate custom states hook
  const state = useTeamCalendarState()

  const phHolidays = useMemo(() => {
    return getPhilippineHolidays(state.currentDate.getFullYear())
  }, [state.currentDate])

  // Fetch range helper
  const fetchRange = useMemo(() => {
    const start = new Date(state.currentDate)
    const end = new Date(state.currentDate)

    if (state.viewMode === 'month') {
      const dow = state.currentDate.getDay()
      start.setDate(state.currentDate.getDate() - dow - 21)
      end.setTime(start.getTime())
      end.setDate(start.getDate() + 41)
    } else if (state.viewMode === 'week') {
      const dow = state.currentDate.getDay()
      start.setDate(state.currentDate.getDate() - dow)
      end.setTime(start.getTime())
      end.setDate(start.getDate() + 6)
    } else if (state.viewMode === 'timeline') {
      end.setDate(state.currentDate.getDate() + 13)
    } else {
      end.setDate(state.currentDate.getDate() + 13)
    }

    return {
      start: formatLocalDate(start),
      end: formatLocalDate(end)
    }
  }, [state.currentDate, state.viewMode])

  // API loadData callback
  const loadData = useCallback(async () => {
    try {
      const gridRes = await teamCalendarApi.getGrid(fetchRange.start, fetchRange.end)
      if (gridRes.success) {
        state.setEvents(gridRes.events)
      }

      const todoRes = await teamCalendarApi.getTodos()
      if (todoRes.success) {
        state.setBacklog(todoRes.todos)
      }

      if (isAdminOrIT) {
        const pendingRes = await teamCalendarApi.getPendingApprovals()
        if (pendingRes.success) {
          state.setPendingApprovals(pendingRes.pending)
        }
      }
    } catch (err: any) {
      console.error(err)
      notify('Failed to load team calendar data.', 'error')
    } finally {
      state.setIsLoading(false)
    }
  }, [fetchRange, notify, isAdminOrIT, state.setEvents, state.setBacklog, state.setPendingApprovals, state.setIsLoading])

  // Socket sync
  const loadDataRef = useRef(loadData)
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const socket = io(API_URL, { path: '/socket.io' })

    socket.on('calendar_updated', () => {
      loadDataRef.current()
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Get active users on load
  useEffect(() => {
    if (isAdminOrIT) {
      teamCalendarApi.getActiveUsers()
        .then(res => {
          if (res.success) {
            state.setActiveUsers(res.users)
          }
        })
        .catch(err => console.error("Error loading active users:", err))
    }
  }, [isAdminOrIT, state.setActiveUsers])

  // Coordinate action handler hook
  const actions = useTeamCalendarActions(
    {
      user,
      isAdminOrIT,
      engineerName: state.engineerName,
      newTodoTitle: state.newTodoTitle,
      setNewTodoTitle: state.setNewTodoTitle,
      newTodoDesc: state.newTodoDesc,
      setNewTodoDesc: state.setNewTodoDesc,
      newTodoPriority: state.newTodoPriority,
      setNewTodoPriority: state.setNewTodoPriority,
      dayOffLeaveType: state.dayOffLeaveType,
      setDayOffLeaveType: state.setDayOffLeaveType,
      setIsAddingTodo: state.setIsAddingTodo,
      setIsAddingDayOff: state.setIsAddingDayOff,
      setIsAddingCompanyEvent: state.setIsAddingCompanyEvent,
      companyEventTitle: state.companyEventTitle,
      setCompanyEventTitle: state.setCompanyEventTitle,
      companyEventCategory: state.companyEventCategory,
      setCompanyEventCategory: state.setCompanyEventCategory,
      companyEventStart: state.companyEventStart,
      setCompanyEventStart: state.setCompanyEventStart,
      companyEventEnd: state.companyEventEnd,
      setCompanyEventEnd: state.setCompanyEventEnd,
      assigningTask: state.assigningTask,
      setAssigningTask: state.setAssigningTask,
      assignUserId: state.assignUserId,
      setAssignUserId: state.setAssignUserId,
      assignEngineerName: state.assignEngineerName,
      setAssignEngineerName: state.setAssignEngineerName,
      assignStartDate: state.assignStartDate,
      setAssignStartDate: state.setAssignStartDate,
      assignEndDate: state.assignEndDate,
      setAssignEndDate: state.setAssignEndDate,
      assignSelectedTodoId: state.assignSelectedTodoId,
      setAssignSelectedTodoId: state.setAssignSelectedTodoId,
      confirmingClaim: state.confirmingClaim,
      setConfirmingClaim: state.setConfirmingClaim,
      dayOffStart: state.dayOffStart,
      setDayOffStart: state.setDayOffStart,
      dayOffEnd: state.dayOffEnd,
      setDayOffEnd: state.setDayOffEnd,
      setSelectedEvent: state.setSelectedEvent,
      notify,
      confirm
    },
    loadData
  )

  // Navigate Date
  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(state.currentDate)
    if (direction === 'today') {
      state.setCurrentDate(new Date())
      return
    }

    if (state.viewMode === 'month') {
      if (direction === 'prev') newDate.setMonth(state.currentDate.getMonth() - 1)
      else newDate.setMonth(state.currentDate.getMonth() + 1)
    } else {
      newDate.setDate(state.currentDate.getDate() + (direction === 'prev' ? -7 : 7))
    }
    state.setCurrentDate(newDate)
  }

  // Wheel calendar scroll
  const handleCalendarWheel = (e: React.WheelEvent) => {
    if (state.viewMode !== 'month') return

    const now = Date.now()
    if (now - state.lastScrollTime.current < 200) {
      return
    }

    if (Math.abs(e.deltaY) < 15) {
      return
    }

    const newDate = new Date(state.currentDate)
    if (e.deltaY > 0) {
      newDate.setDate(state.currentDate.getDate() + 7)
      state.setCurrentDate(newDate)
      state.lastScrollTime.current = now
    } else if (e.deltaY < 0) {
      newDate.setDate(state.currentDate.getDate() - 7)
      state.setCurrentDate(newDate)
      state.lastScrollTime.current = now
    }
  }

  const handleCellClick = (day: Date, _dateStr: string) => {
    state.setActivePopoverDate(day)
  }

  const cancelClaimMode = () => {
    state.setClaimingTask(null)
    state.setClaimStartDate(null)
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

  const displayDate = useMemo(() => state.currentDate, [state.currentDate])
  const monthName = displayDate.toLocaleString('default', { month: 'long' })
  const yearNum = displayDate.getFullYear()

  const visibleTaskTypes = useMemo(() => {
    const seen = new Set<TaskType>()
    state.events.forEach(e => {
      if (e.event_type !== 'Task_Claim') return
      seen.add(inferTaskType(e.todo_title, e.todo_description))
    })
    return (Object.keys(TASK_TYPE_COLORS) as TaskType[]).filter(t => seen.has(t))
  }, [state.events])

  const visibleTeams = useMemo(() => {
    const map = new Map<string, string>()
    state.events.forEach(e => {
      if (!e.team || e.team.toLowerCase() === 'general') return
      if (!map.has(e.team)) map.set(e.team, getTeamColor(e.team))
    })
    return Array.from(map.entries()).map(([team, color]) => ({ team, color }))
  }, [state.events])

  const agendaDays = useMemo(() => {
    const days: Date[] = []
    const start = new Date(state.currentDate)
    let checked = new Date(start)
    while (days.length < 14) {
      days.push(new Date(checked))
      checked.setDate(checked.getDate() + 1)
    }
    return days
  }, [state.currentDate])

  const filteredBacklogPending = useMemo(() => {
    const list = state.backlog.filter(
      t =>
        t.status === 'Pending' &&
        t.title.toLowerCase().includes(state.searchTerm.toLowerCase())
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
  }, [state.backlog, state.searchTerm])

  const filteredBacklogClaimed = useMemo(() => {
    return state.backlog.filter(
      t =>
        t.status === 'Claimed' &&
        t.title.toLowerCase().includes(state.searchTerm.toLowerCase())
    )
  }, [state.backlog, state.searchTerm])

  const filteredBacklogCompleted = useMemo(() => {
    return state.backlog.filter(
      t =>
        t.status === 'Completed' &&
        t.title.toLowerCase().includes(state.searchTerm.toLowerCase())
    )
  }, [state.backlog, state.searchTerm])

  return {
    user,
    hasRole,
    isAdminOrIT,
    isLoading: state.isLoading,
    viewMode: state.viewMode,
    setViewMode: state.setViewMode,
    activeSidebarTab: state.activeSidebarTab,
    setActiveSidebarTab: state.setActiveSidebarTab,
    currentDate: state.currentDate,
    setCurrentDate: state.setCurrentDate,
    events: state.events,
    setEvents: state.setEvents,
    backlog: state.backlog,
    setBacklog: state.setBacklog,
    engineerName: state.engineerName,
    handleNameChange: state.handleNameChange,
    searchTerm: state.searchTerm,
    setSearchTerm: state.setSearchTerm,
    showClaims: state.showClaims,
    setShowClaims: state.setShowClaims,
    showAbsences: state.showAbsences,
    setShowAbsences: state.setShowAbsences,
    showSpans: state.showSpans,
    setShowSpans: state.setShowSpans,
    newTodoTitle: state.newTodoTitle,
    setNewTodoTitle: state.setNewTodoTitle,
    newTodoDesc: state.newTodoDesc,
    setNewTodoDesc: state.setNewTodoDesc,
    newTodoPriority: state.newTodoPriority,
    setNewTodoPriority: state.setNewTodoPriority,
    dayOffLeaveType: state.dayOffLeaveType,
    setDayOffLeaveType: state.setDayOffLeaveType,
    isAddingTodo: state.isAddingTodo,
    setIsAddingTodo: state.setIsAddingTodo,
    isAddingDayOff: state.isAddingDayOff,
    setIsAddingDayOff: state.setIsAddingDayOff,
    isAddingCompanyEvent: state.isAddingCompanyEvent,
    setIsAddingCompanyEvent: state.setIsAddingCompanyEvent,
    companyEventTitle: state.companyEventTitle,
    setCompanyEventTitle: state.setCompanyEventTitle,
    companyEventCategory: state.companyEventCategory,
    setCompanyEventCategory: state.setCompanyEventCategory,
    companyEventStart: state.companyEventStart,
    setCompanyEventStart: state.setCompanyEventStart,
    companyEventEnd: state.companyEventEnd,
    setCompanyEventEnd: state.setCompanyEventEnd,
    activeUsers: state.activeUsers,
    setActiveUsers: state.setActiveUsers,
    assigningTask: state.assigningTask,
    setAssigningTask: state.setAssigningTask,
    assignUserId: state.assignUserId,
    setAssignUserId: state.setAssignUserId,
    assignEngineerName: state.assignEngineerName,
    setAssignEngineerName: state.setAssignEngineerName,
    assignStartDate: state.assignStartDate,
    setAssignStartDate: state.setAssignStartDate,
    assignEndDate: state.assignEndDate,
    setAssignEndDate: state.setAssignEndDate,
    assignSelectedTodoId: state.assignSelectedTodoId,
    setAssignSelectedTodoId: state.setAssignSelectedTodoId,
    pendingApprovals: state.pendingApprovals,
    setPendingApprovals: state.setPendingApprovals,
    selectedEvent: state.selectedEvent,
    setSelectedEvent: state.setSelectedEvent,
    claimingTask: state.claimingTask,
    setClaimingTask: state.setClaimingTask,
    claimStartDate: state.claimStartDate,
    setClaimStartDate: state.setClaimStartDate,
    activePopoverDate: state.activePopoverDate,
    setActivePopoverDate: state.setActivePopoverDate,
    confirmingClaim: state.confirmingClaim,
    setConfirmingClaim: state.setConfirmingClaim,
    dayOffStart: state.dayOffStart,
    setDayOffStart: state.setDayOffStart,
    dayOffEnd: state.dayOffEnd,
    setDayOffEnd: state.setDayOffEnd,
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
    handleCreateTodo: actions.handleCreateTodo,
    handleDeleteTodo: actions.handleDeleteTodo,
    handleCompleteTodo: actions.handleCompleteTodo,
    handleRequestDayOffSubmit: actions.handleRequestDayOffSubmit,
    handleCreateCompanyEventSubmit: actions.handleCreateCompanyEventSubmit,
    handleAssignTaskSubmit: actions.handleAssignTaskSubmit,
    handleConfirmClaimSubmit: actions.handleConfirmClaimSubmit,
    handleCancelEvent: actions.handleCancelEvent,
    handleApproveEvent: actions.handleApproveEvent,
    handleCellClick,
    cancelClaimMode,
    navigateDate,
    handleCalendarWheel,
    notify,
    confirm
  }
}
