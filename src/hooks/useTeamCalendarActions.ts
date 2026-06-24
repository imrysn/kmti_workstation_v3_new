import React from 'react'
import { teamCalendarApi, ICalendarEvent, ITodo } from '../services/teamCalendarService'

interface StateProps {
  user: any
  isAdminOrIT: boolean
  engineerName: string
  newTodoTitle: string
  setNewTodoTitle: (val: string) => void
  newTodoDesc: string
  setNewTodoDesc: (val: string) => void
  newTodoPriority: 'Low' | 'Normal' | 'High' | 'Critical'
  setNewTodoPriority: (val: 'Low' | 'Normal' | 'High' | 'Critical') => void
  dayOffLeaveType: string
  setDayOffLeaveType: (val: string) => void
  setIsAddingTodo: (val: boolean) => void
  setIsAddingDayOff: (val: boolean) => void
  setIsAddingCompanyEvent: (val: boolean) => void
  companyEventTitle: string
  setCompanyEventTitle: (val: string) => void
  companyEventCategory: 'Holiday' | 'Birthday' | 'Outing' | 'Meeting' | 'Other'
  setCompanyEventCategory: (val: 'Holiday' | 'Birthday' | 'Outing' | 'Meeting' | 'Other') => void
  companyEventStart: string
  setCompanyEventStart: (val: string) => void
  companyEventEnd: string
  setCompanyEventEnd: (val: string) => void
  assigningTask: ITodo | null
  setAssigningTask: (val: ITodo | null) => void
  assignUserId: string
  setAssignUserId: (val: string) => void
  assignEngineerName: string
  setAssignEngineerName: (val: string) => void
  assignStartDate: string
  setAssignStartDate: (val: string) => void
  assignEndDate: string
  setAssignEndDate: (val: string) => void
  assignSelectedTodoId: string
  setAssignSelectedTodoId: (val: string) => void
  confirmingClaim: { todo: ITodo; start: string; end: string } | null
  setConfirmingClaim: (val: { todo: ITodo; start: string; end: string } | null) => void
  dayOffStart: string
  setDayOffStart: (val: string) => void
  dayOffEnd: string
  setDayOffEnd: (val: string) => void
  setSelectedEvent: (val: ICalendarEvent | null) => void
  notify: (msg: string, type?: 'success' | 'error' | 'warning') => void
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void, type?: 'primary' | 'danger' | 'info', title?: string, confirmLabel?: string) => void
}

