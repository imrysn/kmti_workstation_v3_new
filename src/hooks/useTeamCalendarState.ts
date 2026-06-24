import { useState, useRef } from 'react'
import type { ICalendarEvent, ITodo, IActiveUser, IPendingApproval } from '../services/teamCalendarService'

export function useTeamCalendarState() {
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda' | 'timeline'>('month')
  const [activeSidebarTab, setActiveSidebarTab] = useState<'backlog' | 'claims' | 'completed'>('backlog')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [events, setEvents] = useState<ICalendarEvent[]>([])
  const [backlog, setBacklog] = useState<ITodo[]>([])

  // Workstation Identity Persistence
  const [engineerName, setEngineerName] = useState<string>(
    localStorage.getItem('kmti_engineer_name') || ''
  )

  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('')
  const [showClaims, setShowClaims] = useState(true)
  const [showAbsences, setShowAbsences] = useState(true)
  const [showSpans, setShowSpans] = useState(false)

  // Modals Form State
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

  // Admin Assignment & Approvals State
  const [activeUsers, setActiveUsers] = useState<IActiveUser[]>([])
  const [assigningTask, setAssigningTask] = useState<ITodo | null>(null)
  const [assignUserId, setAssignUserId] = useState('')
  const [assignEngineerName, setAssignEngineerName] = useState('')
  const [assignStartDate, setAssignStartDate] = useState('')
  const [assignEndDate, setAssignEndDate] = useState('')
  const [assignSelectedTodoId, setAssignSelectedTodoId] = useState('')
  const [pendingApprovals, setPendingApprovals] = useState<IPendingApproval[]>([])

  // Modals Selection State
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

  const handleNameChange = (val: string) => {
    setEngineerName(val)
    localStorage.setItem('kmti_engineer_name', val)
  }

  return {
    isLoading,
    setIsLoading,
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
    lastScrollTime,
    confirmingClaim,
    setConfirmingClaim,
    dayOffStart,
    setDayOffStart,
    dayOffEnd,
    setDayOffEnd
  }
}
