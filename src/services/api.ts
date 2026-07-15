/// <reference types="vite/client" />
import axios from 'axios'
import type { IProject, IQuotation, IQuotationHistory, ICustomPage, ICustomMapping, IMachineName } from '../types'

export const SERVER_BASE = (() => {
  const override = typeof localStorage !== 'undefined' ? localStorage.getItem('KMTI_SERVER_OVERRIDE') : null
  if (override) return override
  // Dev mode checks VITE_API_DEV_URL first, falling back to localhost:8000
  if (import.meta.env.DEV) return import.meta.env.VITE_API_DEV_URL || 'http://localhost:8000'
  return import.meta.env.VITE_API_PROD_URL || 'http://192.168.200.105:8000'
})()
export const API_BASE = `${SERVER_BASE}/api`

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
})

/**
 * Inject the JWT token on every request.
 * The token is stored in module-level state (set by AuthContext via setApiToken).
 * This avoids needing React context inside the axios instance.
 */
let _token: string | null = null
let _socketId: string | null = null

export function setApiToken(token: string | null) {
  _token = token
}

export function setApiSocketId(socketId: string | null) {
  _socketId = socketId
}

api.interceptors.request.use((config) => {
  if (_token) {
    config.headers = config.headers ?? {}
    config.headers['Authorization'] = `Bearer ${_token}`
  }
  if (_socketId) {
    config.headers = config.headers ?? {}
    config.headers['X-Socket-ID'] = _socketId
  }
  return config
})

/**
 * Global 401 handler — clears the token so the app re-renders the login screen.
 * Import and call onUnauthorized(cb) once from AuthContext.
 */
type UnauthorizedCallback = () => void
let _onUnauthorized: UnauthorizedCallback | null = null

export function onUnauthorized(cb: UnauthorizedCallback) {
  _onUnauthorized = cb
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && _onUnauthorized) {
      _onUnauthorized()
    }
    return Promise.reject(err)
  }
)

// --- Purchased Parts ---
export const partsApi = {
  getProjects: (category?: string) =>
    api.get<IProject[]>('/parts/projects', { params: { category } }),
  addProject: (name: string, rootPath: string, category: string = 'PROJECTS') =>
    api.post('/parts/projects', { name, root_path: rootPath, category }),
  deleteProject: (id: number) => api.delete(`/parts/projects/${id}`),
  deleteCategoryProjects: (category: string) =>
    api.delete(`/parts/projects/category/${category}`),
  scanProject: (id: number) => api.post(`/parts/projects/${id}/scan`),
  listParts: (
    projectId?: number,
    search?: string,
    caseSensitive?: boolean,
    cadOnly?: boolean,
    includeFolders?: boolean,
    folderPath?: string,
    recursive: boolean = true,
    limit: number = 1000,
    offset: number = 0
  ) =>
    api.get('/parts/', {
      params: {
        project_id: projectId,
        search,
        case_sensitive: caseSensitive,
        cad_only: cadOnly,
        include_folders: includeFolders,
        folder_path: folderPath,
        recursive,
        limit,
        offset
      },
    }),
  downloadPart: (fileId: number) =>
    api.get('/parts/download', { params: { file_id: fileId }, responseType: 'blob' }),
  deleteItem: (fileId: number) => api.delete(`/parts/${fileId}`),
  getTree: (projectId: number, parentPath?: string) => 
    api.get(`/parts/tree/${projectId}`, { params: { parent_path: parentPath } }),
  getSuggestions: (q: string, parentPath?: string) => 
    api.get<string[]>(`/parts/suggest`, { params: { q, parent_path: parentPath } }).then(r => r.data),
  getCategories: () => api.get<string[]>('/parts/categories').then(r => r.data),
}