export function useTeamCalendarActions(state: StateProps, loadData: () => Promise<void>) {
  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.newTodoTitle.trim()) return

    try {
      const res = await teamCalendarApi.createTodo(state.newTodoTitle, state.newTodoDesc, state.newTodoPriority)
      if (res.success) {
        state.notify('Task added to backlog pool.', 'success')
        state.setNewTodoTitle('')
        state.setNewTodoDesc('')
        state.setNewTodoPriority('Normal')
        state.setIsAddingTodo(false)
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Failed to create task.', 'error')
    }
  }

  const handleDeleteTodo = async (todoId: number, title: string) => {
    state.confirm(
      `Permanently delete "${title}" from history? This cannot be undone.`,
      async () => {
        try {
          const res = await teamCalendarApi.deleteTodo(todoId)
          if (res.success) {
            state.notify('Task record permanently deleted.', 'success')
            loadData()
          }
        } catch (err: any) {
          state.notify(err.response?.data?.detail || 'Failed to delete task.', 'error')
        }
      },
      undefined,
      'danger',
      'Delete Task Record'
    )
  }

  const handleCompleteTodo = async (todoId: number, title: string) => {
    state.confirm(`Mark "${title}" as Completed?`, async () => {
      try {
        const res = await teamCalendarApi.completeTodo(todoId)
        if (res.success) {
          state.notify('Task marked as completed!', 'success')
          loadData()
        }
      } catch (err: any) {
        state.notify(err.response?.data?.detail || 'Failed to complete task.', 'error')
      }
    })
  }

  const handleRequestDayOffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.dayOffStart || !state.dayOffEnd) return

    try {
      const res = await teamCalendarApi.requestDayOff(
        state.dayOffStart,
        state.dayOffEnd,
        state.dayOffLeaveType,
        undefined,
        state.engineerName || undefined
      )
      if (res.success) {
        if (state.isAdminOrIT) {
          state.notify('Absence scheduled and locked successfully!', 'success')
        } else {
          state.notify('Absence request submitted to Admin for approval.', 'success')
        }
        state.setDayOffStart('')
        state.setDayOffEnd('')
        state.setDayOffLeaveType('Vacation')
        state.setIsAddingDayOff(false)
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Failed to request day off.', 'error')
    }
  }

  const handleCreateCompanyEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.companyEventTitle.trim() || !state.companyEventStart || !state.companyEventEnd) return

    try {
      const res = await teamCalendarApi.createCompanyEvent(
        state.companyEventTitle.trim(),
        state.companyEventCategory,
        state.companyEventStart,
        state.companyEventEnd
      )
      if (res.success) {
        state.notify('Company Event scheduled successfully!', 'success')
        state.setCompanyEventTitle('')
        state.setCompanyEventCategory('Other')
        state.setCompanyEventStart('')
        state.setCompanyEventEnd('')
        state.setIsAddingCompanyEvent(false)
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Failed to schedule company event.', 'error')
    }
  }

  const handleAssignTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.assigningTask || !state.assignUserId || !state.assignStartDate || !state.assignEndDate) return

    const targetTaskId = state.assigningTask.id === -1 ? Number(state.assignSelectedTodoId) : state.assigningTask.id
    if (!targetTaskId) {
      state.notify('Please select a task to assign.', 'warning')
      return
    }

    try {
      const res = await teamCalendarApi.assignTask(
        targetTaskId,
        Number(state.assignUserId),
        state.assignStartDate,
        state.assignEndDate,
        state.assignEngineerName || undefined
      )
      if (res.success) {
        state.notify(`Task successfully assigned to ${state.assignEngineerName || 'engineer'}!`, 'success')
        state.setAssigningTask(null)
        state.setAssignUserId('')
        state.setAssignEngineerName('')
        state.setAssignStartDate('')
        state.setAssignEndDate('')
        state.setAssignSelectedTodoId('')
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Could not assign task.', 'error')
    }
  }

  const handleConfirmClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.confirmingClaim) return

    try {
      const res = await teamCalendarApi.claimTask(
        state.confirmingClaim.todo.id,
        state.confirmingClaim.start,
        state.confirmingClaim.end,
        undefined,
        state.engineerName || undefined
      )
      if (res.success) {
        state.notify(`Task "${state.confirmingClaim.todo.title}" successfully self-claimed!`, 'success')
        state.setConfirmingClaim(null)
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Could not claim task.', 'error')
    }
  }

  const handleCancelEvent = async (event: ICalendarEvent) => {
    const term = event.event_type === 'Task_Claim'
      ? 'task claim'
      : event.event_type === 'Company_Event'
        ? 'company event'
        : 'day off lockout'
    state.confirm(`Cancel this ${term}?`, async () => {
      try {
        const res = await teamCalendarApi.deleteEvent(event.id)
        if (res.success) {
          state.notify(res.message, 'success')
          state.setSelectedEvent(null)
          loadData()
        }
      } catch (err: any) {
        state.notify(err.response?.data?.detail || 'Failed to cancel event.', 'error')
      }
    })
  }

  const handleApproveEvent = async (eventId: number) => {
    try {
      const res = await teamCalendarApi.approveEvent(eventId)
      if (res.success) {
        state.notify('Absence request approved successfully!', 'success')
        state.setSelectedEvent(null)
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Failed to approve event.', 'error')
    }
  }

  return {
    handleCreateTodo,
    handleDeleteTodo,
    handleCompleteTodo,
    handleRequestDayOffSubmit,
    handleCreateCompanyEventSubmit,
    handleAssignTaskSubmit,
    handleConfirmClaimSubmit,
    handleCancelEvent,
    handleApproveEvent
  }
}
