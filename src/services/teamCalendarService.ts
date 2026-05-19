import api from './api'

export interface ICalendarEvent {
  id: number
  event_type: 'Task_Claim' | 'Day_Off' | 'Company_Event'
  user_id: number
  username: string
  engineer_name: string | null
  todo_id: number | null
  todo_title: string | null
  todo_description: string | null
  todo_priority: string | null
  todo_status: 'Pending' | 'Claimed' | 'Completed' | null
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  status: string
  leave_type: string | null
}

export interface ITodo {
  id: number
  title: string
  description: string | null
  status: 'Pending' | 'Claimed' | 'Completed'
  priority: 'Low' | 'Normal' | 'High' | 'Critical'
  created_at: string | null
}

export interface IActiveUser {
  id: number
  username: string
  role: string
}

export interface IPendingApproval {
  id: number
  user_id: number
  username: string
  engineer_name: string | null
  start_date: string
  end_date: string
  leave_type: string | null
  created_at: string | null
}

export const teamCalendarApi = {
  getGrid: async (startDate: string, endDate: string): Promise<{ success: boolean; events: ICalendarEvent[] }> => {
    const res = await api.get('/team-calendar/grid', {
      params: { start_date: startDate, end_date: endDate }
    })
    return res.data
  },

  getTodos: async (): Promise<{ success: boolean; todos: ITodo[] }> => {
    const res = await api.get('/team-calendar/todos')
    return res.data
  },

  createTodo: async (title: string, description?: string, priority?: string): Promise<{ success: boolean; todo: ITodo }> => {
    const res = await api.post('/team-calendar/todos', { title, description, priority: priority ?? 'Normal' })
    return res.data
  },

  claimTask: async (
    todoId: number,
    startDate: string,
    endDate: string,
    userId?: number,
    engineerName?: string
  ): Promise<{ success: boolean; message: string; event: any }> => {
    const res = await api.post('/team-calendar/claims', {
      todo_id: todoId,
      start_date: startDate,
      end_date: endDate,
      user_id: userId,
      engineer_name: engineerName
    })
    return res.data
  },

  assignTask: async (
    todoId: number,
    targetUserId: number,
    startDate: string,
    endDate: string,
    engineerName?: string
  ): Promise<{ success: boolean; message: string; event: any }> => {
    const res = await api.post('/team-calendar/assignments', {
      todo_id: todoId,
      target_user_id: targetUserId,
      start_date: startDate,
      end_date: endDate,
      engineer_name: engineerName
    })
    return res.data
  },

  requestDayOff: async (
    startDate: string,
    endDate: string,
    leaveType?: string,
    userId?: number,
    engineerName?: string
  ): Promise<{ success: boolean; message: string; event: any }> => {
    const res = await api.post('/team-calendar/absences', {
      start_date: startDate,
      end_date: endDate,
      leave_type: leaveType ?? 'Vacation',
      user_id: userId,
      engineer_name: engineerName
    })
    return res.data
  },

  completeTodo: async (todoId: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/team-calendar/todos/${todoId}/complete`)
    return res.data
  },

  deleteEvent: async (eventId: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/team-calendar/events/${eventId}`)
    return res.data
  },

  approveEvent: async (eventId: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/team-calendar/events/${eventId}/approve`)
    return res.data
  },

  getActiveUsers: async (): Promise<{ success: boolean; users: IActiveUser[] }> => {
    const res = await api.get('/team-calendar/active-users')
    return res.data
  },

  getPendingApprovals: async (): Promise<{ success: boolean; count: number; pending: IPendingApproval[] }> => {
    const res = await api.get('/team-calendar/pending-approvals')
    return res.data
  },

  createCompanyEvent: async (
    title: string,
    category: string,
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; message: string; event: any }> => {
    const res = await api.post('/team-calendar/company-events', {
      title,
      category,
      start_date: startDate,
      end_date: endDate
    })
    return res.data
  },

  deleteTodo: async (todoId: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/team-calendar/todos/${todoId}`)
    return res.data
  },
}