// --- Character Search (Drafting Notes) ---
export const charsApi = {
  search: async (q: string, limit: number = 50, offset: number = 0, signal?: AbortSignal) => {
    try {
      return await api.get('/chars/', { params: { q, limit, offset }, signal })
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_chars')
      if (cachedStr) {
        const all = JSON.parse(cachedStr)
        const term = q.toLowerCase().trim()
        const filtered = all.filter((c: any) =>
          c.englishChar.toLowerCase().includes(term) ||
          c.japaneseChar.toLowerCase().includes(term)
        )
        return { data: filtered.slice(offset, offset + limit) }
      }
      throw err
    }
  },
  create: (data: { englishChar: string; japaneseChar: string }) =>
    api.post('/chars/', data),
  update: (id: number, data: { englishChar?: string; japaneseChar?: string }) =>
    api.patch(`/chars/${id}`, data),
  delete: (id: number) => api.delete(`/chars/${id}`),
  getHeatTreatmentCategories: async () => {
    try {
      return await api.get('/chars/heat-treatment/categories')
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_heat_treatment')
      if (cachedStr) {
        const all = JSON.parse(cachedStr)
        const categories = Array.from(new Set(all.map((h: any) => h.category))).filter(Boolean)
        return { data: categories }
      }
      throw err
    }
  },
  getHeatTreatment: async (category?: string, q?: string, limit: number = 50, offset: number = 0) => {
    try {
      return await api.get('/chars/heat-treatment', { params: { category, q, limit, offset } })
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_heat_treatment')
      if (cachedStr) {
        let filtered = JSON.parse(cachedStr)
        if (category) {
          filtered = filtered.filter((h: any) => h.category === category)
        }
        if (q) {
          const term = q.toLowerCase().trim()
          filtered = filtered.filter((h: any) =>
            h.englishChar.toLowerCase().includes(term) ||
            h.japaneseChar.toLowerCase().includes(term)
          )
        }
        return { data: filtered.slice(offset, offset + limit) }
      }
      throw err
    }
  },
  createHeatTreatment: (data: { category: string; englishChar: string; japaneseChar: string }) =>
    api.post('/chars/heat-treatment', data),
  updateHeatTreatment: (id: number, data: { category?: string; englishChar?: string; japaneseChar?: string }) =>
    api.patch(`/chars/heat-treatment/${id}`, data),
  deleteHeatTreatment: (id: number) => api.delete(`/chars/heat-treatment/${id}`),
}

// --- Materials ---
export const materialsApi = {
  list: async (q?: string, limit: number = 50, offset: number = 0) => {
    try {
      return await api.get('/materials/', { params: { q, limit, offset } })
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_materials')
      if (cachedStr) {
        let filtered = JSON.parse(cachedStr)
        if (q) {
          const term = q.toLowerCase().trim()
          filtered = filtered.filter((m: any) =>
            m.englishName.toLowerCase().includes(term) ||
            m.japaneseName.toLowerCase().includes(term)
          )
        }
        return { data: filtered.slice(offset, offset + limit) }
      }
      throw err
    }
  },
  create: (data: { englishName: string; japaneseName: string }) =>
    api.post('/materials/', data),
  update: (id: number, data: { englishName?: string; japaneseName?: string }) =>
    api.patch(`/materials/${id}`, data),
  delete: (id: number) => api.delete(`/materials/${id}`),
}

// --- Designers ---
export const designersApi = {
  getCategories: async () => {
    try {
      return await api.get('/designers/categories')
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_designers')
      if (cachedStr) {
        const all = JSON.parse(cachedStr)
        const categories = Array.from(new Set(all.map((d: any) => d.category))).filter(Boolean)
        return { data: categories }
      }
      throw err
    }
  },
  list: async (category?: string, q?: string, limit: number = 50, offset: number = 0) => {
    try {
      return await api.get('/designers', { params: { category, q, limit, offset } })
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_designers')
      if (cachedStr) {
        let filtered = JSON.parse(cachedStr)
        if (category) {
          filtered = filtered.filter((d: any) => d.category === category)
        }
        if (q) {
          const term = q.toLowerCase().trim()
          filtered = filtered.filter((d: any) =>
            d.englishName.toLowerCase().includes(term) ||
            (d.japaneseName && d.japaneseName.toLowerCase().includes(term))
          )
        }
        return { data: filtered.slice(offset, offset + limit) }
      }
      throw err
    }
  },
  create: (data: { category?: string; englishName?: string; email?: string; japaneseName?: string }) =>
    api.post('/designers', data),
  update: (id: number, data: { category?: string; englishName?: string; email?: string; japaneseName?: string }) =>
    api.patch(`/designers/${id}`, data),
  delete: (id: number) => api.delete(`/designers/${id}`),
}

