import React from 'react'
import { teamCalendarApi, ICalendarEvent, ITodo } from '../services/teamCalendarService'

interface StateProps {
  user: any
  isAdminOrIT: boolean
  engineerName: string
  setIsAddingTodo: (val: boolean) => void
  setIsAddingDayOff: (val: boolean) => void
  setIsAddingCompanyEvent: (val: boolean) => void
  assigningTask: ITodo | null
  setAssigningTask: (val: ITodo | null) => void
  confirmingClaim: { todo: ITodo; start: string; end: string } | null
  setConfirmingClaim: (val: { todo: ITodo; start: string; end: string } | null) => void
  setSelectedEvent: (val: ICalendarEvent | null) => void
  notify: (msg: string, type?: 'success' | 'error' | 'warning') => void
  confirm: (message: string, onConfirm: () => void, onCancel?: () => void, type?: 'primary' | 'danger' | 'info', title?: string, confirmLabel?: string) => void
}

export function useTeamCalendarActions(state: StateProps, loadData: () => Promise<void>) {
  const handleCreateTodo = async (title: string, desc: string, priority: 'Low' | 'Normal' | 'High' | 'Critical') => {
    if (!title.trim()) return

    try {
      const res = await teamCalendarApi.createTodo(title, desc, priority)
      if (res.success) {
        state.notify('Task added to backlog pool.', 'success')
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

  const handleRequestDayOffSubmit = async (start: string, end: string, leaveType: string, engName: string) => {
    if (!start || !end) return

    try {
      const res = await teamCalendarApi.requestDayOff(
        start,
        end,
        leaveType,
        undefined,
        engName || undefined
      )
      if (res.success) {
        if (state.isAdminOrIT) {
          state.notify('Absence scheduled and locked successfully!', 'success')
        } else {
          state.notify('Absence request submitted to Admin for approval.', 'success')
        }
        state.setIsAddingDayOff(false)
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Failed to request day off.', 'error')
    }
  }

  const handleCreateCompanyEventSubmit = async (title: string, category: 'Holiday' | 'Birthday' | 'Outing' | 'Meeting' | 'Other', start: string, end: string) => {
    if (!title.trim() || !start || !end) return

    try {
      const res = await teamCalendarApi.createCompanyEvent(
        title.trim(),
        category,
        start,
        end
      )
      if (res.success) {
        state.notify('Company Event scheduled successfully!', 'success')
        state.setIsAddingCompanyEvent(false)
        loadData()
      }
    } catch (err: any) {
      state.notify(err.response?.data?.detail || 'Failed to schedule company event.', 'error')
    }
  }

  const handleAssignTaskSubmit = async (taskId: number, userId: number, startDate: string, endDate: string, engName: string) => {
    if (!taskId || !userId || !startDate || !endDate) return

    try {
      const res = await teamCalendarApi.assignTask(
        taskId,
        userId,
        startDate,
        endDate,
        engName || undefined
      )
      if (res.success) {
        state.notify(`Task successfully assigned to ${engName || 'engineer'}!`, 'success')
        state.setAssigningTask(null)
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
