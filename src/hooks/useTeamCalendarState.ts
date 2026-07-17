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

  // Modals Visibility State
  const [isAddingTodo, setIsAddingTodo] = useState(false)
  const [isAddingDayOff, setIsAddingDayOff] = useState(false)
  const [isAddingCompanyEvent, setIsAddingCompanyEvent] = useState(false)

  // Admin Assignment & Approvals State
  const [activeUsers, setActiveUsers] = useState<IActiveUser[]>([])
  const [assigningTask, setAssigningTask] = useState<ITodo | null>(null)
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
    isAddingTodo,
    setIsAddingTodo,
    isAddingDayOff,
    setIsAddingDayOff,
    isAddingCompanyEvent,
    setIsAddingCompanyEvent,
    activeUsers,
    setActiveUsers,
    assigningTask,
    setAssigningTask,
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
    setConfirmingClaim
  }
}