// --- Clients ---
export const clientsApi = {
  list: async (category?: string, q?: string, limit: number = 50, offset: number = 0) => {
    try {
      return await api.get('/clients', { params: { category, q, limit, offset } })
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_clients')
      if (cachedStr) {
        let filtered = JSON.parse(cachedStr)
        if (category) {
          filtered = filtered.filter((c: any) => c.category === category)
        }
        if (q) {
          const term = q.toLowerCase().trim()
          filtered = filtered.filter((c: any) =>
            c.englishName.toLowerCase().includes(term) ||
            (c.japaneseName && c.japaneseName.toLowerCase().includes(term))
          )
        }
        return { data: filtered.slice(offset, offset + limit) }
      }
      throw err
    }
  },
  create: (data: { category?: string; englishName?: string; email?: string; japaneseName?: string }) =>
    api.post('/clients', data),
  update: (id: number, data: { category?: string; englishName?: string; email?: string; japaneseName?: string }) =>
    api.patch(`/clients/${id}`, data),
  delete: (id: number) => api.delete(`/clients/${id}`),
}

// --- Project Incharges ---
export const projectInchargesApi = {
  list: async (category?: string, q?: string, limit: number = 50, offset: number = 0) => {
    try {
      return await api.get('/project-incharges', { params: { category, q, limit, offset } })
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_project_incharges')
      if (cachedStr) {
        let filtered = JSON.parse(cachedStr)
        if (category) {
          filtered = filtered.filter((c: any) => c.category === category)
        }
        if (q) {
          const term = q.toLowerCase().trim()
          filtered = filtered.filter((c: any) =>
            c.englishName.toLowerCase().includes(term) ||
            (c.japaneseName && c.japaneseName.toLowerCase().includes(term))
          )
        }
        return { data: filtered.slice(offset, offset + limit) }
      }
      throw err
    }
  },
  create: (data: { category?: string; englishName?: string; email?: string; japaneseName?: string }) =>
    api.post('/project-incharges', data),
  update: (id: number, data: { category?: string; englishName?: string; email?: string; japaneseName?: string }) =>
    api.patch(`/project-incharges/${id}`, data),
  delete: (id: number) => api.delete(`/project-incharges/${id}`),
}

// --- Settings ---
export const settingsApi = {
  get: () => api.get('/settings/'),
  save: (settings: object) => api.post('/settings/', settings),
  clearCache: () => api.delete('/settings/cache'),
  updateApp: () => api.post('/settings/update-app'),
  updateDisplayName: (displayName: string) => api.put('/settings/display-name', { displayName }),
}

// --- Feature Flags ---
export const flagsApi = {
  getAll: () => api.get<Record<string, boolean>>('/flags/'),
  update: (key: string, value: boolean) => api.patch(`/flags/${key}`, { value }),
}

// --- User Management ---
export const usersApi = {
  getAll: () => api.get('/auth/users'),
  create: (data: any) => api.post('/auth/users', data),
  update: (id: number, data: any) => api.patch(`/auth/users/${id}`, data),
  delete: (id: number) => api.delete(`/auth/users/${id}`),
}

// --- Help Center (Tickets) ---
export const helpApi = {
  createTicket: (formData: FormData) => 
    api.post('/help/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getTickets: (workstation?: string) => 
    api.get('/help/tickets', { params: { workstation } }),
  getTicketDetails: (id: number) => 
    api.get(`/help/tickets/${id}`),
  reply: (id: number, formData: FormData) => 
    api.post(`/help/tickets/${id}/reply`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus: (id: number, status: string) => 
    api.patch(`/help/tickets/${id}/status`, { status }),
  getUnreadCount: (workstation?: string) =>
    api.get('/help/tickets/unread_count', { params: { workstation } }),
  deleteTicket: (id: number) => api.delete(`/help/tickets/${id}`)
}
// --- Telemetry (Heartbeat) ---
export const telemetryApi = {
  heartbeat: (formData: FormData) => api.post('/telemetry/heartbeat', formData),
  getStatuses: () => api.get('/telemetry/status'),
  getStats: () => api.get('/telemetry/stats'),
  nudge: (computerName: string, latestVersion: string) => {
    const fd = new FormData();
    fd.append('computer_name', computerName);
    fd.append('latest_version', latestVersion);
    return api.post('/telemetry/nudge', fd);
  },
  wave: (fromComputer: string, toComputer: string) => {
    const fd = new FormData();
    fd.append('from_computer', fromComputer);
    fd.append('to_computer', toComputer);
    return api.post('/telemetry/wave', fd);
  },
  unlockAchievement: (computerName: string, achievement: string) => {
    const fd = new FormData();
    fd.append('computer_name', computerName);
    fd.append('achievement', achievement);
    return api.post('/telemetry/achievement', fd);
  },
  recordEvent: (computerName: string, eventType: 'ai_session' | 'broadcast' | 'help_ticket' | 'stopwatch') => {
    const fd = new FormData();
    fd.append('computer_name', computerName);
    fd.append('event_type', eventType);
    return api.post('/telemetry/event', fd);
  },
  saveEquippedSkin: (computerName: string, skinKey: string) => {
    const fd = new FormData();
    fd.append('computer_name', computerName);
    fd.append('skin_key', skinKey);
    return api.post('/telemetry/skin', fd);
  }
}

// --- Broadcast Messages ---
export const broadcastApi = {
  getActive: () => api.get('/broadcast/active'),
  list: () => api.get('/broadcast/'),
  create: (data: FormData) => api.post('/broadcast/', data),
  delete: (id: number) => api.delete(`/broadcast/${id}`),
  acknowledge: (id: number, workstation: string) => {
    const fd = new FormData();
    fd.append('workstation', workstation);
    return api.post(`/broadcast/${id}/acknowledge`, fd);
  },
  getAcks: (id: number) => api.get(`/broadcast/${id}/acks`)
}

// --- Quotations (Database-First) ---
export const quotationApi = {
  list: (params: { q?: string; designer?: string; limit?: number; offset?: number; trash_only?: boolean }) =>
    api.get<{ quotations: IQuotation[] }>('/quotations/', { params }),
  getSessions: () => 
    api.get<{ sessions: any[] }>('/quotations/sessions'),
  get: (id: number) => 
    api.get<any>(`/quotations/${id}`),
  create: (data: any) => 
    api.post<{ success: boolean; id: number }>('/quotations/', data),
  update: (id: number, data: any) => 
    api.patch(`/quotations/${id}`, data),
  delete: (id: number, workstation?: string, permanent?: boolean, computer_name?: string) => 
    api.delete(`/quotations/${id}`, { params: { workstation, permanent, computer_name } }),
  restore: (id: number) =>
    api.post<{ success: boolean }>(`/quotations/${id}/restore`),
  getHistory: (id: number) => 
    api.get<{ history: IQuotationHistory[] }>(`/quotations/${id}/history`),
  restoreHistory: (qId: number, hId: number) => 
    api.get<any>(`/quotations/${qId}/history/${hId}`),
  updateBilling: (id: number, data: Partial<IQuotation>) =>
    api.patch<{ success: boolean }>(`/quotations/${id}/billing`, data),
}

// --- Activity Logs ---
export const activityLogsApi = {
  list: (params: { limit?: number; offset?: number; username?: string; action?: string; search?: string }) =>
    api.get<{ logs: any[]; total: number }>('/activity-logs/', { params }),
}

// --- Custom Dictionaries ---
export const customDictionariesApi = {
  listPages: () => api.get<ICustomPage[]>('/custom-pages/'),
  createPage: (title: string) => api.post<ICustomPage>('/custom-pages/', { title }),
  deletePage: (id: number) => api.delete(`/custom-pages/${id}`),
  listMappings: (pageId: number, q?: string, limit: number = 50, offset: number = 0) =>
    api.get<ICustomMapping[]>(`/custom-pages/${pageId}/mappings/`, { params: { q, limit, offset } }),
  createMapping: (pageId: number, data: { englishName: string; japaneseName: string }) =>
    api.post<ICustomMapping>(`/custom-pages/${pageId}/mappings/`, data),
  updateMapping: (mappingId: number, data: { englishName: string; japaneseName: string }) =>
    api.patch<ICustomMapping>(`/custom-pages/mappings/${mappingId}`, data),
  deleteMapping: (mappingId: number) => api.delete(`/custom-pages/mappings/${mappingId}`),
}

// --- Machine Names ---
export const machinesApi = {
  search: async (q: string, limit: number = 50, offset: number = 0, signal?: AbortSignal) => {
    try {
      return await api.get<IMachineName[]>('/machines/', { params: { q, limit, offset }, signal })
    } catch (err) {
      const cachedStr = localStorage.getItem('kmti_cache_machines')
      if (cachedStr) {
        const all = JSON.parse(cachedStr)
        const term = q.toLowerCase().trim()
        const filtered = all.filter((m: any) =>
          m.machineCode.toLowerCase().includes(term) ||
          m.englishName.toLowerCase().includes(term) ||
          m.japaneseName.toLowerCase().includes(term)
        )
        return { data: filtered.slice(offset, offset + limit) }
      }
      throw err
    }
  },
  create: (data: { machineCode: string; englishName: string; japaneseName: string }) =>
    api.post<IMachineName>('/machines/', data),
  update: (id: number, data: { machineCode?: string; englishName?: string; japaneseName?: string }) =>
    api.patch<IMachineName>(`/machines/${id}`, data),
  delete: (id: number) => api.delete(`/machines/${id}`),
}


// --- Stopwatch Records ---
export const stopwatchApi = {
  list: (workstation?: string, user_name?: string, limit: number = 50) =>
    api.get<any[]>('/stopwatch/', { params: { workstation, user_name, limit } }),
  create: (data: { name: string; time: string; workstation?: string; user_name?: string }) =>
    api.post('/stopwatch/', data),
  update: (id: string, name: string) =>
    api.patch(`/stopwatch/${id}`, { name }),
  delete: (id: string) =>
    api.delete(`/stopwatch/${id}`),
}

// --- Librarian AI Assistant ---
export const librarianApi = {
  getSessions: () => api.get('/librarian/sessions'),
  createSession: (title?: string) => api.post('/librarian/sessions', { title }),
  deleteSession: (id: number) => api.delete(`/librarian/sessions/${id}`),
  getHistory: (sessionId?: number) => api.get('/librarian/history', { params: { session_id: sessionId } }),
  clearHistory: () => api.delete('/librarian/history'),
  submitFeedback: (data: { message_id: number; is_helpful: boolean; query: string; response: string }) => 
    api.post('/librarian/feedback', data),
}

// --- TTS (Kokoro-82M) ---
export const ttsApi = {
  getGenerateUrl: (text: string, voice: string = 'af_heart', speed: number = 1.0) => 
    `${API_BASE}/tts/generate?text=${encodeURIComponent(text)}&voice=${voice}&speed=${speed}`
}

// --- Work Schedule ---
export const scheduleApi = {
  getNotifications: () => api.get('/schedule/notifications').then(r => r.data),
  markNotificationsRead: () => api.post('/schedule/notifications/read').then(r => r.data),
  deleteNotification: (id: number) => api.delete(`/schedule/notifications/${id}`).then(r => r.data),
  deleteAllNotifications: () => api.delete('/schedule/notifications').then(r => r.data),
  sendManualNotification: (memberName: string, jobId: string, message: string) => 
    api.post('/schedule/notifications/manual', { member_name: memberName, job_id: jobId, message }).then(r => r.data),
  getPermissions: () => api.get('/schedule/permissions').then(r => r.data),
  getJobs: () => api.get('/schedule/jobs').then(r => r.data),
  getComponents: (jobId: string) => api.get(`/schedule/jobs/${jobId}/components`).then(r => r.data),
  updateComponentStatus: (componentId: number, status: string, submittedDate?: string | null) =>
    api.post(`/schedule/components/${componentId}/status`, { status, submitted_date: submittedDate }).then(r => r.data),
  createJob: (jobId: string, deadline?: string | null) =>
    api.post('/schedule/jobs', { job_id: jobId, deadline }).then(r => r.data),
  updateJob: (jobId: string, data: { job_id?: string; deadline?: string | null }) =>
    api.patch(`/schedule/jobs/${jobId}`, data).then(r => r.data),
  createComponent: (jobId: string, data: {
    unit_code: string;
    assembly_3d?: string;
    parts_3d?: string;
    assembly_2d?: string;
    parts_2d?: string;
    status?: string;
    submitted_date?: string | null;
  }) => api.post(`/schedule/jobs/${jobId}/components`, data).then(r => r.data),
  importFromExcel: () => api.post('/schedule/import').then(r => r.data),
  exportToExcel: (job_ids: string[], target_months: string[]) => api.post('/schedule/export', { job_ids, target_months }, { responseType: 'blob' }).then(r => r.data),
  getTimeline: () => api.get('/schedule/timeline').then(r => r.data),
  updateTimeline: (memberName: string, colIndex: number, value: string) => 
    api.post('/schedule/timeline', { member_name: memberName, col_index: colIndex, value }).then(r => r.data),
  updateTimelineSpan: (memberName: string, startCol: number, endCol: number, jobCode: string) =>
    api.post('/schedule/timeline/span', { member_name: memberName, start_col: startCol, end_col: endCol, job_code: jobCode }).then(r => r.data),
  deleteJob: (jobId: string) => api.delete(`/schedule/jobs/${jobId}`).then(r => r.data),
  deleteComponent: (componentId: number) => api.delete(`/schedule/components/${componentId}`).then(r => r.data),
  updateComponent: (componentId: number, data: {
    unit_code?: string;
    assembly_3d?: string;
    parts_3d?: string;
    assembly_2d?: string;
    parts_2d?: string;
    status?: string;
    submitted_date?: string | null;
    is_postponed?: boolean;
  }) => api.patch(`/schedule/components/${componentId}`, data).then(r => r.data),
  getMembers: () => api.get('/schedule/members').then(r => r.data),
  createMember: (name: string) => api.post('/schedule/members', { name }).then(r => r.data),
  renameMember: (oldName: string, newName: string) => api.put('/schedule/members', { old_name: oldName, new_name: newName }).then(r => r.data),
  deleteMember: (name: string) => api.delete(`/schedule/members/${encodeURIComponent(name)}`).then(r => r.data),
  getActiveUsers: () => api.get('/auth/users').then(r => r.data as Array<{ id: number; username: string; role: string; is_active: boolean }>),
}


// --- Production Resiliency Interceptor ---
// Automatically retry transient errors (503, 504) once before giving up.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    
    // Only retry if it's a transient server error and hasn't been retried yet
    const isTransientError = response && [503, 504].includes(response.status);
    const hasAlreadyRetried = config && config._retry;

    if (isTransientError && !hasAlreadyRetried) {
      config._retry = true;
      console.warn(`[API] Transient error ${response.status}. Retrying request...`, config.url);
      
      // Wait 1s before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
      return api(config);
    }

    return Promise.reject(error);
  }
);

// --- Preload Offline Cache ---
export async function preloadOfflineCache() {
  try {
    console.log('>>> [OFFLINE CACHE] Preloading reference tables in background...')
    const [chars, heat, materials, designers, clients, incharges, machines] = await Promise.all([
      api.get('/chars/', { params: { limit: 5000 } }).then(r => r.data).catch(() => null),
      api.get('/chars/heat-treatment', { params: { limit: 5000 } }).then(r => r.data).catch(() => null),
      api.get('/materials/', { params: { limit: 5000 } }).then(r => r.data).catch(() => null),
      api.get('/designers', { params: { limit: 5000 } }).then(r => r.data).catch(() => null),
      api.get('/clients', { params: { limit: 5000 } }).then(r => r.data).catch(() => null),
      api.get('/project-incharges', { params: { limit: 5000 } }).then(r => r.data).catch(() => null),
      api.get('/machines/', { params: { limit: 5000 } }).then(r => r.data).catch(() => null),
    ])

    if (chars) localStorage.setItem('kmti_cache_chars', JSON.stringify(chars))
    if (heat) localStorage.setItem('kmti_cache_heat_treatment', JSON.stringify(heat))
    if (materials) localStorage.setItem('kmti_cache_materials', JSON.stringify(materials))
    if (designers) localStorage.setItem('kmti_cache_designers', JSON.stringify(designers))
    if (clients) localStorage.setItem('kmti_cache_clients', JSON.stringify(clients))
    if (incharges) localStorage.setItem('kmti_cache_project_incharges', JSON.stringify(incharges))
    if (machines) localStorage.setItem('kmti_cache_machines', JSON.stringify(machines))
    console.log('>>> [OFFLINE CACHE] Reference tables preloaded successfully.')
  } catch (e) {
    console.warn('[OFFLINE CACHE] Preload failed:', e)
  }
}

export default api
